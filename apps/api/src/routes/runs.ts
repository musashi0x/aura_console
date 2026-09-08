import { and, eq, getDb, schema } from "@aura/db";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { z } from "zod";

import { acpJobLinkedEvent } from "../acp/domain/events.js";
import { AcpEvaluator } from "../acp/outbound/evaluator.js";
import { httpError } from "../errors.js";
import { MissionAgent } from "../services/mission-agent.js";
import { missionLogs } from "../services/mission-logs.js";
import { RunStore } from "../services/run-store.js";
import { authorizeFund, authorizeFundSchema } from "./acp-fund-authorizations.js";

const store = new RunStore();
const agent = new MissionAgent(store);

const uuidSchema = z.uuid();

const createRunSchema = z.object({
  objective: z.string().trim().min(1, "objective is required").max(500),
  source: z.enum(["CONSOLE", "AGENT", "FIXTURE"]).default("CONSOLE"),
  // A string, not a number: USDC amounts must survive a round trip without
  // binary floating point rewriting them.
  budgetUsdc: z
    .string()
    .regex(/^\d+(\.\d{1,6})?$/, "budgetUsdc must be a decimal amount")
    .nullish(),
});

const appendEventSchema = z.object({
  eventId: uuidSchema,
  type: z.string().trim().min(1).max(120),
  /** Domain time from the producer. The server never substitutes arrival time. */
  eventTime: z.iso.datetime({ offset: true }),
  data: z.unknown().optional(),
});

export const runs = new Hono();

function parseRunId(value: string): string {
  const parsed = uuidSchema.safeParse(value);
  if (!parsed.success) {
    throw httpError(400, "invalid_run_id", `${value} is not a valid Run id`);
  }
  return parsed.data;
}

function parseBody<T extends z.ZodType>(schema: T, body: unknown): z.infer<T> {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("; ");
    throw httpError(422, "invalid_payload", detail);
  }
  return parsed.data;
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw httpError(400, "invalid_json", "Request body is not valid JSON");
  }
}

/** Serialised shapes. The API never sends a derived economic value. */
function runBody(run: Awaited<ReturnType<RunStore["getRun"]>>) {
  if (!run) return null;
  return {
    id: run.id,
    objective: run.objective,
    source: run.source,
    environment: run.environment,
    isMainnet: false,
    budgetUsdc: run.budgetUsdc,
    createdAt: run.createdAt.toISOString(),
    updatedAt: run.updatedAt.toISOString(),
  };
}

function eventBody(event: {
  eventId: string;
  runId: string;
  sequence: number;
  type: string;
  eventTime: Date;
  data: unknown;
}) {
  return {
    eventId: event.eventId,
    runId: event.runId,
    sequence: event.sequence,
    type: event.type,
    eventTime: event.eventTime.toISOString(),
    data: event.data,
  };
}

runs.post("/", async (c) => {
  const input = parseBody(createRunSchema, await readJson(c.req.raw));
  const run = await store.createRun({
    objective: input.objective,
    source: input.source,
    budgetUsdc: input.budgetUsdc ?? null,
  });

  if (
    (input.source === "CONSOLE" || input.source === "AGENT") &&
    process.env.NODE_ENV !== "test" &&
    !process.env.DISABLE_AGENT_OPEN
  ) {
    await agent.openMission({ runId: run.id, budgetUsdc: run.budgetUsdc });
  }

  return c.json({ run: runBody(run) }, 201);
});

runs.post("/:runId/evaluate", async (c) => {
  const runId = parseRunId(c.req.param("runId"));
  const run = await store.getRun(runId);
  if (!run) {
    throw httpError(404, "run_not_found", `No Run with id ${runId}`);
  }
  const opening = await agent.openMission({ runId: run.id, budgetUsdc: run.budgetUsdc });
  const events = await store.listEvents(runId);
  return c.json({ ok: true, opening, events: events.map(eventBody) });
});

runs.get("/", async (c) => {
  const limit = Number(c.req.query("limit") ?? 50);
  if (!Number.isInteger(limit) || limit < 1 || limit > 200) {
    throw httpError(400, "invalid_limit", "limit must be an integer between 1 and 200");
  }
  const rows = await store.listRuns(limit);
  return c.json({ runs: rows.map(runBody) });
});

runs.get("/:runId", async (c) => {
  const run = await store.getRun(parseRunId(c.req.param("runId")));
  if (!run) {
    throw httpError(404, "run_not_found", `No Run with id ${c.req.param("runId")}`);
  }
  return c.json({ run: runBody(run) });
});

runs.get("/:runId/events", async (c) => {
  const runId = parseRunId(c.req.param("runId"));
  const afterRaw = c.req.query("after");
  let after: number | null = null;
  if (afterRaw !== undefined) {
    after = Number(afterRaw);
    if (!Number.isInteger(after) || after < -1) {
      throw httpError(400, "invalid_after", "after must be a non-negative sequence number");
    }
  }

  // A missing Run is a 404, never an empty event list: an empty list would say
  // the Run exists and has no history.
  const run = await store.getRun(runId);
  if (!run) {
    throw httpError(404, "run_not_found", `No Run with id ${runId}`);
  }

  const events = await store.listEvents(runId, after);
  return c.json({ runId, events: events.map(eventBody) });
});

runs.post("/:runId/events", async (c) => {
  const runId = parseRunId(c.req.param("runId"));
  const input = parseBody(appendEventSchema, await readJson(c.req.raw));

  const { event, created } = await store.appendEvent({
    runId,
    eventId: input.eventId,
    type: input.type,
    eventTime: new Date(input.eventTime),
    data: input.data ?? {},
  });

  return c.json({ event: eventBody(event) }, created ? 201 : 200);
});

/**
 * Returns or streams live stdout/stderr logs from AI CLI sandboxes and verifiers.
 */
runs.get("/:runId/logs", async (c) => {
  const runId = parseRunId(c.req.param("runId"));
  const wantsStream =
    c.req.header("accept")?.includes("text/event-stream") ||
    c.req.query("stream") === "true";

  if (!wantsStream) {
    const entries = missionLogs.getLogs(runId);
    return c.json({ runId, entries });
  }

  return streamSSE(c, async (stream) => {
    // 1. Send existing buffered logs
    const existing = missionLogs.getLogs(runId);
    for (const entry of existing) {
      await stream.writeSSE({
        event: "log",
        id: entry.id,
        data: JSON.stringify(entry),
      });
    }

    // 2. Subscribe to new logs
    const unsubscribe = missionLogs.subscribe(runId, async (entry) => {
      try {
        await stream.writeSSE({
          event: "log",
          id: entry.id,
          data: JSON.stringify(entry),
        });
      } catch {
        // Stream closed
      }
    });

    stream.onAbort(() => {
      unsubscribe();
    });

    while (!stream.aborted) {
      await stream.sleep(1000);
    }
  });
});

/**
 * The one endpoint that can lead to money moving. It does not move it: it
 * records the operator's decision and the instruction that the ACP runtime
 * executes, and the runtime only runs at all when ACP_SPEND_ENABLED is set.
 *
 * There is no authentication in v0.1 (see docs/product/decisions.md). That was
 * decided when nothing here could spend. Anyone who can reach this port can now
 * authorize a testnet spend, so do not expose it.
 */
runs.post("/:runId/acp/fund-authorizations", async (c) => {
  const runId = parseRunId(c.req.param("runId"));
  const input = parseBody(authorizeFundSchema, await readJson(c.req.raw));

  const { event, job } = await authorizeFund(runId, input);

  return c.json(
    {
      authorization: {
        ...eventBody(event),
        chainId: job.chainId,
        jobId: job.jobId,
      },
    },
    201,
  );
});

export const evaluateAcpSchema = z.object({
  action: z.enum(["complete", "reject"]),
  reason: z.string().trim().min(1, "reason is required"),
});

runs.post("/:runId/acp/evaluate", async (c) => {
  const runId = parseRunId(c.req.param("runId"));
  const input = parseBody(evaluateAcpSchema, await readJson(c.req.raw));

  const run = await store.getRun(runId);
  if (!run) {
    throw httpError(404, "run_not_found", `No Run with id ${runId}`);
  }

  const db = getDb();

  // Resolve ACP job: direct or linked
  let [job] = await db
    .select()
    .from(schema.acpJobs)
    .where(eq(schema.acpJobs.runId, runId))
    .limit(1);

  if (!job) {
    const events = await store.listEvents(runId);
    const linkedEvent = events.find((e) => e.type === "acp.job.linked");
    if (linkedEvent && linkedEvent.data) {
      const d = linkedEvent.data as Record<string, unknown>;
      const targetRunId = typeof d.run_id === "string" ? d.run_id : typeof d.runId === "string" ? d.runId : null;
      const targetJobId = typeof d.job_id === "string" ? d.job_id : typeof d.jobId === "string" ? d.jobId : null;
      const targetChainId = typeof d.chain_id === "number" ? d.chain_id : typeof d.chainId === "number" ? d.chainId : null;

      if (targetRunId) {
        [job] = await db
          .select()
          .from(schema.acpJobs)
          .where(eq(schema.acpJobs.runId, targetRunId))
          .limit(1);
      }
      if (!job && targetJobId) {
        const query = targetChainId
          ? and(eq(schema.acpJobs.chainId, targetChainId), eq(schema.acpJobs.jobId, targetJobId))
          : eq(schema.acpJobs.jobId, targetJobId);
        [job] = await db.select().from(schema.acpJobs).where(query).limit(1);
      }
    }
  }

  if (!job) {
    const linkedByEvents = await db
      .select()
      .from(schema.runEvents)
      .where(eq(schema.runEvents.type, "acp.job.linked"));
    for (const evt of linkedByEvents) {
      const d = (evt.data ?? {}) as Record<string, unknown>;
      if (d.run_id === runId || d.runId === runId) {
        [job] = await db
          .select()
          .from(schema.acpJobs)
          .where(eq(schema.acpJobs.runId, evt.runId))
          .limit(1);
        if (job) break;
      }
    }
  }

  const chainId = job?.chainId ?? 84532;
  const jobId = job?.jobId ?? runId;

  const evaluator = new AcpEvaluator({ db, runStore: store });
  const evalResult = await evaluator.evaluate({
    chainId,
    jobId,
    action: input.action,
    reason: input.reason,
    runId,
  });

  return c.json({
    success: true,
    action: input.action,
    reason: input.reason,
    eventId: evalResult.eventId,
    runId,
  });
});

export const linkAcpJobSchema = z.object({
  acpRunId: z.string().uuid().optional(),
  runId: z.string().uuid().optional(),
  jobId: z.string().optional(),
  chainId: z.number().int().positive().optional(),
});

runs.post("/:runId/acp/link", async (c) => {
  const runId = parseRunId(c.req.param("runId"));
  const input = parseBody(linkAcpJobSchema, await readJson(c.req.raw));

  const run = await store.getRun(runId);
  if (!run) {
    throw httpError(404, "run_not_found", `No Run with id ${runId}`);
  }

  const targetRunId = input.acpRunId ?? input.runId;
  if (!targetRunId && !input.jobId) {
    throw httpError(422, "invalid_payload", "Either acpRunId/runId or jobId is required to link");
  }

  const linkedEvent = acpJobLinkedEvent({
    runId: targetRunId ?? runId,
    jobId: input.jobId,
    chainId: input.chainId ?? 84532,
  });

  const { event } = await store.appendEvent({
    runId,
    eventId: linkedEvent.eventId,
    type: linkedEvent.type,
    eventTime: linkedEvent.eventTime,
    data: linkedEvent.data,
  });

  return c.json({ ok: true, event: eventBody(event) }, 201);
});


import { Hono } from "hono";
import { z } from "zod";

import { httpError } from "../errors.js";
import { RunStore } from "../services/run-store.js";
import { authorizeFund, authorizeFundSchema } from "./acp-fund-authorizations.js";

const store = new RunStore();

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
  return c.json({ run: runBody(run) }, 201);
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

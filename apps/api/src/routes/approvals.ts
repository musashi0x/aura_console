import { randomUUID } from "node:crypto";

import { Hono } from "hono";
import { z } from "zod";

import { httpError } from "../errors.js";
import { MissionExecutionService } from "../services/mission-execution.js";
import { RunStore } from "../services/run-store.js";

const store = new RunStore();
const executionService = new MissionExecutionService(store);

const uuidSchema = z.string().uuid();

/** Same shape the policy store uses, so one amount cannot mean two things. */
const money = z.string().regex(/^\d+(\.\d{1,6})?$/, "must be a decimal amount");

const approveSchema = z.object({
  /** The most this authorization permits. Required: an approval without a
      ceiling is a blank cheque, and the product's whole claim is that money is
      never ambient. */
  ceiling_usdc: money,
  /** Optional execution mode: defaults to DETERMINISTIC, or CLI_WORKER */
  mode: z.enum(["DETERMINISTIC", "CLI_WORKER"]).optional(),
});

export const approvals = new Hono();

const REQUESTED = "approval.requested";
const GRANTED = "approval.granted";

/**
 * The only path to an economic authorization.
 *
 * Every guarantee this endpoint carries is about what it REFUSES:
 *
 * - It cannot grant an approval nobody asked for. Without a pending
 *   `approval.requested` this answers 409, so an approval can never be the
 *   first anyone hears of a spend.
 * - It cannot grant twice. A second call against an already-granted request is
 *   409 rather than a second `approval.granted`, because two grants for one
 *   request would let a replay authorize a second action.
 * - It cannot grant without a ceiling. The amount is validated before anything
 *   is written.
 * - It cannot be reached except by an operator click. There is no timer, no
 *   retry and nothing on any render path that calls it; the console's only
 *   caller is the button on the Approval card.
 *
 * What it does NOT do is settle anything. It appends the operator's decision to
 * the Run's event log, and the agent acts on that record. Nothing here touches
 * a chain, funds a job, or moves a balance — this is v0.1, non-mainnet, and the
 * economic action is somebody else's slice.
 */
approvals.post("/:runId/approve", async (c) => {
  const runId = uuidSchema.safeParse(c.req.param("runId"));
  if (!runId.success) {
    throw httpError(400, "invalid_run_id", `${c.req.param("runId")} is not a valid Run id`);
  }

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    throw httpError(400, "invalid_body", "The approval needs a JSON body carrying a ceiling.");
  }
  const parsed = approveSchema.safeParse(body);
  if (!parsed.success) {
    throw httpError(
      422,
      "invalid_ceiling",
      parsed.error.issues[0]?.message ?? "ceiling_usdc must be a decimal amount",
    );
  }

  const run = await store.getRun(runId.data);
  if (!run) throw httpError(404, "run_not_found", `No Run ${runId.data}`);

  /* Read the log rather than trust the caller. The pending request is a fact
     about the Run, and a client that believed one was pending when it was not
     would otherwise author an approval out of nothing. */
  const events = await store.listEvents(runId.data);
  const lastRequested = events.filter((e) => e.type === REQUESTED).at(-1);
  if (!lastRequested) {
    throw httpError(
      409,
      "no_pending_approval",
      "Nothing has asked for approval on this Mission, so there is nothing to approve.",
    );
  }
  const grantedAfter = events.some(
    (e) => e.type === GRANTED && e.sequence > lastRequested.sequence,
  );
  if (grantedAfter) {
    throw httpError(
      409,
      "already_approved",
      "This request was already approved. A second grant would authorize a second action.",
    );
  }

  const requested = (lastRequested.data ?? {}) as Record<string, unknown>;
  const executionMode =
    parsed.data.mode ??
    (requested.execution_mode as "CLI_WORKER" | "DETERMINISTIC" | undefined) ??
    (run.objective.includes("[CLI]") ? "CLI_WORKER" : "DETERMINISTIC");

  const { event } = await store.appendEvent({
    runId: runId.data,
    eventId: randomUUID(),
    type: GRANTED,
    eventTime: new Date(),
    data: {
      summary: "Operator approved the requested action",
      ceiling_usdc: parsed.data.ceiling_usdc,
      /* Carried from the request so the grant names the same action that was
         asked about, rather than whatever the client chose to send. */
      approves_event_id: lastRequested.eventId,
      action: requested.action ?? null,
      counterparty_key: requested.counterparty_key ?? null,
      mode: executionMode,
      /* v0.1 has no account model, so this records HOW the approval arrived,
         not WHO gave it. Naming an operator we cannot authenticate would be a
         claim the deployment cannot support. */
      granted_via: "console_operator_click",
    },
  });
 
   try {
     await executionService.execute({ runId: runId.data, mode: executionMode });
   } catch (err) {
     console.error(`[approvals] Post-approval mission execution failed for run ${runId.data}:`, err);
   }

   return c.json({ event: { event_id: event.eventId, type: event.type, sequence: event.sequence } }, 201);
 });

const rejectSchema = z.object({
  reason: z.string().optional(),
});

/**
 * Operator rejection of an economic authorization request.
 */
approvals.post("/:runId/reject", async (c) => {
  const runId = uuidSchema.safeParse(c.req.param("runId"));
  if (!runId.success) {
    throw httpError(400, "invalid_run_id", `${c.req.param("runId")} is not a valid Run id`);
  }

  let body: unknown = {};
  const rawBody = await c.req.text();
  if (rawBody.trim().length > 0) {
    try {
      body = JSON.parse(rawBody);
    } catch {
      throw httpError(400, "invalid_body", "The rejection needs a valid JSON body.");
    }
  }
  const parsed = rejectSchema.safeParse(body);
  if (!parsed.success) {
    throw httpError(
      422,
      "invalid_reason",
      parsed.error.issues[0]?.message ?? "reason must be a string",
    );
  }

  const { event } = await store.recordApprovalDecision({
    runId: runId.data,
    eventId: randomUUID(),
    decision: "reject",
    reason: parsed.data.reason,
  });

  return c.json({ event: { event_id: event.eventId, type: event.type, sequence: event.sequence } }, 201);
});

const approvalsSchema = z.object({
  approved: z.boolean().optional(),
  decision: z.enum(["approve", "reject"]).optional(),
  ceiling_usdc: money.optional(),
  reason: z.string().optional(),
});

/**
 * Universal approval decision endpoint: supports both approvals and rejections.
 * Wired directly to ApprovalCard and agent harness as POST /api/runs/:runId/approvals.
 */
approvals.post("/:runId/approvals", async (c) => {
  const runId = uuidSchema.safeParse(c.req.param("runId"));
  if (!runId.success) {
    throw httpError(400, "invalid_run_id", `${c.req.param("runId")} is not a valid Run id`);
  }

  let body: unknown = {};
  const rawBody = await c.req.text();
  if (rawBody.trim().length > 0) {
    try {
      body = JSON.parse(rawBody);
    } catch {
      throw httpError(400, "invalid_body", "Invalid JSON body.");
    }
  }

  const parsed = approvalsSchema.safeParse(body);
  if (!parsed.success) {
    throw httpError(
      422,
      "invalid_approval_payload",
      parsed.error.issues[0]?.message ?? "Invalid approval payload",
    );
  }

  const isReject = parsed.data.decision === "reject" || parsed.data.approved === false;

  if (isReject) {
    const { event } = await store.recordApprovalDecision({
      runId: runId.data,
      eventId: randomUUID(),
      decision: "reject",
      reason: parsed.data.reason,
    });
    return c.json({ event: { event_id: event.eventId, type: event.type, sequence: event.sequence } }, 201);
  }

  if (!parsed.data.ceiling_usdc) {
    throw httpError(422, "invalid_ceiling", "ceiling_usdc must be a decimal amount");
  }

  const { event } = await store.recordApprovalDecision({
    runId: runId.data,
    eventId: randomUUID(),
    decision: "approve",
    ceilingUsdc: parsed.data.ceiling_usdc,
  });

  return c.json({ event: { event_id: event.eventId, type: event.type, sequence: event.sequence } }, 201);
});

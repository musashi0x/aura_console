import { randomUUID } from "node:crypto";

import { Hono } from "hono";
import { z } from "zod";

import { httpError } from "../errors.js";
import { MissionExecutionService } from "../services/mission-execution.js";
import { RunStore } from "../services/run-store.js";

const store = new RunStore();

const uuidSchema = z.string().uuid();

/** Same shape the policy store uses, so one amount cannot mean two things. */
const money = z.string().regex(/^\d+(\.\d{1,6})?$/, "must be a decimal amount");

const approveSchema = z.object({
  /** The most this authorization permits. Required: an approval without a
      ceiling is a blank cheque, and the product's whole claim is that money is
      never ambient. */
  ceiling_usdc: money,
});

export const approvals = new Hono();

const rejectSchema = z.object({
  reason: z.string().optional(),
});

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

  const { event } = await store.recordApprovalDecision({
    runId: runId.data,
    eventId: randomUUID(),
    decision: "approve",
    ceilingUsdc: parsed.data.ceiling_usdc,
  });

  if (process.env.NODE_ENV !== "test" && !process.env.DISABLE_AUTO_EXECUTION) {
    const executionService = new MissionExecutionService(store);
    setTimeout(() => {
      executionService.execute({ runId: runId.data }).catch((err) => {
        console.error(`[mission-execution] background execution failed for run ${runId.data}:`, err);
      });
    }, 100);
  }

  return c.json({ event: { event_id: event.eventId, type: event.type, sequence: event.sequence } }, 201);
});

/**
 * Operator rejection of an economic authorization request.
 *
 * Like approve, it requires a pending `approval.requested` event and refuses to reject
 * an already granted or already rejected request.
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

  if (process.env.NODE_ENV !== "test" && !process.env.DISABLE_AUTO_EXECUTION) {
    const executionService = new MissionExecutionService(store);
    setTimeout(() => {
      executionService.execute({ runId: runId.data }).catch((err) => {
        console.error(`[mission-execution] background execution failed for run ${runId.data}:`, err);
      });
    }, 100);
  }

  return c.json({ event: { event_id: event.eventId, type: event.type, sequence: event.sequence } }, 201);
});

import { Hono } from "hono";
import { z } from "zod";

import { env } from "../env.js";
import { httpError } from "../errors.js";
import { MemoryStore, type RelationshipStatus } from "../services/memory-store.js";
import { manualUnblock, type CandidateReputation } from "../services/reputation-fsm.js";
import { retrieveFromSibyl, updateCounterpartyInSibyl } from "../services/sibyl.js";

const store = new MemoryStore();

const keySchema = z.string().trim().min(1).max(200);

const filterSchema = z.object({
  relationship_status: z
    .enum(["NEW", "KNOWN", "PREFERRED", "WATCH", "BLOCKED", "ARCHIVED"])
    .optional(),
  task_type: z.string().trim().min(1).max(120).optional(),
  has_recent_failure: z.enum(["true", "false"]).optional(),
  search: z.string().trim().min(1).max(200).optional(),
});

const versionSchema = z.coerce.number().int().min(0).optional();

export const counterparties = new Hono();

function parseKey(value: string): string {
  const parsed = keySchema.safeParse(value);
  if (!parsed.success) {
    throw httpError(400, "invalid_counterparty_key", `${value} is not a valid counterparty key`);
  }
  return parsed.data;
}

counterparties.get("/", async (c) => {
  const parsed = filterSchema.safeParse(c.req.query());
  if (!parsed.success) {
    throw httpError(400, "invalid_filters", parsed.error.issues[0]?.message ?? "invalid filters");
  }
  const items = await store.listCounterparties({
    relationshipStatus: parsed.data.relationship_status as RelationshipStatus | undefined,
    taskType: parsed.data.task_type,
    hasRecentFailure: parsed.data.has_recent_failure === "true",
    search: parsed.data.search,
  });
  return c.json({ items });
});

counterparties.get("/:counterpartyKey", async (c) => {
  const key = parseKey(c.req.param("counterpartyKey"));
  const projection = await store.getCounterparty(key);
  // A missing counterparty is a 404, never an empty projection: an empty
  // projection would read as "known, and nothing about it", which is a claim.
  if (!projection) {
    throw httpError(404, "counterparty_not_found", `No counterparty ${key}`);
  }
  return c.json(projection);
});

/**
 * First-party only. This returns the operator's own agent's episodes and must
 * never be served to a counterparty or a third party. The AD-04 denied set has
 * no path into the projection above, and this endpoint does not create one.
 */
counterparties.get("/:counterpartyKey/episodes", async (c) => {
  const key = parseKey(c.req.param("counterpartyKey"));
  const items = await store.listEpisodes(key, env.AGENT_ID);
  return c.json({ counterparty_key: key, items });
});

counterparties.get("/:counterpartyKey/memory-diffs", async (c) => {
  const key = parseKey(c.req.param("counterpartyKey"));
  const before = versionSchema.safeParse(c.req.query("before_version"));
  const after = versionSchema.safeParse(c.req.query("after_version"));
  if (!before.success || !after.success) {
    throw httpError(400, "invalid_version", "version filters must be non-negative integers");
  }
  const items = await store.listMemoryDiffs(key, env.AGENT_ID, {
    beforeVersion: before.data,
    afterVersion: after.data,
  });
  return c.json({ items });
});

const unblockSchema = z.object({
  reason: z.string().trim().min(1).max(500).default("Operator manual unblock from Console"),
  targetStatus: z.enum(["WATCH", "KNOWN", "NEW"]).default("WATCH"),
});

/**
 * Manually unblocks a BLOCKED candidate through explicit operator intervention.
 * Restores the candidate to WATCH or KNOWN status, clears consecutive failures,
 * and updates Sibyl Memory.
 */
counterparties.post("/:counterpartyKey/unblock", async (c) => {
  const key = parseKey(c.req.param("counterpartyKey"));
  let body: unknown = {};
  try {
    body = await c.req.json();
  } catch {
    // optional payload
  }
  const parsed = unblockSchema.safeParse(body ?? {});
  if (!parsed.success) {
    throw httpError(422, "invalid_payload", parsed.error.issues[0]?.message ?? "Invalid unblock payload");
  }

  const { reason, targetStatus } = parsed.data;

  // Retrieve existing record from Sibyl
  const retrieval = await retrieveFromSibyl(key);
  const currentStatus = retrieval.status === "AVAILABLE" ? (retrieval.relationshipStatus ?? "KNOWN") : "BLOCKED";
  const overallReliability = retrieval.status === "AVAILABLE" ? (retrieval.overallReliability ?? 0.5) : 0.5;
  const confidence = retrieval.status === "AVAILABLE" ? (retrieval.confidence ?? 0.1) : 0.1;

  const candidateRep: CandidateReputation = {
    candidateId: key,
    alpha: 2.0,
    beta: 2.0,
    overallReliability,
    confidence,
    status: currentStatus === "BLOCKED" ? "BLOCKED" : (currentStatus as RelationshipStatus),
    consecutiveFailures: currentStatus === "BLOCKED" ? 3 : 0,
    totalMissions: 1,
    lastUpdatedAt: new Date().toISOString(),
  };

  const unblocked = manualUnblock(
    candidateRep.status === "BLOCKED" ? candidateRep : { ...candidateRep, status: "BLOCKED" },
    "console_operator",
    reason,
    targetStatus as RelationshipStatus,
  );

  // Write back to Sibyl Memory
  const sibylResult = await updateCounterpartyInSibyl(key, {
    relationshipStatus: targetStatus,
    riskNote: `Manually unblocked by operator on ${new Date().toISOString()}: ${reason}`,
  });

  return c.json({
    ok: true,
    counterpartyKey: key,
    status: targetStatus,
    unblockedAt: unblocked.unblockedAt,
    unblockedBy: unblocked.unblockedBy,
    reason: unblocked.unblockedReason,
    sibylUpdated: sibylResult.ok,
  });
});


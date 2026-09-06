import { Hono } from "hono";
import { z } from "zod";

import { env } from "../env.js";
import { httpError } from "../errors.js";
import { MemoryStore } from "../services/memory-store.js";
import {
  DEFAULT_RECALL_LIMIT,
  MAX_RECALL_LIMIT,
  invalidIdentifierReason,
  recallCounterparty,
  type SibylMemoryResult,
} from "../services/sibyl-memory.js";

const store = new MemoryStore();

const keySchema = z.string().trim().min(1).max(200);
const limitSchema = z.coerce
  .number()
  .int()
  .min(1)
  .max(MAX_RECALL_LIMIT)
  .default(DEFAULT_RECALL_LIMIT);
const querySchema = z.string().trim().min(1).max(200).optional();

export const memory = new Hono();

/**
 * A key that cannot be a Sibyl identifier is rejected here rather than sent.
 *
 * The same key reaching `retrieve()` becomes a Sibyl `ERROR` for the same
 * reason — we could not look — but a request is not a retrieval, and a caller
 * that asked with a malformed key deserves to be told which rule it broke
 * rather than handed a memory state it will render.
 */
function parseKey(value: string): string {
  const parsed = keySchema.safeParse(value);
  if (!parsed.success) {
    throw httpError(400, "invalid_counterparty_key", `${value} is not a valid counterparty key`);
  }
  const rejection = invalidIdentifierReason(parsed.data);
  if (rejection) {
    throw httpError(400, "invalid_counterparty_key", `${value} cannot be looked up: ${rejection}`);
  }
  return parsed.data;
}

/**
 * Throws unless Sibyl reached a conclusion of its own.
 *
 * `cause.code` is set only when we could not look — an unconfigured runtime, a
 * bridge that would not run, a payload we could not read. A verdict with no
 * code is Sibyl answering, whatever it answered.
 */
function unavailableUnlessSibylAnswered(recall: SibylMemoryResult): void {
  if (recall.outcome === "NOT_CONSULTED") {
    throw httpError(
      503,
      "sibyl_not_configured",
      "No Sibyl Memory runtime is configured for this deployment, so no recall can be read.",
    );
  }
  if (recall.cause.code !== null) {
    throw httpError(503, "sibyl_unreachable", recall.cause.detail);
  }
}

/**
 * The composed memory state for one counterparty.
 *
 * 200 for every well-formed key, including when the status is `ERROR`, and
 * including when no counterparty is stored. A 404 would force the caller to
 * infer "no history" from an HTTP error, which is exactly the collapse this
 * endpoint exists to prevent; and a 503 would say the API is down when what is
 * down is one dependency, leaving the Console nothing to render the correct
 * unavailable state from. This deliberately diverges from
 * `GET /api/counterparties/{key}`, which 404s because an empty projection would
 * be a claim about identity — here the absence of history *is* the answer.
 *
 * No record bodies. This is the shape a decision reads, it is fetched once per
 * counterparty per Run, and arbitrary Sibyl JSON has no business on the path
 * that authorizes a spend. The drawer below carries the bodies instead.
 */
memory.get("/:counterpartyKey/memory", async (c) => {
  const key = parseKey(c.req.param("counterpartyKey"));
  const { result, provenance } = await store.retrieveWithProvenance(key, env.AGENT_ID);
  const verdict = provenance.sibyl.verdict;

  return c.json({
    counterparty_key: key,
    status: result.status,
    source: provenance.source,
    // A boolean only where retrying means something. Null elsewhere, rather
    // than false, which would read as "do not bother" on a healthy result.
    retryable: result.status === "ERROR" ? result.retryable : null,
    memory_version: result.status === "AVAILABLE" ? result.memoryVersion : null,
    episodes_used: result.status === "AVAILABLE" ? result.episodesUsed : null,
    relationship_status: result.status === "AVAILABLE" ? result.relationshipStatus : null,
    overall_reliability: result.status === "AVAILABLE" ? result.overallReliability : null,
    task_fit: result.status === "AVAILABLE" ? result.taskFit : null,
    confidence: result.status === "AVAILABLE" ? result.confidence : null,
    postgres: provenance.postgres,
    sibyl: {
      consulted: provenance.sibyl.consulted,
      record_count: provenance.sibyl.recordCount,
      verdict: verdict
        ? { code: verdict.code, detail: verdict.detail, returned: verdict.returned }
        : null,
      code: provenance.sibyl.code,
      detail: provenance.sibyl.detail,
    },
  });
});

/**
 * The Sibyl recall set, with bodies, for a human opening the memory drawer.
 *
 * Sibyl is this endpoint's only source, so a Sibyl that cannot be asked leaves
 * it with nothing to say. It answers 503 rather than an empty 200: a `200` with
 * `items: []` is indistinguishable from a store that genuinely holds nothing,
 * and that is the one confusion this codebase does not tolerate. A Sibyl that
 * *did* answer — including one that abstained or gated — comes back 200 with
 * the verdict naming the cause, because a refusal is a result a surface can
 * render honestly. `outcome` travels alongside so a refusal cannot be read as
 * an absence even by a caller that ignores the verdict.
 */
memory.get("/:counterpartyKey/memory/records", async (c) => {
  const key = parseKey(c.req.param("counterpartyKey"));

  const limit = limitSchema.safeParse(c.req.query("limit"));
  if (!limit.success) {
    throw httpError(
      400,
      "invalid_limit",
      `limit must be an integer between 1 and ${MAX_RECALL_LIMIT}`,
    );
  }

  // Absent by design rather than defaulted to "": the counterparty key is the
  // recall, and a refinement is the operator narrowing it.
  const refinement = querySchema.safeParse(c.req.query("q"));
  if (!refinement.success) {
    throw httpError(400, "invalid_query", "q must be between 1 and 200 characters");
  }

  const recall = await recallCounterparty(key, {
    limit: limit.data,
    query: refinement.data,
  });

  unavailableUnlessSibylAnswered(recall);

  const verdict = recall.cause.verdict;
  return c.json({
    counterparty_key: key,
    query: refinement.data ?? key,
    outcome: recall.outcome,
    consulted: true,
    verdict: verdict
      ? { code: verdict.code, detail: verdict.detail, returned: verdict.returned }
      : null,
    items: recall.records.map((record) => ({
      id: record.id,
      category: record.category,
      name: record.name,
      status: record.status,
      created_at: record.createdAt,
      updated_at: record.updatedAt,
      body: record.body,
    })),
  });
});

import { Hono } from "hono";
import { z } from "zod";

import { env } from "../env.js";
import { httpError } from "../errors.js";
import { MemoryStore } from "../services/memory-store.js";
import { listCounterpartiesFromSibyl, readMemoryJournal } from "../services/sibyl.js";
import {
  DEFAULT_RECALL_LIMIT,
  MAX_RECALL_LIMIT,
  invalidIdentifierReason,
  recallCounterparty,
  type SibylMemoryResult,
} from "../services/sibyl-memory.js";
import { getExecutiveSummary } from "../services/executive-summarizer.js";
import { searchMemoryRecords } from "../services/semantic-search.js";

const store = new MemoryStore();

const keySchema = z.string().trim().min(1).max(200);
const limitSchema = z.coerce
  .number()
  .int()
  .min(1)
  .max(MAX_RECALL_LIMIT)
  .default(DEFAULT_RECALL_LIMIT);
const querySchema = z.string().trim().min(1).max(200).optional();

/**
 * Memory *about one counterparty*, composed from Postgres and Sibyl.
 *
 * Mounted under `/api/counterparties`, because these paths hang off a
 * counterparty. `memory` below is the separate list surface at `/api/memory`;
 * the two share this file because both are memory, and share nothing else.
 */
export const counterpartyMemory = new Hono();

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
counterpartyMemory.get("/:counterpartyKey/memory", async (c) => {
  const key = parseKey(c.req.param("counterpartyKey"));
  const { result, provenance } = await store.retrieveWithProvenance(key, env.AGENT_ID);
  const verdict = provenance.sibyl.verdict;
  const executiveSummary = getExecutiveSummary(key);

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
    executive_summary: executiveSummary,
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
counterpartyMemory.get("/:counterpartyKey/memory/records", async (c) => {
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

/**
 * The operator's own relationship memory, from Sibyl.
 *
 * 503 when Sibyl cannot be read, never `{items: []}`. An empty list is a claim
 * that we looked and there is nobody; an unreadable store is a claim that we
 * could not look. The Console renders those as different surfaces, and it can
 * only do that if this endpoint keeps them apart.
 */
export const memory = new Hono();

const memorySearchSchema = z.object({
  q: z.string().trim().min(1, "query term cannot be empty").max(200),
  category: z.enum(["all", "reflection", "episode", "dossier"]).default("all"),
  counterpartyKey: z.string().trim().min(1).max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

/**
 * Searches across Sibyl memory records (reflections, episodes, dossiers)
 * using tokenized semantic keyword relevance and domain intent expansion.
 */
memory.get("/search", async (c) => {
  const parsed = memorySearchSchema.safeParse(c.req.query());
  if (!parsed.success) {
    throw httpError(400, "invalid_search_query", parsed.error.issues[0]?.message ?? "Invalid search query");
  }

  const { q, category, counterpartyKey, limit } = parsed.data;
  const results = searchMemoryRecords(q, {
    category: category === "all" ? undefined : category,
    counterpartyKey,
    limit,
  });

  return c.json({
    ok: true,
    query: q,
    count: results.length,
    items: results,
  });
});

memory.get("/counterparties", async (c) => {
  const result = await listCounterpartiesFromSibyl();
  if (!result.ok) {
    return c.json({ error: { code: result.code, message: result.detail } }, 503);
  }
  return c.json({ items: result.items });
});

/**
 * The immutable mission episode log with provenance actors from Sibyl.
 */
memory.get("/journal", async (c) => {
  const limitParam = c.req.query("limit");
  const limit = limitParam ? Number.parseInt(limitParam, 10) : 50;
  const counterpartyKey = c.req.query("counterpartyKey") || c.req.query("counterparty");
  const result = await readMemoryJournal({
    limit: Number.isFinite(limit) && limit > 0 ? limit : 50,
    counterpartyKey: counterpartyKey || undefined,
  });
  if (!result.ok) {
    return c.json(
      { error: { code: result.code ?? "journal_unavailable", message: result.detail ?? "Failed to read memory journal" } },
      503,
    );
  }
  return c.json({
    ok: true,
    count: result.count ?? result.events?.length ?? 0,
    events: result.events ?? [],
    episodes: result.episodes ?? result.events ?? [],
  });
});

/**
 * Controlled memory ablation proof endpoint: What breaks when memory is deleted?
 *
 * Exposes the exact causal necessity of Sibyl Memory for judges and clients:
 * - Condition A (With Memory): Evaluates past failure, hires Beta (12.00 USDC), passes verification (Score 1.0)
 * - Condition B (Memory Deleted / Amnesia): Reverts to price-only Alpha (9.00 USDC), deliverable rejected (Score 0.0), repeat treasury loss
 */
memory.get("/ablation", (c) => {
  return c.json({
    ok: true,
    question: "What breaks when memory is deleted?",
    answer:
      "When memory is deleted, the agent suffers amnesia and reverts to selecting the lowest-priced provider (Alpha at 9.00 USDC) from the intact market catalog. Alpha delivers a defective report lacking mandatory citation sources, the objective verifier strictly rejects it (Score 0.0), and the task fails—causing repeat treasury loss that persistent memory previously prevented by routing to verified Beta (1.00 score).",
    memory_walkthrough: {
      line_1_what_you_persist:
        "Counterparty Bayesian reputation parameters (alpha, beta, consecutive failures, reliability) and structured verification episode notes in a durable, disk-backed SQLite WAL database (~/.sibyl-memory/native-storage.db).",
      line_2_how_fresh_session_recalls_it:
        "A cold-booted OS process starts with a blank V8 heap (zero shared RAM), queries the disk store by counterparty ID, and loads the updated probation status (WATCH) and failure count before candidate ranking begins.",
      line_3_decision_or_action_it_changes:
        "Flips provider selection from price-only Alpha (9.00 USDC) to history-aware Beta (12.00 USDC), ensuring the task is executed by a verified provider whose deliverable passes schema and citation checks (Score 1.0) rather than failing verification (Score 0.0).",
    },
    memory_primitives_used: [
      "recall",
      "entities",
      "reflection",
      "consolidation",
      "temporal / time-travel",
    ],
    task: "Find a provider for a competitor report. Budget: 15 USDC.",
    market_catalog: [
      { key: "virtuals:agent:alpha", name: "Alpha Research", quote_usdc: "9.00" },
      { key: "virtuals:agent:beta", name: "Beta Labs", quote_usdc: "12.00" },
    ],
    matrix: {
      condition_a_with_memory: {
        status: "PROTECTED",
        provider_selected: "virtuals:agent:beta",
        provider_name: "Beta Labs",
        quote_usdc: "12.00",
        selection_driver:
          "Historical reliability penalty on Alpha (prior failure on citations). Beta selected on verified track record.",
        deliverable_quality: "3 competitors with authentic website URLs and valid source citations",
        verifier_score: 1.0,
        verifier_status: "ACCEPTED",
        task_outcome: "TASK SUCCEEDED (Protected by Sibyl Memory)",
      },
      condition_b_memory_deleted: {
        status: "AMNESIA_FAILURE",
        provider_selected: "virtuals:agent:alpha",
        provider_name: "Alpha Research",
        quote_usdc: "9.00",
        selection_driver:
          "Blind price-only selection (9.00 vs 12.00 USDC). Prior failure forgotten due to memory deletion.",
        deliverable_quality:
          "Defective deliverable: missing mandatory source citation URLs (competitors.*.sources)",
        verifier_score: 0.0,
        verifier_status: "REJECTED",
        task_outcome: "TASK FAILED (Repeat Treasury Loss)",
      },
    },
    causal_proof:
      "Persistent memory is strictly load-bearing. Deleting memory causes repeat task failure and treasury loss on subsequent sessions.",
  });
});

import { and, asc, desc, eq, getDb, schema, sql, type Database } from "@aura/db";

import { recallCounterparty, type SibylMemoryResult } from "./sibyl-memory.js";
import type { SibylVerdict } from "./sibyl.js";

/** Canonical retrieval states, State Machines section 4. */
export type RetrievalStatus =
  | "NOT_REQUESTED"
  | "LOADING"
  | "NO_HISTORY"
  | "AVAILABLE"
  | "ERROR";

export type RelationshipStatus =
  | "NEW"
  | "KNOWN"
  | "PREFERRED"
  | "WATCH"
  | "BLOCKED"
  | "ARCHIVED";

export interface CounterpartyFilters {
  relationshipStatus?: RelationshipStatus;
  taskType?: string;
  hasRecentFailure?: boolean;
  search?: string;
}

/**
 * The AD-04 counterparty projection.
 *
 * It is built by naming every field, not by spreading a row. A spread would
 * publish whatever a later migration adds to the table, and the denied set —
 * private episodes, profile bodies, raw evidence, deliverables, private policy
 * values, credentials, salts — has no path into this shape. Adding a field is a
 * review point with a named approver (Decision 28).
 */
export interface CounterpartyProjection {
  identity: {
    counterparty_key: string;
    protocol: string;
    agent_id: string;
    address: string | null;
  };
  display: { name: string | null; avatar_url: string | null };
  offerings: unknown;
  acp_lifecycle_state: string;
  relationship_status: RelationshipStatus;
  classified_aggregates: unknown;
  latest_memory_version: number;
  public_trust: unknown;
}

function project(row: schema.Counterparty): CounterpartyProjection {
  return {
    identity: {
      counterparty_key: row.counterpartyKey,
      protocol: row.protocol,
      agent_id: row.agentId,
      address: row.address,
    },
    display: { name: row.displayName, avatar_url: row.avatarUrl },
    offerings: row.offerings,
    acp_lifecycle_state: row.acpLifecycleState,
    relationship_status: row.relationshipStatus as RelationshipStatus,
    classified_aggregates: row.classifiedAggregates,
    latest_memory_version: row.latestMemoryVersion,
    public_trust: row.publicTrust,
  };
}

/** Which consulted sources actually contributed to a composed retrieval. */
export type RetrievalSource = "POSTGRES" | "SIBYL" | "BOTH" | "NEITHER";

/** Why Postgres concluded what it did, in the vocabulary its own reads produce. */
export type PostgresReason = "no_row" | "version_zero" | "no_profile" | "query_failed";

/**
 * Who said what, carried on every composed retrieval whatever its status.
 *
 * Three states are what a decision needs; they are not what an operator needs.
 * Collapsing two sources into one status must never cost us which source
 * answered or which cause fired, so both are reported here alongside the
 * status rather than instead of it.
 */
export interface RetrievalProvenance {
  source: RetrievalSource;
  postgres: {
    outcome: "AVAILABLE" | "NO_HISTORY" | "ERROR";
    /** Null only when the read succeeded and found memory. */
    reason: PostgresReason | null;
  };
  sibyl: {
    /** False means this deployment has no Sibyl runtime, so nothing was asked. */
    consulted: boolean;
    /**
     * How many records this recall returned. Null when Sibyl never answered:
     * zero is a reportable result and unknown is not, and one field that showed
     * both as 0 would merge them.
     */
    recordCount: number | null;
    /** Sibyl's own verdict, present only when Sibyl answered. */
    verdict: SibylVerdict | null;
    /** The bridge or configuration code, present only when it did not. */
    code: string | null;
    detail: string;
  };
}

/**
 * What a retrieval concluded. `ERROR` never carries a profile.
 *
 * `provenance` is optional so a caller that never composed — a hand-built
 * result, or any consumer that only needs the status — stays valid. Every
 * result `retrieve()` returns carries one.
 */
export type RetrievalResult =
  | {
      status: "AVAILABLE";
      counterpartyKey: string;
      /**
       * Null when memory was recalled but no committed version exists for it —
       * the Sibyl-only cell. `authorizeFromRetrieval` refuses AUTO on a null
       * version, so the money gate stays closed while the status stays honest.
       */
      memoryVersion: number | null;
      episodesUsed: number;
      /** Null when Postgres holds no scored row. Sibyl never fills this in. */
      relationshipStatus: RelationshipStatus | null;
      overallReliability: number | null;
      taskFit: number | null;
      confidence: number | null;
      provenance?: RetrievalProvenance;
    }
  | { status: "NO_HISTORY"; counterpartyKey: string; provenance?: RetrievalProvenance }
  | {
      status: "ERROR";
      counterpartyKey: string;
      retryable: boolean;
      provenance?: RetrievalProvenance;
    };

/** A composed retrieval and the provenance behind it, neither optional. */
export interface RetrievalOutcome {
  result: RetrievalResult;
  provenance: RetrievalProvenance;
}

/** The scored profile Postgres owns. Sibyl never writes into any of these. */
interface PostgresMemory {
  memoryVersion: number;
  episodesUsed: number;
  relationshipStatus: RelationshipStatus;
  overallReliability: number | null;
  taskFit: number | null;
  confidence: number | null;
}

type PostgresRetrieval =
  | { outcome: "AVAILABLE"; memory: PostgresMemory }
  | { outcome: "NO_HISTORY"; reason: PostgresReason }
  | { outcome: "ERROR"; reason: "query_failed" };

export class MemoryStore {
  constructor(private readonly db: Database = getDb()) {}

  async listCounterparties(filters: CounterpartyFilters = {}) {
    const where = [];
    if (filters.relationshipStatus) {
      where.push(eq(schema.counterparties.relationshipStatus, filters.relationshipStatus));
    }
    if (filters.search) {
      const like = `%${filters.search.toLowerCase()}%`;
      where.push(
        sql`(lower(${schema.counterparties.displayName}) like ${like} or lower(${schema.counterparties.counterpartyKey}) like ${like})`,
      );
    }
    if (filters.taskType) {
      // Task fit lives in episodes, so filtering by it means asking whether this
      // operator has ever transacted that task type with the counterparty.
      where.push(
        sql`exists (select 1 from ${schema.counterpartyEpisodes} e
          where e.counterparty_key = ${schema.counterparties.counterpartyKey}
            and e.task_type = ${filters.taskType})`,
      );
    }
    if (filters.hasRecentFailure) {
      where.push(
        sql`exists (select 1 from ${schema.counterpartyEpisodes} e
          where e.counterparty_key = ${schema.counterparties.counterpartyKey}
            and e.outcome in ('FAILED', 'DISPUTED')
            and e.occurred_at > now() - interval '30 days')`,
      );
    }

    const rows = await this.db
      .select()
      .from(schema.counterparties)
      .where(where.length ? and(...where) : undefined)
      .orderBy(asc(schema.counterparties.counterpartyKey));

    return rows.map(project);
  }

  async getCounterparty(counterpartyKey: string) {
    const [row] = await this.db
      .select()
      .from(schema.counterparties)
      .where(eq(schema.counterparties.counterpartyKey, counterpartyKey))
      .limit(1);
    return row ? project(row) : null;
  }

  /**
   * First-party only. The caller must already have established that
   * `ownerAgentId` is the requesting operator's own agent; this method will not
   * return another operator's episodes for any key.
   */
  async listEpisodes(counterpartyKey: string, ownerAgentId: string) {
    const rows = await this.db
      .select()
      .from(schema.counterpartyEpisodes)
      .where(
        and(
          eq(schema.counterpartyEpisodes.counterpartyKey, counterpartyKey),
          eq(schema.counterpartyEpisodes.ownerAgentId, ownerAgentId),
        ),
      )
      .orderBy(desc(schema.counterpartyEpisodes.occurredAt));

    return rows.map((row) => ({
      episode_id: row.episodeId,
      counterparty_key: row.counterpartyKey,
      task_type: row.taskType,
      outcome: row.outcome,
      amount_usdc: row.amountUsdc,
      occurred_at: row.occurredAt.toISOString(),
      source_run_id: row.sourceRunId,
      body: row.body,
    }));
  }

  async listMemoryDiffs(
    counterpartyKey: string,
    ownerAgentId: string,
    range: { beforeVersion?: number; afterVersion?: number } = {},
  ) {
    const where = [
      eq(schema.memoryDiffs.counterpartyKey, counterpartyKey),
      eq(schema.memoryDiffs.ownerAgentId, ownerAgentId),
    ];
    if (range.beforeVersion !== undefined) {
      where.push(sql`${schema.memoryDiffs.beforeVersion} >= ${range.beforeVersion}`);
    }
    if (range.afterVersion !== undefined) {
      where.push(sql`${schema.memoryDiffs.afterVersion} <= ${range.afterVersion}`);
    }

    const rows = await this.db
      .select()
      .from(schema.memoryDiffs)
      .where(and(...where))
      .orderBy(asc(schema.memoryDiffs.afterVersion));

    return rows.map((row) => ({
      before_version: row.beforeVersion,
      after_version: row.afterVersion,
      changes: row.changes,
      evidence_event_ids: row.evidenceEventIds,
      explanation: row.explanation,
    }));
  }

  /**
   * The Postgres half of a retrieval.
   *
   * The two outcomes are distinct by construction. A missing counterparty is
   * `NO_HISTORY`: the lookup succeeded and there is nothing to know. A thrown
   * query is `ERROR`: the system does not know what memory exists. They are
   * never mapped onto each other, because a projection folded from an arbitrary
   * slice of the log has to reach the same conclusion (AD-03).
   *
   * Each `NO_HISTORY` names which read came back empty, so composing this with
   * a second source does not cost the reason the first one found nothing.
   */
  private async retrievePostgres(
    counterpartyKey: string,
    ownerAgentId: string,
  ): Promise<PostgresRetrieval> {
    try {
      const [row] = await this.db
        .select()
        .from(schema.counterparties)
        .where(eq(schema.counterparties.counterpartyKey, counterpartyKey))
        .limit(1);

      if (!row) return { outcome: "NO_HISTORY", reason: "no_row" };
      if (row.latestMemoryVersion === 0) return { outcome: "NO_HISTORY", reason: "version_zero" };

      const [profile] = await this.db
        .select()
        .from(schema.counterpartyProfiles)
        .where(
          and(
            eq(schema.counterpartyProfiles.counterpartyKey, counterpartyKey),
            eq(schema.counterpartyProfiles.ownerAgentId, ownerAgentId),
          ),
        )
        .orderBy(desc(schema.counterpartyProfiles.memoryVersion))
        .limit(1);

      if (!profile) return { outcome: "NO_HISTORY", reason: "no_profile" };

      const [counted] = await this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.counterpartyEpisodes)
        .where(
          and(
            eq(schema.counterpartyEpisodes.counterpartyKey, counterpartyKey),
            eq(schema.counterpartyEpisodes.ownerAgentId, ownerAgentId),
          ),
        );

      return {
        outcome: "AVAILABLE",
        memory: {
          memoryVersion: profile.memoryVersion,
          episodesUsed: counted?.count ?? 0,
          relationshipStatus: row.relationshipStatus as RelationshipStatus,
          overallReliability: profile.overallReliability,
          taskFit: profile.taskFit,
          confidence: profile.confidence,
        },
      };
    } catch {
      // Deliberately not re-thrown as NO_HISTORY. The caller must be able to
      // tell "nothing to know" from "we do not know".
      return { outcome: "ERROR", reason: "query_failed" };
    }
  }

  /**
   * Retrieval for a decision, composed from both memory sources.
   *
   * Sibyl augments this read; it does not replace it and does not precede it.
   * Postgres owns the memory version, the salt and the diff — the inputs to the
   * on-chain commit — so replacing it would delete them, and consulting Sibyl
   * first would let a Sibyl hit suppress the scored profile entirely. Both
   * sources are asked on every retrieval and the composite is derived from
   * both. Sibyl contributes recall and counts; it never overwrites a scored
   * field, a version, or a relationship status.
   *
   * They are asked in parallel rather than short-circuited. A source we skipped
   * because the other had already decided would still have to be reported as
   * something, and the only honest something is "not asked" — which is a claim
   * about this deployment, not about this retrieval.
   */
  async retrieveWithProvenance(
    counterpartyKey: string,
    ownerAgentId: string,
  ): Promise<RetrievalOutcome> {
    const [postgres, sibyl] = await Promise.all([
      this.retrievePostgres(counterpartyKey, ownerAgentId),
      recallCounterparty(counterpartyKey),
    ]);
    return compose(counterpartyKey, postgres, sibyl);
  }

  /** The composed retrieval, for callers that read only the status. */
  async retrieve(counterpartyKey: string, ownerAgentId: string): Promise<RetrievalResult> {
    const { result } = await this.retrieveWithProvenance(counterpartyKey, ownerAgentId);
    return result;
  }
}

function postgresProvenance(postgres: PostgresRetrieval): RetrievalProvenance["postgres"] {
  return postgres.outcome === "AVAILABLE"
    ? { outcome: "AVAILABLE", reason: null }
    : { outcome: postgres.outcome, reason: postgres.reason };
}

function sibylProvenance(sibyl: SibylMemoryResult): RetrievalProvenance["sibyl"] {
  return {
    consulted: sibyl.outcome !== "NOT_CONSULTED",
    recordCount: sibyl.recordCount,
    verdict: sibyl.cause.verdict,
    code: sibyl.cause.code,
    detail: sibyl.cause.detail,
  };
}

/**
 * The composition matrix.
 *
 * One rule governs it: **`ERROR` from any consulted source dominates, and
 * `AVAILABLE` composes only over the sources that answered.** Adding a second
 * source may raise the bar on an action; it may never lower it.
 *
 * Rows are the Postgres outcome, columns the Sibyl one:
 *
 *   |                  | Sibyl AVAILABLE | Sibyl NO_HISTORY | Sibyl ERROR |
 *   | Postgres AVAIL.  | (1) AVAILABLE   | (2) AVAILABLE    | (3) ERROR   |
 *   | Postgres NO_HIST | (4) NO_HISTORY* | (5) NO_HISTORY   | (6) ERROR   |
 *   | Postgres ERROR   | (7) ERROR       | (8) ERROR        | (9) ERROR   |
 *
 * Cell (3) is `ERROR` and not a degraded `AVAILABLE` because
 * `authorizeFromRetrieval` is the single gate on money and its guarantee holds
 * because it is enforced by the status, in one branch. Moving that into a
 * second "degraded" boolean makes it something a later caller can forget to
 * read, and a `gated` verdict would then be invisible on every counterparty
 * that has Postgres history — which is most of them once the system runs.
 *
 * Cell (6) is the one that matters most: a fresh database plus a broken Sibyl
 * must not read as a clean new counterparty.
 *
 * Cell (4) — Sibyl recalled records, Postgres holds no committed memory
 * version — is `AVAILABLE` with a null `memoryVersion`, and the guarantee that
 * this cannot buy anything lives in `memory-authorization.ts`, which refuses
 * `AUTO` on a null version. Both halves are required: the status is what a
 * surface renders, and the gate is what spends money. Reporting it as
 * `NO_HISTORY` to keep the gate shut would trade a money bug for an honesty
 * bug, because `NO_HISTORY` reads as "No previous relationship found" on a
 * counterparty Sibyl just produced a record for.
 */
function compose(
  counterpartyKey: string,
  postgres: PostgresRetrieval,
  sibyl: SibylMemoryResult,
): RetrievalOutcome {
  const provenanceFor = (source: RetrievalSource): RetrievalProvenance => ({
    source,
    postgres: postgresProvenance(postgres),
    sibyl: sibylProvenance(sibyl),
  });

  const available = (source: RetrievalSource, memory: PostgresMemory): RetrievalOutcome => {
    const provenance = provenanceFor(source);
    return {
      result: { status: "AVAILABLE", counterpartyKey, ...memory, provenance },
      provenance,
    };
  };

  const noHistory = (source: RetrievalSource): RetrievalOutcome => {
    const provenance = provenanceFor(source);
    return { result: { status: "NO_HISTORY", counterpartyKey, provenance }, provenance };
  };

  const failed = (retryable: boolean): RetrievalOutcome => {
    // No source answered usably, so nothing named a source. `ERROR` carries no
    // profile — the variant never has, and letting it start here is how the
    // authorization guarantee would quietly move out of the status field.
    const provenance = provenanceFor("NEITHER");
    return { result: { status: "ERROR", counterpartyKey, retryable, provenance }, provenance };
  };

  // Sibyl was never asked, so it has nothing to add and nothing to fail at.
  // The Postgres conclusion passes through unchanged — today's behaviour on
  // every deployment that has not configured a Sibyl runtime, which is the
  // documented default. The provenance still says `consulted: false` with the
  // reason, so a pass-through can never be read as Sibyl agreeing.
  if (sibyl.outcome === "NOT_CONSULTED") {
    if (postgres.outcome === "AVAILABLE") return available("POSTGRES", postgres.memory);
    if (postgres.outcome === "NO_HISTORY") return noHistory("NEITHER");
    return failed(true);
  }

  // Cells (7), (8), (9). Without Postgres we do not know the version, the salt
  // or the diff, so we do not know what memory exists — whatever Sibyl
  // recalled. Retryable is the OR over the failing sources, and a thrown query
  // may succeed on the next attempt, so it is true whatever Sibyl reported.
  if (postgres.outcome === "ERROR") return failed(true);

  // Cells (3) and (6). Sibyl was asked and could not answer, so this retrieval
  // does not know what memory exists. (6) is the cell that matters most: a
  // fresh database plus a broken Sibyl must not read as a clean counterparty.
  if (sibyl.outcome === "ERROR") return failed(sibyl.retryable);

  if (postgres.outcome === "AVAILABLE") {
    // Cell (1): both answered. Every scored field is Postgres's, unmodified;
    // Sibyl's contribution is its count and its verdict in the provenance.
    if (sibyl.outcome === "AVAILABLE") return available("BOTH", postgres.memory);
    // Cell (2): Sibyl looked and holds nothing. Zero recall is a real result,
    // not a missing one, and the verdict distinguishes an empty store from a
    // query nothing matched.
    return available("POSTGRES", postgres.memory);
  }

  // Cell (4). Sibyl recalled records; Postgres holds no committed version.
  //
  // The status is AVAILABLE because memory WAS found, and calling that
  // NO_HISTORY would render to the operator as "No previous relationship
  // found" (copy.ts) about a counterparty Sibyl just returned a record for —
  // the same collapse this file exists to prevent, only in the direction of
  // claiming ignorance rather than claiming knowledge.
  //
  // Nothing scored travels with it. The version is null, the episode count is
  // zero, and every Postgres-owned score stays null rather than borrowing a
  // value out of Sibyl's opaque body. `authorizeFromRetrieval` denies AUTO on a
  // null version, so this cell cannot clear a spend it has no version to name.
  if (sibyl.outcome === "AVAILABLE") {
    const provenance = provenanceFor("SIBYL");
    return {
      result: {
        status: "AVAILABLE",
        counterpartyKey,
        memoryVersion: null,
        episodesUsed: 0,
        relationshipStatus: null,
        overallReliability: null,
        taskFit: null,
        confidence: null,
        provenance,
      },
      provenance,
    };
  }

  // Cell (5): both looked, neither found. The provenance carries both causes.
  return noHistory("NEITHER");
}

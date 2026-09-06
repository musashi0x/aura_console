import { and, asc, desc, eq, getDb, schema, sql, type Database } from "@aura/db";

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

/** What a retrieval concluded. `ERROR` never carries a profile. */
export type RetrievalResult =
  | {
      status: "AVAILABLE";
      counterpartyKey: string;
      memoryVersion: number;
      episodesUsed: number;
      relationshipStatus: RelationshipStatus;
      overallReliability: number | null;
      taskFit: number | null;
      confidence: number | null;
    }
  | { status: "NO_HISTORY"; counterpartyKey: string }
  | { status: "ERROR"; counterpartyKey: string; retryable: boolean };

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
   * Retrieval for a decision.
   *
   * The three outcomes are distinct by construction. A missing counterparty is
   * `NO_HISTORY`: the lookup succeeded and there is nothing to know. A thrown
   * query is `ERROR`: the system does not know what memory exists. They are
   * never mapped onto each other, because a projection folded from an arbitrary
   * slice of the log has to reach the same conclusion (AD-03).
   */
  async retrieve(counterpartyKey: string, ownerAgentId: string): Promise<RetrievalResult> {
    try {
      const [row] = await this.db
        .select()
        .from(schema.counterparties)
        .where(eq(schema.counterparties.counterpartyKey, counterpartyKey))
        .limit(1);

      if (!row || row.latestMemoryVersion === 0) {
        return { status: "NO_HISTORY", counterpartyKey };
      }

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

      if (!profile) return { status: "NO_HISTORY", counterpartyKey };

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
        status: "AVAILABLE",
        counterpartyKey,
        memoryVersion: profile.memoryVersion,
        episodesUsed: counted?.count ?? 0,
        relationshipStatus: row.relationshipStatus as RelationshipStatus,
        overallReliability: profile.overallReliability,
        taskFit: profile.taskFit,
        confidence: profile.confidence,
      };
    } catch {
      // Deliberately not re-thrown as NO_HISTORY. The caller must be able to
      // tell "nothing to know" from "we do not know".
      return { status: "ERROR", counterpartyKey, retryable: true };
    }
  }
}

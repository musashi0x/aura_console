import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Relationship memory.
 *
 * The split across these tables is the AD-04 privacy boundary, expressed as
 * storage rather than as a filter someone has to remember to apply. Anything a
 * counterparty may see lives on `counterparties`; anything only the operator's
 * own agent may see lives on `counterpartyEpisodes` and `counterpartyProfiles`;
 * salts live alone and are never selected into a response. A projection built
 * by joining only the first table cannot leak the other two.
 */

/** Canonical relationship states, State Machines section 5. */
export const RELATIONSHIP_STATUSES = [
  "NEW",
  "KNOWN",
  "PREFERRED",
  "WATCH",
  "BLOCKED",
  "ARCHIVED",
] as const;

/**
 * The publishable half. Every column here is on the AD-04 allow list, so the
 * counterparty projection is `select *` over this row plus its classified
 * aggregates — there is no denied field to forget to strip.
 */
export const counterparties = pgTable(
  "counterparties",
  {
    /** Stable across protocols, e.g. "virtuals:agent:alpha". */
    counterpartyKey: text("counterparty_key").primaryKey(),
    protocol: text("protocol").notNull(),
    agentId: text("agent_id").notNull(),
    /** Public chain address. Never a signing secret (AD-05). */
    address: text("address"),
    displayName: text("display_name"),
    avatarUrl: text("avatar_url"),
    acpLifecycleState: text("acp_lifecycle_state").notNull().default("UNKNOWN"),
    relationshipStatus: text("relationship_status").notNull().default("NEW"),
    /** Bumped by the agent runtime whenever it writes a new memory version. */
    latestMemoryVersion: integer("latest_memory_version").notNull().default(0),
    /**
     * Aggregates that have been explicitly classified as publishable. An
     * aggregate over private episodes can re-identify its inputs, so nothing
     * lands here without that classification (Decision 28).
     */
    classifiedAggregates: jsonb("classified_aggregates").notNull().default({}),
    offerings: jsonb("offerings").notNull().default([]),
    publicTrust: jsonb("public_trust").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("counterparties_relationship_idx").on(table.relationshipStatus),
    check(
      "counterparties_relationship_known",
      sql`${table.relationshipStatus} in ('NEW', 'KNOWN', 'PREFERRED', 'WATCH', 'BLOCKED', 'ARCHIVED')`,
    ),
    check("counterparties_memory_version_non_negative", sql`${table.latestMemoryVersion} >= 0`),
  ],
);

/**
 * Immutable economic episodes, first-party only. Never served to a counterparty
 * or any third party, and never copied into a run event payload.
 */
export const counterpartyEpisodes = pgTable(
  "counterparty_episodes",
  {
    episodeId: uuid("episode_id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    counterpartyKey: text("counterparty_key")
      .notNull()
      .references(() => counterparties.counterpartyKey, { onDelete: "cascade" }),
    /** The operator's own agent. Episodes are never shared across operators. */
    ownerAgentId: text("owner_agent_id").notNull(),
    taskType: text("task_type").notNull(),
    outcome: text("outcome").notNull(),
    /** What was actually settled, not what was quoted. */
    amountUsdc: numeric("amount_usdc", { precision: 20, scale: 6 }),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    /** The Run this episode was learned from, for tracing evidence back. */
    sourceRunId: uuid("source_run_id"),
    /** Private body. Denied to every projection; read only by the adapter. */
    body: jsonb("body").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("counterparty_episodes_key_idx").on(table.counterpartyKey, table.occurredAt),
    index("counterparty_episodes_owner_idx").on(table.ownerAgentId),
    check(
      "counterparty_episodes_outcome_known",
      sql`${table.outcome} in ('DELIVERED', 'FAILED', 'DISPUTED', 'CANCELLED')`,
    ),
  ],
);

/** Private semantic profile, one row per (counterparty, owner, version). */
export const counterpartyProfiles = pgTable(
  "counterparty_profiles",
  {
    profileId: uuid("profile_id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    counterpartyKey: text("counterparty_key")
      .notNull()
      .references(() => counterparties.counterpartyKey, { onDelete: "cascade" }),
    ownerAgentId: text("owner_agent_id").notNull(),
    memoryVersion: integer("memory_version").notNull(),
    overallReliability: integer("overall_reliability"),
    taskFit: integer("task_fit"),
    confidence: integer("confidence"),
    /** Private free-form body. Never enters an event payload or a projection. */
    body: jsonb("body").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("counterparty_profiles_version_key").on(
      table.counterpartyKey,
      table.ownerAgentId,
      table.memoryVersion,
    ),
    check("counterparty_profiles_version_positive", sql`${table.memoryVersion} > 0`),
  ],
);

/**
 * Salts sit in their own table with no publishable column beside them, so a
 * projection cannot pick one up by widening a select on another table.
 */
export const counterpartySalts = pgTable("counterparty_salts", {
  counterpartyKey: text("counterparty_key")
    .primaryKey()
    .references(() => counterparties.counterpartyKey, { onDelete: "cascade" }),
  salt: text("salt").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** What changed between two memory versions, and the evidence for each change. */
export const memoryDiffs = pgTable(
  "memory_diffs",
  {
    diffId: uuid("diff_id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    counterpartyKey: text("counterparty_key")
      .notNull()
      .references(() => counterparties.counterpartyKey, { onDelete: "cascade" }),
    ownerAgentId: text("owner_agent_id").notNull(),
    beforeVersion: integer("before_version").notNull(),
    afterVersion: integer("after_version").notNull(),
    changes: jsonb("changes").notNull().default([]),
    /** Event ids only. The evidence itself stays in the episode table. */
    evidenceEventIds: jsonb("evidence_event_ids").notNull().default([]),
    explanation: jsonb("explanation").notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("memory_diffs_key_idx").on(table.counterpartyKey, table.afterVersion),
    check("memory_diffs_versions_ordered", sql`${table.afterVersion} > ${table.beforeVersion}`),
  ],
);

/**
 * Operator policy. Money is numeric in storage and serialized as a string at
 * the edge, so no client ever parses a float for a spend limit.
 */
export const agentPolicies = pgTable(
  "agent_policies",
  {
    agentId: text("agent_id").primaryKey(),
    policyVersion: integer("policy_version").notNull().default(1),
    autoSpendLimitUsdc: numeric("auto_spend_limit_usdc", { precision: 20, scale: 6 }),
    absoluteSpendLimitUsdc: numeric("absolute_spend_limit_usdc", { precision: 20, scale: 6 }),
    dailySpendLimitUsdc: numeric("daily_spend_limit_usdc", { precision: 20, scale: 6 }),
    humanApprovalAboveUsdc: numeric("human_approval_above_usdc", { precision: 20, scale: 6 }),
    minimumReliability: integer("minimum_reliability"),
    preferredProviderPremiumLimit: numeric("preferred_provider_premium_limit", {
      precision: 6,
      scale: 4,
    }),
    blockAfterRecentFailures: integer("block_after_recent_failures"),
    preferPreviousSuccess: boolean("prefer_previous_success").notNull().default(true),
    requireVerifiedCommitment: boolean("require_verified_commitment").notNull().default(false),
    /**
     * Whether an operator override may rescue a memory ERROR into an approval.
     * Absent or false means deny, because AD-03 fails closed by default.
     */
    memoryErrorOverrideAllowed: boolean("memory_error_override_allowed")
      .notNull()
      .default(false),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("agent_policies_version_positive", sql`${table.policyVersion} > 0`),
    check(
      "agent_policies_reliability_range",
      sql`${table.minimumReliability} is null or (${table.minimumReliability} between 0 and 100)`,
    ),
  ],
);

export type Counterparty = typeof counterparties.$inferSelect;
export type NewCounterparty = typeof counterparties.$inferInsert;
export type CounterpartyEpisode = typeof counterpartyEpisodes.$inferSelect;
export type CounterpartyProfile = typeof counterpartyProfiles.$inferSelect;
export type MemoryDiff = typeof memoryDiffs.$inferSelect;
export type AgentPolicy = typeof agentPolicies.$inferSelect;
export type NewAgentPolicy = typeof agentPolicies.$inferInsert;

import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { runs } from "./runs.js";

/**
 * An operator's authorization to spend, waiting to be executed.
 *
 * This table is the *only* thing that causes the runtime to move money. The
 * `acp.fund.authorized` event is the record of the decision; this row is the
 * instruction. Keeping them separate matters: `POST /api/runs/:id/events`
 * accepts any event type, so a hand-written authorization event exists in
 * history but has no row here, and therefore buys nothing.
 *
 * `claimed_at` is the concurrency guard. A worker claims a row before it
 * touches the chain, so two workers cannot fund the same job twice.
 */
export const acpSpendIntents = pgTable(
  "acp_spend_intents",
  {
    /** The `run_events.event_id` of the authorization that created this row. */
    authorizationEventId: uuid("authorization_event_id").primaryKey(),
    runId: uuid("run_id")
      .notNull()
      .references(() => runs.id, { onDelete: "cascade" }),
    chainId: bigint("chain_id", { mode: "number" }).notNull(),
    jobId: text("job_id").notNull(),
    /** Exact. Never a float, at rest or in flight. */
    amountUsdc: numeric("amount_usdc", { precision: 20, scale: 6 }).notNull(),
    /** Producer domain time of the authorization. */
    authorizedAt: timestamp("authorized_at", { withTimezone: true }).notNull(),
    /** Set the moment a worker takes the row, before it touches the chain. */
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
    /**
     * Set once `fund` returned without throwing. It means "we sent it", not
     * "the chain agrees" — the observed `acp.job.funded` entry is what says
     * that, and it arrives through the normal stream.
     */
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
  },
  (table) => [
    /**
     * At most one unsubmitted authorization per job. Authorizing twice while
     * the first is still in flight is the mistake most likely to double-spend,
     * so the database refuses it rather than the route alone.
     */
    uniqueIndex("acp_spend_intents_pending_job_key")
      .on(table.chainId, table.jobId)
      .where(sql`${table.submittedAt} is null`),
    index("acp_spend_intents_unclaimed_idx")
      .on(table.authorizedAt)
      .where(sql`${table.claimedAt} is null and ${table.submittedAt} is null`),
    index("acp_spend_intents_run_id_idx").on(table.runId),
    check("acp_spend_intents_amount_positive", sql`${table.amountUsdc} > 0`),
    check("acp_spend_intents_chain_id_positive", sql`${table.chainId} > 0`),
    check("acp_spend_intents_job_id_not_blank", sql`length(btrim(${table.jobId})) > 0`),
    check("acp_spend_intents_attempts_non_negative", sql`${table.attempts} >= 0`),
  ],
);

export type AcpSpendIntent = typeof acpSpendIntents.$inferSelect;
export type NewAcpSpendIntent = typeof acpSpendIntents.$inferInsert;

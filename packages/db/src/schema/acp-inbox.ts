import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Raw ACP stream entries, captured before anything is derived from them.
 *
 * The ACP stream is lossy at its edge: `agent.start()` replays only jobs that
 * are still active, so an entry dropped during an outage is gone for good. A
 * row here is written in one statement with no external calls, which makes the
 * window where an entry can be lost as small as a single insert. Projecting
 * that row into `run_events` is a separate, retryable step.
 *
 * This is a staging buffer, not history. `run_events` remains the record; a row
 * here is deletable once processed without changing what the Console reads.
 */
export const acpInbox = pgTable(
  "acp_inbox",
  {
    /** Derived from the entry's content, so a duplicate delivery collides here. */
    eventId: uuid("event_id").primaryKey(),
    chainId: bigint("chain_id", { mode: "number" }).notNull(),
    jobId: text("job_id").notNull(),
    /** The entry exactly as received. Never edited, so a reprojection is honest. */
    entry: jsonb("entry").notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
    /** Null until the entry has landed in `run_events`. */
    processedAt: timestamp("processed_at", { withTimezone: true }),
    attempts: integer("attempts").notNull().default(0),
    /** Kept so a stuck row explains itself without a log search. */
    lastError: text("last_error"),
  },
  (table) => [
    index("acp_inbox_unprocessed_idx")
      .on(table.receivedAt)
      .where(sql`${table.processedAt} is null`),
    index("acp_inbox_chain_job_idx").on(table.chainId, table.jobId),
    check("acp_inbox_chain_id_positive", sql`${table.chainId} > 0`),
    check("acp_inbox_job_id_not_blank", sql`length(btrim(${table.jobId})) > 0`),
    check("acp_inbox_attempts_non_negative", sql`${table.attempts} >= 0`),
  ],
);

export type AcpInboxRow = typeof acpInbox.$inferSelect;
export type NewAcpInboxRow = typeof acpInbox.$inferInsert;

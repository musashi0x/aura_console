import { sql } from "drizzle-orm";
import { bigint, check, index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { runs } from "./runs.js";

/**
 * Identity only: which Run is a given ACP job? The ACP runtime resolves this on
 * every stream entry, including after a restart, so the answer cannot live in
 * memory — and it cannot be read back out of `run_events`, because that table
 * is append-only history rather than a lookup index.
 *
 * Nothing derived from event history belongs here. No status, no amount, no
 * counterparty: those are events, and the projection is the only thing allowed
 * to reduce them.
 */
export const acpJobs = pgTable(
  "acp_jobs",
  {
    /** EVM chain id. Base Sepolia is 84532; the column does not assume one chain. */
    chainId: bigint("chain_id", { mode: "number" }).notNull(),
    /** On-chain job id. Text because the SDK hands it over as a decimal string. */
    jobId: text("job_id").notNull(),
    runId: uuid("run_id")
      .notNull()
      .references(() => runs.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("acp_jobs_chain_job_key").on(table.chainId, table.jobId),
    index("acp_jobs_run_id_idx").on(table.runId),
    check("acp_jobs_chain_id_positive", sql`${table.chainId} > 0`),
    check("acp_jobs_job_id_not_blank", sql`length(btrim(${table.jobId})) > 0`),
  ],
);

export type AcpJob = typeof acpJobs.$inferSelect;
export type NewAcpJob = typeof acpJobs.$inferInsert;

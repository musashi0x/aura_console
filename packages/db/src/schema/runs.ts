import { sql } from "drizzle-orm";
import {
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
 * A Run is one economic objective from start to finish. The row holds only the
 * seed: everything that happens to the Run is an event, so no column here is
 * derived from event history.
 */
export const runs = pgTable(
  "runs",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    objective: text("objective").notNull(),
    /** Who asked for the Run: CONSOLE, AGENT, or FIXTURE. */
    source: text("source").notNull(),
    /** Free text rather than an enum so a new network needs no migration. */
    environment: text("environment").notNull().default("non-mainnet"),
    /** The declared ceiling, not an amount spent. Spend only ever comes from events. */
    budgetUsdc: numeric("budget_usdc", { precision: 20, scale: 6 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("runs_objective_not_blank", sql`length(btrim(${table.objective})) > 0`),
    check("runs_source_known", sql`${table.source} in ('CONSOLE', 'AGENT', 'FIXTURE')`),
    check("runs_budget_non_negative", sql`${table.budgetUsdc} is null or ${table.budgetUsdc} >= 0`),
  ],
);

/**
 * Append-only. Rows are never updated or deleted, so the projection can be
 * rebuilt from this table alone.
 */
export const runEvents = pgTable(
  "run_events",
  {
    /** Supplied by the producer so a retried append is recognisable. */
    eventId: uuid("event_id").primaryKey(),
    runId: uuid("run_id")
      .notNull()
      .references(() => runs.id, { onDelete: "cascade" }),
    /** Canonical order within a Run. Allocated server-side, never by a client. */
    sequence: integer("sequence").notNull(),
    type: text("type").notNull(),
    /** Domain time from the producer. Never the request arrival time. */
    eventTime: timestamp("event_time", { withTimezone: true }).notNull(),
    data: jsonb("data").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("run_events_run_sequence_key").on(table.runId, table.sequence),
    index("run_events_run_id_idx").on(table.runId),
    check("run_events_sequence_non_negative", sql`${table.sequence} >= 0`),
    check("run_events_type_not_blank", sql`length(btrim(${table.type})) > 0`),
  ],
);

export type Run = typeof runs.$inferSelect;
export type NewRun = typeof runs.$inferInsert;
export type RunEvent = typeof runEvents.$inferSelect;
export type NewRunEvent = typeof runEvents.$inferInsert;

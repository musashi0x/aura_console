import { closeDb, getDb, sql } from "@aura/db";
import { afterAll, beforeEach } from "vitest";

/**
 * Every test starts from an empty store.
 *
 * `runs` cascades to `run_events` and `counterparties` cascades to episodes,
 * profiles, salts and diffs, which is the same guarantee the foreign keys give
 * in production. Policies have no parent, so they are named explicitly — a new
 * root table that is not listed here will leak rows between tests.
 */
beforeEach(async () => {
  await getDb().execute(
    sql`truncate table runs, counterparties, agent_policies restart identity cascade`,
  );
});

afterAll(async () => {
  await closeDb();
});

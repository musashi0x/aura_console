import { closeDb, getDb, sql } from "@aura/db";
import { afterAll, beforeEach } from "vitest";

/**
 * Every test starts from an empty store.
 *
 * Truncating `runs` cascades to `run_events`, `acp_jobs` and `acp_spend_intents`,
 * and `counterparties` cascades to episodes, profiles, salts and diffs, which is
 * the same guarantee the foreign keys give in production. `acp_inbox` and
 * `agent_policies` have no parent — the inbox is a staging buffer that must
 * survive independently of any Run — so both are named explicitly. A new root
 * table that is not listed here will leak rows between tests.
 */
beforeEach(async () => {
  await getDb().execute(
    sql`truncate table runs, acp_inbox, counterparties, agent_policies restart identity cascade`,
  );
});

afterAll(async () => {
  await closeDb();
});

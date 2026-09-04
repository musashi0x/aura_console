import { closeDb, getDb, sql } from "@aura/db";
import { afterAll, beforeEach } from "vitest";

/**
 * Every test starts from an empty event store. Truncating `runs` cascades to
 * `run_events` and `acp_jobs`, which is the same guarantee the foreign keys give
 * in production. `acp_inbox` has no foreign key — it is a staging buffer that
 * must survive independently of any Run — so it is truncated explicitly.
 */
beforeEach(async () => {
  await getDb().execute(sql`truncate table runs, acp_inbox restart identity cascade`);
});

afterAll(async () => {
  await closeDb();
});

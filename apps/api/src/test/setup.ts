import { closeDb, getDb, sql } from "@aura/db";
import { afterAll, beforeEach } from "vitest";

/**
 * Every test starts from an empty event store. Truncating `runs` cascades to
 * `run_events`, which is the same guarantee the foreign key gives in production.
 */
beforeEach(async () => {
  await getDb().execute(sql`truncate table runs restart identity cascade`);
});

afterAll(async () => {
  await closeDb();
});

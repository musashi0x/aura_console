import { ensureDatabase, runMigrations } from "@aura/db";

import { testDatabaseUrl } from "./database.js";

/**
 * Creates the test database if it is missing and brings it to the current
 * migration head. Runs once for the whole suite, before any test file, so the
 * tests exercise the real schema and its constraints rather than a fake.
 */
export default async function setup(): Promise<void> {
  const url = testDatabaseUrl();
  await ensureDatabase(url);
  await runMigrations(url);
}

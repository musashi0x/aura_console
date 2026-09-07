import { ensureDatabase, runMigrations } from "@aura/db";

import { testDatabaseUrl } from "./database.js";
import { setupTestSibylDb } from "./sibyl.js";

/**
 * Creates the test database if it is missing and brings it to the current
 * migration head. Also provisions an isolated ephemeral Sibyl test database
 * so tests never touch or overflow the developer's live ~/.sibyl-memory.
 */
export default async function setup(): Promise<void> {
  const url = testDatabaseUrl();
  await ensureDatabase(url);
  await runMigrations(url);
  await setupTestSibylDb();
}


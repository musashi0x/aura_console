import { loadRootEnvFile, getPool, closeDb } from "@aura/db";

loadRootEnvFile();

async function main() {
  const pool = getPool();
  try {
    await pool.query("TRUNCATE TABLE run_events, runs CASCADE;");
    console.log("✓ Postgres event store (runs, run_events) wiped clean.");
  } catch (error) {
    console.error("Failed to wipe event store:", error);
    process.exit(1);
  } finally {
    await closeDb();
  }
}

main();

import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";

import { loadDbEnv } from "./env.js";
import * as schema from "./schema/index.js";

export type Database = NodePgDatabase<typeof schema>;

let pool: pg.Pool | undefined;
let db: Database | undefined;

/**
 * One pool per process, created on first use. Every consumer goes through this
 * factory — no application code constructs its own connection.
 */
export function getPool(): pg.Pool {
  if (!pool) {
    const env = loadDbEnv();
    pool = new pg.Pool({
      connectionString: env.DATABASE_URL,
      max: Number(process.env.DATABASE_POOL_MAX ?? 10),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
    // Without this listener an idle-client error crashes the process.
    pool.on("error", (error) => {
      console.error("[db] idle client error", error);
    });
  }
  return pool;
}

export function getDb(): Database {
  if (!db) {
    db = drizzle(getPool(), { schema });
  }
  return db;
}

/** Ends the pool so a process can exit cleanly. Safe to call more than once. */
export async function closeDb(): Promise<void> {
  if (!pool) return;
  const current = pool;
  pool = undefined;
  db = undefined;
  await current.end();
}

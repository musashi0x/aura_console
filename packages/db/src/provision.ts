import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

import { migrationsFolder } from "./migrations.js";

/**
 * Creates the database named in `url` if it does not exist yet. Intended for
 * test and local provisioning, where the alternative is a manual step that
 * silently rots.
 */
export async function ensureDatabase(url: string): Promise<void> {
  const target = new URL(url);
  const database = target.pathname.replace(/^\//, "");
  if (!database) throw new Error(`Connection string has no database name: ${url}`);

  const admin = new URL(url);
  admin.pathname = "/postgres";
  const pool = new pg.Pool({ connectionString: admin.toString(), max: 1 });
  try {
    const existing = await pool.query("select 1 from pg_database where datname = $1", [database]);
    if (existing.rowCount === 0) {
      // A database name is an identifier and cannot be parameterised. It comes
      // from our own connection string, never from a request.
      await pool.query(`create database "${database.replace(/"/g, '""')}"`);
    }
  } finally {
    await pool.end();
  }
}

/** Brings the database at `url` to the current migration head. */
export async function runMigrations(url: string): Promise<void> {
  const pool = new pg.Pool({ connectionString: url, max: 1 });
  try {
    await migrate(drizzle(pool), { migrationsFolder });
  } finally {
    await pool.end();
  }
}

export { loadDbEnv, type DbEnv } from "./env.js";
export { loadRootEnvFile } from "./root-env.js";
export { closeDb, getDb, getPool, type Database } from "./client.js";
export { migrationsFolder } from "./migrations.js";
export { ensureDatabase, runMigrations } from "./provision.js";
export * as schema from "./schema/index.js";
// Query operators are re-exported so consumers never depend on drizzle-orm
// directly; the ORM stays an implementation detail of this package.
export { and, asc, desc, eq, isNull, sql } from "drizzle-orm";

import { loadRootEnvFile } from "@aura/db";

loadRootEnvFile();

/**
 * Tests never run against the development database. The URL is derived by
 * suffixing the database name, so a misconfigured environment cannot silently
 * point the suite at real data.
 */
export function testDatabaseUrl(source: NodeJS.ProcessEnv = process.env): string {
  const explicit = source.TEST_DATABASE_URL;
  if (explicit) return explicit;

  const base = source.DATABASE_URL;
  if (!base) {
    throw new Error("Set DATABASE_URL or TEST_DATABASE_URL before running API tests");
  }

  const url = new URL(base);
  const name = url.pathname.replace(/^\//, "");
  if (!name) throw new Error(`DATABASE_URL has no database name: ${base}`);
  url.pathname = name.endsWith("_test") ? `/${name}` : `/${name}_test`;
  return url.toString();
}

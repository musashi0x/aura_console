import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Absolute path to the generated SQL. Exported separately from `migrate.ts` so
 * importing it does not run the migration CLI as a side effect.
 */
export const migrationsFolder = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "drizzle",
);

import { fileURLToPath } from "node:url";
import path from "node:path";

import { migrate } from "drizzle-orm/node-postgres/migrator";

import { closeDb, getDb } from "./client.js";
import { loadRootEnvFile } from "./root-env.js";

loadRootEnvFile();

const migrationsFolder = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "drizzle",
);

async function main(): Promise<void> {
  console.log(`[db] applying migrations from ${migrationsFolder}`);
  await migrate(getDb(), { migrationsFolder });
  console.log("[db] migrations up to date");
}

main()
  .then(async () => {
    await closeDb();
    process.exit(0);
  })
  .catch(async (error: unknown) => {
    console.error("[db] migration failed");
    console.error(error);
    await closeDb().catch(() => undefined);
    process.exit(1);
  });

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { config } from "dotenv";

/**
 * Loads the repository-root `.env` so every server-side entrypoint (migrations,
 * drizzle-kit, the API) reads one file. Existing process env always wins, which
 * is what makes CI and container environments behave.
 */
export function loadRootEnvFile(
  startDir: string = path.dirname(fileURLToPath(import.meta.url)),
): string | undefined {
  let dir = startDir;

  for (;;) {
    const candidate = path.join(dir, ".env");
    if (fs.existsSync(candidate)) {
      config({ path: candidate, override: false, quiet: true });
      return candidate;
    }
    const parent = path.dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

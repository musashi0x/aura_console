import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { env } from "../env.js";

const run = promisify(execFile);

/**
 * Sibyl Memory readiness, as Sibyl itself reports it.
 *
 * Sibyl ships as a Python package over a local SQLite file, so reaching it
 * from this Node service means crossing a process boundary. `tools/sibyl_bridge.py`
 * is that seam, and it is read-only.
 *
 * Nothing here infers. If Python is missing, the client is not installed, or
 * the database is absent, this returns `unavailable` with the reason — it never
 * returns a zeroed status that would read as "Sibyl is here and empty". That is
 * the same distinction the Console draws everywhere else: "we could not look"
 * is not "we looked and there is nothing".
 */
export interface SibylStatus {
  configured: boolean;
  reachable: boolean;
  /** Present only when Sibyl actually answered. */
  tier?: string;
  schemaVersion?: number;
  dbSizeBytes?: number;
  softCapBytes?: number;
  atOrAboveCap?: boolean;
  entityCount?: number;
  /** Why it could not be reached. Never shown as a memory result. */
  code?: string;
  detail?: string;
}

const NOT_CONFIGURED: SibylStatus = {
  configured: false,
  reachable: false,
  code: "not_configured",
  detail:
    "SIBYL_PYTHON is not set, so this deployment has no Sibyl Memory runtime to ask.",
};

export async function getSibylStatus(): Promise<SibylStatus> {
  const python = env.SIBYL_PYTHON;
  if (!python) return NOT_CONFIGURED;

  try {
    const { stdout } = await run(python, [env.SIBYL_BRIDGE, "status"], {
      timeout: env.SIBYL_TIMEOUT_MS,
      env: { ...process.env, SIBYL_DB_PATH: env.SIBYL_DB_PATH },
      maxBuffer: 1024 * 1024,
    });
    const parsed = JSON.parse(stdout) as Record<string, unknown>;
    if (parsed.ok !== true) {
      return {
        configured: true,
        reachable: false,
        code: String(parsed.code ?? "bridge_error"),
        detail: String(parsed.detail ?? "The Sibyl bridge reported a failure."),
      };
    }
    return {
      configured: true,
      reachable: true,
      tier: parsed.tier as string,
      schemaVersion: parsed.schemaVersion as number,
      dbSizeBytes: parsed.dbSizeBytes as number,
      softCapBytes: parsed.softCapBytes as number,
      atOrAboveCap: parsed.atOrAboveCap as boolean,
      entityCount: parsed.entityCount as number,
    };
  } catch (error) {
    // Logged in full server-side; the client is told it could not be reached,
    // which is all it needs to render the unavailable state honestly.
    console.error("[sibyl] status check failed", error);
    return {
      configured: true,
      reachable: false,
      code: "bridge_unreachable",
      detail: "The Sibyl bridge could not be run.",
    };
  }
}

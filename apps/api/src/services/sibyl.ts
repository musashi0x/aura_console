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

/**
 * One counterparty's relationship profile, read from Sibyl.
 *
 * The shape is the Console's existing `RetrievalResult`, unchanged: the five
 * `RetrievalStatus` values are the product's vocabulary and swapping the store
 * underneath them must not alter what the operator reads.
 *
 * The three outcomes stay separate all the way down. Sibyl answering "no such
 * entity" is NO_HISTORY — a real result about a counterparty we have not dealt
 * with. Sibyl not answering at all is ERROR. Collapsing them would let an
 * outage read as a clean record, which is the failure this product exists to
 * prevent.
 */
export type SibylRetrieval =
  | { status: "NO_HISTORY"; counterpartyKey: string }
  | { status: "ERROR"; counterpartyKey: string; retryable: true }
  | {
      status: "AVAILABLE";
      counterpartyKey: string;
      memoryVersion: number;
      episodesUsed: number;
      relationshipStatus: string;
      overallReliability: number | null;
      taskFit: number | null;
      confidence: number | null;
    };

/** Reads a number Sibyl stored, or null. Never coerces a missing value to 0. */
function num(body: Record<string, unknown>, key: string): number | null {
  const value = body[key];
  return typeof value === "number" ? value : null;
}

export async function retrieveFromSibyl(counterpartyKey: string): Promise<SibylRetrieval> {
  const python = env.SIBYL_PYTHON;
  if (!python) return { status: "ERROR", counterpartyKey, retryable: true };

  try {
    const { stdout } = await run(python, [env.SIBYL_BRIDGE, "retrieve", "counterparty", counterpartyKey], {
      timeout: env.SIBYL_TIMEOUT_MS,
      env: { ...process.env, SIBYL_DB_PATH: env.SIBYL_DB_PATH },
      maxBuffer: 1024 * 1024,
    });
    const parsed = JSON.parse(stdout) as Record<string, unknown>;
    if (parsed.ok !== true) return { status: "ERROR", counterpartyKey, retryable: true };
    if (parsed.found !== true) return { status: "NO_HISTORY", counterpartyKey };

    const body = (parsed.body ?? {}) as Record<string, unknown>;
    const memoryVersion = num(body, "memory_version");
    // A profile with no version is not a profile. Reporting it as AVAILABLE
    // would put a relationship claim in front of the operator that Sibyl never
    // made.
    if (memoryVersion === null) return { status: "NO_HISTORY", counterpartyKey };

    return {
      status: "AVAILABLE",
      counterpartyKey,
      memoryVersion,
      episodesUsed: num(body, "episodes_used") ?? 0,
      relationshipStatus:
        typeof body.relationship_status === "string" ? body.relationship_status : "KNOWN",
      overallReliability: num(body, "overall_reliability"),
      taskFit: num(body, "task_fit"),
      confidence: num(body, "confidence"),
    };
  } catch (error) {
    console.error("[sibyl] retrieve failed", error);
    return { status: "ERROR", counterpartyKey, retryable: true };
  }
}

/**
 * A counterparty as Sibyl holds it.
 *
 * Named field by field rather than spread, for the same reason the AD-04
 * projection is: a spread publishes whatever the store adds later, and Sibyl's
 * rows carry `id` and `tenant_id` that are its own business, not the operator's.
 *
 * `hasProfile` is false for an entity Sibyl holds that carries no relationship
 * profile. It is listed rather than hidden — an entity we cannot read a profile
 * from is a real thing to know about — but it never borrows numbers it does not
 * have.
 */
export interface SibylCounterparty {
  counterpartyKey: string;
  hasProfile: boolean;
  relationshipStatus: string | null;
  memoryVersion: number | null;
  episodesUsed: number | null;
  overallReliability: number | null;
  taskFit: number | null;
  confidence: number | null;
  updatedAt: string | null;
}

export type SibylCounterparties =
  | { ok: true; items: SibylCounterparty[] }
  | { ok: false; code: string; detail: string };

export async function listCounterpartiesFromSibyl(): Promise<SibylCounterparties> {
  const python = env.SIBYL_PYTHON;
  if (!python) {
    return {
      ok: false,
      code: "not_configured",
      detail: "SIBYL_PYTHON is not set, so this deployment has no relationship memory to read.",
    };
  }

  try {
    const { stdout } = await run(python, [env.SIBYL_BRIDGE, "entities", "counterparty"], {
      timeout: env.SIBYL_TIMEOUT_MS,
      env: { ...process.env, SIBYL_DB_PATH: env.SIBYL_DB_PATH },
      maxBuffer: 4 * 1024 * 1024,
    });
    const parsed = JSON.parse(stdout) as Record<string, unknown>;
    if (parsed.ok !== true) {
      return {
        ok: false,
        code: String(parsed.code ?? "bridge_error"),
        detail: String(parsed.detail ?? "Sibyl could not be read."),
      };
    }

    const rows = Array.isArray(parsed.entities) ? parsed.entities : [];
    const items = rows.map((row): SibylCounterparty => {
      const entity = (row ?? {}) as Record<string, unknown>;
      const body = (entity.body ?? {}) as Record<string, unknown>;
      const memoryVersion = num(body, "memory_version");
      return {
        counterpartyKey: typeof entity.name === "string" ? entity.name : "",
        hasProfile: memoryVersion !== null,
        relationshipStatus:
          typeof body.relationship_status === "string" ? body.relationship_status : null,
        memoryVersion,
        episodesUsed: num(body, "episodes_used"),
        overallReliability: num(body, "overall_reliability"),
        taskFit: num(body, "task_fit"),
        confidence: num(body, "confidence"),
        updatedAt: typeof entity.updated_at === "string" ? entity.updated_at : null,
      };
    });
    return { ok: true, items: items.filter((item) => item.counterpartyKey !== "") };
  } catch (error) {
    console.error("[sibyl] counterparty listing failed", error);
    return { ok: false, code: "bridge_unreachable", detail: "Sibyl could not be read." };
  }
}

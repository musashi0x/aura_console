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
      env: { ...process.env, SIBYL_DB_PATH: env.SIBYL_DB_PATH, SIBYL_TENANT_ID: env.AGENT_ID },
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
      displayName: string | null;
      /** Null when Sibyl holds no version for this profile. Never defaulted. */
      memoryVersion: number | null;
      episodesUsed: number;
      relationshipStatus: string;
      overallReliability: number | null;
      taskFit: number | null;
      confidence: number | null;
      riskNote: string | null;
      /** True when Sibyl itself marks the record as fixture data. */
      isFixture: boolean;
    };

/** Reads a number Sibyl stored, or null. Never coerces a missing value to 0. */
function num(body: Record<string, unknown>, key: string): number | null {
  const value = body[key];
  return typeof value === "number" ? value : null;
}

function str(body: Record<string, unknown>, key: string): string | null {
  const value = body[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

/**
 * A profile is a profile when Sibyl says something evaluative about the
 * counterparty.
 *
 * This used to hinge on `memory_version`, which the records in a real store do
 * not carry — so two fully populated profiles, with scores, episodes and a risk
 * note, were both reported as no history. A version is metadata about a
 * profile, not the thing that makes one.
 */
function hasProfileBody(body: Record<string, unknown>): boolean {
  return (
    str(body, "relationship_status") !== null ||
    num(body, "overall_reliability") !== null ||
    num(body, "task_fit") !== null ||
    num(body, "confidence") !== null
  );
}

function episodeCount(body: Record<string, unknown>): number {
  const episodes = body.episodes;
  return Array.isArray(episodes) ? episodes.length : 0;
}

export async function retrieveFromSibyl(counterpartyKey: string): Promise<SibylRetrieval> {
  const python = env.SIBYL_PYTHON;
  if (!python) return { status: "ERROR", counterpartyKey, retryable: true };

  try {
    const { stdout } = await run(python, [env.SIBYL_BRIDGE, "retrieve", "counterparty", counterpartyKey], {
      timeout: env.SIBYL_TIMEOUT_MS,
      env: { ...process.env, SIBYL_DB_PATH: env.SIBYL_DB_PATH, SIBYL_TENANT_ID: env.AGENT_ID },
      maxBuffer: 1024 * 1024,
    });
    const parsed = JSON.parse(stdout) as Record<string, unknown>;
    if (parsed.ok !== true) return { status: "ERROR", counterpartyKey, retryable: true };
    if (parsed.found !== true) return { status: "NO_HISTORY", counterpartyKey };

    const body = (parsed.body ?? {}) as Record<string, unknown>;
    // An entity Sibyl holds that says nothing evaluative is not history.
    // Reporting it as AVAILABLE would put a relationship claim in front of the
    // operator that Sibyl never made.
    if (!hasProfileBody(body)) return { status: "NO_HISTORY", counterpartyKey };

    return {
      status: "AVAILABLE",
      counterpartyKey,
      displayName: str(body, "display_name"),
      memoryVersion: num(body, "memory_version"),
      episodesUsed: episodeCount(body),
      relationshipStatus: str(body, "relationship_status") ?? "KNOWN",
      overallReliability: num(body, "overall_reliability"),
      taskFit: num(body, "task_fit"),
      confidence: num(body, "confidence"),
      riskNote: str(body, "risk_note"),
      isFixture: str(body, "source") === "fixture",
    };
  } catch (error) {
    console.error("[sibyl] retrieve failed", error);
    return { status: "ERROR", counterpartyKey, retryable: true };
  }
}

/**
 * A counterparty as Sibyl holds it, for the Agents surface.
 *
 * Named field by field rather than spread, for the same reason the AD-04
 * projection is: a spread publishes whatever the store adds later, and Sibyl's
 * rows carry `id` and `tenant_id` that are its own business.
 *
 * Scores are passed through exactly as Sibyl stored them. They are not scaled,
 * rounded or suffixed with a unit: the store holds ratios in one record and
 * whole numbers in another, and inventing a common scale would put a number in
 * front of the operator that nothing measured.
 */
export interface SibylEpisode {
  run: string | null;
  taskType: string | null;
  outcome: string | null;
  note: string | null;
  occurredAt: string | null;
}

export interface SibylCounterparty {
  counterpartyKey: string;
  displayName: string | null;
  hasProfile: boolean;
  /** Sibyl marks this record as fixture data, and the Console must say so. */
  isFixture: boolean;
  relationshipStatus: string | null;
  memoryVersion: number | null;
  overallReliability: number | null;
  taskFit: number | null;
  confidence: number | null;
  observedPriceUsdc: string | null;
  riskNote: string | null;
  episodes: SibylEpisode[];
  updatedAt: string | null;
}

export type SibylCounterparties =
  | { ok: true; items: SibylCounterparty[] }
  | { ok: false; code: string; detail: string };

function episodesFrom(body: Record<string, unknown>): SibylEpisode[] {
  const raw = body.episodes;
  if (!Array.isArray(raw)) return [];
  return raw.map((entry) => {
    const episode = (entry ?? {}) as Record<string, unknown>;
    return {
      run: str(episode, "run"),
      taskType: str(episode, "task_type"),
      outcome: str(episode, "outcome"),
      note: str(episode, "note"),
      occurredAt: str(episode, "occurred_at"),
    };
  });
}

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
      env: { ...process.env, SIBYL_DB_PATH: env.SIBYL_DB_PATH, SIBYL_TENANT_ID: env.AGENT_ID },
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
      return {
        counterpartyKey: typeof entity.name === "string" ? entity.name : "",
        displayName: str(body, "display_name"),
        hasProfile: hasProfileBody(body),
        isFixture: str(body, "source") === "fixture",
        relationshipStatus: str(body, "relationship_status"),
        memoryVersion: num(body, "memory_version"),
        overallReliability: num(body, "overall_reliability"),
        taskFit: num(body, "task_fit"),
        confidence: num(body, "confidence"),
        observedPriceUsdc: str(body, "observed_price_usdc"),
        riskNote: str(body, "risk_note"),
        episodes: episodesFrom(body),
        updatedAt: typeof entity.updated_at === "string" ? entity.updated_at : null,
      };
    });
    return { ok: true, items: items.filter((item) => item.counterpartyKey !== "") };
  } catch (error) {
    console.error("[sibyl] counterparty listing failed", error);
    return { ok: false, code: "bridge_unreachable", detail: "Sibyl could not be read." };
  }
}

import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
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

const NOT_CONFIGURED_DETAIL =
  "SIBYL_PYTHON is not set, so this deployment has no Sibyl Memory runtime to ask.";

const NOT_CONFIGURED: SibylStatus = {
  configured: false,
  reachable: false,
  code: "not_configured",
  detail: NOT_CONFIGURED_DETAIL,
};

/** What one bridge invocation concluded. Failure is a value, never a throw. */
type BridgeOutcome =
  | { ok: true; payload: Record<string, unknown> }
  | { ok: false; configured: boolean; code: string; detail: string };

/**
 * One command, one process, one JSON object.
 *
 * Every read in this file crosses the same seam, so there is one timeout, one
 * decision about what "we could not look" means, and one error vocabulary. Four
 * call sites each spawning their own interpreter would be four subtly different
 * opinions about an unreachable bridge, and the one thing this boundary cannot
 * afford is a second opinion on that.
 *
 * A body we cannot parse lands in the same failure as a process that never ran,
 * and deliberately: with no parsed answer we hold nothing Sibyl said, which is
 * the same position as never having asked.
 */
function getSibylPython(): string | undefined {
  if (process.env.SIBYL_PYTHON !== undefined) {
    return process.env.SIBYL_PYTHON || undefined;
  }
  return env.SIBYL_PYTHON;
}

function getSibylBridgePath(): string {
  const defaultPath = env.SIBYL_BRIDGE || "tools/sibyl_bridge.py";
  if (process.env.SIBYL_BRIDGE && existsSync(process.env.SIBYL_BRIDGE)) {
    return process.env.SIBYL_BRIDGE;
  }
  if (existsSync(defaultPath)) {
    return path.resolve(defaultPath);
  }
  const fromOneUp = path.resolve(process.cwd(), "..", defaultPath);
  if (existsSync(fromOneUp)) {
    return fromOneUp;
  }
  const fromTwoUp = path.resolve(process.cwd(), "..", "..", defaultPath);
  if (existsSync(fromTwoUp)) {
    return fromTwoUp;
  }
  return defaultPath;
}

async function runBridge(args: string[]): Promise<BridgeOutcome> {
  const python = getSibylPython();
  if (!python) {
    return {
      ok: false,
      configured: false,
      code: "not_configured",
      detail: NOT_CONFIGURED_DETAIL,
    };
  }

  try {
    const { stdout } = await run(python, [getSibylBridgePath(), ...args], {
      timeout: env.SIBYL_TIMEOUT_MS,
      env: { ...process.env, SIBYL_DB_PATH: env.SIBYL_DB_PATH, SIBYL_TENANT_ID: env.AGENT_ID },
      maxBuffer: 1024 * 1024,
    });
    const parsed = JSON.parse(stdout) as Record<string, unknown>;
    if (parsed.ok !== true) {
      return {
        ok: false,
        configured: true,
        code: String(parsed.code ?? "bridge_error"),
        detail: String(parsed.detail ?? "The Sibyl bridge reported a failure."),
      };
    }
    return { ok: true, payload: parsed };
  } catch (error) {
    // Logged in full server-side; the caller is told it could not be reached,
    // which is all it needs to render the unavailable state honestly.
    console.error(`[sibyl] bridge command failed: ${args[0] ?? "(none)"}`, error);
    return {
      ok: false,
      configured: true,
      code: "bridge_unreachable",
      detail: "The Sibyl bridge could not be run.",
    };
  }
}

export async function getSibylStatus(): Promise<SibylStatus> {
  const outcome = await runBridge(["status"]);
  if (!outcome.ok) {
    if (!outcome.configured) return NOT_CONFIGURED;
    return {
      configured: true,
      reachable: false,
      code: outcome.code,
      detail: outcome.detail,
    };
  }

  const parsed = outcome.payload;
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
}

/**
 * Sibyl's verdict vocabulary, as its own enum defines it.
 *
 * Sibyl stamps exactly one of these on every result and is blunt about what
 * that buys: `ok` is the only member that accompanies a non-empty result, and
 * the other five are the causes of an empty one. There is no sixth reason to
 * return nothing, which is why this union is closed and an unrecognised code is
 * treated as a broken contract rather than quietly tolerated.
 */
export type SibylVerdictCode =
  | "ok"
  | "abstained_on"
  | "negation_abstain"
  | "gated"
  | "empty_store"
  | "no_match";

const VERDICT_CODES: readonly SibylVerdictCode[] = [
  "ok",
  "abstained_on",
  "negation_abstain",
  "gated",
  "empty_store",
  "no_match",
];

/**
 * A sentence per code, used only when the bridge sent none.
 *
 * These name the code we did receive. None of them describes the contents of a
 * store, because on five of the six we did not read one.
 */
const VERDICT_DETAIL: Record<SibylVerdictCode, string> = {
  ok: "Sibyl returned matching records.",
  empty_store: "Sibyl looked, and the store holds nothing yet.",
  no_match: "Sibyl looked, and nothing in the store matched this query.",
  abstained_on: "Sibyl abstained on this query, so nothing was looked up.",
  negation_abstain: "Sibyl abstained on the negation in this query, so nothing was looked up.",
  gated: "Sibyl gated this query, so nothing was looked up.",
};

/** One Sibyl entity, in the field names this boundary publishes. */
export interface SibylRecord {
  id: string;
  category: string;
  name: string;
  /**
   * Sibyl's own lifecycle label, and `null` on every entity written without
   * one — `set_entity` defaults `status` to `None`, so absent is the ordinary
   * case rather than a damaged record. Requiring a string here rejected every
   * real recall as a broken contract, which reached a decision as `ERROR` and
   * therefore `DENY`: a counterparty that *has* memory was denied while one
   * with none only needed approval.
   */
  status: string | null;
  /**
   * Whatever was written at write time. It crosses untouched and stays
   * `unknown`: typing it would be this file guessing at somebody else's JSON.
   */
  body: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface SibylVerdict {
  code: SibylVerdictCode;
  /** Why this code fired, in one sentence a surface can render as-is. */
  detail: string;
  /** Sibyl's own count of what it returned. */
  returned: number;
}

/**
 * The result of one recall.
 *
 * `reachable` is the field a caller must read first. `records` is empty on every
 * failure, and an empty list on its own says nothing: only `reachable: true`
 * plus a verdict means we looked.
 */
export interface SibylRecall {
  reachable: boolean;
  /** Present only when Sibyl answered. */
  verdict?: SibylVerdict;
  records: SibylRecord[];
  /** Why we could not look. Never shown as a memory result. */
  code?: string;
  detail?: string;
}

/** The result of one entity lookup. `reachable: true` with no record means it is genuinely absent. */
export interface SibylEntityLookup {
  reachable: boolean;
  /** Present only when Sibyl held this entity. */
  record?: SibylRecord;
  code?: string;
  detail?: string;
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isVerdictCode(value: unknown): value is SibylVerdictCode {
  return typeof value === "string" && (VERDICT_CODES as readonly string[]).includes(value);
}

function toVerdict(value: unknown): SibylVerdict | null {
  if (!isJsonObject(value)) return null;
  const { code, detail, returned } = value;
  if (!isVerdictCode(code) || typeof returned !== "number") return null;
  return {
    code,
    detail: typeof detail === "string" && detail.length > 0 ? detail : VERDICT_DETAIL[code],
    returned,
  };
}

/**
 * Reads one entity exactly as the bridge promised it, or gives up.
 *
 * A missing field is never filled in. A half-read record presented as memory is
 * a claim about a counterparty that nobody made, and the caller has no way to
 * tell which half it is reading.
 */
function toRecord(value: unknown): SibylRecord | null {
  if (!isJsonObject(value)) return null;
  const { id, category, name, status, createdAt, updatedAt } = value;
  if (
    typeof id !== "string" ||
    typeof category !== "string" ||
    typeof name !== "string" ||
    (typeof status !== "string" && status !== null) ||
    typeof createdAt !== "string" ||
    typeof updatedAt !== "string"
  ) {
    return null;
  }
  return { id, category, name, status, body: value.body, createdAt, updatedAt };
}

/**
 * A payload we cannot read is a failure to look, not a small answer.
 *
 * Dropping the records we could parse and returning the rest would report a
 * shorter memory than Sibyl holds, which reads as a fact about the counterparty.
 * The whole read fails instead, and says so.
 */
function contractFailure(reason: string, payload: unknown): { code: string; detail: string } {
  console.error("[sibyl] bridge payload did not match the contract", { reason, payload });
  return {
    code: "bridge_contract",
    detail: "The Sibyl bridge answered in a shape this service cannot read.",
  };
}

/**
 * How a verdict becomes a retrieval state.
 *
 * This file owns the boundary, so the table lives here; a caller folding a
 * recall into a `RetrievalResult` applies it.
 *
 *   ok (with records)  -> AVAILABLE    Sibyl returned records.
 *   empty_store        -> NO_HISTORY   We looked; the store is genuinely empty.
 *   no_match           -> NO_HISTORY   We looked; nothing matched this counterparty.
 *   abstained_on       -> ERROR, retryable: false
 *   negation_abstain   -> ERROR, retryable: false
 *   gated              -> ERROR, retryable: false
 *
 * The three abstentions are ERROR and not NO_HISTORY because an abstention is
 * Sibyl declining to answer: "we could not look", not "we looked and there is
 * nothing". Folded into NO_HISTORY, a refusal would reach an operator as "no
 * relationship history exists for this counterparty" — a clean bill of health
 * that nobody issued — and it would take the approval path reserved for a first,
 * genuinely unknown dealing. As ERROR it cannot: `authorizeFromRetrieval` denies
 * on ERROR unless a versioned policy softens it to REQUIRE_APPROVAL, and AUTO is
 * unreachable on every path.
 *
 * They are not retryable because the same query meets the same gate. A retry
 * loop would spend the operator's time to be refused in exactly the same words.
 *
 * The collapse to three states is what a decision needs. It is not what an
 * operator needs, so the verdict code and its sentence travel out of here
 * intact: three states must never cost us which of the six causes fired.
 */
export async function recallEntities(
  query: string,
  opts: { category?: string; limit?: number } = {},
): Promise<SibylRecall> {
  // Flags first, then `--`, then the query. The bridge stops reading flags at
  // `--`, so a query beginning with `--` is the query. Passed ahead of the
  // flags it was read as one: `?q=--limit` bound `--category` as the limit's
  // value, left `counterparty` as the query and dropped the category filter, so
  // the recall ran across every category and returned another category's record
  // bodies as this counterparty's memory.
  const args = ["recall"];
  if (opts.category !== undefined) args.push("--category", opts.category);
  if (opts.limit !== undefined) args.push("--limit", String(opts.limit));
  args.push("--", query);

  const outcome = await runBridge(args);
  if (!outcome.ok) {
    return { reachable: false, records: [], code: outcome.code, detail: outcome.detail };
  }

  const verdict = toVerdict(outcome.payload.verdict);
  if (!verdict) {
    const failure = contractFailure("recall carried no verdict this service recognises", outcome.payload);
    return { reachable: false, records: [], ...failure };
  }

  const raw: unknown = outcome.payload.records;
  if (!Array.isArray(raw)) {
    const failure = contractFailure("recall carried no records array", outcome.payload);
    return { reachable: false, records: [], ...failure };
  }

  const records: SibylRecord[] = [];
  for (const item of raw) {
    const record = toRecord(item);
    if (!record) {
      const failure = contractFailure("recall returned a record missing a required field", outcome.payload);
      return { reachable: false, records: [], ...failure };
    }
    records.push(record);
  }

  return { reachable: true, verdict, records };
}

/**
 * One entity by category and name.
 *
 * `entity_absent` is Sibyl answering — the bridge opened the store and found no
 * such entity — so it comes back `reachable: true` with no record. Every other
 * code means we never got an answer at all, and stays `reachable: false`. The
 * two look alike in a list and mean opposite things, which is precisely why the
 * caller is handed the distinction rather than a null.
 */
export async function getEntity(category: string, name: string): Promise<SibylEntityLookup> {
  const outcome = await runBridge(["entity", category, name]);
  if (!outcome.ok) {
    return {
      reachable: outcome.code === "entity_absent",
      code: outcome.code,
      detail: outcome.detail,
    };
  }

  const record = toRecord(outcome.payload.record);
  if (!record) {
    return { reachable: false, ...contractFailure("entity carried no readable record", outcome.payload) };
  }

  return { reachable: true, record };
}

/* ---------------------------------------------------------------------------
 * Below: two readers over the same bridge, kept apart on purpose.
 *
 * `recallEntities` / `getEntity` are the general recall path, and they carry
 * Sibyl's verdict so a caller can tell an empty store from a refusal.
 * `retrieveFromSibyl` / `listCounterpartiesFromSibyl` are the counterparty
 * readers that the Console's Agents surfaces consume directly.
 *
 * They share the bridge helper above and nothing else.
 * ------------------------------------------------------------------------ */

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
  const python = getSibylPython();
  if (!python) return { status: "ERROR", counterpartyKey, retryable: true };

  try {
    const { stdout } = await run(python, [getSibylBridgePath(), "retrieve", "counterparty", counterpartyKey], {
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
  const python = getSibylPython();
  if (!python) {
    return {
      ok: false,
      code: "not_configured",
      detail: "SIBYL_PYTHON is not set, so this deployment has no relationship memory to read.",
    };
  }

  try {
    const { stdout } = await run(python, [getSibylBridgePath(), "entities", "counterparty"], {
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

export interface RecordEpisodeOutcome {
  ok: boolean;
  eventId?: string;
  episodesCount?: number;
  code?: string;
  detail?: string;
}

export async function recordEpisodeToSibyl(
  counterpartyKey: string,
  episode: {
    run: string;
    taskType?: string;
    outcome: "accepted" | "rejected";
    note?: string;
    occurredAt?: string;
  },
  actor = "buyer_agent",
): Promise<RecordEpisodeOutcome> {
  const python = getSibylPython();
  if (!python) return { ok: false, code: "not_configured", detail: "SIBYL_PYTHON not configured" };

  try {
    const payload = {
      run: episode.run,
      task_type: episode.taskType ?? "mission",
      outcome: episode.outcome,
      note: episode.note ?? "",
      occurred_at: episode.occurredAt ?? new Date().toISOString(),
      actor,
    };
    const { stdout } = await run(
      python,
      [getSibylBridgePath(), "record_episode", counterpartyKey, JSON.stringify(payload), `--actor=${actor}`],
      {
        timeout: env.SIBYL_TIMEOUT_MS,
        env: { ...process.env, SIBYL_DB_PATH: env.SIBYL_DB_PATH, SIBYL_TENANT_ID: env.AGENT_ID },
        maxBuffer: 1024 * 1024,
      },
    );
    const parsed = JSON.parse(stdout) as Record<string, unknown>;
    if (parsed.ok !== true) {
      return {
        ok: false,
        code: String(parsed.code ?? "bridge_error"),
        detail: String(parsed.detail ?? "Failed to record episode"),
      };
    }
    return {
      ok: true,
      eventId: str(parsed, "event_id") ?? undefined,
      episodesCount: num(parsed, "episodes_count") ?? undefined,
    };
  } catch (error) {
    console.error("[sibyl] record episode failed", error);
    return { ok: false, code: "bridge_unreachable", detail: "Sibyl bridge failed to record episode" };
  }
}

export async function updateCounterpartyInSibyl(
  counterpartyKey: string,
  update: {
    relationshipStatus?: string;
    overallReliability?: number;
    confidence?: number;
    riskNote?: string;
  },
): Promise<{ ok: boolean; code?: string; detail?: string }> {
  const python = getSibylPython();
  if (!python) return { ok: false, code: "not_configured", detail: "SIBYL_PYTHON not configured" };

  try {
    const payload: Record<string, unknown> = {};
    if (update.relationshipStatus !== undefined) payload.relationship_status = update.relationshipStatus;
    if (update.overallReliability !== undefined) payload.overall_reliability = update.overallReliability;
    if (update.confidence !== undefined) payload.confidence = update.confidence;
    if (update.riskNote !== undefined) payload.risk_note = update.riskNote;

    const { stdout } = await run(
      python,
      [getSibylBridgePath(), "update_counterparty", counterpartyKey, JSON.stringify(payload)],
      {
        timeout: env.SIBYL_TIMEOUT_MS,
        env: { ...process.env, SIBYL_DB_PATH: env.SIBYL_DB_PATH, SIBYL_TENANT_ID: env.AGENT_ID },
        maxBuffer: 1024 * 1024,
      },
    );
    const parsed = JSON.parse(stdout) as Record<string, unknown>;
    return { ok: parsed.ok === true };
  } catch (error) {
    console.error("[sibyl] update counterparty failed", error);
    return { ok: false, code: "bridge_unreachable", detail: "Sibyl bridge failed to update counterparty" };
  }
}

export async function setMissionState(
  key: string,
  state: Record<string, unknown>,
): Promise<{ ok: boolean; code?: string; detail?: string }> {
  const python = getSibylPython();
  if (!python) return { ok: false, code: "not_configured", detail: "SIBYL_PYTHON not configured" };

  try {
    const { stdout } = await run(
      python,
      [getSibylBridgePath(), "set_state", key, JSON.stringify(state)],
      {
        timeout: env.SIBYL_TIMEOUT_MS,
        env: { ...process.env, SIBYL_DB_PATH: env.SIBYL_DB_PATH, SIBYL_TENANT_ID: env.AGENT_ID },
        maxBuffer: 1024 * 1024,
      },
    );
    const parsed = JSON.parse(stdout) as Record<string, unknown>;
    return { ok: parsed.ok === true };
  } catch (error) {
    console.error("[sibyl] set state failed", error);
    return { ok: false, code: "bridge_unreachable", detail: "Failed to set state" };
  }
}

export async function getMissionState(
  key: string,
): Promise<{ ok: boolean; state?: Record<string, unknown>; code?: string; detail?: string }> {
  const python = getSibylPython();
  if (!python) return { ok: false, code: "not_configured", detail: "SIBYL_PYTHON not configured" };

  try {
    const { stdout } = await run(
      python,
      [getSibylBridgePath(), "get_state", key],
      {
        timeout: env.SIBYL_TIMEOUT_MS,
        env: { ...process.env, SIBYL_DB_PATH: env.SIBYL_DB_PATH, SIBYL_TENANT_ID: env.AGENT_ID },
        maxBuffer: 1024 * 1024,
      },
    );
    const parsed = JSON.parse(stdout) as Record<string, unknown>;
    return { ok: parsed.ok === true, state: parsed.state as Record<string, unknown> | undefined };
  } catch (error) {
    console.error("[sibyl] get state failed", error);
    return { ok: false, code: "bridge_unreachable", detail: "Failed to get state" };
  }
}

export async function setPolicyReference(
  key: string,
  reference: Record<string, unknown>,
): Promise<{ ok: boolean; code?: string; detail?: string }> {
  const python = getSibylPython();
  if (!python) return { ok: false, code: "not_configured", detail: "SIBYL_PYTHON not configured" };

  try {
    const { stdout } = await run(
      python,
      [getSibylBridgePath(), "set_reference", key, JSON.stringify(reference)],
      {
        timeout: env.SIBYL_TIMEOUT_MS,
        env: { ...process.env, SIBYL_DB_PATH: env.SIBYL_DB_PATH, SIBYL_TENANT_ID: env.AGENT_ID },
        maxBuffer: 1024 * 1024,
      },
    );
    const parsed = JSON.parse(stdout) as Record<string, unknown>;
    return { ok: parsed.ok === true };
  } catch (error) {
    console.error("[sibyl] set reference failed", error);
    return { ok: false, code: "bridge_unreachable", detail: "Failed to set reference" };
  }
}

export async function getPolicyReference(
  key: string,
): Promise<{ ok: boolean; reference?: unknown; code?: string; detail?: string }> {
  const python = getSibylPython();
  if (!python) return { ok: false, code: "not_configured", detail: "SIBYL_PYTHON not configured" };

  try {
    const { stdout } = await run(
      python,
      [getSibylBridgePath(), "get_reference", key],
      {
        timeout: env.SIBYL_TIMEOUT_MS,
        env: { ...process.env, SIBYL_DB_PATH: env.SIBYL_DB_PATH, SIBYL_TENANT_ID: env.AGENT_ID },
        maxBuffer: 1024 * 1024,
      },
    );
    const parsed = JSON.parse(stdout) as Record<string, unknown>;
    return { ok: parsed.ok === true, reference: parsed.reference };
  } catch (error) {
    console.error("[sibyl] get reference failed", error);
    return { ok: false, code: "bridge_unreachable", detail: "Failed to get reference" };
  }
}

export async function archiveCounterpartyInSibyl(
  counterpartyKey: string,
  reason = "operator_archived",
): Promise<{ ok: boolean; code?: string; detail?: string }> {
  const python = getSibylPython();
  if (!python) return { ok: false, code: "not_configured", detail: "SIBYL_PYTHON not configured" };

  try {
    const { stdout } = await run(
      python,
      [getSibylBridgePath(), "archive_entity", "counterparty", counterpartyKey, reason],
      {
        timeout: env.SIBYL_TIMEOUT_MS,
        env: { ...process.env, SIBYL_DB_PATH: env.SIBYL_DB_PATH, SIBYL_TENANT_ID: env.AGENT_ID },
        maxBuffer: 1024 * 1024,
      },
    );
    const parsed = JSON.parse(stdout) as Record<string, unknown>;
    return { ok: parsed.ok === true };
  } catch (error) {
    console.error("[sibyl] archive entity failed", error);
    return { ok: false, code: "bridge_unreachable", detail: "Failed to archive entity" };
  }
}

export async function readMemoryJournal(limit = 50): Promise<{ ok: boolean; events?: unknown[]; code?: string }> {
  const python = getSibylPython();
  if (!python) return { ok: false, code: "not_configured" };

  try {
    const { stdout } = await run(
      python,
      [getSibylBridgePath(), "events", `--limit=${limit}`],
      {
        timeout: env.SIBYL_TIMEOUT_MS,
        env: { ...process.env, SIBYL_DB_PATH: env.SIBYL_DB_PATH, SIBYL_TENANT_ID: env.AGENT_ID },
        maxBuffer: 2 * 1024 * 1024,
      },
    );
    const parsed = JSON.parse(stdout) as Record<string, unknown>;
    return { ok: parsed.ok === true, events: Array.isArray(parsed.events) ? parsed.events : [] };
  } catch (error) {
    console.error("[sibyl] read journal failed", error);
    return { ok: false, code: "bridge_unreachable" };
  }
}


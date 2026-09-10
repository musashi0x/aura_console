import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, statSync, unlinkSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import type {
  RecordEpisodeOutcome,
  SibylCounterparties,
  SibylCounterparty,
  SibylEntityLookup,
  SibylEpisode,
  SibylRecall,
  SibylRecord,
  SibylRetrieval,
  SibylStatus,
} from "./sibyl.js";

export interface NativeEntity {
  id: string;
  category: string;
  name: string;
  status: string | null;
  body: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

interface EntityRow {
  key: string;
  id: string;
  category: string;
  name: string;
  status: string | null;
  body: string;
  created_at: string;
  updated_at: string;
}

export interface NativeCounterpartyUpdate {
  relationshipStatus?: string;
  relationship_status?: string;
  overallReliability?: number;
  overall_reliability?: number;
  confidence?: number;
  riskNote?: string;
  risk_note?: string;
  alpha?: number;
  beta?: number;
  consecutiveFailures?: number;
  consecutive_failures?: number;
  totalMissions?: number;
  total_missions?: number;
  blockedReason?: string | null;
  blocked_reason?: string | null;
  taskFit?: number;
  task_fit?: number;
  observedPriceUsdc?: string;
  observed_price_usdc?: string;
}

export const DEFAULT_UNOBSERVED_PRIORS = {
  overallReliability: 0.5,
  confidence: 0.0,
  episodesUsed: 0,
} as const;

export const INITIAL_FIXTURE_ENTITIES: NativeEntity[] = [
  {
    id: "entity_alpha_fixture",
    category: "counterparty",
    name: "virtuals:agent:alpha",
    status: "active",
    body: {
      source: "fixture",
      display_name: "Alpha Research",
      relationship_status: "WATCH",
      overall_reliability: 0.42,
      task_fit: 0.71,
      confidence: 0.88,
      observed_price_usdc: "9.00",
      episodes: [
        {
          run: "98",
          task_type: "market-research",
          outcome: "rejected",
          note: "Delivered 41 hours late and the deliverable failed acceptance.",
          occurred_at: "2026-08-14T09:12:00Z",
        },
        {
          run: "104",
          task_type: "market-research",
          outcome: "accepted",
          note: "Delivered on time at the quoted price.",
          occurred_at: "2026-07-30T15:40:00Z",
        },
      ],
      risk_note: "One acceptance failure inside the last 30 days applies a risk penalty.",
    },
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-14T09:12:00.000Z",
  },
  {
    id: "entity_beta_fixture",
    category: "counterparty",
    name: "virtuals:agent:beta",
    status: "active",
    body: {
      source: "fixture",
      display_name: "Beta Labs",
      relationship_status: "PREFERRED",
      overall_reliability: 0.91,
      task_fit: 0.83,
      confidence: 0.90,
      observed_price_usdc: "12.00",
      episodes: [
        {
          run: "116",
          task_type: "market-research",
          outcome: "accepted",
          note: "Delivered early; deliverable accepted without revision.",
          occurred_at: "2026-08-22T11:05:00Z",
        },
        {
          run: "121",
          task_type: "market-research",
          outcome: "accepted",
          note: "Delivered on time at the quoted price.",
          occurred_at: "2026-08-29T08:31:00Z",
        },
      ],
      risk_note: "No acceptance failures on record.",
    },
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-29T08:31:00.000Z",
  },
];

let currentDb: DatabaseSync | null = null;
let currentDbPath: string | null = null;
let lastStorageError: string | null = null;

export function getLastStorageError(): string | null {
  return lastStorageError;
}

export function clearLastStorageError(): void {
  lastStorageError = null;
}

export function getNativeStoragePath(): string {
  const envPath =
    process.env.SIBYL_NATIVE_DB_PATH ||
    process.env.SIBYL_STORAGE_PATH ||
    process.env.AURA_NATIVE_STORAGE_PATH;
  if (envPath && envPath.trim().length > 0) {
    const trimmed = envPath.trim();
    if (trimmed === ":memory:") return ":memory:";
    if (trimmed.startsWith("~/") || trimmed === "~") {
      return path.join(os.homedir(), trimmed.replace(/^~[\\/]?/, ""));
    }
    return path.resolve(trimmed);
  }
  return path.join(os.homedir(), ".sibyl-memory", "native-storage.db");
}

export function closeNativeSibylDatabase(): void {
  if (currentDb) {
    try {
      currentDb.close();
    } catch {
      // ignore
    }
    currentDb = null;
    currentDbPath = null;
  }
}

function seedFixtures(db: DatabaseSync): void {
  const insert = db.prepare(`
    INSERT OR REPLACE INTO entities (key, id, category, name, status, body, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const entity of INITIAL_FIXTURE_ENTITIES) {
    insert.run(
      `${entity.category}:${entity.name}`,
      entity.id,
      entity.category,
      entity.name,
      entity.status,
      JSON.stringify(entity.body),
      entity.createdAt,
      entity.updatedAt,
    );
  }
}

export interface ResetStoreOptions {
  seedFixtures?: boolean;
}

export function resetNativeSibylStorage(options: ResetStoreOptions = {}): {
  ok: boolean;
  entityCount: number;
} {
  return resetNativeSibylStore(options);
}

export function resetNativeSibylStore(options: ResetStoreOptions = {}): {
  ok: boolean;
  entityCount: number;
} {
  closeNativeSibylDatabase();
  const targetPath = getNativeStoragePath();
  if (targetPath !== ":memory:") {
    for (const ext of ["", "-wal", "-shm", "-journal"]) {
      const f = targetPath + ext;
      if (existsSync(f)) {
        try {
          unlinkSync(f);
        } catch {
          // ignore
        }
      }
    }
  }
  if (options.seedFixtures) {
    const db = getDb(true);
    if (db) {
      seedFixtures(db);
      const countRow = db.prepare("SELECT count(*) as count FROM entities").get() as
        | { count: number | bigint }
        | undefined;
      return { ok: true, entityCount: Number(countRow?.count ?? 0) };
    }
  }
  return { ok: true, entityCount: 0 };
}

function getDb(forWrite = false): DatabaseSync | null {
  if (process.env.SIBYL_STORAGE_UNAVAILABLE === "true") {
    if (currentDb) {
      closeNativeSibylDatabase();
    }
    lastStorageError = "Native durable storage unavailable via SIBYL_STORAGE_UNAVAILABLE";
    return null;
  }
  const targetPath = getNativeStoragePath();

  if (currentDb && currentDbPath !== targetPath) {
    closeNativeSibylDatabase();
  }

  if (targetPath !== ":memory:") {
    const exists = existsSync(targetPath);
    if (!exists) {
      if (currentDb) {
        closeNativeSibylDatabase();
      }
      if (!forWrite) {
        return null;
      }
    }
  }

  if (currentDb) {
    return currentDb;
  }

  if (targetPath !== ":memory:") {
    const dir = path.dirname(targetPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }

  const maxRetries = forWrite ? 20 : 5;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const db = new DatabaseSync(targetPath);
      db.exec("PRAGMA busy_timeout = 10000;");
      db.exec("PRAGMA journal_mode = WAL;");
      db.exec("PRAGMA synchronous = NORMAL;");
      db.exec(`
        CREATE TABLE IF NOT EXISTS entities (
          key TEXT PRIMARY KEY,
          id TEXT NOT NULL,
          category TEXT NOT NULL,
          name TEXT NOT NULL,
          status TEXT,
          body TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_entities_category ON entities(category);
        CREATE INDEX IF NOT EXISTS idx_entities_category_name ON entities(category, name);
      `);

      const countRow = db.prepare("SELECT count(*) as count FROM entities").get() as
        | { count: number | bigint }
        | undefined;
      const count = Number(countRow?.count ?? 0);
      if (
        count === 0 &&
        process.env.SIBYL_SEED_FIXTURES !== "false" &&
        process.env.AURA_NATIVE_AUTO_SEED !== "false" &&
        !forWrite
      ) {
        seedFixtures(db);
      }

      currentDb = db;
      currentDbPath = targetPath;
      return db;
    } catch (err) {
      const msg = (err as Error).message;
      if (attempt < maxRetries - 1 && (msg.includes("locked") || msg.includes("busy"))) {
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50 + Math.floor(Math.random() * 50));
        continue;
      }
      console.warn("[native-sibyl] Database initialization/access error:", msg);
      return null;
    }
  }
  return null;
}

/**
 * Executes a synchronous operation inside a SQLite `BEGIN IMMEDIATE` transaction.
 *
 * Guarantees:
 * 1. Immediate exclusive write reservation preventing concurrent read-modify-write lost updates.
 * 2. If BEGIN IMMEDIATE fails (e.g. lock timeout / busy), no ROLLBACK is attempted, preventing
 *    secondary "cannot rollback - no transaction is active" unhandled exceptions.
 * 3. If the callback or COMMIT throws while transaction is active, ROLLBACK is executed.
 * 4. Any secondary failure during ROLLBACK itself is safely suppressed to ensure the root cause is returned.
 * 5. Preserves synchronous function contracts without async/await or event-loop overhead.
 */
function withImmediateTransaction<T>(db: DatabaseSync, action: () => T): T {
  let inTx = false;
  try {
    db.exec("BEGIN IMMEDIATE;");
    inTx = true;
    const result = action();
    db.exec("COMMIT;");
    inTx = false;
    return result;
  } catch (err) {
    if (inTx) {
      try {
        db.exec("ROLLBACK;");
      } catch {
        // Suppress secondary rollback failures if transaction already auto-aborted
      }
    }
    throw err;
  }
}

function num(body: Record<string, unknown>, key: string): number | null {
  const value = body[key];
  return typeof value === "number" ? value : null;
}

function str(body: Record<string, unknown>, key: string): string | null {
  const value = body[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function hasProfileBody(body: Record<string, unknown>): boolean {
  return (
    str(body, "relationship_status") !== null ||
    num(body, "overall_reliability") !== null ||
    num(body, "task_fit") !== null ||
    num(body, "confidence") !== null ||
    num(body, "alpha") !== null ||
    num(body, "beta") !== null
  );
}

function episodeCount(body: Record<string, unknown>): number {
  const episodes = body.episodes;
  return Array.isArray(episodes) ? episodes.length : 0;
}

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

export function getNativeSibylStatus(): SibylStatus {
  try {
    if (process.env.SIBYL_STORAGE_UNAVAILABLE === "true") {
      return {
        configured: true,
        reachable: false,
        backend: "native_durable",
        fallback_active: false,
        code: "storage_unreachable",
        detail: "Native durable storage unavailable via SIBYL_STORAGE_UNAVAILABLE",
        tier: "embedded",
        schemaVersion: 4,
        dbSizeBytes: 0,
        softCapBytes: 104857600,
        atOrAboveCap: false,
        entityCount: 0,
      };
    }
    const db = getDb(false);
    if (!db) {
      return {
        configured: true,
        reachable: true,
        backend: "native_durable",
        fallback_active: false,
        code: "native_durable_active",
        detail: "Native durable storage active. Store file is empty or absent on disk.",
        tier: "embedded",
        schemaVersion: 4,
        dbSizeBytes: 0,
        softCapBytes: 104857600,
        atOrAboveCap: false,
        entityCount: 0,
      };
    }
    const countRow = db.prepare("SELECT count(*) as count FROM entities").get() as
      | { count: number | bigint }
      | undefined;
    const count = Number(countRow?.count ?? 0);
    const dbPath = getNativeStoragePath();
    let dbSizeBytes = 16384;
    if (dbPath !== ":memory:" && existsSync(dbPath)) {
      try {
        dbSizeBytes = statSync(dbPath).size;
      } catch {
        dbSizeBytes = 16384;
      }
    }
    return {
      configured: true,
      reachable: true,
      backend: "native_durable",
      fallback_active: false,
      code: "native_durable_active",
      detail: "Native durable storage active.",
      tier: "embedded",
      schemaVersion: 4,
      dbSizeBytes,
      softCapBytes: 104857600,
      atOrAboveCap: false,
      entityCount: count,
      dbPath,
    };
  } catch (err) {
    return {
      configured: true,
      reachable: false,
      backend: "native_durable",
      fallback_active: false,
      code: "storage_error",
      detail: `Native durable storage error: ${(err as Error).message}`,
      tier: "embedded",
      schemaVersion: 4,
      dbSizeBytes: 0,
      softCapBytes: 104857600,
      atOrAboveCap: false,
      entityCount: 0,
    };
  }
}

export function recallNativeEntities(
  query: string,
  opts: { category?: string; limit?: number } = {},
): SibylRecall {
  if (process.env.SIBYL_STORAGE_UNAVAILABLE === "true") {
    return {
      reachable: false,
      records: [],
      code: "storage_unreachable",
      detail: "Native durable storage unavailable via SIBYL_STORAGE_UNAVAILABLE",
    };
  }
  const db = getDb(false);
  if (!db) {
    return {
      reachable: true,
      verdict: {
        code: "empty_store",
        detail: "Sibyl looked, and the store holds nothing yet.",
        returned: 0,
      },
      records: [],
    };
  }
  try {
    const category = opts.category ?? "counterparty";
    const rows = db.prepare("SELECT * FROM entities WHERE category = ?").all(category) as unknown as EntityRow[];
    if (rows.length === 0) {
      return {
        reachable: true,
        verdict: {
          code: "empty_store",
          detail: "Sibyl looked, and the store holds nothing yet.",
          returned: 0,
        },
        records: [],
      };
    }

    const norm = query.trim().toLowerCase();
    const matches: SibylRecord[] = [];

    for (const row of rows) {
      let body: Record<string, unknown> = {};
      try {
        body = JSON.parse(row.body) as Record<string, unknown>;
      } catch {
        continue;
      }

      let isMatch = false;
      if (!norm) {
        isMatch = true;
      } else if (row.name.toLowerCase().includes(norm)) {
        isMatch = true;
      } else {
        const dName = typeof body.display_name === "string" ? body.display_name.toLowerCase() : "";
        if (dName.includes(norm)) {
          isMatch = true;
        } else if (JSON.stringify(body).toLowerCase().includes(norm)) {
          isMatch = true;
        }
      }

      if (isMatch) {
        matches.push({
          id: row.id,
          category: row.category,
          name: row.name,
          status: row.status,
          body,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        });
      }
    }

    const limit = opts.limit ?? 20;
    const sliced = matches.slice(0, limit);
    if (sliced.length === 0) {
      return {
        reachable: true,
        verdict: {
          code: "no_match",
          detail: "Sibyl looked, and nothing in the store matched this query.",
          returned: 0,
        },
        records: [],
      };
    }

    return {
      reachable: true,
      verdict: {
        code: "ok",
        detail: "Sibyl returned matching records.",
        returned: sliced.length,
      },
      records: sliced,
    };
  } catch (err) {
    console.warn("[native-sibyl] recallNativeEntities error:", (err as Error).message);
    return {
      reachable: true,
      verdict: {
        code: "empty_store",
        detail: "Sibyl looked, and the store holds nothing yet.",
        returned: 0,
      },
      records: [],
    };
  }
}

export function getNativeEntity(category: string, name: string): SibylEntityLookup {
  const db = getDb(false);
  if (!db) {
    return {
      reachable: true,
      code: "entity_absent",
      detail: `No Sibyl entity at ${category}/${name}`,
    };
  }
  try {
    const row = db.prepare("SELECT * FROM entities WHERE category = ? AND name = ?").get(category, name) as unknown as EntityRow | undefined;
    if (!row) {
      return {
        reachable: true,
        code: "entity_absent",
        detail: `No Sibyl entity at ${category}/${name}`,
      };
    }
    let body: Record<string, unknown> = {};
    try {
      body = JSON.parse(row.body) as Record<string, unknown>;
    } catch {
      body = {};
    }
    return {
      reachable: true,
      record: {
        id: row.id,
        category: row.category,
        name: row.name,
        status: row.status,
        body,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      },
    };
  } catch (err) {
    console.warn("[native-sibyl] getNativeEntity error:", (err as Error).message);
    return {
      reachable: true,
      code: "entity_absent",
      detail: `No Sibyl entity at ${category}/${name}`,
    };
  }
}

export function retrieveNativeFromSibyl(counterpartyKey: string): SibylRetrieval {
  if (process.env.SIBYL_STORAGE_UNAVAILABLE === "true") {
    return {
      status: "ERROR",
      counterpartyKey,
      retryable: true,
      code: "storage_unreachable",
      detail: "Native durable storage unavailable via SIBYL_STORAGE_UNAVAILABLE",
    };
  }
  const db = getDb(false);
  if (!db) {
    return {
      status: "NO_HISTORY",
      counterpartyKey,
      overallReliability: DEFAULT_UNOBSERVED_PRIORS.overallReliability,
      confidence: DEFAULT_UNOBSERVED_PRIORS.confidence,
      episodesUsed: DEFAULT_UNOBSERVED_PRIORS.episodesUsed,
    };
  }
  try {
    const row = db
      .prepare("SELECT * FROM entities WHERE category = 'counterparty' AND name = ?")
      .get(counterpartyKey) as unknown as EntityRow | undefined;
    if (!row) {
      return {
        status: "NO_HISTORY",
        counterpartyKey,
        overallReliability: DEFAULT_UNOBSERVED_PRIORS.overallReliability,
        confidence: DEFAULT_UNOBSERVED_PRIORS.confidence,
        episodesUsed: DEFAULT_UNOBSERVED_PRIORS.episodesUsed,
      };
    }
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(row.body) as Record<string, unknown>;
    } catch {
      return {
        status: "NO_HISTORY",
        counterpartyKey,
        overallReliability: DEFAULT_UNOBSERVED_PRIORS.overallReliability,
        confidence: DEFAULT_UNOBSERVED_PRIORS.confidence,
        episodesUsed: DEFAULT_UNOBSERVED_PRIORS.episodesUsed,
      };
    }
    if (!hasProfileBody(body)) {
      return {
        status: "NO_HISTORY",
        counterpartyKey,
        overallReliability: DEFAULT_UNOBSERVED_PRIORS.overallReliability,
        confidence: DEFAULT_UNOBSERVED_PRIORS.confidence,
        episodesUsed: DEFAULT_UNOBSERVED_PRIORS.episodesUsed,
      };
    }
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
      alpha: num(body, "alpha") ?? undefined,
      beta: num(body, "beta") ?? undefined,
      consecutiveFailures:
        num(body, "consecutive_failures") ??
        num(body, "consecutiveFailures") ??
        undefined,
      totalMissions:
        num(body, "total_missions") ??
        num(body, "totalMissions") ??
        undefined,
      blockedReason:
        str(body, "blocked_reason") ??
        str(body, "blockedReason") ??
        undefined,
    };
  } catch (err) {
    console.warn("[native-sibyl] retrieveNativeFromSibyl error:", (err as Error).message);
    return {
      status: "NO_HISTORY",
      counterpartyKey,
      overallReliability: DEFAULT_UNOBSERVED_PRIORS.overallReliability,
      confidence: DEFAULT_UNOBSERVED_PRIORS.confidence,
      episodesUsed: DEFAULT_UNOBSERVED_PRIORS.episodesUsed,
    };
  }
}

export function listNativeCounterpartiesFromSibyl(): SibylCounterparties {
  if (process.env.SIBYL_STORAGE_UNAVAILABLE === "true") {
    return {
      ok: false,
      code: "storage_unreachable",
      detail: "Native durable storage unavailable via SIBYL_STORAGE_UNAVAILABLE",
    };
  }
  const db = getDb(false);
  if (!db) {
    return { ok: true, items: [] };
  }
  try {
    const rows = db
      .prepare("SELECT * FROM entities WHERE category = 'counterparty'")
      .all() as unknown as EntityRow[];
    const items: SibylCounterparty[] = rows.map((row) => {
      let body: Record<string, unknown> = {};
      try {
        body = JSON.parse(row.body) as Record<string, unknown>;
      } catch {
        body = {};
      }
      return {
        counterpartyKey: row.name,
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
        updatedAt: row.updated_at,
        alpha: num(body, "alpha") ?? undefined,
        beta: num(body, "beta") ?? undefined,
        consecutiveFailures:
          num(body, "consecutive_failures") ??
          num(body, "consecutiveFailures") ??
          undefined,
        totalMissions:
          num(body, "total_missions") ??
          num(body, "totalMissions") ??
          undefined,
        blockedReason:
          str(body, "blocked_reason") ??
          str(body, "blockedReason") ??
          undefined,
      };
    });
    return { ok: true, items };
  } catch (err) {
    console.warn("[native-sibyl] listNativeCounterpartiesFromSibyl error:", (err as Error).message);
    return { ok: true, items: [] };
  }
}

export function recordEpisodeToNativeSibyl(
  counterpartyKey: string,
  episode: {
    run: string;
    taskType?: string;
    outcome: "accepted" | "rejected";
    note?: string;
    occurredAt?: string;
  },
): RecordEpisodeOutcome {
  const db = getDb(true);
  if (!db) {
    return { ok: false, code: "storage_unavailable", detail: "Could not open native SQLite database" };
  }
  try {
    return withImmediateTransaction(db, () => {
      const key = `counterparty:${counterpartyKey}`;
      const row = db.prepare("SELECT * FROM entities WHERE key = ?").get(key) as unknown as EntityRow | undefined;
      const now = new Date().toISOString();
      let id: string;
      let createdAt: string;
      let body: Record<string, unknown>;

      if (!row) {
        id = randomUUID();
        createdAt = now;
        body = {
          display_name: counterpartyKey,
          relationship_status: "KNOWN",
          episodes: [],
        };
      } else {
        id = row.id;
        createdAt = row.created_at;
        try {
          body = JSON.parse(row.body) as Record<string, unknown>;
        } catch {
          body = { episodes: [] };
        }
      }

      const episodes = Array.isArray(body.episodes)
        ? (body.episodes as Record<string, unknown>[])
        : [];
      const eventId = randomUUID();
      episodes.push({
        run: episode.run,
        task_type: episode.taskType ?? "mission",
        outcome: episode.outcome,
        note: episode.note ?? "",
        occurred_at: episode.occurredAt ?? now,
      });
      body.episodes = episodes;

      const upsert = db.prepare(`
        INSERT INTO entities (key, id, category, name, status, body, created_at, updated_at)
        VALUES (?, ?, 'counterparty', ?, 'active', ?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET
          body = excluded.body,
          updated_at = excluded.updated_at
      `);
      upsert.run(key, id, counterpartyKey, JSON.stringify(body), createdAt, now);

      return { ok: true, eventId, episodesCount: episodes.length };
    });
  } catch (err) {
    console.warn("[native-sibyl] recordEpisodeToNativeSibyl error:", (err as Error).message);
    return { ok: false, code: "storage_error", detail: (err as Error).message };
  }
}

export function updateNativeCounterpartyInSibyl(
  counterpartyKey: string,
  update: NativeCounterpartyUpdate,
): { ok: boolean; code?: string; detail?: string } {
  const db = getDb(true);
  if (!db) {
    return { ok: false, code: "storage_unavailable", detail: "Could not open native SQLite database" };
  }
  try {
    return withImmediateTransaction(db, () => {
      const key = `counterparty:${counterpartyKey}`;
      const row = db.prepare("SELECT * FROM entities WHERE key = ?").get(key) as unknown as EntityRow | undefined;
      const now = new Date().toISOString();
      let id: string;
      let createdAt: string;
      let body: Record<string, unknown>;

      const relStatus = update.relationshipStatus ?? update.relationship_status;
      const relReliability = update.overallReliability ?? update.overall_reliability;
      const rNote = update.riskNote ?? update.risk_note;
      const cFailures = update.consecutiveFailures ?? update.consecutive_failures;
      const tMissions = update.totalMissions ?? update.total_missions;
      const bReason = update.blockedReason ?? update.blocked_reason;

      if (!row) {
        id = randomUUID();
        createdAt = now;
        body = {
          display_name: counterpartyKey,
          relationship_status: relStatus ?? "KNOWN",
          overall_reliability: relReliability,
          confidence: update.confidence,
          risk_note: rNote,
          episodes: [],
        };
      } else {
        id = row.id;
        createdAt = row.created_at;
        try {
          body = JSON.parse(row.body) as Record<string, unknown>;
        } catch {
          body = { episodes: [] };
        }
        if (relStatus !== undefined) body.relationship_status = relStatus;
        if (relReliability !== undefined) body.overall_reliability = relReliability;
        if (update.confidence !== undefined) body.confidence = update.confidence;
        if (rNote !== undefined) body.risk_note = rNote;
      }

      if (update.alpha !== undefined) body.alpha = update.alpha;
      if (update.beta !== undefined) body.beta = update.beta;
      if (cFailures !== undefined) body.consecutive_failures = cFailures;
      if (tMissions !== undefined) body.total_missions = tMissions;
      if (bReason !== undefined) body.blocked_reason = bReason;
      const tFit = update.taskFit ?? update.task_fit;
      if (tFit !== undefined) body.task_fit = tFit;
      const obsPrice = update.observedPriceUsdc ?? update.observed_price_usdc;
      if (obsPrice !== undefined) body.observed_price_usdc = obsPrice;

      const upsert = db.prepare(`
        INSERT INTO entities (key, id, category, name, status, body, created_at, updated_at)
        VALUES (?, ?, 'counterparty', ?, 'active', ?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET
          body = excluded.body,
          updated_at = excluded.updated_at
      `);
      upsert.run(key, id, counterpartyKey, JSON.stringify(body), createdAt, now);

      return { ok: true };
    });
  } catch (err) {
    console.warn("[native-sibyl] updateNativeCounterpartyInSibyl error:", (err as Error).message);
    return { ok: false, code: "storage_error", detail: (err as Error).message };
  }
}

export function setNativeMissionState(
  key: string,
  state: Record<string, unknown>,
): { ok: boolean; code?: string; detail?: string } {
  const db = getDb(true);
  if (!db) {
    return { ok: false, code: "storage_unavailable", detail: "Could not open native SQLite database" };
  }
  try {
    const entityKey = `hot_state:${key}`;
    const now = new Date().toISOString();
    const id = randomUUID();
    const upsert = db.prepare(`
      INSERT INTO entities (key, id, category, name, status, body, created_at, updated_at)
      VALUES (?, ?, 'hot_state', ?, 'active', ?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        body = excluded.body,
        updated_at = excluded.updated_at
    `);
    upsert.run(entityKey, id, key, JSON.stringify(state), now, now);
    return { ok: true };
  } catch (err) {
    console.warn("[native-sibyl] setNativeMissionState error:", (err as Error).message);
    return { ok: false, code: "storage_error", detail: (err as Error).message };
  }
}

export function getNativeMissionState(
  key: string,
): { ok: boolean; state?: Record<string, unknown>; code?: string; detail?: string } {
  const db = getDb(false);
  if (!db) {
    return { ok: true, state: undefined };
  }
  try {
    const entityKey = `hot_state:${key}`;
    const row = db.prepare("SELECT body FROM entities WHERE key = ?").get(entityKey) as
      | { body: string }
      | undefined;
    let state: Record<string, unknown> | undefined = undefined;
    if (row) {
      try {
        state = JSON.parse(row.body) as Record<string, unknown>;
      } catch {
        state = undefined;
      }
    }
    return { ok: true, state };
  } catch (err) {
    console.warn("[native-sibyl] getNativeMissionState error:", (err as Error).message);
    return { ok: true, state: undefined };
  }
}

export function setNativePolicyReference(
  key: string,
  reference: Record<string, unknown>,
): { ok: boolean; code?: string; detail?: string } {
  const db = getDb(true);
  if (!db) {
    return { ok: false, code: "storage_unavailable", detail: "Could not open native SQLite database" };
  }
  try {
    const entityKey = `reference:${key}`;
    const now = new Date().toISOString();
    const id = randomUUID();
    const upsert = db.prepare(`
      INSERT INTO entities (key, id, category, name, status, body, created_at, updated_at)
      VALUES (?, ?, 'reference', ?, 'active', ?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        body = excluded.body,
        updated_at = excluded.updated_at
    `);
    upsert.run(entityKey, id, key, JSON.stringify(reference), now, now);
    return { ok: true };
  } catch (err) {
    console.warn("[native-sibyl] setNativePolicyReference error:", (err as Error).message);
    return { ok: false, code: "storage_error", detail: (err as Error).message };
  }
}

export function getNativePolicyReference(
  key: string,
): { ok: boolean; reference?: unknown; code?: string; detail?: string } {
  const db = getDb(false);
  if (!db) {
    return { ok: true, reference: null };
  }
  try {
    const entityKey = `reference:${key}`;
    const row = db.prepare("SELECT body FROM entities WHERE key = ?").get(entityKey) as
      | { body: string }
      | undefined;
    let ref: unknown = null;
    if (row) {
      try {
        ref = JSON.parse(row.body);
      } catch {
        ref = null;
      }
    }
    return { ok: true, reference: ref };
  } catch (err) {
    console.warn("[native-sibyl] getNativePolicyReference error:", (err as Error).message);
    return { ok: true, reference: null };
  }
}

export function archiveNativeCounterpartyInSibyl(
  counterpartyKey: string,
  reason = "operator_archived",
): { ok: boolean; code?: string; detail?: string } {
  const db = getDb(true);
  if (!db) {
    return { ok: false, code: "storage_unavailable", detail: "Could not open native SQLite database" };
  }
  try {
    return withImmediateTransaction(db, () => {
      const key = `counterparty:${counterpartyKey}`;
      const row = db.prepare("SELECT * FROM entities WHERE key = ?").get(key) as unknown as EntityRow | undefined;
      if (row) {
        const now = new Date().toISOString();
        let body: Record<string, unknown> = {};
        try {
          body = JSON.parse(row.body) as Record<string, unknown>;
        } catch {
          body = {};
        }
        body.archive_reason = reason;
        body.status = "ARCHIVED";
        db.prepare(`
          UPDATE entities
          SET status = 'ARCHIVED', body = ?, updated_at = ?
          WHERE key = ?
        `).run(JSON.stringify(body), now, key);
      }
      return { ok: true };
    });
  } catch (err) {
    console.warn("[native-sibyl] archiveNativeCounterpartyInSibyl error:", (err as Error).message);
    return { ok: false, code: "storage_error", detail: (err as Error).message };
  }
}

export function readNativeMemoryJournal(
  limit = 50,
  counterpartyKey?: string,
): {
  ok: boolean;
  count: number;
  events: unknown[];
  episodes: unknown[];
  code?: string;
  detail?: string;
} {
  const db = getDb(false);
  if (!db) {
    return {
      ok: true,
      count: 0,
      events: [],
      episodes: [],
    };
  }
  try {
    let rows: EntityRow[];
    if (counterpartyKey) {
      rows = db
        .prepare("SELECT * FROM entities WHERE category = 'counterparty' AND name = ?")
        .all(counterpartyKey) as unknown as EntityRow[];
    } else {
      rows = db
        .prepare("SELECT * FROM entities WHERE category = 'counterparty'")
        .all() as unknown as EntityRow[];
    }

    const allEpisodes: Record<string, unknown>[] = [];
    for (const row of rows) {
      let body: Record<string, unknown>;
      try {
        body = JSON.parse(row.body) as Record<string, unknown>;
      } catch {
        continue;
      }
      const episodes = Array.isArray(body.episodes) ? body.episodes : [];
      for (const ep of episodes) {
        const episode = (ep ?? {}) as Record<string, unknown>;
        allEpisodes.push({
          run: episode.run,
          counterpartyKey: row.name,
          counterparty_key: row.name,
          taskType: episode.task_type ?? episode.taskType ?? "mission",
          task_type: episode.task_type ?? episode.taskType ?? "mission",
          outcome: episode.outcome,
          note: episode.note,
          occurredAt: episode.occurred_at ?? episode.occurredAt ?? row.updated_at,
          occurred_at: episode.occurred_at ?? episode.occurredAt ?? row.updated_at,
          evaluated: {
            counterpartyKey: row.name,
            run: episode.run,
            outcome: episode.outcome,
          },
        });
      }
    }

    allEpisodes.sort((a, b) => {
      const timeA = typeof a.occurred_at === "string" ? new Date(a.occurred_at).getTime() : 0;
      const timeB = typeof b.occurred_at === "string" ? new Date(b.occurred_at).getTime() : 0;
      return timeB - timeA;
    });

    const sliced = allEpisodes.slice(0, limit);
    return {
      ok: true,
      count: sliced.length,
      events: sliced,
      episodes: sliced,
    };
  } catch (err) {
    console.warn("[native-sibyl] readNativeMemoryJournal error:", (err as Error).message);
    return {
      ok: true,
      count: 0,
      events: [],
      episodes: [],
    };
  }
}


import { randomUUID } from "node:crypto";

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

const INITIAL_FIXTURE_ENTITIES: NativeEntity[] = [
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

const nativeEntities = new Map<string, NativeEntity>(
  INITIAL_FIXTURE_ENTITIES.map((e) => [`${e.category}:${e.name}`, e]),
);

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
    num(body, "confidence") !== null
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
  return {
    configured: true,
    reachable: true,
    tier: "embedded",
    schemaVersion: 4,
    dbSizeBytes: 16384,
    softCapBytes: 104857600,
    atOrAboveCap: false,
    entityCount: nativeEntities.size,
  };
}

export function recallNativeEntities(
  query: string,
  opts: { category?: string; limit?: number } = {},
): SibylRecall {
  const category = opts.category ?? "counterparty";
  const categoryEntities = Array.from(nativeEntities.values()).filter(
    (e) => e.category === category,
  );
  if (categoryEntities.length === 0) {
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
  const matches: SibylRecord[] = categoryEntities
    .filter((e) => {
      if (!norm) return true;
      if (e.name.toLowerCase().includes(norm)) return true;
      const dName = typeof e.body.display_name === "string" ? e.body.display_name.toLowerCase() : "";
      if (dName.includes(norm)) return true;
      return JSON.stringify(e.body).toLowerCase().includes(norm);
    })
    .map((e) => ({
      id: e.id,
      category: e.category,
      name: e.name,
      status: e.status,
      body: e.body,
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
    }));

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
}

export function getNativeEntity(category: string, name: string): SibylEntityLookup {
  const key = `${category}:${name}`;
  const entity = nativeEntities.get(key);
  if (!entity) {
    return {
      reachable: true,
      code: "entity_absent",
      detail: `No Sibyl entity at ${category}/${name}`,
    };
  }
  return {
    reachable: true,
    record: {
      id: entity.id,
      category: entity.category,
      name: entity.name,
      status: entity.status,
      body: entity.body,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    },
  };
}

export function retrieveNativeFromSibyl(counterpartyKey: string): SibylRetrieval {
  const key = `counterparty:${counterpartyKey}`;
  const entity = nativeEntities.get(key);
  if (!entity) {
    return { status: "NO_HISTORY", counterpartyKey };
  }
  const body = entity.body;
  if (!hasProfileBody(body)) {
    return { status: "NO_HISTORY", counterpartyKey };
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
  };
}

export function listNativeCounterpartiesFromSibyl(): SibylCounterparties {
  const items = Array.from(nativeEntities.values())
    .filter((e) => e.category === "counterparty")
    .map((entity): SibylCounterparty => {
      const body = entity.body;
      return {
        counterpartyKey: entity.name,
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
        updatedAt: entity.updatedAt,
      };
    });
  return { ok: true, items };
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
  const key = `counterparty:${counterpartyKey}`;
  let entity = nativeEntities.get(key);
  if (!entity) {
    entity = {
      id: randomUUID(),
      category: "counterparty",
      name: counterpartyKey,
      status: "active",
      body: {
        display_name: counterpartyKey,
        relationship_status: "KNOWN",
        episodes: [],
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    nativeEntities.set(key, entity);
  }
  const episodes = Array.isArray(entity.body.episodes)
    ? (entity.body.episodes as Record<string, unknown>[])
    : [];
  const eventId = randomUUID();
  episodes.push({
    run: episode.run,
    task_type: episode.taskType ?? "mission",
    outcome: episode.outcome,
    note: episode.note ?? "",
    occurred_at: episode.occurredAt ?? new Date().toISOString(),
  });
  entity.body.episodes = episodes;
  entity.updatedAt = new Date().toISOString();
  return { ok: true, eventId, episodesCount: episodes.length };
}

export function updateNativeCounterpartyInSibyl(
  counterpartyKey: string,
  update: {
    relationshipStatus?: string;
    overallReliability?: number;
    confidence?: number;
    riskNote?: string;
  },
): { ok: boolean; code?: string; detail?: string } {
  const key = `counterparty:${counterpartyKey}`;
  let entity = nativeEntities.get(key);
  if (!entity) {
    entity = {
      id: randomUUID(),
      category: "counterparty",
      name: counterpartyKey,
      status: "active",
      body: {
        display_name: counterpartyKey,
        relationship_status: update.relationshipStatus ?? "KNOWN",
        overall_reliability: update.overallReliability,
        confidence: update.confidence,
        risk_note: update.riskNote,
        episodes: [],
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    nativeEntities.set(key, entity);
    return { ok: true };
  }
  if (update.relationshipStatus !== undefined)
    entity.body.relationship_status = update.relationshipStatus;
  if (update.overallReliability !== undefined)
    entity.body.overall_reliability = update.overallReliability;
  if (update.confidence !== undefined) entity.body.confidence = update.confidence;
  if (update.riskNote !== undefined) entity.body.risk_note = update.riskNote;
  entity.updatedAt = new Date().toISOString();
  return { ok: true };
}

export function setNativeMissionState(
  key: string,
  state: Record<string, unknown>,
): { ok: boolean; code?: string; detail?: string } {
  const entityKey = `hot_state:${key}`;
  nativeEntities.set(entityKey, {
    id: randomUUID(),
    category: "hot_state",
    name: key,
    status: "active",
    body: state,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  return { ok: true };
}

export function getNativeMissionState(
  key: string,
): { ok: boolean; state?: Record<string, unknown>; code?: string; detail?: string } {
  const entityKey = `hot_state:${key}`;
  const entity = nativeEntities.get(entityKey);
  return { ok: true, state: (entity?.body as Record<string, unknown>) ?? undefined };
}

export function setNativePolicyReference(
  key: string,
  reference: Record<string, unknown>,
): { ok: boolean; code?: string; detail?: string } {
  const entityKey = `reference:${key}`;
  nativeEntities.set(entityKey, {
    id: randomUUID(),
    category: "reference",
    name: key,
    status: "active",
    body: reference,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  return { ok: true };
}

export function getNativePolicyReference(
  key: string,
): { ok: boolean; reference?: unknown; code?: string; detail?: string } {
  const entityKey = `reference:${key}`;
  const entity = nativeEntities.get(entityKey);
  return { ok: true, reference: entity?.body ?? null };
}

export function archiveNativeCounterpartyInSibyl(
  counterpartyKey: string,
  reason = "operator_archived",
): { ok: boolean; code?: string; detail?: string } {
  const key = `counterparty:${counterpartyKey}`;
  const entity = nativeEntities.get(key);
  if (entity) {
    entity.status = "ARCHIVED";
    entity.body.archive_reason = reason;
    entity.body.status = "ARCHIVED";
    entity.updatedAt = new Date().toISOString();
  }
  return { ok: true };
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
  const allEpisodes: Record<string, unknown>[] = [];
  for (const entity of nativeEntities.values()) {
    if (entity.category !== "counterparty") continue;
    if (counterpartyKey && entity.name !== counterpartyKey) continue;
    const episodes = Array.isArray(entity.body.episodes) ? entity.body.episodes : [];
    for (const ep of episodes) {
      const episode = (ep ?? {}) as Record<string, unknown>;
      allEpisodes.push({
        run: episode.run,
        counterpartyKey: entity.name,
        counterparty_key: entity.name,
        taskType: episode.task_type ?? episode.taskType ?? "mission",
        task_type: episode.task_type ?? episode.taskType ?? "mission",
        outcome: episode.outcome,
        note: episode.note,
        occurredAt: episode.occurred_at ?? episode.occurredAt ?? entity.updatedAt,
        occurred_at: episode.occurred_at ?? episode.occurredAt ?? entity.updatedAt,
        evaluated: {
          counterpartyKey: entity.name,
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
}

import { env } from "./env";

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };

export interface DbHealth {
  status: "ok";
  latencyMs: number;
}

/**
 * Sibyl Memory readiness, as Sibyl reports it.
 *
 * `reachable: false` carries a reason and no numbers. A zeroed entity count on
 * an unreachable Sibyl would read as "no history", which is a different claim
 * from "we could not look".
 */
export interface SibylHealth {
  configured: boolean;
  reachable: boolean;
  tier?: string;
  schemaVersion?: number;
  dbSizeBytes?: number;
  softCapBytes?: number;
  atOrAboveCap?: boolean;
  entityCount?: number;
  code?: string;
  detail?: string;
}

/**
 * Whether an answering agent is actually there.
 *
 * `configured` is a fact about the deployment; `reachable` is a fact about the
 * agent, and only a request establishes it. A URL in an env var is not an
 * agent, and the two failures need different sentences.
 */
export interface AgentHealth {
  configured: boolean;
  reachable: boolean;
  apps?: string[];
  code?: string;
  detail?: string;
}

/**
 * A counterparty as Sibyl holds it. `hasProfile` false means Sibyl knows the
 * name but holds no relationship profile — listed rather than hidden, and
 * never given numbers it does not have.
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

export interface Liveness {
  status: "ok";
  uptime: number;
  timestamp: string;
}

async function request<T>(path: string, init?: RequestInit): Promise<ApiResult<T>> {
  let response: Response;

  try {
    response = await fetch(new URL(path, env.NEXT_PUBLIC_API_URL), {
      ...init,
      // Health must never be served from a build-time snapshot.
      cache: "no-store",
      headers: { accept: "application/json", ...init?.headers },
    });
  } catch (cause) {
    return {
      ok: false,
      error: {
        code: "unreachable",
        message: cause instanceof Error ? cause.message : "API is unreachable",
      },
    };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = undefined;
  }

  if (!response.ok) {
    const parsed = body as { error?: { code?: string; message?: string } } | undefined;
    return {
      ok: false,
      error: {
        code: parsed?.error?.code ?? `http_${response.status}`,
        message: parsed?.error?.message ?? `API responded ${response.status}`,
      },
    };
  }

  return { ok: true, data: body as T };
}

/** Mirrors the Run seed the API serves. Derived values are absent by design. */
export interface RunSummary {
  id: string;
  objective: string;
  source: "CONSOLE" | "AGENT" | "FIXTURE";
  environment: string;
  isMainnet: boolean;
  budgetUsdc: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Mirrors one row of `GET /api/runs/{id}/events`. */
export interface RunEvent {
  eventId: string;
  runId: string;
  sequence: number;
  type: string;
  eventTime: string;
  data: unknown;
}

// ── Counterparty memory ─────────────────────────────────────────────────────
//
// These mirror `GET /api/counterparties/{key}/memory` and its `/records`
// companion, both of which exist. Field names are snake_case because that is
// what the wire carries: `request<T>()` hands the parsed body back untouched,
// so a camelCase interface here would typecheck and then read undefined at
// runtime.

/** Sibyl's own verdict on one recall. `returned` is Sibyl's count, not ours. */
export interface SibylVerdict {
  code: "ok" | "abstained_on" | "negation_abstain" | "gated" | "empty_store" | "no_match";
  /** Why this code fired, in one sentence a surface can render as-is. */
  detail: string;
  returned: number;
}

/** The three states a composed retrieval can reach. */
export type RetrievalStatus = "AVAILABLE" | "NO_HISTORY" | "ERROR";

/** Which consulted sources actually contributed to the composed result. */
export type RetrievalSource = "POSTGRES" | "SIBYL" | "BOTH" | "NEITHER";

/** Which Postgres read came back empty, or which one threw. */
export type PostgresReason = "no_row" | "version_zero" | "no_profile" | "query_failed";

export type RelationshipStatus =
  | "NEW"
  | "KNOWN"
  | "PREFERRED"
  | "WATCH"
  | "BLOCKED"
  | "ARCHIVED";

/**
 * The composed memory state for one counterparty.
 *
 * Every scored field is null unless `status` is `AVAILABLE`, and `retryable` is
 * null unless `status` is `ERROR` — the server sends null there rather than
 * false, because a false on a healthy result would read as "do not bother".
 *
 * `sibyl.record_count` is null when Sibyl never answered and 0 when it looked
 * and holds nothing. Those are different claims and must not render alike.
 */
export interface CounterpartyMemory {
  counterparty_key: string;
  status: RetrievalStatus;
  source: RetrievalSource;
  retryable: boolean | null;
  memory_version: number | null;
  episodes_used: number | null;
  relationship_status: RelationshipStatus | null;
  overall_reliability: number | null;
  task_fit: number | null;
  confidence: number | null;
  postgres: {
    outcome: RetrievalStatus;
    /** Null only when the read succeeded and found memory. */
    reason: PostgresReason | null;
  };
  sibyl: {
    /** False means this deployment has no Sibyl runtime, so nothing was asked. */
    consulted: boolean;
    record_count: number | null;
    /** Present only when Sibyl answered. */
    verdict: SibylVerdict | null;
    /** The bridge or configuration code, present only when it did not. */
    code: string | null;
    detail: string;
  };
}

/** One Sibyl record, as the drawer receives it. */
export interface SibylMemoryRecord {
  id: string;
  category: string;
  name: string;
  /** Sibyl's lifecycle label, null on every entity written without one. */
  status: string | null;
  created_at: string;
  updated_at: string;
  /** Whatever was written at write time. Typing it would be guessing at Sibyl's JSON. */
  body: unknown;
}

/**
 * The Sibyl recall set for one counterparty.
 *
 * `NOT_CONSULTED` is absent from `outcome` on purpose: a Sibyl that could not
 * be asked is a 503 from this endpoint, never a 200 with an empty `items`. So
 * every outcome reachable here is one Sibyl actually reached, and an `ERROR`
 * outcome with `items: []` is a refusal — not an absence of history.
 */
export interface CounterpartyMemoryRecords {
  counterparty_key: string;
  /** The refinement that was searched, or the counterparty key when there was none. */
  query: string;
  outcome: RetrievalStatus;
  consulted: true;
  verdict: SibylVerdict | null;
  items: SibylMemoryRecord[];
}

export const apiClient = {
  /** Liveness. Answers even when Postgres is down, so it isolates the domain. */
  health: () => request<Liveness>("/health"),
  dbHealth: () => request<DbHealth>("/health/db"),
  /* 200 even when Sibyl is unreachable: the API is fine, one dependency is
     not, and the Console needs the reason to render the right state. */
  sibylHealth: () => request<SibylHealth>("/health/sibyl"),
  agentHealth: () => request<AgentHealth>("/health/agent"),
  /* 503 when Sibyl cannot be read, never an empty list: "we could not look" and
     "we looked and there is nobody" are different answers. */
  /* The console's only authorization path, and its second write of any kind.
     Called from the Approval card's button and from nowhere else: no render
     path, no effect and no retry reaches it, because an approval that could
     happen without a click is exactly what this product promises never to do.
     A pending request is verified server-side, so a client that got the state
     wrong cannot author an approval out of nothing. */
  approveRun: (runId: string, ceilingUsdc: string) =>
    request<{ event: { event_id: string; type: string; sequence: number } }>(
      `/api/runs/${encodeURIComponent(runId)}/approve`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ceiling_usdc: ceilingUsdc }),
      },
    ),

  listSibylCounterparties: () =>
    request<{ items: SibylCounterparty[] }>("/api/memory/counterparties"),

  // ── Runs ────────────────────────────────────────────────────────────────
  //
  // Only endpoints that exist. There is deliberately no `stream` method: the
  // server has no stream yet, and a client method that 404s turns a known gap
  // into a runtime failure.

  listRuns: (limit = 50) => request<{ runs: RunSummary[] }>(`/api/runs?limit=${limit}`),
  getRun: (runId: string) => request<{ run: RunSummary }>(`/api/runs/${encodeURIComponent(runId)}`),
  getRunEvents: (runId: string) =>
    request<{ runId: string; events: RunEvent[] }>(
      `/api/runs/${encodeURIComponent(runId)}/events`,
    ),

  // ── Counterparty memory ─────────────────────────────────────────────────
  //
  // Both of these are mounted. They are here for the same reason `stream` is
  // not: a client method stands for an endpoint that answers.

  /* 200 for every well-formed key, including an ERROR status and including a
     counterparty with no history. A 404 would make the caller infer "no
     history" from an HTTP error, which is the one collapse this endpoint
     exists to prevent — so `ok: false` here really does mean the API failed. */
  getCounterpartyMemory: (counterpartyKey: string) =>
    request<CounterpartyMemory>(
      `/api/counterparties/${encodeURIComponent(counterpartyKey)}/memory`,
    ),

  /* Record bodies, for a human opening the memory drawer. This one 503s when
     Sibyl could not be asked, because an empty `items` would be
     indistinguishable from a store that genuinely holds nothing. A caller that
     gets `ok: false` must say so and must not fall back to an empty list. */
  getCounterpartyMemoryRecords: (
    counterpartyKey: string,
    options: { limit?: number; query?: string } = {},
  ) => {
    // Both absent rather than defaulted: the server owns the default limit, and
    // the counterparty key is the recall unless the operator narrows it.
    const params = new URLSearchParams();
    if (options.limit !== undefined) params.set("limit", String(options.limit));
    if (options.query !== undefined) params.set("q", options.query);
    const query = params.toString();
    return request<CounterpartyMemoryRecords>(
      `/api/counterparties/${encodeURIComponent(counterpartyKey)}/memory/records${
        query ? `?${query}` : ""
      }`,
    );
  },
};

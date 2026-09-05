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
};

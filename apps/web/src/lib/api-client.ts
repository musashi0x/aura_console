import { env } from "./env";

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };

export interface DbHealth {
  status: "ok";
  latencyMs: number;
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

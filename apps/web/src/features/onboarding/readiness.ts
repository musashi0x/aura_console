import { apiClient } from "@/lib/api-client";

import type { ReadinessRow } from "./types";

/**
 * v0.1 checks exactly what the API actually exposes. Operator policy and agent
 * identity have no endpoint yet, so they are reported as not checked rather
 * than assumed ready. Inventing an endpoint to fill the row would be worse
 * than an honest gap.
 */
export const initialRows: ReadinessRow[] = [
  {
    id: "api",
    domain: "Aura API",
    label: "API reachable",
    status: "checking",
    detail: "",
    retryable: true,
  },
  {
    id: "database",
    domain: "Event store",
    label: "Database",
    status: "checking",
    detail: "",
    retryable: true,
  },
  {
    id: "policy",
    domain: "Policy",
    label: "Operator policy",
    status: "not_checked",
    detail: "v0.1 exposes no policy endpoint yet, so Aura cannot verify this. Policy still applies on the server.",
    retryable: false,
  },
  {
    id: "agent",
    domain: "Agent runtime",
    label: "Agent identity",
    status: "not_checked",
    detail: "Provided by server configuration and not read by the browser in v0.1.",
    retryable: false,
  },
];

export interface CheckOutcome {
  status: "ready" | "unavailable";
  detail: string;
}

/** Names ownership, consequence, and next action, per the UX spec error rules. */
export async function runCheck(id: string): Promise<CheckOutcome> {
  if (id === "api") {
    const result = await apiClient.health();
    return result.ok
      ? { status: "ready", detail: "Responding." }
      : {
          status: "unavailable",
          detail:
            "The Aura API is not responding, so the Console cannot start or read a Run. Start it with pnpm dev, then retry.",
        };
  }

  if (id === "database") {
    const result = await apiClient.dbHealth();
    return result.ok
      ? { status: "ready", detail: `Responded in ${result.data.latencyMs} ms.` }
      : {
          status: "unavailable",
          detail:
            "The API cannot reach Postgres, so Runs cannot be recorded or replayed. Check docker compose and migrations, then retry.",
        };
  }

  return { status: "unavailable", detail: "Unknown check." };
}

export const retryableIds = initialRows.filter((row) => row.retryable).map((row) => row.id);

import type { Metadata } from "next";

import { MonoRef, Panel, StatusBadge } from "@/components/primitives";
import { ConsoleShell } from "@/features/console/components/console-shell";
import { apiClient } from "@/lib/api-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Readiness — Aura Console" };

/**
 * The readiness surface, moved off the root route when that became the landing
 * page. Rows report only what was actually checked: dependencies with no
 * browser-readable endpoint say so rather than being omitted or assumed.
 */
export default async function SystemPage() {
  const [liveness, database] = await Promise.all([apiClient.health(), apiClient.dbHealth()]);

  const rows = [
    {
      id: "api",
      label: "API reachable",
      domain: "Aura API",
      tone: liveness.ok ? ("ready" as const) : ("error" as const),
      state: liveness.ok ? "READY" : "UNAVAILABLE",
      detail: liveness.ok
        ? "Responding."
        : "The Aura API is not responding, so no Run can be started or read. Start it with pnpm dev.",
    },
    {
      id: "database",
      label: "Database",
      domain: "Event store",
      tone: database.ok ? ("ready" as const) : ("error" as const),
      state: database.ok ? "READY" : "UNAVAILABLE",
      detail: database.ok
        ? `Responded in ${database.data.latencyMs} ms.`
        : "The API cannot reach Postgres, so Runs cannot be recorded or replayed.",
    },
    {
      id: "policy",
      label: "Operator policy",
      domain: "Policy",
      tone: "neutral" as const,
      state: "NOT CHECKED",
      detail:
        "v0.1 exposes no policy endpoint, so Aura cannot verify this. Policy still applies on the server.",
    },
    {
      id: "agent",
      label: "Agent identity",
      domain: "Agent runtime",
      tone: "neutral" as const,
      state: "NOT CHECKED",
      detail: "Provided by server configuration and not read by the browser in v0.1.",
    },
  ];

  return (
    <ConsoleShell surface="Readiness" readiness={database.ok ? "ready" : "degraded"}>
      <h1 className="cs__title">Readiness</h1>
      <p className="cs__lede">
        Aura reports only what it verified. Anything it cannot check is listed as not checked
        rather than assumed.
      </p>

      <ul className="sys">
        {rows.map((row) => (
          <li key={row.id}>
            <Panel
              title={row.label}
              meta={<MonoRef label="DOMAIN">{row.domain}</MonoRef>}
            >
              <p className="sys__state">
                <StatusBadge tone={row.tone}>{row.state}</StatusBadge>
              </p>
              <p className="sys__detail">{row.detail}</p>
            </Panel>
          </li>
        ))}
      </ul>
    </ConsoleShell>
  );
}

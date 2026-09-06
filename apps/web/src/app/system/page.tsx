import type { Metadata } from "next";

import { MonoRef, Panel, StatusBadge } from "@/components/primitives";
import { ConsoleShell } from "@/features/console/components/console-shell";
import { readGrounding } from "@/features/console/grounding";
import { apiClient } from "@/lib/api-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Readiness — Aura Console" };

/**
 * The readiness surface, moved off the root route when that became the landing
 * page. Rows report only what was actually checked: dependencies with no
 * browser-readable endpoint say so rather than being omitted or assumed.
 */
export default async function SystemPage() {
  const [liveness, database, sibyl, grounding] = await Promise.all([
    apiClient.health(),
    apiClient.dbHealth(),
    apiClient.sibylHealth(),
    readGrounding(),
  ]);

  /* Sibyl reports itself. Three outcomes, and they are not interchangeable:
     the API could not be asked, Sibyl is not wired up in this deployment, or
     Sibyl answered. Only the third one may show a number, because only the
     third one measured anything. */
  const sibylRow = (() => {
    if (!sibyl.ok) {
      return {
        tone: "error" as const,
        state: "UNAVAILABLE",
        detail:
          "The Aura API could not be asked about Sibyl, so nothing is known about relationship memory.",
      };
    }
    const status = sibyl.data;
    if (status.reachable) {
      const megabytes = (status.dbSizeBytes ?? 0) / 1_048_576;
      return {
        tone: "ready" as const,
        state: "READY",
        detail: `Sibyl answered: ${status.tier} tier, schema v${status.schemaVersion}, ${status.entityCount} ${status.entityCount === 1 ? "entity" : "entities"}, ${megabytes.toFixed(2)} MB on disk.`,
      };
    }
    return {
      tone: "neutral" as const,
      state: status.configured ? "UNAVAILABLE" : "NOT CONNECTED",
      detail:
        status.detail ??
        "Sibyl Memory is not reachable from this deployment, so no relationship history is available.",
    };
  })();

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
      id: "sibyl",
      label: "Relationship memory",
      domain: "Sibyl Memory",
      tone: sibylRow.tone,
      state: sibylRow.state,
      detail: sibylRow.detail,
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
    <ConsoleShell
      surface="Network"
      readiness={database.ok ? "ready" : "degraded"}
      grounding={grounding}
    >
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

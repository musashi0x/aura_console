import type { Metadata } from "next";
import Link from "next/link";

import { ConsoleShell } from "@/features/console/components/console-shell";
import { ConsoleEmptyState, ConsoleErrorState } from "@/features/console/components/console-states";
import { StatusBadge } from "@/components/primitives";
import { console_ } from "@/features/console/copy";
import { exampleRun } from "@/features/console/fixtures/example-run";
import { apiClient } from "@/lib/api-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Missions — Aura Console" };

/**
 * The Runs list, from the real endpoint.
 *
 * Three outcomes, and they are not interchangeable. A failed request is
 * degraded and says the store could not be read. An empty array is an empty
 * list, because the API answered and there is genuinely nothing. Rows are rows.
 * Collapsing the first two would report "no Runs" when the truth is "we could
 * not look".
 */
export default async function RunsPage() {
  const health = await apiClient.dbHealth();
  const runs = health.ok ? await apiClient.listRuns() : null;
  const readiness = health.ok ? "ready" : "degraded";

  return (
    <ConsoleShell surface="Missions" readiness={readiness}>
      <h1 className="cs__title">{console_.missions.title}</h1>

      {!health.ok || runs === null || !runs.ok ? (
        <ConsoleErrorState
          domain="Event store"
          detail="The API could not be read, so Runs cannot be listed. Nothing is known about how many exist."
          retryHref="/runs"
        />
      ) : runs.data.runs.length === 0 ? (
        <ConsoleEmptyState exampleAvailable createAvailable={false} />
      ) : (
        <ul className="cs__list" role="list">
          {/* The demo Mission lives here, badged, rather than in a rail item of
              its own. It is not a Run the API returned and must never be
              counted as one, which is what the badge says out loud. */}
          <li>
            <Link className="cs__row" href="/runs/example">
              <span className="cs__row-objective">{exampleRun.objective}</span>
              <span className="cs__row-meta">
                <StatusBadge tone="warning">{console_.missions.demoBadge}</StatusBadge>
                <span className="cs__row-env">{exampleRun.environment}</span>
              </span>
            </Link>
          </li>
          {runs.data.runs.map((run) => (
            <li key={run.id}>
              <Link className="cs__row" href={`/runs/${run.id}`}>
                <span className="cs__row-objective">{run.objective}</span>
                <span className="cs__row-meta">
                  <span className="cs__row-env">{run.environment}</span>
                  <time dateTime={run.createdAt}>{run.createdAt.slice(0, 19).replace("T", " ")}</time>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </ConsoleShell>
  );
}

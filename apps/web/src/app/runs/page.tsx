import type { Metadata } from "next";
import Link from "next/link";

import { ConsoleShell } from "@/features/console/components/console-shell";
import { ConsoleEmptyState, ConsoleErrorState } from "@/features/console/components/console-states";
import { apiClient } from "@/lib/api-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Runs — Aura Console" };

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
    <ConsoleShell surface="Runs" readiness={readiness}>
      <h1 className="cs__title">Runs</h1>

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

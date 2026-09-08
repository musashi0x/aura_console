import type { Metadata } from "next";

import { ConsoleShell } from "@/features/console/components/console-shell";
import { readGrounding } from "@/features/console/grounding";
import {
  ConsoleEmptyState,
  ConsoleErrorState,
} from "@/features/console/components/console-states";
import { console_ } from "@/features/console/copy";
import { exampleRun } from "@/features/console/fixtures/example-run";
import { apiClient } from "@/lib/api-client";
import { RunsView } from "@/features/console/components/runs-view";

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
  const [health, grounding] = await Promise.all([
    apiClient.dbHealth(),
    readGrounding(),
  ]);
  const runs = health.ok ? await apiClient.listRuns() : null;
  const readiness = health.ok ? "ready" : "degraded";

  return (
    <ConsoleShell
      surface="Missions"
      readiness={readiness}
      grounding={grounding}
    >
      <h1 className="cs__title">{console_.missions.title}</h1>

      {!health.ok || runs === null || !runs.ok ? (
        <ConsoleErrorState
          domain="Event store"
          detail="The API could not be read, so Runs cannot be listed. Nothing is known about how many exist."
          retryHref="/runs"
        />
      ) : runs.data.runs.length === 0 ? (
        /* Both destinations exist. `createAvailable={false}` rendered
           "Start a new Run · Not yet available" beside a form that has been
           real since #30 — a control talked out of existence by a flag nobody
           moved. */
        <ConsoleEmptyState exampleAvailable createAvailable />
      ) : (
        <RunsView runs={runs.data.runs} exampleRun={exampleRun} />
      )}
    </ConsoleShell>
  );
}

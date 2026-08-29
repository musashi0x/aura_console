import type { Metadata } from "next";

import { ConsoleShell } from "@/features/console/components/console-shell";
import { ConsoleEmptyState, ConsoleErrorState } from "@/features/console/components/console-states";
import { apiClient } from "@/lib/api-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Runs — Aura Console" };

export default async function RunsPage() {
  const health = await apiClient.dbHealth();
  const readiness = health.ok ? "ready" : "degraded";

  return (
    <ConsoleShell surface="Runs" readiness={readiness}>
      <h1 className="cs__title">Runs</h1>
      {!health.ok ? (
        <ConsoleErrorState
          domain="Event store"
          detail="The API cannot reach Postgres, so Runs cannot be listed, recorded, or replayed."
          retryHref="/runs"
        />
      ) : null}
      {/* No Runs endpoint exists, so this is an honest empty shell rather than
          a verified empty list. Nothing has been queried. */}
      <ConsoleEmptyState exampleAvailable createAvailable={false} />
      <p className="cs__deferred">
        Run listing and detail data need the run skeleton and its projection endpoints, tracked by
        task #30. Replacing the example and new Run destinations is task #61.
      </p>
    </ConsoleShell>
  );
}

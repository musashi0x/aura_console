import type { Metadata } from "next";

import { ConsoleShell } from "@/features/console/components/console-shell";
import { RunTimeline } from "@/features/console/components/run-timeline";
import { exampleEvents, exampleRun } from "@/features/console/fixtures/example-run";
import { eventsFromApi, seedFromRun } from "@/features/console/model/from-api";
import { apiClient } from "@/lib/api-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Example Run — Aura Console" };

/**
 * The example Run: fixture data through the real projection.
 *
 * It does not call the API for its events, and it says so. Everything else on
 * the page behaves exactly as a real Run does, because it is the same
 * component and the same fold. Readiness is still the live check: the example
 * works whether or not the store is reachable, and claiming otherwise would
 * make the badge a decoration.
 */
export default async function ExampleRunPage() {
  const health = await apiClient.dbHealth();

  return (
    <ConsoleShell
      surface="Example Run"
      readiness={health.ok ? "ready" : "degraded"}
      runRef={exampleRun.id}
    >
      <RunTimeline
        events={eventsFromApi(exampleEvents)}
        seed={seedFromRun(exampleRun)}
        fixtureLabel="Example data. This Run was not executed and no economic action was taken."
      />
    </ConsoleShell>
  );
}

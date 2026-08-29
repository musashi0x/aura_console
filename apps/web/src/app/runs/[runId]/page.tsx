import type { Metadata } from "next";

import { ConsoleShell } from "@/features/console/components/console-shell";
import { ConsoleErrorState } from "@/features/console/components/console-states";
import { RunTimeline } from "@/features/console/components/run-timeline";
import { eventsFromApi, seedFromRun } from "@/features/console/model/from-api";
import { apiClient } from "@/lib/api-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Run — Aura Console" };

/**
 * One Run, folded through the same projection the replay uses.
 *
 * The seed and the events answer different questions: the seed is what the Run
 * was asked to do, the events are what happened. A missing Run is an error, not
 * an empty timeline — an empty timeline would say the Run exists and did
 * nothing.
 */
export default async function RunPage({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  const health = await apiClient.dbHealth();
  const readiness = health.ok ? "ready" : "degraded";

  if (!health.ok) {
    return (
      <ConsoleShell surface="Runs" readiness={readiness} runRef={runId}>
        <ConsoleErrorState
          domain="Event store"
          detail="The API could not be read, so this Run cannot be replayed."
          retryHref={`/runs/${runId}`}
        />
      </ConsoleShell>
    );
  }

  const [run, events] = await Promise.all([
    apiClient.getRun(runId),
    apiClient.getRunEvents(runId),
  ]);

  if (!run.ok || !events.ok) {
    return (
      <ConsoleShell surface="Runs" readiness={readiness} runRef={runId}>
        <ConsoleErrorState
          domain="Run"
          detail={`No Run ${runId} could be read. It may not exist, or the event store could not answer.`}
          retryHref="/runs"
        />
      </ConsoleShell>
    );
  }

  return (
    <ConsoleShell surface="Runs" readiness={readiness} runRef={run.data.run.id}>
      <RunTimeline events={eventsFromApi(events.data.events)} seed={seedFromRun(run.data.run)} />
    </ConsoleShell>
  );
}

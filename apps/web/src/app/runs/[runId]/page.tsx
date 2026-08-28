import type { Metadata } from "next";

import { ConsoleShell } from "@/features/console/components/console-shell";
import { ConsoleErrorState, ConsoleUnavailableMemory } from "@/features/console/components/console-states";
import { apiClient } from "@/lib/api-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Run — Aura Console" };

export default async function RunDetailPage({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  const health = await apiClient.dbHealth();
  const readiness = health.ok ? "ready" : "degraded";

  return (
    <ConsoleShell surface="Runs" readiness={readiness} runRef={runId}>
      <h1 className="cs__title">Run</h1>
      {!health.ok ? (
        <ConsoleErrorState
          domain="Event store"
          detail="The API cannot reach Postgres, so this Run cannot be reconstructed."
          retryHref={`/runs/${runId}`}
        />
      ) : null}
      {/* The timeline component exists and is tested; it has no data source
          until the events endpoint lands. Nothing is inferred about this Run. */}
      <ConsoleUnavailableMemory>
        <p className="cs__detail">
          Aura also has no events endpoint, so this Run cannot be reconstructed at all. Its
          existence, decision, and spend are all unknown rather than empty.
        </p>
      </ConsoleUnavailableMemory>
      <p className="cs__deferred">Tracked by task #30.</p>
    </ConsoleShell>
  );
}

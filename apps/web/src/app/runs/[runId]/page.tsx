import type { Metadata } from "next";

import { ConsoleShell } from "@/features/console/components/console-shell";
import { DataUnavailable } from "@/features/console/components/data-unavailable";
import { MonoRef } from "@/components/primitives";
import { apiClient } from "@/lib/api-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Run — Aura Console" };

export default async function RunDetailPage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const { runId } = await params;
  const health = await apiClient.dbHealth();

  return (
    <ConsoleShell surface="Runs" ready={health.ok}>
      <h1 className="cs__title">Run</h1>
      <p className="cs__lede">
        <MonoRef label="REQUESTED">{runId}</MonoRef>
      </p>
      {/* The timeline component is implemented and tested; it has no data
          source until the events endpoint exists. */}
      <DataUnavailable
        title="This Run cannot be loaded"
        body="Aura has no events endpoint, so it cannot reconstruct this Run. Nothing is inferred about whether the Run exists, what it decided, or what it spent."
        owner="task #30"
      />
    </ConsoleShell>
  );
}

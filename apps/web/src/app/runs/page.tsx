import type { Metadata } from "next";

import { ConsoleShell } from "@/features/console/components/console-shell";
import { DataUnavailable } from "@/features/console/components/data-unavailable";
import { apiClient } from "@/lib/api-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Runs — Aura Console" };

export default async function RunsPage() {
  const health = await apiClient.dbHealth();

  return (
    <ConsoleShell surface="Runs" ready={health.ok}>
      <h1 className="cs__title">Runs</h1>
      {/* There is no Runs endpoint yet. An empty list would claim a verified
          empty result; this says Aura has not asked. */}
      <DataUnavailable
        title="No Runs endpoint yet"
        body="Aura cannot list Runs because the run skeleton and its projection endpoints are not implemented. This is not an empty result: nothing has been queried, and no Run has been created."
        owner="task #30"
      />
    </ConsoleShell>
  );
}

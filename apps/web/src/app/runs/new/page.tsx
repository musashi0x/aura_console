import type { Metadata } from "next";

import { ConsoleShell } from "@/features/console/components/console-shell";
import { DataUnavailable } from "@/features/console/components/data-unavailable";
import { apiClient } from "@/lib/api-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Start a Run — Aura Console" };

/**
 * Placeholder, now rendered inside the Console shell. Replacing it with the
 * real surface is tracked separately and depends on the run skeleton.
 */
export default async function NewRunPage() {
  const health = await apiClient.dbHealth();

  return (
    <ConsoleShell surface="Runs" ready={health.ok}>
      <h1 className="cs__title">Start a Run</h1>
      <DataUnavailable
        title="Not built yet"
        body="The New Run form needs a Run creation endpoint, which does not exist yet. Nothing has been created and no economic action has been taken."
        owner="task #61"
      />
    </ConsoleShell>
  );
}

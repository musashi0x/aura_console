import type { Metadata } from "next";

import { ConsoleShell } from "@/features/console/components/console-shell";
import { DataUnavailable } from "@/features/console/components/data-unavailable";
import { apiClient } from "@/lib/api-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Example Run — Aura Console" };

/**
 * Placeholder, now rendered inside the Console shell. Replacing it with the
 * real surface is tracked separately and depends on the run skeleton.
 */
export default async function ExampleRunPage() {
  const health = await apiClient.dbHealth();

  return (
    <ConsoleShell surface="Runs" ready={health.ok}>
      <h1 className="cs__title">Example Run</h1>
      <DataUnavailable
        title="Not built yet"
        body="The example Run replays a canonical fixture through the same projection as a real Run. That surface is not wired up yet. This is an example, not live commerce."
        owner="task #61"
      />
    </ConsoleShell>
  );
}

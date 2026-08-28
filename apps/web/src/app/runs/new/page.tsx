import type { Metadata } from "next";

import { ConsoleShell } from "@/features/console/components/console-shell";
import { ConsoleEmptyState } from "@/features/console/components/console-states";
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
    <ConsoleShell surface="Runs" readiness={health.ok ? "ready" : "degraded"}>
      <h1 className="cs__title">Start a Run</h1>
      <ConsoleEmptyState exampleAvailable={false} createAvailable={false} />
      <p className="cs__deferred">
        This destination is a placeholder until the run skeleton lands. Nothing has been created
        and no economic action has been taken. Tracked by task #61.
      </p>
    </ConsoleShell>
  );
}

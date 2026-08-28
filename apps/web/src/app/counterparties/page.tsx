import type { Metadata } from "next";

import { ConsoleShell } from "@/features/console/components/console-shell";
import { DataUnavailable } from "@/features/console/components/data-unavailable";
import { apiClient } from "@/lib/api-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Counterparties — Aura Console" };

export default async function CounterpartiesPage() {
  const health = await apiClient.dbHealth();

  return (
    <ConsoleShell surface="Counterparties" ready={health.ok}>
      <h1 className="cs__title">Counterparties</h1>
      <DataUnavailable
        title="No counterparty projection yet"
        body="Relationship intelligence is served through a deny-by-default projection that does not exist yet. Private episodes, profile bodies, raw evidence, and salts never reach this surface."
        owner="task #32"
      />
    </ConsoleShell>
  );
}

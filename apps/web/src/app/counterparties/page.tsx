import type { Metadata } from "next";

import { ConsoleShell } from "@/features/console/components/console-shell";
import { ConsoleUnavailableMemory } from "@/features/console/components/console-states";
import { apiClient } from "@/lib/api-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Counterparties — Aura Console" };

export default async function CounterpartiesPage() {
  const health = await apiClient.dbHealth();
  const readiness = health.ok ? "ready" : "degraded";

  return (
    <ConsoleShell surface="Counterparties" readiness={readiness}>
      <h1 className="cs__title">Counterparties</h1>
      <ConsoleUnavailableMemory>
        <p className="cs__detail">
          Relationship intelligence is served through a deny-by-default projection that does not
          exist yet. Private episodes, profile bodies, raw evidence, and salts never reach this
          surface.
        </p>
      </ConsoleUnavailableMemory>
      <p className="cs__deferred">Tracked by task #32.</p>
    </ConsoleShell>
  );
}

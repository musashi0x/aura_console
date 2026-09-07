import type { Metadata } from "next";

import { ConsoleShell } from "@/features/console/components/console-shell";
import { readGrounding } from "@/features/console/grounding";
import { ConsoleUnavailableMemory } from "@/features/console/components/console-states";
import { CounterpartiesView } from "@/features/console/components/counterparties-view";
import { console_ } from "@/features/console/copy";
import { apiClient } from "@/lib/api-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Agents — Aura Console" };

/**
 * The operator's own relationship memory, read from Sibyl.
 *
 * Three outcomes, and they are not interchangeable. Sibyl could not be read:
 * that is the unavailable state, and it says so rather than showing an empty
 * page. Sibyl answered with nothing: that is an empty list, and it is only
 * sayable because Sibyl answered. Rows are rows.
 */
export default async function CounterpartiesPage() {
  const [health, memory, grounding] = await Promise.all([
    apiClient.dbHealth(),
    apiClient.listSibylCounterparties(),
    readGrounding(),
  ]);
  const readiness = health.ok ? "ready" : "degraded";

  return (
    <ConsoleShell surface="Agents" readiness={readiness} grounding={grounding}>
      <h1 className="cs__title">{console_.agents.title}</h1>
      <p className="cs__lede">{console_.agents.lede}</p>

      {!memory.ok ? (
        <ConsoleUnavailableMemory>
          <p className="cs__detail">{memory.error.message}</p>
        </ConsoleUnavailableMemory>
      ) : (
        <CounterpartiesView items={memory.data.items} />
      )}
    </ConsoleShell>
  );
}

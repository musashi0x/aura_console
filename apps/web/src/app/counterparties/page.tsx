import type { Metadata } from "next";

import { MonoRef, Panel, StatusBadge } from "@/components/primitives";
import { ConsoleShell } from "@/features/console/components/console-shell";
import { ConsoleUnavailableMemory } from "@/features/console/components/console-states";
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
 *
 * This surface used to render the unavailable state unconditionally while no
 * store was wired up. That was honest then and would be a lie now.
 */
export default async function CounterpartiesPage() {
  const [health, memory] = await Promise.all([
    apiClient.dbHealth(),
    apiClient.listSibylCounterparties(),
  ]);
  const readiness = health.ok ? "ready" : "degraded";

  return (
    <ConsoleShell surface="Agents" readiness={readiness}>
      <h1 className="cs__title">{console_.agents.title}</h1>
      <p className="cs__lede">{console_.agents.lede}</p>

      {!memory.ok ? (
        <ConsoleUnavailableMemory>
          <p className="cs__detail">{memory.error.message}</p>
        </ConsoleUnavailableMemory>
      ) : memory.data.items.length === 0 ? (
        <Panel title={console_.agents.empty}>
          <p className="cs__detail">{console_.agents.emptyNote}</p>
        </Panel>
      ) : (
        <ul className="sys">
          {memory.data.items.map((item) => (
            <li key={item.counterpartyKey}>
              <Panel
                title={item.counterpartyKey}
                meta={
                  item.relationshipStatus ? (
                    <MonoRef label={console_.agents.fields.status}>
                      {item.relationshipStatus}
                    </MonoRef>
                  ) : undefined
                }
              >
                {item.hasProfile ? (
                  <dl className="run__facts">
                    <div>
                      <dt>{console_.agents.fields.version}</dt>
                      <dd>{item.memoryVersion}</dd>
                    </div>
                    <div>
                      <dt>{console_.agents.fields.episodes}</dt>
                      <dd>{item.episodesUsed}</dd>
                    </div>
                    {/* A missing score is not a zero. Rendering one would put a
                        judgement in front of the operator that Sibyl never
                        made. */}
                    <div>
                      <dt>{console_.agents.fields.reliability}</dt>
                      <dd>{item.overallReliability ?? "—"}</dd>
                    </div>
                    <div>
                      <dt>{console_.agents.fields.taskFit}</dt>
                      <dd>{item.taskFit ?? "—"}</dd>
                    </div>
                    <div>
                      <dt>{console_.agents.fields.confidence}</dt>
                      <dd>{item.confidence ?? "—"}</dd>
                    </div>
                  </dl>
                ) : (
                  <p className="sys__state">
                    <StatusBadge tone="neutral">{console_.agents.noProfile}</StatusBadge>
                  </p>
                )}
                {item.updatedAt ? (
                  <p className="sys__detail">{console_.agents.updated(item.updatedAt)}</p>
                ) : null}
              </Panel>
            </li>
          ))}
        </ul>
      )}
    </ConsoleShell>
  );
}

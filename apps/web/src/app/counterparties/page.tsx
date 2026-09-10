import type { Metadata } from "next";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { Token } from "@astryxdesign/core/Token";
import { Bot, Shield, History, Sparkles } from "lucide-react";

import { ConsoleShell } from "@/features/console/components/console-shell";
import { readGrounding } from "@/features/console/grounding";
import { ConsoleUnavailableMemory } from "@/features/console/components/console-states";
import { console_ } from "@/features/console/copy";
import { apiClient, type SibylCounterparty } from "@/lib/api-client";
import {
  CounterpartyExecutiveSummary,
  CounterpartyReflections,
  CounterpartyDossierView,
  CounterpartyTemporalView,
  CounterpartySemanticSearch,
} from "@/features/counterparties";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Agents — Aura Console" };

/** Sibyl's own value, unscaled. A missing score is an em dash, never a zero. */
function score(value: number | null): string {
  return value === null ? "—" : String(value);
}

/**
 * What Aura remembers about one counterparty, as episodes rather than a number.
 *
 * The scores are a summary of these; the episodes are the evidence. An operator
 * deciding whether to trust someone with money needs the second, and a surface
 * that only showed the first would be asking them to trust a score.
 */
function Episodes({ item }: { item: SibylCounterparty }) {
  if (item.episodes.length === 0) {
    return (
      <Text as="p" size="sm" color="secondary">
        {console_.agents.noEpisodes}
      </Text>
    );
  }
  return (
    <div className="flex flex-col gap-2.5 pt-2 border-t border-[var(--color-border)]/60">
      <span className="text-xs font-medium text-[var(--color-text-muted)] flex items-center gap-1.5">
        <History size={13} />
        <span>Verified Episodes ({item.episodes.length})</span>
      </span>
      <VStack gap={2}>
        {item.episodes.map((episode, index) => (
          <div
            key={`${episode.run ?? "run"}-${index}`}
            className="p-3 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)]/80 flex flex-col gap-1.5"
          >
            <HStack gap={2} wrap="wrap">
              {episode.outcome ? (
                <Token
                  label={episode.outcome}
                  size="sm"
                  color={episode.outcome === "accepted" ? "green" : "red"}
                />
              ) : null}
              <Text as="span" size="xsm" color="secondary">
                {[episode.taskType, episode.occurredAt].filter(Boolean).join(" · ")}
              </Text>
            </HStack>
            {episode.note ? (
              <Text as="p" size="sm">
                {episode.note}
              </Text>
            ) : null}
          </div>
        ))}
      </VStack>
    </div>
  );
}

function Profile({ item }: { item: SibylCounterparty }) {
  const reliabilityVal = item.overallReliability !== null ? Math.round(item.overallReliability * 100) : null;

  return (
    <VStack gap={3}>
      <HStack gap={2} wrap="wrap">
        {/* Beside the record, not in endContent */}
        {item.isFixture ? (
          <Token label={console_.agents.fixtureBadge} size="sm" color="orange" />
        ) : null}
        {item.relationshipStatus ? (
          <Token label={item.relationshipStatus} size="sm" color="cyan" />
        ) : null}
      </HStack>

      <div className="flex flex-wrap items-center gap-2">
        <Token label={`${console_.agents.fields.reliability} ${score(item.overallReliability)}`} size="sm" />
        {reliabilityVal !== null && (
          <div className="w-16 h-1.5 rounded-full bg-[var(--color-border)] overflow-hidden inline-block align-middle" title={`${reliabilityVal}%`}>
            <div
              className="h-full rounded-full bg-[var(--color-accent)] transition-all"
              style={{ width: `${reliabilityVal}%` }}
            />
          </div>
        )}
        <Token label={`${console_.agents.fields.taskFit} ${score(item.taskFit)}`} size="sm" />
        <Token label={`${console_.agents.fields.confidence} ${score(item.confidence)}`} size="sm" />
        {item.observedPriceUsdc ? (
          <Token label={`${console_.agents.price} ${item.observedPriceUsdc}`} size="sm" />
        ) : null}
        {item.memoryVersion !== null ? (
          <Token label={`${console_.agents.fields.version} ${item.memoryVersion}`} size="sm" />
        ) : null}
      </div>

      {item.riskNote ? (
        <div className="flex items-start gap-2 p-2.5 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)]/60 text-xs">
          <Shield size={13} className="text-[var(--color-accent)] mt-0.5 flex-shrink-0" />
          <Text as="p" size="sm">
            {console_.agents.risk}: {item.riskNote}
          </Text>
        </div>
      ) : null}

      <Episodes item={item} />

      {item.isFixture ? (
        <Text as="p" size="xsm" color="secondary">
          {console_.agents.fixtureNote}
        </Text>
      ) : null}
      {item.updatedAt ? (
        <Text as="p" size="xsm" color="secondary">
          {console_.agents.updated(item.updatedAt)}
        </Text>
      ) : null}
    </VStack>
  );
}

/**
 * The operator's own relationship memory, read from Sibyl.
 * Integrates all 5 Sibyl memory primitives: R1 Reflection, R2 Consolidation,
 * R3 Temporal Point-in-Time History, R4 Semantic Search, R5 Executive Summarization.
 */
export default async function CounterpartiesPage() {
  const [health, memory, grounding] = await Promise.all([
    apiClient.dbHealth(),
    apiClient.listSibylCounterparties(),
    readGrounding(),
  ]);
  const readiness = health.ok ? "ready" : "degraded";

  const details = memory.ok
    ? await Promise.all(
        memory.data.items.map(async (item) => {
          const [summary, reflections, dossier, temporal] = await Promise.all([
            typeof apiClient.getCounterpartySummary === "function"
              ? apiClient.getCounterpartySummary(item.counterpartyKey).catch(() => null)
              : Promise.resolve(null),
            typeof apiClient.getCounterpartyReflections === "function"
              ? apiClient.getCounterpartyReflections(item.counterpartyKey).catch(() => [])
              : Promise.resolve([]),
            typeof apiClient.getCounterpartyDossier === "function"
              ? apiClient.getCounterpartyDossier(item.counterpartyKey).catch(() => null)
              : Promise.resolve(null),
            typeof apiClient.getCounterpartyTemporal === "function"
              ? apiClient.getCounterpartyTemporal(item.counterpartyKey, 0).catch(() => null)
              : Promise.resolve(null),
          ]);
          return { item, summary, reflections, dossier, temporal };
        }),
      )
    : [];

  return (
    <ConsoleShell surface="Agents" readiness={readiness} grounding={grounding}>
      <h1 className="cs__title">{console_.agents.title}</h1>
      <p className="cs__lede">{console_.agents.lede}</p>

      {/* R4 Semantic & Intent-Based Memory Search Bar */}
      <div className="w-full max-w-4xl my-3">
        <CounterpartySemanticSearch />
      </div>

      {!memory.ok ? (
        <ConsoleUnavailableMemory>
          <p className="cs__detail">{memory.error.message}</p>
        </ConsoleUnavailableMemory>
      ) : memory.data.items.length === 0 ? (
        <VStack gap={2}>
          <Text as="p">{console_.agents.empty}</Text>
          <Text as="p" size="sm" color="secondary">
            {console_.agents.emptyNote}
          </Text>
        </VStack>
      ) : (
        <div className="flex flex-col gap-6 w-full max-w-4xl my-4">
          {details.map(({ item, summary, reflections, dossier, temporal }) => (
            <div
              key={item.counterpartyKey}
              data-testid={`counterparty-card-${item.counterpartyKey}`}
              className="p-5 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-[var(--color-accent)] transition-all shadow-sm flex flex-col gap-5"
            >
              <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border)]/60 pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-accent)]">
                    <Bot size={18} />
                  </div>
                  <div className="flex flex-col">
                    <span className="font-semibold text-sm text-[var(--color-text)]">
                      {item.displayName ?? item.counterpartyKey}
                    </span>
                    {item.displayName ? (
                      <span className="font-mono text-[11px] text-[var(--color-text-muted)]">
                        {item.counterpartyKey}
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Sparkles size={13} className="text-[var(--color-accent)] opacity-70" />
                  <span className="text-[11px] font-mono text-[var(--color-text-muted)]">
                    Sibyl Rep
                  </span>
                </div>
              </div>

              {/* R5 Executive Risk Digest Hero Banner */}
              {summary && (
                <CounterpartyExecutiveSummary
                  summary={summary}
                  counterpartyKey={item.counterpartyKey}
                />
              )}

              <div className="pt-1">
                {item.hasProfile ? <Profile item={item} /> : (
                  <Text as="p" size="sm" color="secondary">
                    {console_.agents.noProfile}
                  </Text>
                )}
              </div>

              {/* R1 Reflections, R2 Consolidated Dossier, R3 Temporal Point-in-Time History */}
              {item.hasProfile && (
                <div className="flex flex-col gap-4 pt-3 border-t border-[var(--color-border)]/60">
                  <CounterpartyReflections
                    reflections={reflections}
                    counterpartyKey={item.counterpartyKey}
                  />
                  <CounterpartyDossierView
                    dossier={dossier}
                    counterpartyKey={item.counterpartyKey}
                  />
                  <CounterpartyTemporalView
                    counterpartyKey={item.counterpartyKey}
                    initialReconstruction={temporal}
                    totalEpisodes={item.episodes.length}
                  />
                </div>
              )}
            </div>
          ))}

          <Text as="p" size="xsm" color="secondary">
            {console_.agents.scoreNote}
          </Text>
        </div>
      )}
    </ConsoleShell>
  );
}

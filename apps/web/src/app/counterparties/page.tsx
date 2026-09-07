import type { Metadata } from "next";
import { List, ListItem } from "@astryxdesign/core/List";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { Token } from "@astryxdesign/core/Token";

import { ConsoleShell } from "@/features/console/components/console-shell";
import { readGrounding } from "@/features/console/grounding";
import { ConsoleUnavailableMemory } from "@/features/console/components/console-states";
import { console_ } from "@/features/console/copy";
import { apiClient, type SibylCounterparty } from "@/lib/api-client";

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
    <VStack gap={3}>
      {item.episodes.map((episode, index) => (
        <VStack key={`${episode.run ?? "run"}-${index}`} gap={1}>
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
          {/* The note wraps. As a ListItem label it truncated to "Delivere…" at
              375px, and the note is the evidence the score is a summary of —
              the one line an operator reads before trusting someone with
              money. */}
          {episode.note ? (
            <Text as="p" size="sm">
              {episode.note}
            </Text>
          ) : null}
        </VStack>
      ))}
    </VStack>
  );
}

function Profile({ item }: { item: SibylCounterparty }) {
  return (
    <VStack gap={3}>
      <HStack gap={2} wrap="wrap">
        {/* Beside the record, not in `endContent`: there they were centred
            against the whole row, so on a tall entry they floated halfway down
            beside nothing. */}
        {item.isFixture ? (
          <Token label={console_.agents.fixtureBadge} size="sm" color="orange" />
        ) : null}
        {item.relationshipStatus ? (
          <Token label={item.relationshipStatus} size="sm" color="cyan" />
        ) : null}
      </HStack>
      <HStack gap={2} wrap="wrap">
        <Token label={`${console_.agents.fields.reliability} ${score(item.overallReliability)}`} size="sm" />
        <Token label={`${console_.agents.fields.taskFit} ${score(item.taskFit)}`} size="sm" />
        <Token label={`${console_.agents.fields.confidence} ${score(item.confidence)}`} size="sm" />
        {item.observedPriceUsdc ? (
          <Token label={`${console_.agents.price} ${item.observedPriceUsdc}`} size="sm" />
        ) : null}
        {/* Only when Sibyl holds one. A version is metadata about a profile,
            not the thing that makes one, so its absence is not reported as a
            gap in the relationship. */}
        {item.memoryVersion !== null ? (
          <Token label={`${console_.agents.fields.version} ${item.memoryVersion}`} size="sm" />
        ) : null}
      </HStack>

      {item.riskNote ? (
        <Text as="p" size="sm">
          {console_.agents.risk}: {item.riskNote}
        </Text>
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
      ) : memory.data.items.length === 0 ? (
        <VStack gap={2}>
          <Text as="p">{console_.agents.empty}</Text>
          <Text as="p" size="sm" color="secondary">
            {console_.agents.emptyNote}
          </Text>
        </VStack>
      ) : (
        <VStack gap={3}>
          <List hasDividers density="spacious">
            {memory.data.items.map((item) => (
              <ListItem
                key={item.counterpartyKey}
                label={item.displayName ?? item.counterpartyKey}
                description={
                  item.hasProfile ? <Profile item={item} /> : console_.agents.noProfile
                }
              />
            ))}
          </List>
          <Text as="p" size="xsm" color="secondary">
            {console_.agents.scoreNote}
          </Text>
        </VStack>
      )}
    </ConsoleShell>
  );
}

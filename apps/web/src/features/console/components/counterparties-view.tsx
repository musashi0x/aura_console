"use client";

import { useState } from "react";
import { Button } from "@astryxdesign/core/Button";
import { List, ListItem } from "@astryxdesign/core/List";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { Token } from "@astryxdesign/core/Token";

import { console_ } from "@/features/console/copy";
import { apiClient, type SibylCounterparty } from "@/lib/api-client";

function score(value: number | null): string {
  return value === null ? "—" : String(value);
}

function statusColor(status: string | null): "green" | "cyan" | "orange" | "red" | undefined {
  if (!status) return undefined;
  switch (status.toUpperCase()) {
    case "PREFERRED":
      return "green";
    case "KNOWN":
      return "cyan";
    case "WATCH":
      return "orange";
    case "BLOCKED":
      return "red";
    default:
      return undefined;
  }
}

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

interface CounterpartyItemProps {
  initialItem: SibylCounterparty;
}

function CounterpartyItem({ initialItem }: CounterpartyItemProps) {
  const [item, setItem] = useState(initialItem);
  const [busy, setBusy] = useState(false);
  const [unblockMessage, setUnblockMessage] = useState<string | null>(null);

  const isBlocked = item.relationshipStatus === "BLOCKED";

  const handleUnblock = async () => {
    if (busy) return;
    setBusy(true);
    setUnblockMessage(null);
    try {
      const res = await apiClient.unblockCounterparty(item.counterpartyKey, {
        unblockedBy: "operator",
        reason: "Operator manual unblock from Agents Console",
      });

      if (res.ok) {
        setItem((prev) => ({
          ...prev,
          relationshipStatus: res.data.newStatus,
          riskNote: `Manually unblocked by operator on ${new Date().toLocaleDateString()}`,
        }));
        setUnblockMessage("Candidate restored to WATCH status. Veto exclusion removed.");
      } else {
        setUnblockMessage(res.error.message || "Failed to unblock candidate.");
      }
    } catch (err) {
      setUnblockMessage(err instanceof Error ? err.message : "Error unblocking candidate.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <VStack gap={3}>
      <HStack gap={2} wrap="wrap" align="center">
        {item.isFixture ? (
          <Token label={console_.agents.fixtureBadge} size="sm" color="orange" />
        ) : null}
        {item.relationshipStatus ? (
          <Token
            label={item.relationshipStatus}
            size="sm"
            color={statusColor(item.relationshipStatus)}
          />
        ) : null}

        {isBlocked ? (
          <Button
            label={busy ? "Unblocking…" : "Manual Unblock (Restore to WATCH)"}
            size="sm"
            variant="secondary"
            isDisabled={busy}
            onClick={handleUnblock}
          />
        ) : null}
      </HStack>

      {unblockMessage ? (
        <Text as="p" size="xsm" color={isBlocked ? "primary" : "secondary"}>
          ✓ {unblockMessage}
        </Text>
      ) : null}

      <HStack gap={2} wrap="wrap">
        <Token
          label={`${console_.agents.fields.reliability} ${score(item.overallReliability)}`}
          size="sm"
        />
        <Token label={`${console_.agents.fields.taskFit} ${score(item.taskFit)}`} size="sm" />
        <Token
          label={`${console_.agents.fields.confidence} ${score(item.confidence)}`}
          size="sm"
        />
        {item.observedPriceUsdc ? (
          <Token label={`${console_.agents.price} ${item.observedPriceUsdc}`} size="sm" />
        ) : null}
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

export function CounterpartiesView({ items }: { items: SibylCounterparty[] }) {
  if (items.length === 0) {
    return (
      <VStack gap={2}>
        <Text as="p">{console_.agents.empty}</Text>
        <Text as="p" size="sm" color="secondary">
          {console_.agents.emptyNote}
        </Text>
      </VStack>
    );
  }

  return (
    <VStack gap={3}>
      <List hasDividers density="spacious">
        {items.map((item) => (
          <ListItem
            key={item.counterpartyKey}
            label={item.displayName ?? item.counterpartyKey}
            description={
              item.hasProfile ? (
                <CounterpartyItem initialItem={item} />
              ) : (
                console_.agents.noProfile
              )
            }
          />
        ))}
      </List>
      <Text as="p" size="xsm" color="secondary">
        {console_.agents.scoreNote}
      </Text>
    </VStack>
  );
}

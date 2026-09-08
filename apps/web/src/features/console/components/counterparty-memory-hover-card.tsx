"use client";

import { useEffect, useState } from "react";
import { Badge } from "@astryxdesign/core/Badge";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { apiClient } from "@/lib/api-client";
import type {
  CounterpartyMemorySummary,
  RelationshipStatus,
} from "../chat/chat-types";
import { MOCK_COUNTERPARTY_SUMMARIES } from "../fixtures/e2e-contracts";

export type { CounterpartyMemorySummary, RelationshipStatus };

export interface CounterpartyMemoryHoverCardProps {
  counterpartyKey: string;
  displayName?: string;
  summary?: CounterpartyMemorySummary;
  className?: string;
}

function getBadgeVariant(status: RelationshipStatus) {
  switch (status) {
    case "PREFERRED":
      return "success" as const;
    case "WATCH":
      return "warning" as const;
    case "BLOCKED":
      return "error" as const;
    case "KNOWN":
    case "NEW":
    case "ARCHIVED":
    default:
      return "neutral" as const;
  }
}

export function CounterpartyMemoryHoverCard({
  counterpartyKey,
  displayName,
  summary: propSummary,
  className,
}: CounterpartyMemoryHoverCardProps) {
  const fixture = MOCK_COUNTERPARTY_SUMMARIES[counterpartyKey] as
    | CounterpartyMemorySummary
    | undefined;
  const initialSummary = propSummary ?? fixture ?? null;

  const [asyncSummary, setAsyncSummary] = useState<CounterpartyMemorySummary | null>(null);
  const [loading, setLoading] = useState(initialSummary === null);

  useEffect(() => {
    // If summary is already provided via props or fixture, no remote fetch needed
    if (propSummary || fixture) {
      return;
    }

    let isMounted = true;

    apiClient
      .getCounterpartyMemory(counterpartyKey)
      .then((res) => {
        if (!isMounted) return;
        if (res.ok && res.data) {
          const data = res.data;
          setAsyncSummary({
            counterpartyKey: data.counterparty_key,
            displayName: displayName ?? data.counterparty_key,
            status: (data.relationship_status as RelationshipStatus) ?? "NEW",
            overallReliability: data.overall_reliability ?? 0.5,
            confidence: data.confidence ?? 0.0,
            episodesUsed: data.episodes_used ?? 0,
            latestOutcome: data.sibyl?.verdict?.detail ?? undefined,
          });
        } else {
          setAsyncSummary({
            counterpartyKey,
            displayName: displayName ?? counterpartyKey,
            status: "NEW",
            overallReliability: 0.5,
            confidence: 0.0,
            episodesUsed: 0,
          });
        }
      })
      .catch(() => {
        if (!isMounted) return;
        setAsyncSummary({
          counterpartyKey,
          displayName: displayName ?? counterpartyKey,
          status: "NEW",
          overallReliability: 0.5,
          confidence: 0.0,
          episodesUsed: 0,
        });
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [counterpartyKey, displayName, propSummary, fixture]);

  const summary = propSummary ?? fixture ?? asyncSummary ?? {
    counterpartyKey,
    displayName: displayName ?? counterpartyKey,
    status: "NEW" as RelationshipStatus,
    overallReliability: 0.5,
    confidence: 0.0,
    episodesUsed: 0,
  };

  return (
    <div
      className={className ? `cs__memory-hover-content ${className}` : "cs__memory-hover-content"}
      data-testid="hovercard-memory-preview"
      style={{ padding: 12, minWidth: 260 }}
    >
      <VStack gap={2}>
        <HStack justify="between" align="center">
          <Text as="span" size="sm" weight="bold">
            {summary.displayName}
          </Text>
          <Badge
            variant={getBadgeVariant(summary.status)}
            label={summary.status}
          />
        </HStack>

        <HStack gap={1} align="center">
          <Text as="span" size="xsm" color="secondary">
            Key: <code className="mono-ref__value">{summary.counterpartyKey}</code>
          </Text>
        </HStack>

        {loading ? (
          <Text as="p" size="xsm" color="secondary">
            Loading reputation memory...
          </Text>
        ) : (
          <>
            <Text as="p" size="xsm" color="secondary">
              Reliability: <strong>{(summary.overallReliability * 100).toFixed(1)}%</strong> · Confidence:{" "}
              <strong>{(summary.confidence * 100).toFixed(1)}%</strong>
            </Text>
            <Text as="p" size="xsm" color="secondary">
              Episodes: <strong>{summary.episodesUsed}</strong>
            </Text>
            {summary.latestOutcome ? (
              <Text as="p" size="xsm">
                Latest: {summary.latestOutcome}
              </Text>
            ) : null}
          </>
        )}
      </VStack>
    </div>
  );
}

CounterpartyMemoryHoverCard.displayName = "CounterpartyMemoryHoverCard";

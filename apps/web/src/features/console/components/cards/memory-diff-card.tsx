"use client";

import type { ReactNode } from "react";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { Token } from "@astryxdesign/core/Token";
import { Database } from "lucide-react";

import type { TimelineEntry } from "@/features/console/model/types";
import { number, text } from "./fields";

export interface MemoryDiffCardProps {
  entry: TimelineEntry;
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <HStack gap={2} wrap="wrap">
      <Text as="span" size="xsm" color="secondary">
        {label}
      </Text>
      <Text as="span" size="sm">
        {value}
      </Text>
    </HStack>
  );
}

export function MemoryDiffCard({ entry }: MemoryDiffCardProps) {
  const d = entry.data;
  const counterparty = text(d, "counterparty_key") ?? text(d, "counterparty");
  const beforeVersion = number(d, "before_version");
  const afterVersion = number(d, "after_version") ?? number(d, "version");
  const beforeReliability = number(d, "before_reliability");
  const afterReliability = number(d, "after_reliability") ?? number(d, "overall_reliability");
  const status = text(d, "status") ?? text(d, "relationship_status");
  const sibylEventId = text(d, "sibyl_event_id");
  const sibylRecorded = d && typeof d === "object" && "sibyl_recorded" in d && d.sibyl_recorded === true;

  const versionDelta =
    beforeVersion !== null && afterVersion !== null
      ? `v${beforeVersion} → v${afterVersion}`
      : afterVersion !== null
        ? `v${afterVersion}`
        : null;

  const reliabilityDelta =
    beforeReliability !== null && afterReliability !== null
      ? `${Math.round(beforeReliability * 100)}% → ${Math.round(afterReliability * 100)}%`
      : afterReliability !== null
        ? `${Math.round(afterReliability * 100)}%`
        : null;

  return (
    <VStack gap={2}>
      <HStack justify="between" align="center" wrap="wrap" className="mw__card-header mw__row-header">
        <HStack gap={2} align="center" className="mw__card-title-wrap mw__row-title-wrap">
          <span className="mw__card-icon mw__row-icon" aria-hidden="true">
            <Database size={15} />
          </span>
          <Text as="h3" size="sm" weight="semibold">
            Relationship Memory Diff
          </Text>
          <Token label={entry.type} size="sm" color="cyan" />
          {status ? <Token label={status} size="sm" color={status === "BLOCKED" ? "red" : "green"} /> : null}
        </HStack>
        <Text as="p" size="xsm" color="secondary">
          <time dateTime={entry.eventTime}>{entry.eventTime}</time>
        </Text>
      </HStack>

      <Text as="p" size="sm">
        {entry.summary || "Relationship memory updated with mission outcome"}
      </Text>

      {counterparty ? <Row label="Counterparty" value={<code className="cs__run-ref">{counterparty}</code>} /> : null}
      {versionDelta ? <Row label="Memory Version" value={versionDelta} /> : null}
      {reliabilityDelta ? <Row label="Reliability" value={reliabilityDelta} /> : null}
      {sibylEventId ? <Row label="Sibyl Event ID" value={<code className="font-mono text-xs">{sibylEventId}</code>} /> : null}
      {sibylRecorded ? <Row label="Sibyl Storage" value="Recorded in persistent memory.db" /> : null}
    </VStack>
  );
}

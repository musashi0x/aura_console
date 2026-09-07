"use client";

import type { ReactNode } from "react";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { Token } from "@astryxdesign/core/Token";

import { console_ } from "@/features/console/copy";
import type { RetrievalStatus, TimelineEntry } from "@/features/console/model/types";
import type { Counterfactual } from "@/features/console/projection/counterfactual";
import { ApprovalRequestCard } from "./approval-request-card";
import { CounterfactualView } from "./counterfactual-view";
import { amount, list, number, text } from "./fields";

/**
 * One canonical event, rendered as the card its type earns.
 *
 * A card is a projection, never a message. Every value below is read by name
 * out of the event that produced it, so nothing here can render a fact the
 * stream does not contain — no economic value computed locally, no completion
 * inferred from silence. If a model could author one of these, every guarantee
 * the Console has would leave through it.
 *
 * A type with no card yet falls through to the raw entry rather than being
 * dropped or paraphrased, which is the treatment `UNSUPPORTED_TYPE` already
 * gets and for the same reason.
 */
export interface EventCardProps {
  entry: TimelineEntry;
  onScrubTo?: (entry: TimelineEntry) => void;
  /**
   * The live Mission this card belongs to.
   *
   * Absent for the fixture, and that absence is load-bearing: without a Run id
   * the Approval card renders no button, so example data cannot offer a control
   * that would authorize anything.
   */
  runId?: string;
  /** Re-read the Mission after an approval lands. */
  onApproved?: () => void;
  /** Re-read the Mission after an approval rejection lands. */
  onRejected?: () => void;
  /**
   * The no-memory comparison, folded from this Mission's recorded events.
   *
   * Passed in rather than computed here because it reads the whole stream and a
   * card only ever sees its own event.
   */
  counterfactual?: Counterfactual;
}

/**
 * A labelled fact, or nothing at all.
 *
 * An absent field is not rendered. A row reading "Chose —" invites the reader
 * to wonder what was chosen and hidden, when the truth is that the event never
 * said. Showing only what the stream carries keeps the card the same size as
 * its evidence.
 */
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

function Shell({
  title,
  tone,
  entry,
  children,
}: {
  title: string;
  tone?: "green" | "red" | "orange" | "cyan";
  entry: TimelineEntry;
  children: ReactNode;
}) {
  return (
    <VStack gap={2}>
      <HStack gap={2} wrap="wrap">
        <Text as="h3" size="sm" weight="semibold">
          {title}
        </Text>
        {tone ? <Token label={entry.type} size="sm" color={tone} /> : null}
      </HStack>
      {children}
      <Text as="p" size="xsm" color="secondary">
        <time dateTime={entry.eventTime}>{entry.eventTime}</time>
      </Text>
    </VStack>
  );
}

const RETRIEVAL_STATUSES: readonly RetrievalStatus[] = [
  "NOT_REQUESTED",
  "LOADING",
  "NO_HISTORY",
  "AVAILABLE",
  "ERROR",
];

function retrievalStatus(value: string | null): RetrievalStatus | null {
  return RETRIEVAL_STATUSES.find((status) => status === value) ?? null;
}

export function EventCard({
  entry,
  runId,
  onApproved,
  onRejected,
  counterfactual,
}: EventCardProps) {
  const d = entry.data;
  const copy = console_.cards;

  switch (entry.type) {
    case "decision.made":
    case "decision.proposed": {
      return (
        <Shell title={copy.decision.title} tone="cyan" entry={entry}>
          <Text as="p" size="sm">
            {entry.summary}
          </Text>
          <Row label={copy.decision.chose} value={text(d, "counterparty_key") ?? text(d, "chosen")} />
          <Row label={copy.decision.mode} value={text(d, "authorization_mode")} />
          {/* Reasons only when the event carries them. A decision card with an
              invented rationale is the most persuasive lie available here. */}
          {list(d, "reasons").length > 0 ? (
            <VStack gap={1}>
              <Text as="span" size="xsm" color="secondary">
                {copy.decision.reasons}
              </Text>
              {list(d, "reasons").map((reason) => (
                <Text key={reason} as="p" size="sm">
                  {reason}
                </Text>
              ))}
            </VStack>
          ) : null}
          {/* The comparison hangs off the decision it explains, not off a stage
              of its own. It renders nothing when the Mission recorded no
              memory component to subtract. */}
          {counterfactual ? <CounterfactualView counterfactual={counterfactual} /> : null}
        </Shell>
      );
    }

    /* The pending request. Its own component because it is the only card that
       carries a control, and that deserves to be read in one place. */
    case "approval.requested": {
      return (
        <ApprovalRequestCard
          entry={entry}
          runId={runId}
          onApproved={onApproved}
          onRejected={onRejected}
          counterfactual={counterfactual}
        />
      );
    }

    case "policy.evaluated": {
      const passed = d?.passed;
      return (
        <Shell title={copy.policy.title} tone="cyan" entry={entry}>
          <Text as="p" size="sm">
            {entry.summary}
          </Text>
          <Row label={copy.policy.rule} value={text(d, "policy_version") ?? text(d, "rule")} />
          {/* Only when the event states an outcome. A gate with no reported
              result must not be drawn as passing. */}
          {typeof passed === "boolean" ? (
            <Token
              label={passed ? copy.policy.passed : copy.policy.failed}
              size="sm"
              color={passed ? "green" : "red"}
            />
          ) : null}
        </Shell>
      );
    }

    case "approval.granted": {
      return (
        <Shell title={copy.approval.title} tone="green" entry={entry}>
          <Text as="p" size="sm">
            {copy.approval.granted}
          </Text>
          <Row label={copy.approval.ceiling} value={amount(d, "ceiling_usdc") ?? amount(d, "amount_usdc")} />
          <Text as="p" size="xsm" color="secondary">
            {copy.approval.note}
          </Text>
        </Shell>
      );
    }

    case "acp.job.created":
    case "acp.job.funded": {
      return (
        <Shell title={copy.job.title} tone="cyan" entry={entry}>
          <Text as="p" size="sm">
            {entry.summary}
          </Text>
          <Row label={copy.job.provider} value={text(d, "counterparty_key") ?? text(d, "provider")} />
          <Row label={copy.job.amount} value={amount(d, "amount_usdc")} />
          <Row label={copy.job.state} value={text(d, "job_state") ?? text(d, "state")} />
        </Shell>
      );
    }

    case "base.transaction.confirmed":
    case "commitment.settled": {
      return (
        <Shell title={copy.transaction.title} tone="cyan" entry={entry}>
          <Text as="p" size="sm">
            {entry.summary}
          </Text>
          <Row label={copy.transaction.network} value={text(d, "network")} />
          <Row label={copy.transaction.amount} value={amount(d, "amount_usdc")} />
          {/* A hash is only shown beside what it settled, never alone. */}
          <Row label={copy.transaction.reference} value={text(d, "tx_hash") ?? text(d, "reference")} />
        </Shell>
      );
    }

    case "outcome.recorded":
    case "evaluation.completed": {
      const failure = text(d, "failure_reason");
      return (
        <Shell title={copy.outcome.title} tone={failure ? "red" : "green"} entry={entry}>
          <Text as="p" size="sm">
            {entry.summary}
          </Text>
          <Row label={copy.outcome.result} value={text(d, "result") ?? text(d, "outcome")} />
          <Row label={copy.outcome.evaluator} value={text(d, "evaluated_by") ?? text(d, "evaluator")} />
          {/* Success is never inferred from a job ending. A failure renders
              only because the event named one. */}
          {failure ? <Row label={copy.outcome.failure} value={failure} /> : null}
        </Shell>
      );
    }

    case "memory.retrieval.started":
    case "memory.retrieved": {
      const status = retrievalStatus(text(d, "retrieval_status"));
      return (
        <Shell title={copy.memory.title} tone="cyan" entry={entry}>
          {/* Retrieval STATE, not a record. NO_HISTORY and ERROR never collapse
              into each other, and nothing here says memory changed a decision:
              that is a claim about a counterfactual the Console has not run. */}
          <Text as="p" size="sm">
            {status ? copy.memory.status[status] : entry.summary}
          </Text>
          <Row label={copy.memory.counterparty} value={text(d, "counterparty_key")} />
          {number(d, "episodes_used") !== null ? (
            <Row label={copy.memory.episodes} value={number(d, "episodes_used")} />
          ) : null}
          {number(d, "memory_version") !== null ? (
            <Row label={copy.memory.version} value={number(d, "memory_version")} />
          ) : null}
        </Shell>
      );
    }

    default: {
      /* Three different answers, and only one of them is "a card is missing".
         A lifecycle event has no stage in the decision story but is fully
         understood — it is what moves the Run's status — so telling the
         operator no card reads it implies a gap that is not there. That note
         belongs to a type the fold genuinely does not recognise. */
      const lifecycle = entry.stage === null && entry.support === "SUPPORTED";
      return (
        <Shell title={entry.type} entry={entry}>
          <Text as="p" size="sm">
            {entry.summary}
          </Text>
          {lifecycle ? null : (
            <Text as="p" size="xsm" color="secondary">
              {copy.raw.note}
            </Text>
          )}
        </Shell>
      );
    }
  }
}

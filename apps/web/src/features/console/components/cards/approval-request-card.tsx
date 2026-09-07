"use client";

import { useState } from "react";
import { Button } from "@astryxdesign/core/Button";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { Token } from "@astryxdesign/core/Token";

import { console_ } from "@/features/console/copy";
import type { TimelineEntry } from "@/features/console/model/types";
import type { Counterfactual } from "@/features/console/projection/counterfactual";
import { apiClient } from "@/lib/api-client";
import { CounterfactualView } from "./counterfactual-view";
import { amount, text } from "./fields";

/**
 * The pending approval, and the only control in the console that changes the
 * world.
 *
 * Everything about this card is arranged so the authorization cannot happen by
 * accident:
 *
 * - The button is the only caller. There is no effect, no timer and no retry;
 *   `approve` runs from `onClick` and nowhere else.
 * - It names what it authorizes before it is pressed — the action, the
 *   counterparty, and the ceiling — because an approval the operator cannot
 *   read is one they did not really give.
 * - Without a recorded ceiling there is no button at all. Approving to an
 *   unknown limit is a blank cheque, and a control that should not act is not
 *   rendered rather than rendered and refused.
 * - A failure says nothing was authorized. The dangerous failure here is the
 *   ambiguous one, where an operator cannot tell whether their click landed.
 */
export interface ApprovalRequestCardProps {
  entry: TimelineEntry;
  /** Absent on the fixture, which must never offer a live control. */
  runId?: string;
  /** Re-read the Mission so the granted event appears in the stream. */
  onApproved?: () => void;
  /** Re-read the Mission so the rejected event appears in the stream. */
  onRejected?: () => void;
  /** The counterfactual comparison or rationale. */
  counterfactual?: Counterfactual;
}

export function ApprovalRequestCard({
  entry,
  runId,
  onApproved,
  onRejected,
  counterfactual,
}: ApprovalRequestCardProps) {
  const copy = console_.cards.approval.pending;
  const [busy, setBusy] = useState(false);
  const [rejectBusy, setRejectBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [rejectFailed, setRejectFailed] = useState(false);

  const d = entry.data;
  const action = text(d, "action") ?? text(d, "reason") ?? text(d, "summary");
  const counterparty = text(d, "counterparty_key");
  const ceiling = amount(d, "ceiling_usdc") ?? amount(d, "amount_usdc");
  const counterfactualRationale = text(d, "counterfactual_rationale");

  async function approve() {
    if (!runId || !ceiling || busy || rejectBusy) return;
    setBusy(true);
    setFailed(false);
    setRejectFailed(false);
    const result = await apiClient.approveRun(runId, ceiling);
    setBusy(false);
    if (!result.ok) {
      /* Reported, never swallowed. An approval that silently failed would
         leave the operator believing they authorized something. */
      setFailed(true);
      return;
    }
    onApproved?.();
  }

  async function reject() {
    if (!runId || busy || rejectBusy) return;
    setRejectBusy(true);
    setFailed(false);
    setRejectFailed(false);
    const result = await apiClient.rejectRun(runId);
    setRejectBusy(false);
    if (!result.ok) {
      /* Reported, never swallowed. A rejection that silently failed would
         leave the operator believing they rejected something. */
      setRejectFailed(true);
      return;
    }
    if (onRejected) {
      onRejected();
    } else {
      onApproved?.();
    }
  }

  return (
    <VStack gap={2}>
      <HStack gap={2} wrap="wrap">
        <Text as="h3" size="sm" weight="semibold">
          {copy.title}
        </Text>
        <Token label={entry.type} size="sm" color="orange" />
      </HStack>

      <Text as="p" size="sm">
        {copy.lede}
      </Text>

      {action ? <Field label={copy.action} value={action} /> : null}
      {counterparty ? <Field label={copy.counterparty} value={counterparty} /> : null}
      {ceiling ? <Field label={copy.ceilingLabel} value={ceiling} /> : null}

      {counterfactual && counterfactual.status !== "UNAVAILABLE" ? (
        <CounterfactualView counterfactual={counterfactual} />
      ) : counterfactualRationale ? (
        <Field label="Counterfactual" value={counterfactualRationale} />
      ) : counterfactual ? (
        <CounterfactualView counterfactual={counterfactual} />
      ) : null}

      {/* No ceiling, no button: there is nothing to approve against. */}
      {ceiling === null ? (
        <Text as="p" size="xsm" color="secondary">
          {copy.missingCeiling}
        </Text>
      ) : runId ? (
        <VStack gap={1}>
          <HStack gap={2}>
            {/* `label` is the accessible name and moves with the state, so a
                screen reader hears the approval is in flight rather than an
                idle button that stopped responding. */}
            <Button
              label={busy ? copy.approving : copy.approve}
              onClick={approve}
              isDisabled={busy || rejectBusy}
              isLoading={busy}
            />
            <Button
              label={rejectBusy ? "Rejecting…" : "Reject"}
              variant="secondary"
              onClick={reject}
              isDisabled={busy || rejectBusy}
              isLoading={rejectBusy}
            />
          </HStack>
          <Text as="p" size="xsm" color="secondary">
            {copy.note}
          </Text>
          {failed ? (
            <Text as="p" size="xsm" color="secondary">
              {copy.failed}
            </Text>
          ) : null}
          {rejectFailed ? (
            <Text as="p" size="xsm" color="secondary">
              The rejection was not recorded.
            </Text>
          ) : null}
        </VStack>
      ) : null}

      <Text as="p" size="xsm" color="secondary">
        <time dateTime={entry.eventTime}>{entry.eventTime}</time>
      </Text>
    </VStack>
  );
}

function Field({ label, value }: { label: string; value: string }) {
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

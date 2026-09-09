import { useState, type ReactNode } from "react";
import { Button } from "@astryxdesign/core/Button";
import { Link } from "@astryxdesign/core/Link";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { Token } from "@astryxdesign/core/Token";
import {
  Brain,
  ShieldCheck,
  Coins,
  CheckCircle2,
  Database,
  Activity,
  AlertCircle,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

import { console_ } from "@/features/console/copy";
import type { RetrievalStatus, TimelineEntry } from "@/features/console/model/types";
import type { Counterfactual } from "@/features/console/projection/counterfactual";
import { ApprovalRequestCard } from "./approval-request-card";
import { CounterfactualView } from "./counterfactual-view";
import { MemoryDiffCard } from "./memory-diff-card";
import { amount, list, number, text } from "./fields";
import { apiClient } from "@/lib/api-client";

function getEventIcon(type: string) {
  if (type.startsWith("memory.commitment")) return <Coins size={15} />;
  if (type.startsWith("memory")) return <Database size={15} />;
  if (type.startsWith("decision")) return <Brain size={15} />;
  if (type.startsWith("policy")) return <ShieldCheck size={15} />;
  if (type.startsWith("approval")) return <AlertCircle size={15} />;
  if (type.startsWith("acp") || type.startsWith("base") || type.startsWith("commitment"))
    return <Coins size={15} />;
  if (type.startsWith("outcome") || type.startsWith("evaluation"))
    return <CheckCircle2 size={15} />;
  return <Activity size={15} />;
}

function getNarrative(type: string, d?: Record<string, unknown> | null): string | null {
  if (type === "run.created") return "Mission initialized with an economic budget ceiling.";
  if (type === "run.started") return "Autonomous agent runtime initiated task execution.";
  if (type === "decision.made" || type === "decision.proposed") {
    const cp = d?.counterparty_key || d?.chosen;
    return cp
      ? `Agent evaluated options and selected counterparty ${cp} under ${d?.authorization_mode || "governed policy"}.`
      : "Agent finalized execution decision.";
  }
  if (type === "policy.evaluated") {
    return d?.passed === false
      ? "Policy gate failed or triggered an authorization condition."
      : "Policy gate verified: spend ceiling and trust bounds satisfied.";
  }
  if (type === "approval.requested") {
    return "Action exceeds automated spend threshold and requires manual operator authorization.";
  }
  if (type === "approval.granted") {
    return "Operator authorized spend ceiling.";
  }
  if (type === "acp.job.funded" || type === "acp.job.created") {
    return `Escrow funded with ${d?.amount_usdc ?? "USDC"} committed to counterparty.`;
  }
  if (type === "base.transaction.confirmed" || type === "commitment.settled") {
    return "Transaction settled and confirmed on Base Sepolia.";
  }
  if (type === "memory.commitment.confirmed") {
    return "Salted memory commitment published and confirmed on Base Sepolia.";
  }
  if (type === "memory.commitment.submitted") {
    return "Salted memory commitment submitted to Base Sepolia.";
  }
  if (type === "outcome.recorded" || type === "evaluation.completed") {
    return d?.failure_reason
      ? `Evaluation failed: ${d.failure_reason}`
      : "Service delivery verified and accepted against quality criteria.";
  }
  if (type === "memory.diff.published" || type === "memory.episode.written") {
    return "Relationship memory updated with newly recorded episode metrics and score adjustments.";
  }
  return null;
}

export interface EventCardProps {
  entry: TimelineEntry;
  onScrubTo?: (entry: TimelineEntry) => void;
  runId?: string;
  onApproved?: () => void;
  onRejected?: () => void;
  counterfactual?: Counterfactual;
  environment?: string;
}

function AcpDeliverableCard({
  entry,
  runId,
  onApproved,
}: {
  entry: TimelineEntry;
  runId?: string;
  onApproved?: () => void;
}) {
  const d = entry.data;
  const provider = text(d, "provider") ?? text(d, "counterparty_key");
  const deliverable = text(d, "deliverable");
  const deliverableHash = text(d, "deliverable_hash");

  const [completing, setCompleting] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  async function handleEvaluate(action: "complete" | "reject") {
    if (!runId || completing || rejecting) return;
    if (action === "complete") {
      setCompleting(true);
    } else {
      setRejecting(true);
    }
    setFailed(null);

    const defaultReason =
      action === "complete"
        ? "Deliverable verified against criteria and accepted by operator."
        : "Deliverable rejected by operator: failed verification standards.";

    const res = await apiClient.evaluateAcpJob(runId, {
      action,
      reason: defaultReason,
    });

    setCompleting(false);
    setRejecting(false);

    if (!res.ok) {
      setFailed("Evaluation failed to record.");
      return;
    }

    onApproved?.();
  }

  return (
    <Shell title="ACP Deliverable" tone="orange" entry={entry}>
      <Text as="p" size="sm">
        {entry.summary}
      </Text>
      {provider ? <Row label="Provider" value={provider} /> : null}
      {deliverable ? <Row label="Deliverable" value={deliverable} /> : null}
      {deliverableHash ? (
        <Row
          label="Deliverable Hash"
          value={
            <Token
              size="sm"
              color="orange"
              label={`${deliverableHash.slice(0, 10)}…`}
            />
          }
        />
      ) : null}

      {runId ? (
        <VStack gap={1} className="mw__eval-controls">
          <Text as="p" size="xsm" color="secondary">
            Operator Evaluation:
          </Text>
          <HStack gap={2}>
            <Button
              size="sm"
              label={completing ? "Completing…" : "Complete (Accept)"}
              onClick={() => handleEvaluate("complete")}
              isDisabled={completing || rejecting}
              isLoading={completing}
            />
            <Button
              size="sm"
              variant="secondary"
              label={rejecting ? "Rejecting…" : "Reject"}
              onClick={() => handleEvaluate("reject")}
              isDisabled={completing || rejecting}
              isLoading={rejecting}
            />
          </HStack>
          {failed ? (
            <Text as="p" size="xsm" color="secondary">
              {failed}
            </Text>
          ) : null}
        </VStack>
      ) : null}
    </Shell>
  );
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

export function formatEventTime(value: string): string {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})/.exec(value);
  if (!match) return value;
  return `${match[1]} ${match[2]} UTC`;
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
  const [showPayload, setShowPayload] = useState(false);
  const narrative = getNarrative(entry.type, entry.data);
  const d = entry.data;
  const hasPayload = d && Object.keys(d).length > 0;
  const canShowPayload = hasPayload && entry.type !== "approval.granted";

  const txHash = (() => {
    const v = d?.tx_hash ?? d?.reference ?? d?.txHash;
    return typeof v === "string" && v.startsWith("0x") ? v : null;
  })();

  return (
    <VStack gap={2}>
      <HStack justify="between" align="center" wrap="wrap" className="mw__card-header mw__row-header">
        <HStack gap={2} align="center" className="mw__card-title-wrap mw__row-title-wrap">
          <span className="mw__card-icon mw__row-icon" aria-hidden="true">
            {getEventIcon(entry.type)}
          </span>
          <Text as="h3" size="sm" weight="semibold">
            {title}
          </Text>
          {tone ? <Token label={entry.type} size="sm" color={tone} /> : null}
        </HStack>
        <Text as="p" size="xsm" color="secondary">
          <time dateTime={entry.eventTime}>{formatEventTime(entry.eventTime)}</time>
        </Text>
      </HStack>

      {narrative ? <p className="mw__card-narrative mw__row-narrative">{narrative}</p> : null}

      {children}

      {txHash ? (
        <div className="mw__card-metrics mw__row-metrics">
          <div className="mw__card-metric-chip mw__row-metric-chip">
            <span className="mw__card-metric-label mw__row-metric-label">On-Chain Tx</span>
            <Link
              href={`https://sepolia.basescan.org/tx/${txHash}`}
              target="_blank"
              className="mw__card-metric-value mw__tx-link"
            >
              {txHash.slice(0, 8)}...{txHash.slice(-6)}
            </Link>
          </div>
        </div>
      ) : null}

      {canShowPayload ? (
        <HStack gap={2} align="center" className="mw__card-actions mw__row-actions">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mw__card-action-btn mw__row-action-btn"
            onClick={() => setShowPayload((prev) => !prev)}
            aria-expanded={showPayload}
            icon={showPayload ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            label={showPayload ? "Hide Payload" : "View Payload"}
          />
          {txHash ? (
            <Link
              href={`https://sepolia.basescan.org/tx/${txHash}`}
              target="_blank"
              className="mw__card-action-btn mw__row-action-btn"
            >
              <ExternalLink size={12} />
              <span>Base Sepolia Explorer</span>
            </Link>
          ) : null}
        </HStack>
      ) : null}

      {showPayload && d ? (
        <pre className="mw__card-payload mw__row-payload">
          <code>{JSON.stringify(d, null, 2)}</code>
        </pre>
      ) : null}
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
  environment,
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
          environment={environment}
        />
      );
    }

    case "acp.budget.set": {
      return (
        <ApprovalRequestCard
          entry={entry}
          runId={runId}
          onApproved={onApproved}
          onRejected={onRejected}
          counterfactual={counterfactual}
          environment={environment ?? "base-sepolia"}
        />
      );
    }

    case "acp.job.submitted": {
      return <AcpDeliverableCard entry={entry} runId={runId} onApproved={onApproved} />;
    }

    case "acp.job.linked": {
      const linkedRun = text(d, "run_id") ?? text(d, "job_id");
      return (
        <Shell title="ACP Job Linked" tone="cyan" entry={entry}>
          <Text as="p" size="sm">
            {entry.summary}
          </Text>
          {linkedRun ? <Row label="Linked Run" value={linkedRun} /> : null}
          {text(d, "job_id") ? <Row label="Job ID" value={text(d, "job_id")} /> : null}
          {number(d, "chain_id") ? <Row label="Chain ID" value={number(d, "chain_id")} /> : null}
        </Shell>
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
    case "commitment.settled":
    case "memory.commitment.confirmed":
    case "memory.commitment.submitted": {
      const txHash = text(d, "tx_hash") ?? text(d, "reference");
      const explorerUrl =
        text(d, "explorer_url") ??
        (txHash && txHash.startsWith("0x")
          ? `https://sepolia.basescan.org/tx/${txHash}`
          : null);
      return (
        <Shell title={copy.transaction.title} tone="cyan" entry={entry}>
          <Text as="p" size="sm">
            {entry.summary}
          </Text>
          <Row label={copy.transaction.network} value={text(d, "network")} />
          <Row label={copy.transaction.amount} value={amount(d, "amount_usdc")} />
          <Row label="Counterparty" value={text(d, "counterparty_key")} />
          {number(d, "memory_version") !== null ? (
            <Row label="Memory Version" value={`v${number(d, "memory_version")}`} />
          ) : null}
          <Row label="Commitment" value={text(d, "commitment")} />
          {/* A hash is only shown beside what it settled, never alone. */}
          <Row label={copy.transaction.reference} value={txHash} />
          {explorerUrl ? (
            <HStack gap={2} align="center">
              <Text as="span" size="xsm" color="secondary">
                Explorer
              </Text>
              <Link
                href={explorerUrl}
                target="_blank"
                rel="noreferrer"
                className="mw__tx-link"
              >
                <HStack gap={1} align="center">
                  <span>BaseScan</span>
                  <ExternalLink size={12} />
                </HStack>
              </Link>
            </HStack>
          ) : null}
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

    case "memory.diff.published":
    case "memory.episode.written": {
      return <MemoryDiffCard entry={entry} />;
    }

    default: {
      /* Three different answers, and only one of them is "a card is missing".
         A lifecycle event has no stage in the decision story but is fully
         understood — it is what moves the Run's status — so telling the
         operator no card reads it implies a gap that is not there. That note
         belongs to a type the fold genuinely does not recognise. */
      const lifecycle = entry.stage === null && entry.support === "SUPPORTED";
      const isDuplicate =
        !entry.summary ||
        entry.summary.trim().toLowerCase() === entry.type.trim().toLowerCase();
      return (
        <Shell title={entry.type} entry={entry}>
          {isDuplicate ? null : (
            <Text as="p" size="sm">
              {entry.summary}
            </Text>
          )}
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

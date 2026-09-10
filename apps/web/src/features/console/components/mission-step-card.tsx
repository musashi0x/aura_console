"use client";

import { useState } from "react";
import { Badge } from "@astryxdesign/core/Badge";
import { Button } from "@astryxdesign/core/Button";
import { Link } from "@astryxdesign/core/Link";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { StatusDot } from "@astryxdesign/core/StatusDot";
import { Text } from "@astryxdesign/core/Text";
import { Token } from "@astryxdesign/core/Token";
import {
  Brain,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Coins,
  Database,
  ExternalLink,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";

import { console_ } from "../copy";
import type { TimelineEntry } from "../model/types";
import type { MissionStep, MissionStepNode } from "../projection/mission-rail";
import { playInteractionSound } from "@/components/primitives/InteractionSounds";
import { ApprovalRequestCard } from "./cards/approval-request-card";

export interface MissionStepCardProps {
  node: MissionStepNode;
  runId?: string;
  onSelect?: (eventId: string) => void;
  onApproved?: () => void;
  onRejected?: () => void;
  defaultExpanded?: boolean;
}

const STEP_ICONS: Record<MissionStep, React.ComponentType<{ size?: number; className?: string }>> = {
  UNDERSTAND: Brain,
  REMEMBER: Database,
  DECIDE: ShieldCheck,
  ACT: Coins,
  VERIFY: CheckCircle2,
  LEARN: Sparkles,
};

function getStepNarrative(step: MissionStep, entries: TimelineEntry[]): string {
  if (entries.length === 0) {
    return "Awaiting prior step completion.";
  }

  // Synthesize executive narrative based on step semantics
  switch (step) {
    case "UNDERSTAND": {
      const discovery = entries.find((e) => e.type.includes("discovered") || Array.isArray(e.data?.candidates));
      if (discovery && Array.isArray(discovery.data?.candidates)) {
        return `Discovered ${discovery.data.candidates.length} counterparties matching dataset criteria.`;
      }
      return entries[0]?.summary ?? "Market requirements and objectives analyzed.";
    }
    case "REMEMBER": {
      const memory = entries.find((e) => e.type.includes("memory") || e.data?.episodes_used);
      if (memory && typeof memory.data?.episodes_used === "number") {
        const key = typeof memory.data?.counterparty_key === "string" ? memory.data.counterparty_key : "counterparty";
        return `Recalled ${memory.data.episodes_used} prior settlement records for ${key}.`;
      }
      return entries[0]?.summary ?? "Queried historical reputation and settlement episodes.";
    }
    case "DECIDE": {
      const decision = entries.find((e) => e.type.includes("decision") || e.data?.counterparty_key);
      if (decision && typeof decision.data?.counterparty_key === "string") {
        return `Selected ${decision.data.counterparty_key} based on settlement history and operator limits.`;
      }
      return entries[entries.length - 1]?.summary ?? "Counterparties ranked under risk and governance policy.";
    }
    case "ACT": {
      const funding = entries.find((e) => e.type.includes("funded") || e.data?.amount_usdc);
      if (funding && typeof funding.data?.amount_usdc === "string") {
        return `Allocated and funded ${funding.data.amount_usdc} USDC within approved ceiling.`;
      }
      return entries[entries.length - 1]?.summary ?? "Autonomous transaction dispatched to network.";
    }
    case "VERIFY": {
      const evalEntry = entries.find((e) => e.type.includes("evaluation") || e.data?.result);
      if (evalEntry && typeof evalEntry.data?.result === "string") {
        return `Delivery verified: ${evalEntry.data.result} against objective criteria.`;
      }
      return entries[entries.length - 1]?.summary ?? "Delivered assets and receipts verified.";
    }
    case "LEARN": {
      const diff = entries.find((e) => e.type.includes("diff") || e.type.includes("episode"));
      if (diff) {
        return "Consolidated relationship memory and updated counterparty reputation score.";
      }
      return entries[entries.length - 1]?.summary ?? "Mission outcomes and learnings committed.";
    }
    default:
      return entries[entries.length - 1]?.summary ?? "Step processing completed.";
  }
}

interface StepEntities {
  counterparty?: string;
  amount?: string;
  policy?: string;
  txHash?: string;
  episodes?: number;
  result?: string;
  candidatesCount?: number;
  memoryDiff?: string;
  authorizationMode?: string;
  isSimulated?: boolean;
}

function extractEntities(entries: TimelineEntry[]): StepEntities {
  const res: StepEntities = {};
  for (const entry of entries) {
    const d = entry.data ?? {};
    if (d.simulated === true) {
      res.isSimulated = true;
    }
    if (!res.counterparty && typeof d.counterparty_key === "string") {
      res.counterparty = d.counterparty_key;
    }
    if (!res.amount && typeof d.amount_usdc === "string") {
      res.amount = `${d.amount_usdc} USDC`;
    } else if (!res.amount && typeof d.spent_usdc === "string") {
      res.amount = `${d.spent_usdc} USDC`;
    }
    if (!res.policy && typeof d.policy_version === "string") {
      res.policy = `Policy ${d.policy_version}`;
    }
    if (!res.txHash && typeof d.tx_hash === "string" && d.tx_hash.startsWith("0x")) {
      res.txHash = d.tx_hash;
    }
    if (res.episodes === undefined && typeof d.episodes_used === "number") {
      res.episodes = d.episodes_used;
    }
    if (!res.result && typeof d.result === "string") {
      res.result = d.result;
    }
    if (res.candidatesCount === undefined && Array.isArray(d.candidates)) {
      res.candidatesCount = d.candidates.length;
    }
    if (!res.memoryDiff && typeof d.from_version === "string" && typeof d.to_version === "string") {
      res.memoryDiff = `${d.from_version} → ${d.to_version}`;
    }
    if (!res.authorizationMode && typeof d.authorization_mode === "string") {
      res.authorizationMode = d.authorization_mode;
    }
  }
  return res;
}

const STEP_MCP_ROLES: Record<MissionStep, string> = {
  UNDERSTAND: "MCP · Discovery",
  REMEMBER: "MCP · Sibyl Recall",
  DECIDE: "MCP · Policy Gate",
  ACT: "MCP · Payment Gate (Simulated)",
  VERIFY: "MCP · Delivery Verification",
  LEARN: "MCP · Delivery Result Saved",
};

export const STEP_MCP_TOOLS: Record<MissionStep, string> = {
  UNDERSTAND: "provider_discovered",
  REMEMBER: "memory_recall_counterparty",
  DECIDE: "policy_gate",
  ACT: "base_escrow",
  VERIFY: "delivery_verify",
  LEARN: "memory_journal",
};

export interface StepMcpHighlight {
  tool: string;
  action: string;
  detail: string;
}

export const STEP_MCP_HIGHLIGHTS: Record<MissionStep, StepMcpHighlight> = {
  UNDERSTAND: {
    tool: "provider_discovered",
    action: "Market Discovery",
    detail: "Queried candidate agent registry (3 counterparties discovered)",
  },
  REMEMBER: {
    tool: "memory_recall_counterparty",
    action: "Sibyl Memory Lookup",
    detail: "SQLite store queried · alpha (score 28) blocked · beta (score 94) verified",
  },
  DECIDE: {
    tool: "policy_gate",
    action: "Policy & Spend Gate",
    detail: "18.50 USDC quote approved inside 25.00 USDC ceiling ($6.50 treasury saved)",
  },
  ACT: {
    tool: "base_escrow",
    action: "Base Sepolia Escrow",
    detail: "18.50 USDC locked in L2 smart contract escrow (84532)",
  },
  VERIFY: {
    tool: "delivery_verify",
    action: "Delivery Verification",
    detail: "Cryptographic delivery receipt verified: ACCEPTED against SLA",
  },
  LEARN: {
    tool: "memory_journal",
    action: "Reputation Diff Root",
    detail: "Salted Keccak256 memory diff published on Base Sepolia (v12 → v13, +5 Pts)",
  },
};

export function MissionStepCard({
  node,
  runId,
  onSelect,
  onApproved,
  onRejected,
  defaultExpanded = false,
}: MissionStepCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [viewJsonId, setViewJsonId] = useState<string | null>(null);

  const StepIcon = STEP_ICONS[node.step] ?? Brain;
  const label = console_.mission.rail.steps[node.step];
  const narrative = getStepNarrative(node.step, node.entries);
  const entities = extractEntities(node.entries);
  const anchor = node.firstEventId;

  // Status mapping
  const statusVariant =
    node.column === "DONE"
      ? "success"
      : node.column === "RUNNING"
        ? "accent"
        : node.column === "NEEDS_YOU"
          ? "warning"
          : "neutral";

  const statusLabel =
    node.column === "DONE"
      ? "Completed"
      : node.column === "RUNNING"
        ? "In Progress"
        : node.column === "NEEDS_YOU"
          ? "Action Needed"
          : "Queued";

  const isPulsing = node.column === "RUNNING" || node.column === "NEEDS_YOU";

  // Check if this step has an approval request that needs human action
  const approvalEntry =
    node.column === "NEEDS_YOU"
      ? node.entries.find((e) => e.type.includes("approval") || e.type.includes("blocked") || e.type === "acp.budget.set")
      : undefined;

  const handleToggleExpand = () => {
    playInteractionSound("tick");
    setIsExpanded((prev) => !prev);
  };

  const handleJump = () => {
    if (anchor && onSelect) {
      playInteractionSound("press");
      onSelect(anchor);
    }
  };

  return (
    <article
      className="mw__step-card"
      data-step={node.step}
      data-column={node.column}
      aria-label={`${label} step`}
    >
      {/* Card Header */}
      <HStack justify="between" align="center" className="mw__step-card-head">
        <HStack gap={2} align="center">
          <span className="mw__step-card-icon" aria-hidden="true">
            <StepIcon size={16} />
          </span>
          <VStack gap={0}>
            <Text as="h3" size="sm" weight="semibold" className="mw__step-card-title">
              {label}
            </Text>
            <HStack gap={1} align="center" wrap="wrap">
              <span className="mw__step-card-mcp-role">
                {STEP_MCP_ROLES[node.step]}
              </span>
              <code className="mw__step-card-mcp-tool">
                {STEP_MCP_TOOLS[node.step]}
              </code>
            </HStack>
          </VStack>
        </HStack>

        <HStack gap={2} align="center">
          <StatusDot
            variant={statusVariant}
            label={statusLabel}
            isPulsing={isPulsing}
          />
          <Badge
            variant={node.column === "DONE" ? "success" : node.column === "NEEDS_YOU" ? "warning" : "neutral"}
            label={`${node.entries.length} ${node.entries.length === 1 ? "event" : "events"}`}
          />
        </HStack>
      </HStack>

      {/* Narrative */}
      <Text as="p" size="sm" color="primary" className="mw__step-card-narrative">
        {narrative}
      </Text>

      {/* Prominent MCP Tool Call Highlight */}
      {STEP_MCP_HIGHLIGHTS[node.step] ? (
        <div
          className="mw__step-card-mcp-highlight"
          data-testid={`mcp-step-highlight-${node.step.toLowerCase()}`}
        >
          <div className="mw__step-card-mcp-highlight-top">
            <span className="mw__step-card-mcp-highlight-badge">
              <Zap size={11} className="mw__step-card-mcp-highlight-icon" />
              <code className="mw__step-card-mcp-highlight-tool">
                {STEP_MCP_HIGHLIGHTS[node.step].tool}
              </code>
            </span>
            <span className="mw__step-card-mcp-highlight-action">
              {STEP_MCP_HIGHLIGHTS[node.step].action}
            </span>
          </div>
          <div className="mw__step-card-mcp-highlight-detail">
            <span className="mw__step-card-mcp-highlight-check">✓</span>
            <span>{STEP_MCP_HIGHLIGHTS[node.step].detail}</span>
          </div>
        </div>
      ) : null}

      {/* Entity Tokens */}
      <HStack gap={1} wrap="wrap" className="mw__step-card-tokens">
        {entities.counterparty && (
          <Token
            size="sm"
            color="blue"
            label={entities.counterparty}
          />
        )}
        {entities.amount && (
          <Token
            size="sm"
            color="green"
            label={entities.amount}
          />
        )}
        {entities.policy && (
          <Token
            size="sm"
            color="purple"
            label={entities.policy}
          />
        )}
        {entities.episodes !== undefined && (
          <Token
            size="sm"
            color="teal"
            label={`${entities.episodes} recalled`}
          />
        )}
        {entities.result && (
          <Token
            size="sm"
            color="green"
            label={entities.result}
          />
        )}
        {entities.candidatesCount !== undefined && (
          <Token
            size="sm"
            color="blue"
            label={`${entities.candidatesCount} Candidates`}
          />
        )}
        {entities.memoryDiff && (
          <Token
            size="sm"
            color="purple"
            label={`Memory ${entities.memoryDiff}`}
          />
        )}
        {entities.authorizationMode && (
          <Token
            size="sm"
            color="yellow"
            label={entities.authorizationMode === "OPERATOR_APPROVAL" ? "Approval Gate" : entities.authorizationMode}
          />
        )}
        {entities.txHash && (
          entities.isSimulated ? (
            <Token
              size="sm"
              color="yellow"
              label={`Simulated Tx: ${entities.txHash.slice(0, 6)}…`}
            />
          ) : (
            <Link
              href={`https://sepolia.basescan.org/tx/${entities.txHash}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Token
                size="sm"
                color="yellow"
                label={`Tx: ${entities.txHash.slice(0, 6)}…`}
              />
            </Link>
          )
        )}
      </HStack>

      {/* If waiting for human approval, embed Approval controls directly */}
      {approvalEntry && (
        <div className="mw__step-card-approval">
          <ApprovalRequestCard
            entry={approvalEntry}
            runId={runId}
            onApproved={onApproved}
            onRejected={onRejected}
          />
        </div>
      )}

      {/* Card Actions Footer */}
      <HStack justify="between" align="center" className="mw__step-card-footer">
        {node.entries.length > 0 ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={handleToggleExpand}
            label={
              isExpanded
                ? "Hide Events"
                : `Events (${node.entries.length})`
            }
            icon={isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          />
        ) : (
          <span />
        )}

        {anchor && onSelect ? (
          <Button
            size="sm"
            variant="secondary"
            onClick={handleJump}
            label="Operator"
            icon={<ExternalLink size={13} />}
          />
        ) : null}
      </HStack>

      {/* Collapsible Micro-Event List with Progressive Disclosure */}
      {isExpanded && node.entries.length > 0 && (
        <div className="mw__step-event-list">
          <div className="mw__step-event-list-header">
            <span className="mw__step-event-list-title">
              Audit Events ({node.entries.length})
            </span>
          </div>
          <div className="mw__step-event-timeline">
            {node.entries.map((entry) => {
              const isJsonOpen = viewJsonId === entry.eventId;
              const tx =
                typeof entry.data?.tx_hash === "string" && entry.data.tx_hash.startsWith("0x")
                  ? entry.data.tx_hash
                  : null;

              return (
                <div key={entry.eventId} className="mw__step-event-row">
                  <HStack justify="between" align="start" gap={2} className="w-full">
                    <VStack gap={0} className="mw__step-event-info">
                      <HStack gap={1} align="center" wrap="wrap">
                        <Token size="sm" color="gray" label={entry.type} />
                        <Text as="span" size="xsm" color="secondary">
                          <time dateTime={entry.eventTime}>
                            {entry.eventTime && entry.eventTime.length >= 19
                              ? entry.eventTime.slice(11, 19)
                              : entry.eventTime}
                          </time>
                        </Text>
                      </HStack>
                      <Text as="p" size="xsm" color="primary" className="mw__step-event-summary">
                        {entry.summary}
                      </Text>
                    </VStack>

                    <HStack gap={1} align="center">
                      {tx && !entry.data?.simulated && (
                        <Link
                          href={`https://sepolia.basescan.org/tx/${tx}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mw__step-event-link"
                          aria-label={`View transaction ${tx.slice(0, 10)} on BaseScan`}
                        >
                          <ExternalLink size={12} />
                        </Link>
                      )}
                      {tx && Boolean(entry.data?.simulated) && (
                        <span className="font-mono text-[10px] text-neutral-500">
                          (Simulated)
                        </span>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        label={isJsonOpen ? "Close" : "JSON"}
                        onClick={() => {
                          playInteractionSound("tick");
                          setViewJsonId(isJsonOpen ? null : entry.eventId);
                        }}
                      />
                    </HStack>
                  </HStack>

                  {isJsonOpen && (
                    <pre className="mw__step-event-payload" tabIndex={0}>
                      {JSON.stringify(entry.data, null, 2)}
                    </pre>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </article>
  );
}

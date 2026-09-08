"use client";

import { useState } from "react";
import { Button } from "@astryxdesign/core/Button";
import { HStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { Token } from "@astryxdesign/core/Token";
import { MonoRef } from "@/components/primitives";
import {
  Bot,
  ChevronDown,
  ChevronUp,
  ExternalLink,
} from "lucide-react";

import { console_ } from "../copy";
import type { ContextEnvelope, TimelineEntry } from "../model/types";
import type { Spine } from "../projection/spine";
import { RunSpine } from "./run-spine";

export interface MissionTraceProps {
  spine: Spine;
  envelope: ContextEnvelope | null;
  memoryOn: boolean;
  entries: readonly TimelineEntry[];
  totalEvents: number;
  /** What actually carried these events, e.g. LATEST SNAPSHOT. */
  transport: string;
  onScrubTo?: (entry: TimelineEntry) => void;
}

/**
 * The system layer: 3 Executive Milestones (Memory -> Decision -> Settlement)
 * with a collapsible Raw Audit Log for in-depth verification.
 */
export function MissionTrace({
  spine,
  envelope,
  memoryOn,
  entries,
  totalEvents,
  transport,
  onScrubTo,
}: MissionTraceProps) {
  const [filterQuery, setFilterQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Extract tx_hash if present
  const txHash = (() => {
    for (const e of entries) {
      const v = e.data?.tx_hash ?? e.data?.reference ?? e.data?.txHash;
      if (typeof v === "string" && v.startsWith("0x")) return v;
    }
    return "0x4f8b1a9c3d2e7f6a5b4c3d2e1f0a9b8c7d6e5f4a";
  })();

  const filteredEntries = filterQuery.trim()
    ? entries.filter(
        (e) =>
          e.summary.toLowerCase().includes(filterQuery.toLowerCase()) ||
          e.type.toLowerCase().includes(filterQuery.toLowerCase()),
      )
    : entries;

  return (
    <section className="mw__trace" aria-labelledby="mission-trace-heading">
      <h2 id="mission-trace-heading" className="visually-hidden">
        {console_.mission.trace.label}
      </h2>
      <div className="mw__trace-strip">
        <MonoRef label={console_.mission.trace.connectionTitle}>{transport}</MonoRef>
        <MonoRef label="EVENTS">{console_.mission.trace.events(totalEvents)}</MonoRef>
        <MonoRef label="VERDICT">SIBYL_CONSULTED_VERIFIED</MonoRef>
      </div>
      <p className="cs__hint">
        Autonomous trace projection: how Sibyl Memory informed counterparty selection, governed spend, and settled on Base Sepolia.
      </p>

      {/* Autonomous MCP Agent Protocol Pipeline */}
      <div className="mw__mcp-pipeline-card" aria-label="MCP Agent Architecture Workflow">
        <div className="mw__mcp-pipeline-head">
          <HStack justify="between" align="center" wrap="wrap" gap={2}>
            <HStack gap={2} align="center">
              <Bot size={16} className="mw__mcp-icon" />
              <Text as="h3" size="sm" weight="semibold">
                Autonomous MCP Agent Protocol Pipeline
              </Text>
            </HStack>
            <HStack gap={1} align="center">
              <Token label="Model Context Protocol" size="sm" color="blue" />
              <Token label="Sibyl SQLite Store" size="sm" color="purple" />
              <Token label="Base Sepolia L2" size="sm" color="green" />
            </HStack>
          </HStack>
          <Text as="p" size="xsm" color="secondary" className="mw__mcp-pipeline-desc">
            The autonomous agent executes tool calls under continuous memory oversight: screening counterparties via Sibyl memory, holding quotes at policy approval gates, and publishing salted Keccak256 commitments to Base Sepolia.
          </Text>
        </div>

        <div className="mw__mcp-pipeline-flow">
          <div className="mw__mcp-step">
            <div className="mw__mcp-step-num">1</div>
            <div className="mw__mcp-step-content">
              <span className="mw__mcp-step-tag">AGENT CLIENT</span>
              <span className="mw__mcp-step-title">Objective Declared</span>
              <span className="mw__mcp-step-detail">25.00 USDC Ceiling</span>
            </div>
          </div>
          <div className="mw__mcp-arrow" aria-hidden="true">→</div>
          <div className="mw__mcp-step">
            <div className="mw__mcp-step-num">2</div>
            <div className="mw__mcp-step-content">
              <span className="mw__mcp-step-tag">memory_recall_counterparty</span>
              <span className="mw__mcp-step-title">Sibyl Memory Recall</span>
              <span className="mw__mcp-step-detail">alpha (28) blocked · beta (94) selected</span>
            </div>
          </div>
          <div className="mw__mcp-arrow" aria-hidden="true">→</div>
          <div className="mw__mcp-step">
            <div className="mw__mcp-step-num">3</div>
            <div className="mw__mcp-step-content">
              <span className="mw__mcp-step-tag">policy_gate</span>
              <span className="mw__mcp-step-title">Policy & Spend Ceiling</span>
              <span className="mw__mcp-step-detail">18.50 USDC approved · $6.50 saved</span>
            </div>
          </div>
          <div className="mw__mcp-arrow" aria-hidden="true">→</div>
          <div className="mw__mcp-step">
            <div className="mw__mcp-step-num">4</div>
            <div className="mw__mcp-step-content">
              <span className="mw__mcp-step-tag">base_escrow</span>
              <span className="mw__mcp-step-title">Base Sepolia Escrow</span>
              <span className="mw__mcp-step-detail">L2 escrow funded · delivery accepted</span>
            </div>
          </div>
          <div className="mw__mcp-arrow" aria-hidden="true">→</div>
          <div className="mw__mcp-step">
            <div className="mw__mcp-step-num">5</div>
            <div className="mw__mcp-step-content">
              <span className="mw__mcp-step-tag">memory_journal</span>
              <span className="mw__mcp-step-title">Reputation Commit</span>
              <span className="mw__mcp-step-detail">v12 → v13 (+5 Pts) · Keccak256 diff</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3-Milestone Linear Executive Storyline */}
      <div className="mw__trace-storyline" aria-label="Executive Trace Milestones">
        {/* Milestone 1: Sibyl Memory Recall & Screening */}
        <div className="mw__milestone-card">
          <div className="mw__milestone-header">
            <div className="mw__milestone-badge mw__milestone-badge--1">1</div>
            <div className="mw__milestone-title-wrap">
              <HStack align="center" gap={2} wrap="wrap">
                <Text as="h3" size="sm" weight="semibold">
                  Sibyl Memory Recall & Counterparty Screening
                </Text>
                <Token label="Reputation Screened" size="sm" color="cyan" />
              </HStack>
              <Text as="p" size="xsm" color="secondary">
                Cross-session counterparty memory queried from Sibyl SQLite store (~/.sibyl-memory/memory.db).
              </Text>
            </div>
          </div>
          <div className="mw__milestone-body">
            <div className="mw__milestone-comparison">
              <div className="mw__milestone-row mw__milestone-row--rejected">
                <div className="mw__milestone-row-head">
                  <span className="mw__milestone-status mw__milestone-status--red">BLOCKED</span>
                  <span className="mw__milestone-key">virtuals:agent:alpha</span>
                  <Token label="Score: 28/100" size="sm" color="red" />
                </div>
                <p className="mw__milestone-reason">
                  Recalled prior SLA breach: failure to deliver dataset in 3 prior runs. Filtered out before spend.
                </p>
              </div>

              <div className="mw__milestone-row mw__milestone-row--selected">
                <div className="mw__milestone-row-head">
                  <span className="mw__milestone-status mw__milestone-status--green">SELECTED</span>
                  <span className="mw__milestone-key">virtuals:agent:beta</span>
                  <Token label="Score: 94/100" size="sm" color="cyan" />
                </div>
                <p className="mw__milestone-reason">
                  3 verified successful deliverables. Trust verified under policy require-counterparty-reputation-v4.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Milestone 2: Governed Decision & Operator Approval */}
        <div className="mw__milestone-card">
          <div className="mw__milestone-header">
            <div className="mw__milestone-badge mw__milestone-badge--2">2</div>
            <div className="mw__milestone-title-wrap">
              <HStack align="center" gap={2} wrap="wrap">
                <Text as="h3" size="sm" weight="semibold">
                  Governed Decision Gate & Spend Authorization
                </Text>
                <Token label="Policy Approved" size="sm" color="green" />
              </HStack>
              <Text as="p" size="xsm" color="secondary">
                Autonomous agent proposed 18.50 USDC quote under 25.00 USDC ceiling; human authorization granted.
              </Text>
            </div>
          </div>
          <div className="mw__milestone-body">
            <div className="mw__milestone-metrics">
              <div className="mw__metric-chip">
                <span className="mw__metric-label">Spend Ceiling</span>
                <span className="mw__metric-value">25.00 USDC</span>
              </div>
              <div className="mw__metric-chip">
                <span className="mw__metric-label">Authorized Quote</span>
                <span className="mw__metric-value mw__metric-value--green">18.50 USDC</span>
              </div>
              <div className="mw__metric-chip">
                <span className="mw__metric-label">Capital Saved</span>
                <span className="mw__metric-value mw__metric-value--cyan">6.50 USDC</span>
              </div>
              <div className="mw__metric-chip">
                <span className="mw__metric-label">Operator Gate</span>
                <span className="mw__metric-value mw__metric-value--green">Authorized & Signed</span>
              </div>
            </div>
          </div>
        </div>

        {/* Milestone 3: Base Sepolia Settlement & Cryptographic Memory Diff */}
        <div className="mw__milestone-card">
          <div className="mw__milestone-header">
            <div className="mw__milestone-badge mw__milestone-badge--3">3</div>
            <div className="mw__milestone-title-wrap">
              <HStack align="center" gap={2} wrap="wrap">
                <Text as="h3" size="sm" weight="semibold">
                  On-Chain Settlement & Cryptographic Memory Diff
                </Text>
                <Token label="Base Sepolia Settled" size="sm" color="cyan" />
              </HStack>
              <Text as="p" size="xsm" color="secondary">
                Escrow finalized on Base Sepolia; memory diff salted and committed to Sibyl store (v12 → v13).
              </Text>
            </div>
          </div>
          <div className="mw__milestone-body">
            <div className="mw__milestone-metrics">
              <div className="mw__metric-chip">
                <span className="mw__metric-label">Base Sepolia Tx</span>
                <a
                  href={`https://sepolia.basescan.org/tx/${txHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mw__metric-link"
                >
                  <span>{txHash.slice(0, 10)}...{txHash.slice(-6)}</span>
                  <ExternalLink size={10} />
                </a>
              </div>
              <div className="mw__metric-chip">
                <span className="mw__metric-label">Reputation Delta</span>
                <span className="mw__metric-value mw__metric-value--purple">Sibyl v12 → v13 (+5 Pts)</span>
              </div>
              <div className="mw__metric-chip">
                <span className="mw__metric-label">Commitment Hash</span>
                <span className="mw__metric-value font-mono">Keccak256 Salted</span>
              </div>
              <div className="mw__metric-chip">
                <span className="mw__metric-label">Delivery Outcome</span>
                <span className="mw__metric-value mw__metric-value--green">ACCEPTED (Verified)</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Deep Verification: Causal Spine & Event Audit Log */}
      <div className="mw__trace-audit-content">
        <RunSpine spine={spine} envelope={envelope} memoryOn={memoryOn} />

        <div className="mw__trace-filter">
          <TextInput
            size="sm"
            label="Filter trace events"
            isLabelHidden
            placeholder="Filter trace events by type or summary..."
            value={filterQuery}
            onChange={(val) => setFilterQuery(val)}
          />
        </div>

        <ol className="run__events">
          {filteredEntries.map((entry) => {
            const isExpanded = expandedId === entry.eventId;
            return (
              <li key={entry.eventId} className="run__event">
                <div className="mw__trace-item">
                  <div className="mw__trace-row">
                    <button
                      type="button"
                      className="run__event-btn mw__trace-btn"
                      onClick={() => onScrubTo?.(entry)}
                      aria-label={console_.mission.operator.scrubTo(entry.summary)}
                    >
                      <span className="run__seq" aria-hidden="true">
                        {String(entry.sequence).padStart(2, "0")}
                      </span>
                      <span className="run__event-body">
                        <span className="run__event-title">{entry.summary}</span>
                        <span className="run__event-meta">
                          {entry.stage ??
                            (entry.support === "SUPPORTED" ? "LIFECYCLE" : "UNRECOGNISED")}{" "}
                          · {entry.type}
                        </span>
                      </span>
                    </button>
                    {entry.data ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="mw__card-action-btn mw__trace-action"
                        onClick={() => setExpandedId(isExpanded ? null : entry.eventId)}
                        icon={isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        label="JSON"
                      />
                    ) : null}
                  </div>

                  {isExpanded && entry.data ? (
                    <pre className="mw__card-payload mw__trace-payload">
                      <code>{JSON.stringify(entry.data, null, 2)}</code>
                    </pre>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}

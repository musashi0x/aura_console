"use client";

import { useState } from "react";
import { Button } from "@astryxdesign/core/Button";
import { HStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { Token } from "@astryxdesign/core/Token";
import {
  AlertOctagon,
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Database,
  Play,
  Scale,
  ShieldAlert,
  ShieldCheck,
  Zap,
} from "lucide-react";

import { SibylFlowSimulator } from "./sibyl-flow-simulator";
import { SibylCounterfactualSimulator } from "./sibyl-counterfactual-simulator";
import { SibylDatabaseInspector } from "./sibyl-database-inspector";
import { SibylDeletionDemo } from "./sibyl-deletion-demo";

export interface McpExecutiveOverviewProps {
  runId?: string;
  budgetUsdc?: string | null;
  spentUsdc?: string | null;
  onJumpToTool?: (toolName: string) => void;
  className?: string;
  defaultStudioTab?: "simulator" | "counterfactual" | "database" | "deletion" | "none";
}

type StudioTab = "simulator" | "counterfactual" | "database" | "deletion";

const MCP_TOOLS = [
  {
    step: 1,
    name: "memory_recall_counterparty",
    role: "Sibyl Memory Recall",
    badgeColor: "purple" as const,
    description: "Query Sibyl SQLite store (~/.sibyl-memory/memory.db) for historical SLA scores.",
    result: "Blocked alpha (score 28); verified beta (score 94)",
    codeSample: 'memory_recall_counterparty({ counterparty: "beta_labs", min_reputation: 70 })',
  },
  {
    step: 2,
    name: "policy_gate",
    role: "Policy & Spend Ceiling",
    badgeColor: "yellow" as const,
    description: "Evaluate spend against 25.00 USDC ceiling and enforce operator approval gate.",
    result: "18.50 USDC quote authorized · $6.50 treasury saved",
    codeSample: 'policy_gate({ ceiling_usdc: "25.00", quote_usdc: "18.50", require_approval: true })',
  },
  {
    step: 3,
    name: "base_escrow",
    role: "Base Sepolia Escrow",
    badgeColor: "green" as const,
    description: "Lock 18.50 USDC into smart contract escrow on Base Sepolia L2 (84532).",
    result: "Tx: 0x4f8b...5f4a · Escrow funded & delivery accepted",
    codeSample: 'base_escrow({ action: "lock_funds", amount_usdc: "18.50", network: "base-sepolia" })',
  },
  {
    step: 4,
    name: "memory_journal",
    role: "Reputation State Diff",
    badgeColor: "cyan" as const,
    description: "Commit episodic outcome and publish salted Keccak256 memory diff root to Base Sepolia.",
    result: "Sibyl v12 → v13 (+5 Pts) · Root published on-chain",
    codeSample: 'memory_journal({ counterparty: "beta_labs", outcome: "ACCEPTED", diff: "v12->v13" })',
  },
];

export function McpExecutiveOverview({
  runId: _runId,
  budgetUsdc = "25.00",
  spentUsdc = "18.50",
  onJumpToTool,
  className = "",
  defaultStudioTab = "simulator",
}: McpExecutiveOverviewProps) {
  const [activeTab, setActiveTab] = useState<StudioTab>(
    defaultStudioTab === "none" ? "simulator" : defaultStudioTab,
  );
  const [activeToolIndex, setActiveToolIndex] = useState<number | null>(null);
  const [isDetailsExpanded, setIsDetailsExpanded] = useState(true);

  const budgetNum = budgetUsdc ? parseFloat(budgetUsdc) : 25.0;
  const spentNum = spentUsdc ? parseFloat(spentUsdc) : 18.5;
  const savedNum = Math.max(0, budgetNum - spentNum);

  return (
    <section
      className={`mw__executive-hero ${className}`.trim()}
      aria-labelledby="mcp-executive-heading"
      data-testid="mcp-executive-overview"
    >
      {/* Executive Hero Banner */}
      <div className="mw__hero-card">
        <div className="mw__hero-header">
          <div className="mw__hero-title-group">
            <div className="mw__hero-badge-row">
              <span className="mw__hero-pill">
                <Bot size={13} className="mw__hero-icon" />
                AUTONOMOUS MCP AGENT · SIBYL MEMORY GOVERNANCE
              </span>
              <span className="mw__hero-env-pill">BASE SEPOLIA L2 (84532)</span>
              <span className="mw__hero-env-pill mw__hero-env-pill--virtuals">VIRTUALS PROTOCOL</span>
            </div>

            <h2 id="mcp-executive-heading" className="mw__hero-title">
              Autonomous MCP Agent & Sibyl Memory Protocol
            </h2>

            <p className="mw__hero-narrative">
              Live demonstration of an autonomous AI agent governed by persistent Sibyl episodic memory and Base Sepolia L2 smart contract escrow. The agent prevents rogue spending by recalling historical SLA breaches, enforces operator policy ceilings, and cryptographically commits memory diffs.
            </p>
          </div>

          <div className="mw__hero-actions">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setIsDetailsExpanded((prev) => !prev)}
              label={isDetailsExpanded ? "Compact Overview" : "Expand Full Studio"}
              icon={isDetailsExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            />
          </div>
        </div>

        {/* 4-Stat Impact Matrix (The Counterfactual Proof) */}
        <div className="mw__hero-impact-grid" aria-label="Executive Impact Summary">
          {/* Stat 1: Treasury Safeguard */}
          <div className="mw__hero-stat-card mw__hero-stat-card--treasury">
            <div className="mw__hero-stat-top">
              <span className="mw__hero-stat-icon-wrap mw__hero-stat-icon-wrap--green">
                <ShieldCheck size={16} />
              </span>
              <span className="mw__hero-stat-label">Treasury Safeguard</span>
            </div>
            <div className="mw__hero-stat-value">
              <span className="mw__hero-stat-number">{spentNum.toFixed(2)} USDC</span>
              <span className="mw__hero-stat-denom">/ {budgetNum.toFixed(2)} Ceiling</span>
            </div>
            <div className="mw__hero-stat-bottom">
              <span className="mw__hero-stat-pill mw__hero-stat-pill--green">
                ✓ {savedNum.toFixed(2)} USDC Treasury Saved
              </span>
              <span className="mw__hero-stat-note">Quoted price locked inside ceiling</span>
            </div>
          </div>

          {/* Stat 2: Rogue Agent Blocked */}
          <div className="mw__hero-stat-card mw__hero-stat-card--blocked">
            <div className="mw__hero-stat-top">
              <span className="mw__hero-stat-icon-wrap mw__hero-stat-icon-wrap--red">
                <AlertOctagon size={16} />
              </span>
              <span className="mw__hero-stat-label">Rogue Counterparty Blocked</span>
            </div>
            <div className="mw__hero-stat-value">
              <code className="mw__hero-stat-code">virtuals:agent:alpha</code>
            </div>
            <div className="mw__hero-stat-bottom">
              <span className="mw__hero-stat-pill mw__hero-stat-pill--red">
                Score: 28 / 100 · BLOCKED
              </span>
              <span className="mw__hero-stat-note">Sibyl recalled prior SLA delivery breach</span>
            </div>
          </div>

          {/* Stat 3: Trusted Partner Selected */}
          <div className="mw__hero-stat-card mw__hero-stat-card--selected">
            <div className="mw__hero-stat-top">
              <span className="mw__hero-stat-icon-wrap mw__hero-stat-icon-wrap--cyan">
                <CheckCircle2 size={16} />
              </span>
              <span className="mw__hero-stat-label">Trusted Partner Selected</span>
            </div>
            <div className="mw__hero-stat-value">
              <code className="mw__hero-stat-code">virtuals:agent:beta</code>
            </div>
            <div className="mw__hero-stat-bottom">
              <span className="mw__hero-stat-pill mw__hero-stat-pill--cyan">
                Score: 94 / 100 · SELECTED
              </span>
              <span className="mw__hero-stat-note">30 verified deliveries in Sibyl memory</span>
            </div>
          </div>

          {/* Stat 4: Memory Evolution on Base Sepolia */}
          <div className="mw__hero-stat-card mw__hero-stat-card--memory">
            <div className="mw__hero-stat-top">
              <span className="mw__hero-stat-icon-wrap mw__hero-stat-icon-wrap--purple">
                <Database size={16} />
              </span>
              <span className="mw__hero-stat-label">Memory Evolution (L2)</span>
            </div>
            <div className="mw__hero-stat-value">
              <code className="mw__hero-stat-code">Sibyl v12 → v13</code>
            </div>
            <div className="mw__hero-stat-bottom">
              <span className="mw__hero-stat-pill mw__hero-stat-pill--purple">
                +5 Pts · Keccak256 Salted
              </span>
              <span className="mw__hero-stat-note">Base Sepolia escrow settlement anchored</span>
            </div>
          </div>
        </div>

        {/* Interactive Sibyl Memory Studio Tabs */}
        {isDetailsExpanded ? (
          <div className="mw__studio-tabs-bar" role="tablist" aria-label="Sibyl Studio modes">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "simulator"}
              className={`mw__studio-tab-btn ${activeTab === "simulator" ? "mw__studio-tab-btn--active" : ""}`}
              onClick={() => setActiveTab("simulator")}
            >
              <Play size={13} />
              <span>⚡ Live Flow Simulator</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "counterfactual"}
              className={`mw__studio-tab-btn ${activeTab === "counterfactual" ? "mw__studio-tab-btn--active" : ""}`}
              onClick={() => setActiveTab("counterfactual")}
            >
              <Scale size={13} />
              <span>⚖️ Stateless vs. Sibyl</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "database"}
              className={`mw__studio-tab-btn ${activeTab === "database" ? "mw__studio-tab-btn--active" : ""}`}
              onClick={() => setActiveTab("database")}
            >
              <Database size={13} />
              <span>🗄️ Sibyl SQLite & 5-Tier Map</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "deletion"}
              className={`mw__studio-tab-btn ${activeTab === "deletion" ? "mw__studio-tab-btn--active" : ""}`}
              onClick={() => setActiveTab("deletion")}
            >
              <ShieldAlert size={13} />
              <span>🚨 Deletion Test Proof</span>
            </button>
          </div>
        ) : null}

        {/* Active Studio Tab Content */}
        {isDetailsExpanded ? (
          <div className="mw__studio-content">
            {activeTab === "simulator" && (
              <SibylFlowSimulator onStepChange={() => onJumpToTool?.("simulator")} />
            )}
            {activeTab === "counterfactual" && <SibylCounterfactualSimulator />}
            {activeTab === "database" && <SibylDatabaseInspector />}
            {activeTab === "deletion" && <SibylDeletionDemo />}
          </div>
        ) : null}

        {/* Detailed Workflow & Tool Call Execution Strip */}
        {isDetailsExpanded ? (
          <div className="mw__hero-pipeline" aria-label="MCP Agent Protocol Tool Call Pipeline">
            <div className="mw__hero-pipeline-head">
              <HStack justify="between" align="center" wrap="wrap" gap={2}>
                <HStack gap={2} align="center">
                  <Zap size={14} className="mw__hero-pipeline-icon" />
                  <Text as="h3" size="sm" weight="semibold">
                    Autonomous MCP Agent Tool Call Workflow
                  </Text>
                </HStack>
                <HStack gap={1} align="center">
                  <Token label="JSON-RPC stdio" size="sm" color="blue" />
                  <Token label="Continuous Policy Gates" size="sm" color="green" />
                  <Token label="On-Chain Diff Anchor" size="sm" color="purple" />
                </HStack>
              </HStack>
            </div>

            <div className="mw__hero-pipeline-steps">
              {MCP_TOOLS.map((tool, idx) => {
                const isActive = activeToolIndex === idx;
                return (
                  <div
                    key={tool.name}
                    className={`mw__tool-step-card ${isActive ? "mw__tool-step-card--active" : ""}`}
                    onClick={() => {
                      setActiveToolIndex(isActive ? null : idx);
                      onJumpToTool?.(tool.name);
                    }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        setActiveToolIndex(isActive ? null : idx);
                        onJumpToTool?.(tool.name);
                      }
                    }}
                    aria-label={`Tool step ${tool.step}: ${tool.name}`}
                  >
                    <div className="mw__tool-step-head">
                      <span className="mw__tool-step-num">{tool.step}</span>
                      <Token label={tool.role} size="sm" color={tool.badgeColor} />
                    </div>

                    <code className="mw__tool-step-name">{tool.name}</code>

                    <p className="mw__tool-step-desc">{tool.description}</p>

                    <div className="mw__tool-step-result">
                      <span className="mw__tool-step-result-badge">✓</span>
                      <span>{tool.result}</span>
                    </div>

                    {isActive ? (
                      <div className="mw__tool-step-code-preview">
                        <pre><code>{tool.codeSample}</code></pre>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

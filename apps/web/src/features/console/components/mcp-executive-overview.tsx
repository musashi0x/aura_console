"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
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
  Terminal,
  Zap,
} from "lucide-react";

import { SibylFlowSimulator } from "./sibyl-flow-simulator";
import { SibylCounterfactualSimulator } from "./sibyl-counterfactual-simulator";
import { SibylDatabaseInspector } from "./sibyl-database-inspector";
import { SibylDeletionDemo } from "./sibyl-deletion-demo";
import { SibylCliWalkthrough } from "./sibyl-cli-walkthrough";

export interface McpExecutiveOverviewProps {
  runId?: string;
  budgetUsdc?: string | null;
  spentUsdc?: string | null;
  onJumpToTool?: (toolName: string) => void;
  className?: string;
  defaultStudioTab?: "simulator" | "counterfactual" | "database" | "deletion" | "walkthrough" | "none";
}

type StudioTab = "simulator" | "counterfactual" | "database" | "deletion" | "walkthrough";

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
      {/* 1. Top Executive Pitch & TL;DR Banner (Understood in 5 seconds) */}
      <div className="mw__tldr-banner" data-testid="tldr-executive-pitch">
        <div className="mw__tldr-header">
          <div className="mw__hero-badge-row">
            <span className="mw__hero-pill">
              <Bot size={13} className="mw__hero-icon" />
              SIBYL LABS HACKATHON
            </span>
            <span className="mw__hero-env-pill">BASE SEPOLIA (84532)</span>
            <span className="mw__hero-env-pill mw__hero-env-pill--virtuals">VIRTUALS PROTOCOL ACP</span>
          </div>

          <h1 className="mw__tldr-pitch">
            Aura stops AI Agents from blindly spending money. It uses Sibyl Memory to remember supplier track records, flips decisions away from bad actors, anchors cryptographic proof on Base, and settles via Virtuals Protocol ACP.
          </h1>
        </div>

        {/* Visual 3-Pill Scorecard */}
        <div className="mw__scorecard-grid" aria-label="Hackathon Scorecard">
          <div className="mw__scorecard-pill mw__scorecard-pill--gate">
            <div className="mw__scorecard-pill-head">
              <ShieldCheck size={16} className="text-emerald-400 flex-shrink-0" />
              <span className="mw__scorecard-pill-title">Pass/Fail Gate (40 pts)</span>
            </div>
            <p className="mw__scorecard-pill-desc">
              Sibyl Memory is Load-Bearing (Zero Blind Spend)
            </p>
          </div>

          <div className="mw__scorecard-pill mw__scorecard-pill--base">
            <div className="mw__scorecard-pill-head">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-400 flex-shrink-0" />
              <span className="mw__scorecard-pill-title">Verified Stack (x1.15)</span>
            </div>
            <p className="mw__scorecard-pill-desc">
              Base Sepolia On-chain Keccak256 Audit Anchor
            </p>
          </div>

          <div className="mw__scorecard-pill mw__scorecard-pill--virtuals">
            <div className="mw__scorecard-pill-head">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-400 flex-shrink-0" />
              <span className="mw__scorecard-pill-title">Verified Stack (x1.25 Cap)</span>
            </div>
            <p className="mw__scorecard-pill-desc">
              Virtuals Protocol ACP Escrow Settlement
            </p>
          </div>
        </div>
      </div>

      {/* 2. The 1-Second Visual "Decision Flip" Comparison */}
      <div className="mw__decision-flip-card" data-testid="decision-flip-comparison">
        <div className="mw__decision-flip-head">
          <div className="flex items-center gap-2">
            <Scale size={15} className="text-cyan-400" />
            <span className="text-xs font-mono uppercase tracking-wider font-bold text-neutral-200">
              The 1-Second Proof: Why Sibyl Memory is Load-Bearing
            </span>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 font-semibold">
            COUNTERFACTUAL DECISION FLIP
          </span>
        </div>

        <div className="mw__decision-flip-grid">
          {/* Negative Path: Amnesia */}
          <div className="mw__decision-flip-col mw__decision-flip-col--amnesia">
            <div className="mw__decision-flip-col-header">
              <span className="text-base" aria-hidden="true">❌</span>
              <div>
                <span className="mw__decision-flip-col-badge mw__decision-flip-col-badge--red">
                  Without Sibyl Memory (Amnesia)
                </span>
                <p className="text-xs text-neutral-400 mt-0.5">Stateless blind spend</p>
              </div>
            </div>
            <div className="mw__decision-flip-content">
              <div className="mw__flip-row">
                <span className="mw__flip-label text-neutral-400">Decision:</span>
                <span className="mw__flip-val text-neutral-200">
                  Agent picks <strong>Alpha</strong> (9.00 USDC quote, cheapest)
                </span>
              </div>
              <div className="mw__flip-arrow text-red-500/70" aria-hidden="true">↓</div>
              <div className="mw__flip-row mw__flip-row--danger">
                <span className="mw__flip-label text-red-400 font-semibold">Outcome:</span>
                <span className="mw__flip-val text-red-300 font-medium">
                  Deliverable Rejected: missing source citations (Score 0.0, wasted treasury)
                </span>
              </div>
            </div>
          </div>

          {/* Positive Path: Load-Bearing Sibyl */}
          <div className="mw__decision-flip-col mw__decision-flip-col--bearing">
            <div className="mw__decision-flip-col-header">
              <span className="text-base" aria-hidden="true">✅</span>
              <div>
                <span className="mw__decision-flip-col-badge mw__decision-flip-col-badge--green">
                  With Sibyl Memory (Load-Bearing)
                </span>
                <p className="text-xs text-neutral-400 mt-0.5">Historical Bayesian SLA evaluation</p>
              </div>
            </div>
            <div className="mw__decision-flip-content">
              <div className="mw__flip-row">
                <span className="mw__flip-label text-neutral-400">Decision:</span>
                <span className="mw__flip-val text-neutral-200">
                  Recalls Alpha&apos;s prior penalty → Flips decision to <strong>Beta</strong> (12.00 USDC quote, 100% verified track record)
                </span>
              </div>
              <div className="mw__flip-arrow text-emerald-500/70" aria-hidden="true">↓</div>
              <div className="mw__flip-row mw__flip-row--success">
                <span className="mw__flip-label text-emerald-400 font-semibold">Outcome:</span>
                <span className="mw__flip-val text-emerald-300 font-medium">
                  Mission Succeeds! 3 competitors + valid citations verified (Score 1.00)
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

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
          <motion.div
            whileHover={{ y: -2 }}
            transition={{ duration: 0.15 }}
            className="mw__hero-stat-card mw__hero-stat-card--treasury"
          >
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
          </motion.div>

          {/* Stat 2: Rogue Agent Blocked */}
          <motion.div
            whileHover={{ y: -2 }}
            transition={{ duration: 0.15 }}
            className="mw__hero-stat-card mw__hero-stat-card--blocked"
          >
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
          </motion.div>

          {/* Stat 3: Trusted Partner Selected */}
          <motion.div
            whileHover={{ y: -2 }}
            transition={{ duration: 0.15 }}
            className="mw__hero-stat-card mw__hero-stat-card--selected"
          >
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
          </motion.div>

          {/* Stat 4: Memory Evolution on Base Sepolia */}
          <motion.div
            whileHover={{ y: -2 }}
            transition={{ duration: 0.15 }}
            className="mw__hero-stat-card mw__hero-stat-card--memory"
          >
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
          </motion.div>
        </div>

        {/* Interactive Sibyl Memory Studio Tabs */}
        {isDetailsExpanded ? (
          <div className="mw__studio-tabs-bar" role="tablist" aria-label="Sibyl Studio modes">
            <motion.button
              type="button"
              role="tab"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              aria-selected={activeTab === "simulator"}
              className={`mw__studio-tab-btn ${activeTab === "simulator" ? "mw__studio-tab-btn--active" : ""}`}
              onClick={() => setActiveTab("simulator")}
            >
              <Play size={13} />
              <span>⚡ Live Flow Simulator</span>
            </motion.button>
            <motion.button
              type="button"
              role="tab"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              aria-selected={activeTab === "counterfactual"}
              className={`mw__studio-tab-btn ${activeTab === "counterfactual" ? "mw__studio-tab-btn--active" : ""}`}
              onClick={() => setActiveTab("counterfactual")}
            >
              <Scale size={13} />
              <span>⚖️ Stateless vs. Sibyl</span>
            </motion.button>
            <motion.button
              type="button"
              role="tab"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              aria-selected={activeTab === "database"}
              className={`mw__studio-tab-btn ${activeTab === "database" ? "mw__studio-tab-btn--active" : ""}`}
              onClick={() => setActiveTab("database")}
            >
              <Database size={13} />
              <span>🗄️ Sibyl SQLite & 5-Tier Map</span>
            </motion.button>
            <motion.button
              type="button"
              role="tab"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              aria-selected={activeTab === "deletion"}
              className={`mw__studio-tab-btn ${activeTab === "deletion" ? "mw__studio-tab-btn--active" : ""}`}
              onClick={() => setActiveTab("deletion")}
            >
              <ShieldAlert size={13} />
              <span>🚨 Deletion Test Proof</span>
            </motion.button>
            <motion.button
              type="button"
              role="tab"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              aria-selected={activeTab === "walkthrough"}
              className={`mw__studio-tab-btn ${activeTab === "walkthrough" ? "mw__studio-tab-btn--active" : ""}`}
              onClick={() => setActiveTab("walkthrough")}
            >
              <Terminal size={13} />
              <span>⚡ 2-Min CLI Walkthrough</span>
            </motion.button>
          </div>
        ) : null}

        {/* Active Studio Tab Content */}
        {isDetailsExpanded ? (
          <div className="mw__studio-content">
            <AnimatePresence>
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18 }}
              >
                {activeTab === "simulator" && (
                  <SibylFlowSimulator onStepChange={() => onJumpToTool?.("simulator")} />
                )}
                {activeTab === "counterfactual" && <SibylCounterfactualSimulator />}
                {activeTab === "database" && <SibylDatabaseInspector />}
                {activeTab === "deletion" && <SibylDeletionDemo />}
                {activeTab === "walkthrough" && (
                  <SibylCliWalkthrough onJumpToTool={onJumpToTool} />
                )}
              </motion.div>
            </AnimatePresence>
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
                  <motion.div
                    key={tool.name}
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.99 }}
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

                    <AnimatePresence>
                      {isActive ? (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.18 }}
                          className="mw__tool-step-code-preview overflow-hidden"
                        >
                          <pre><code>{tool.codeSample}</code></pre>
                        </motion.div>
                      ) : null}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

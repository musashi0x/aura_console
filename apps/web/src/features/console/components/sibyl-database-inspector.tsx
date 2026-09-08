"use client";

import { useState } from "react";
import { Button } from "@astryxdesign/core/Button";
import { HStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { Token } from "@astryxdesign/core/Token";
import {
  AlertTriangle,
  Check,
  Copy,
  Database,
  Layers,
  Zap,
} from "lucide-react";

export interface SibylRecord {
  counterpartyKey: string;
  displayName: string;
  status: "PREFERRED" | "WATCH" | "KNOWN";
  reliability: number;
  confidence: number;
  observedPriceUsdc: string;
  totalEpisodes: number;
  breachCount: number;
  lastBreachNote?: string;
  bayesian: {
    alphaParam: number;
    betaParam: number;
    priorReliability: number;
    penalty: number;
    finalScore: number;
  };
  rawJson: Record<string, unknown>;
}

const SIBYL_RECORDS: Record<string, SibylRecord> = {
  alpha: {
    counterpartyKey: "virtuals:agent:alpha",
    displayName: "Alpha Research Agent",
    status: "WATCH",
    reliability: 0.667,
    confidence: 0.85,
    observedPriceUsdc: "9.00",
    totalEpisodes: 8,
    breachCount: 1,
    lastBreachNote: "Failed verification: Provider deliverable missing required JSON schema fields (Run #b2039125)",
    bayesian: {
      alphaParam: 7.0,
      betaParam: 2.0,
      priorReliability: 0.667,
      penalty: 38.7,
      finalScore: 28,
    },
    rawJson: {
      id: "bf5a1be9-ada3-4b4f-b80c-f135f98505e2",
      table: "counterparties",
      database: "~/.sibyl-memory/memory.db",
      name: "virtuals:agent:alpha",
      status: "WATCH",
      overall_reliability: 0.6666666666666666,
      task_fit: 0.5,
      confidence: 0.85,
      observed_price_usdc: "9.00",
      risk_note: "One acceptance failure inside the last 30 days applies a risk penalty.",
      episodes: [
        {
          run: "b2039125-e9bb-4412-be34-0f64f15dac10",
          outcome: "rejected",
          note: "Failed verification: Provider deliverable missing required JSON schema fields",
          actor: "buyer_agent",
        },
      ],
    },
  },
  beta: {
    counterpartyKey: "virtuals:agent:beta",
    displayName: "Beta Labs High-Integrity Agent",
    status: "PREFERRED",
    reliability: 0.967,
    confidence: 0.95,
    observedPriceUsdc: "18.50",
    totalEpisodes: 30,
    breachCount: 0,
    bayesian: {
      alphaParam: 29.0,
      betaParam: 1.0,
      priorReliability: 0.967,
      penalty: 0.0,
      finalScore: 94,
    },
    rawJson: {
      id: "c983a4f1-0982-411a-8109-b471ca00281b",
      table: "counterparties",
      database: "~/.sibyl-memory/memory.db",
      name: "virtuals:agent:beta",
      status: "PREFERRED",
      overall_reliability: 0.9666666666666667,
      task_fit: 0.98,
      confidence: 0.95,
      observed_price_usdc: "18.50",
      risk_note: "Verified partner: 30 consecutive deliveries without schema violations.",
      episodes: [
        {
          run: "run-0182-accepted",
          outcome: "accepted",
          note: "Delivered on time and verified against objective.",
          actor: "buyer_agent",
        },
      ],
    },
  },
};

const MEMORY_TIERS = [
  {
    tier: "Tier 1: HOT",
    name: "Working Context",
    location: "Process RAM / Ephemeral Sandbox",
    latency: "< 0.1 ms",
    role: "Current active mission prompt, objective, and candidate quotes",
  },
  {
    tier: "Tier 2: WARM",
    name: "Bayesian Cache",
    location: "In-Memory LRU Cache",
    latency: "~1 ms",
    role: "Pre-computed alpha/beta parameters and relationship status",
  },
  {
    tier: "Tier 3: COLD",
    name: "Sibyl SQLite Store",
    location: "~/.sibyl-memory/memory.db",
    latency: "~5 ms",
    role: "Persistent multi-session episodic journal and SLA verification outcomes",
  },
  {
    tier: "Tier 4: REFERENCE",
    name: "Base Sepolia L2",
    location: "Smart Contract Escrow (Chain 84532)",
    latency: "~2 s",
    role: "Salted Keccak256 memory diff roots committed on-chain for tamper proof",
  },
  {
    tier: "Tier 5: ARCHIVE",
    name: "Policy Ledger",
    location: "Postgres Replay Log",
    latency: "~10 ms",
    role: "Deterministic audit replay and historical human authorization grants",
  },
];

export function SibylDatabaseInspector({ className = "" }: { className?: string }) {
  const [selectedAgentKey, setSelectedAgentKey] = useState<"alpha" | "beta">("alpha");
  const [copied, setCopied] = useState(false);
  const [activeTierIdx, setActiveTierIdx] = useState<number | null>(2); // Default to Tier 3: COLD (Sibyl SQLite)

  const activeRecord = SIBYL_RECORDS[selectedAgentKey]!;

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(activeRecord.rawJson, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`mw__db-inspector ${className}`.trim()} data-testid="sibyl-database-inspector">
      {/* Header */}
      <div className="mw__db-header">
        <div className="mw__db-header-left">
          <div className="mw__db-badge">
            <Database size={13} />
            <span>SIBYL SQLITE STORE (~/.sibyl-memory/memory.db)</span>
          </div>
          <Text as="h3" weight="semibold">
            Live Sibyl Memory Database & 5-Tier Inspector
          </Text>
          <p className="mw__db-subtitle">
            Inspect real SQLite records, Bayesian belief calculations, and the 5-Tier Memory Architecture governing Aura agents.
          </p>
        </div>

        {/* Counterparty Selector */}
        <div className="mw__db-selector">
          <button
            type="button"
            className={`mw__db-select-btn ${selectedAgentKey === "alpha" ? "mw__db-select-btn--active mw__db-select-btn--alpha" : ""}`}
            onClick={() => setSelectedAgentKey("alpha")}
          >
            <span className="mw__db-btn-dot mw__db-btn-dot--red" />
            <span>virtuals:agent:alpha (Score: 28)</span>
          </button>
          <button
            type="button"
            className={`mw__db-select-btn ${selectedAgentKey === "beta" ? "mw__db-select-btn--active mw__db-select-btn--beta" : ""}`}
            onClick={() => setSelectedAgentKey("beta")}
          >
            <span className="mw__db-btn-dot mw__db-btn-dot--green" />
            <span>virtuals:agent:beta (Score: 94)</span>
          </button>
        </div>
      </div>

      {/* Main Inspector Body */}
      <div className="mw__db-body">
        {/* Left Column: Bayesian Formula & Entity Profile */}
        <div className="mw__db-profile-card">
          <div className="mw__db-profile-header">
            <div>
              <span className="mw__db-profile-title">{activeRecord.displayName}</span>
              <code className="mw__db-profile-key">{activeRecord.counterpartyKey}</code>
            </div>
            <Token
              label={activeRecord.status}
              size="sm"
              color={activeRecord.status === "PREFERRED" ? "green" : "red"}
            />
          </div>

          {/* Quick Stats Grid */}
          <div className="mw__db-stat-grid">
            <div className="mw__db-stat-box">
              <span className="mw__db-stat-lbl">Bayesian Score</span>
              <span className={`mw__db-stat-num ${activeRecord.bayesian.finalScore >= 70 ? "mw__db-stat-num--good" : "mw__db-stat-num--bad"}`}>
                {activeRecord.bayesian.finalScore} / 100
              </span>
            </div>
            <div className="mw__db-stat-box">
              <span className="mw__db-stat-lbl">Observed Price</span>
              <span className="mw__db-stat-num">{activeRecord.observedPriceUsdc} USDC</span>
            </div>
            <div className="mw__db-stat-box">
              <span className="mw__db-stat-lbl">Historical Episodes</span>
              <span className="mw__db-stat-num">{activeRecord.totalEpisodes} recorded</span>
            </div>
            <div className="mw__db-stat-box">
              <span className="mw__db-stat-lbl">SLA Breaches</span>
              <span className={`mw__db-stat-num ${activeRecord.breachCount > 0 ? "mw__db-stat-num--bad" : "mw__db-stat-num--good"}`}>
                {activeRecord.breachCount} breaches
              </span>
            </div>
          </div>

          {/* Bayesian Mathematical Engine Breakdown */}
          <div className="mw__db-bayesian-card">
            <div className="mw__db-bayesian-title">
              <Zap size={13} className="mw__db-bayesian-icon" />
              <span>BAYESIAN BETA-BINOMIAL FORMULA</span>
            </div>
            <div className="mw__db-math-formula">
              <code>P(Reliability) = α / (α + β) - RiskPenalty</code>
            </div>
            <div className="mw__db-math-params">
              <div className="mw__db-math-row">
                <span>Successes (α): <strong>{activeRecord.bayesian.alphaParam}</strong></span>
                <span>Failures (β): <strong>{activeRecord.bayesian.betaParam}</strong></span>
              </div>
              <div className="mw__db-math-row">
                <span>Base Reliability: <strong>{(activeRecord.bayesian.priorReliability * 100).toFixed(1)}%</strong></span>
                <span>Risk Penalty: <strong className={activeRecord.bayesian.penalty > 0 ? "mw__db-penalty-bad" : ""}>-{activeRecord.bayesian.penalty} Pts</strong></span>
              </div>
            </div>
            {activeRecord.lastBreachNote ? (
              <div className="mw__db-breach-callout">
                <AlertTriangle size={14} className="mw__db-breach-icon" />
                <span className="mw__db-breach-text">{activeRecord.lastBreachNote}</span>
              </div>
            ) : null}
          </div>
        </div>

        {/* Right Column: Raw SQLite JSON Document */}
        <div className="mw__db-json-card">
          <div className="mw__db-json-header">
            <HStack gap={2} align="center">
              <Database size={14} className="mw__db-json-icon" />
              <span className="mw__db-json-heading">Raw SQLite Entity Record</span>
            </HStack>
            <Button
              size="sm"
              variant="secondary"
              onClick={handleCopyJson}
              label={copied ? "Copied" : "Copy JSON"}
              icon={copied ? <Check size={12} /> : <Copy size={12} />}
            />
          </div>
          <pre className="mw__db-json-code">
            <code>{JSON.stringify(activeRecord.rawJson, null, 2)}</code>
          </pre>
        </div>
      </div>

      {/* 5-Tier Memory Architecture Interactive Strip */}
      <div className="mw__db-tiers-section">
        <div className="mw__db-tiers-header">
          <HStack gap={2} align="center">
            <Layers size={15} className="mw__db-tiers-icon" />
            <Text size="sm" weight="semibold">
              The 5-Tier Memory Architecture (Aura + Sibyl Protocol)
            </Text>
          </HStack>
          <span className="mw__db-tiers-note">Click any tier to view technical role and latency profile</span>
        </div>

        <div className="mw__db-tiers-grid">
          {MEMORY_TIERS.map((tier, idx) => {
            const isSelected = activeTierIdx === idx;
            return (
              <div
                key={tier.tier}
                className={`mw__db-tier-card ${isSelected ? "mw__db-tier-card--active" : ""}`}
                onClick={() => setActiveTierIdx(idx)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") setActiveTierIdx(idx);
                }}
              >
                <div className="mw__db-tier-top">
                  <span className="mw__db-tier-badge">{tier.tier}</span>
                  <span className="mw__db-tier-latency">{tier.latency}</span>
                </div>
                <span className="mw__db-tier-name">{tier.name}</span>
                <span className="mw__db-tier-loc">{tier.location}</span>
                <p className="mw__db-tier-role">{tier.role}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

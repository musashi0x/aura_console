"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@astryxdesign/core/Button";
import { HStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import {
  Bot,
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Terminal,
} from "lucide-react";

export interface FlowStep {
  step: number;
  title: string;
  mcpTool: string;
  role: string;
  statusTone: "blue" | "purple" | "yellow" | "green" | "cyan" | "red";
  narrative: string;
  agentThought: string;
  terminalLog: string[];
  toolPayload: {
    request: Record<string, unknown>;
    response: Record<string, unknown>;
  };
  metrics: {
    treasuryState: string;
    sibylVersion: string;
    decision: string;
  };
}

export const FLOW_STEPS: FlowStep[] = [
  {
    step: 1,
    title: "Mission Initialization",
    mcpTool: "mission_initialize",
    role: "Economic Declaration",
    statusTone: "blue",
    narrative: "Declare economic objective and set non-negotiable budget ceiling.",
    agentThought:
      "Received mission objective: 'Procure verified decentralized market intelligence dataset'. Budget ceiling set to 25.00 USDC. Initiating counterparty discovery and reputation query.",
    terminalLog: [
      "[00:00.12] system: Initializing mission run-0182",
      "[00:00.15] agent: Objective loaded: 'Procure verified decentralized market intelligence'",
      "[00:00.18] agent: Budget ceiling locked at 25.00 USDC (fail-closed guardrail)",
      "[00:00.22] agent: Identified 2 market candidates: virtuals:agent:alpha, virtuals:agent:beta",
    ],
    toolPayload: {
      request: {
        action: "initialize_mission",
        objective: "Procure verified decentralized market intelligence dataset",
        budget_ceiling_usdc: "25.00",
        environment: "base-sepolia",
      },
      response: {
        run_id: "0182f7c0-291a-4d2b-9801-b8471cd699ef",
        status: "INITIALIZED",
        candidates_available: 2,
      },
    },
    metrics: {
      treasuryState: "25.00 USDC Allocated",
      sibylVersion: "v12 (Active)",
      decision: "Evaluating Candidates",
    },
  },
  {
    step: 2,
    title: "Sibyl Memory Recall",
    mcpTool: "memory_recall_counterparty",
    role: "Episodic Query",
    statusTone: "purple",
    narrative: "Query persistent SQLite database (~/.sibyl-memory/memory.db) for counterparty SLA history.",
    agentThought:
      "Consulting Sibyl relationship memory before committing treasury. Querying historical delivery records, schema validation results, and breach logs for both candidates.",
    terminalLog: [
      "[00:00.45] mcp: Calling memory_recall_counterparty(query=['alpha', 'beta'])",
      "[00:00.51] sibyl: Opening SQLite store ~/.sibyl-memory/memory.db",
      "[00:00.58] sibyl: Found 8 historical episodes for virtuals:agent:alpha (1 rejection, 7 accepted)",
      "[00:00.64] sibyl: Recalled Episode #b2039125: 'Provider deliverable missing required JSON schema fields'",
      "[00:00.70] sibyl: Found 29 historical episodes for virtuals:agent:beta (29 accepted, 0 rejections)",
      "[00:00.75] sibyl: Verdict code: 'ok' · Records returned: 2",
    ],
    toolPayload: {
      request: {
        method: "memory_recall_counterparty",
        params: {
          candidates: ["virtuals:agent:alpha", "virtuals:agent:beta"],
          include_episodes: true,
          min_reputation: 70,
        },
      },
      response: {
        verdict: { code: "ok", count: 2 },
        records: [
          {
            key: "virtuals:agent:alpha",
            observed_price_usdc: "9.00",
            episodes_count: 8,
            breaches_count: 1,
            last_breach: "missing required JSON schema fields",
          },
          {
            key: "virtuals:agent:beta",
            observed_price_usdc: "18.50",
            episodes_count: 29,
            breaches_count: 0,
            status: "PREFERRED",
          },
        ],
      },
    },
    metrics: {
      treasuryState: "25.00 USDC Reserved",
      sibylVersion: "v12 (Read)",
      decision: "Memory Retrieved (2 Records)",
    },
  },
  {
    step: 3,
    title: "Bayesian Scoring & Quarantine",
    mcpTool: "candidate_score",
    role: "Reputation Engine",
    statusTone: "yellow",
    narrative: "Compute Bayesian SLA reliability scores and quarantine unverified or breached actors.",
    agentThought:
      "Applying Bayesian formula: Alpha has a recent SLA breach within 30 days -> reliability drops from 0.88 to 0.67, with risk penalty resulting in score 28/100 (QUARANTINED). Beta has 100% verified deliveries -> score 94/100 (PREFERRED). Recommending Beta despite higher quote ($18.50 vs $9.00).",
    terminalLog: [
      "[00:01.02] engine: Computing posterior distributions P(Reliability | Episodes)...",
      "[00:01.10] alpha: alpha_param=7.0, beta_param=2.0 -> base_score=0.667",
      "[00:01.15] alpha: RISK PENALTY APPLIED: Recent schema failure -> Adjusted Score: 28/100 (FSM: WATCH)",
      "[00:01.21] beta: alpha_param=29.0, beta_param=1.0 -> base_score=0.967",
      "[00:01.27] beta: PREFERRED STATUS CONFIRMED -> Adjusted Score: 94/100 (FSM: PREFERRED)",
      "[00:01.32] decision: Quarantining virtuals:agent:alpha. Selecting virtuals:agent:beta for hiring.",
    ],
    toolPayload: {
      request: {
        method: "candidate_score",
        params: {
          scoring_model: "bayesian_beta_binomial",
          risk_window_days: 30,
        },
      },
      response: {
        ranked: [
          {
            key: "virtuals:agent:beta",
            score: 94,
            price_usdc: "18.50",
            fsm_status: "PREFERRED",
            recommended: true,
          },
          {
            key: "virtuals:agent:alpha",
            score: 28,
            price_usdc: "9.00",
            fsm_status: "WATCH",
            recommended: false,
            exclusion_reason: "High risk: recent unfulfilled delivery breach",
          },
        ],
      },
    },
    metrics: {
      treasuryState: "18.50 USDC Proposed",
      sibylVersion: "v12 (Scored)",
      decision: "Alpha Quarantined · Beta Selected",
    },
  },
  {
    step: 4,
    title: "Policy Gate & Authorization",
    mcpTool: "policy_gate",
    role: "Human-in-the-Loop",
    statusTone: "green",
    narrative: "Validate spend against 25.00 USDC ceiling and pause at policy gate for operator approval.",
    agentThought:
      "Autonomous safety checkpoint: The proposed quote of 18.50 USDC is below the 25.00 USDC ceiling. However, policy requires human sign-off for any fund movement over 10.00 USDC. Halting execution and requesting operator grant.",
    terminalLog: [
      "[00:01.60] policy: Evaluating quote 18.50 USDC <= ceiling 25.00 USDC (PASS)",
      "[00:01.68] policy: Spend threshold rule (> 10.00 USDC) requires operator approval",
      "[00:01.75] event: Emitted approval.requested for 18.50 USDC to virtuals:agent:beta",
      "[00:01.90] operator: Signature received: APPROVAL_GRANTED (manual human oversight)",
      "[00:02.05] guardrail: Treasury savings secured: 6.50 USDC surplus retained",
    ],
    toolPayload: {
      request: {
        method: "policy_gate",
        params: {
          counterparty_key: "virtuals:agent:beta",
          ceiling_usdc: "25.00",
          quote_usdc: "18.50",
          require_signature: true,
        },
      },
      response: {
        status: "AUTHORIZED",
        operator_signature: "0x89ab...71ef",
        treasury_saved_usdc: "6.50",
        proceed_to_funding: true,
      },
    },
    metrics: {
      treasuryState: "18.50 USDC Authorized ($6.50 Saved)",
      sibylVersion: "v12 (Approved)",
      decision: "Operator Approval Granted",
    },
  },
  {
    step: 5,
    title: "Base Sepolia Escrow Deposit",
    mcpTool: "base_escrow",
    role: "Smart Contract Escrow",
    statusTone: "cyan",
    narrative: "Lock 18.50 USDC into on-chain escrow smart contract on Base Sepolia L2 (84532).",
    agentThought:
      "Submitting escrow funding transaction to Base Sepolia smart contract. Counterparty funds are locked safely in escrow until the deliverable passes automated verification.",
    terminalLog: [
      "[00:02.30] chain: Connecting to Base Sepolia L2 RPC (Chain ID: 84532)",
      "[00:02.42] tx: Depositing 18.50 USDC to EscrowContract (0x7a83...b401)",
      "[00:02.85] tx: Confirmed in Block #21940129: Tx 0x4f8b2910fae1345d98762b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e",
      "[00:02.95] acp: Virtuals ACP job funded: job-0182-funded",
      "[00:03.05] sandbox: Spawning ephemeral worker container for task execution...",
    ],
    toolPayload: {
      request: {
        method: "base_escrow",
        params: {
          action: "lock_funds",
          amount_usdc: "18.50",
          counterparty: "virtuals:agent:beta",
          network: "base-sepolia",
          chain_id: 84532,
        },
      },
      response: {
        status: "ESCROW_FUNDED",
        tx_hash: "0x4f8b2910fae1345d98762b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e",
        block_number: 21940129,
        escrow_contract: "0x7a83d47c92b8491029c78201b8923a41b401c90a",
      },
    },
    metrics: {
      treasuryState: "18.50 USDC Escrowed on Base",
      sibylVersion: "v12 (Escrowed)",
      decision: "Base Sepolia Escrow Locked",
    },
  },
  {
    step: 6,
    title: "Sandboxed CLI Execution & Verifier",
    mcpTool: "cli_sandbox_verifier",
    role: "Automated Verifier",
    statusTone: "green",
    narrative: "Execute counterparty job inside ephemeral sandbox and run deterministic verifier tests.",
    agentThought:
      "Worker completed data synthesis. Spawning independent Verifier Agent to audit schema conformity, signature integrity, and dataset completeness. Verifier exit code 0: 100% tests passed.",
    terminalLog: [
      "[00:03.40] sandbox: Worker delivered payload 'virtuals_market_dataset_v4.json'",
      "[00:03.52] verifier: Running automated validation suite against deliverable...",
      "[00:03.65] test: JSON Schema conformity -> PASS",
      "[00:03.78] test: Cryptographic oracle signatures -> PASS",
      "[00:03.88] test: Price feed freshness (< 30s) -> PASS (12s elapsed)",
      "[00:03.95] verifier: All 3 verification checks passed cleanly. Releasing escrow payment.",
    ],
    toolPayload: {
      request: {
        method: "cli_sandbox_verifier",
        params: {
          deliverable_path: "/tmp/sandbox/virtuals_market_dataset_v4.json",
          required_schema: "oracle_dataset_v2.json",
        },
      },
      response: {
        verifier_status: "ACCEPTED",
        score: 1.0,
        tests_passed: 3,
        tests_failed: 0,
        summary: "Delivery verified against objective. Ready for settlement.",
      },
    },
    metrics: {
      treasuryState: "18.50 USDC Verified & Settled",
      sibylVersion: "v12 (Verified)",
      decision: "Delivery Accepted (Score: 100%)",
    },
  },
  {
    step: 7,
    title: "Memory Diff & Base Sepolia Commit",
    mcpTool: "memory_journal",
    role: "State Diff Root",
    statusTone: "cyan",
    narrative: "Record episode in Sibyl SQLite and publish salted Keccak256 memory diff root to Base Sepolia.",
    agentThought:
      "Finalizing mission: Recording positive delivery episode to Sibyl SQLite. Updating Beta's Bayesian confidence (+5 Pts). Generating salted Keccak256 hash of new memory state and committing root to Base Sepolia contract for public verifiable auditability.",
    terminalLog: [
      "[00:04.20] sibyl: Writing episode #run-0182 outcome: ACCEPTED to ~/.sibyl-memory/memory.db",
      "[00:04.35] sibyl: Bayesian update: virtuals:agent:beta total_accepted=30, confidence=0.92 -> v13",
      "[00:04.50] crypto: Generating salted Keccak256 memory diff commitment...",
      "[00:04.65] crypto: Salted hash: 0x76b2cba16198f3ef017a0a038bfbcbe10f3c5b8b98e7bbef0694cfb63ea9e4be",
      "[00:04.85] chain: Committing state root to Base Sepolia L2 contract...",
      "[00:05.10] chain: Confirmed in Tx 0x91d4e7823ab4c6019f2a456789b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8",
      "[00:05.20] system: Mission run-0182 completed successfully. Memory state: v13.",
    ],
    toolPayload: {
      request: {
        method: "memory_journal",
        params: {
          counterparty_key: "virtuals:agent:beta",
          outcome: "ACCEPTED",
          note: "Delivery verified against objective with 100% test pass rate",
          salted_hash: "0x76b2cba16198f3ef017a0a038bfbcbe10f3c5b8b98e7bbef0694cfb63ea9e4be",
        },
      },
      response: {
        recorded: true,
        previous_version: 12,
        current_version: 13,
        base_sepolia_tx: "0x91d4e7823ab4c6019f2a456789b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8",
        state_match: true,
      },
    },
    metrics: {
      treasuryState: "Settled ($6.50 Retained)",
      sibylVersion: "v13 (+5 Pts Committed)",
      decision: "Mission Complete · Diff Anchored",
    },
  },
];

export interface SibylFlowSimulatorProps {
  onStepChange?: (step: number) => void;
  className?: string;
}

export function SibylFlowSimulator({ onStepChange, className = "" }: SibylFlowSimulatorProps) {
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const playIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const activeStep = FLOW_STEPS[currentStepIdx]!;

  // Handle autoplay
  useEffect(() => {
    if (isPlaying) {
      playIntervalRef.current = setInterval(() => {
        setCurrentStepIdx((prev) => {
          if (prev >= FLOW_STEPS.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          const next = prev + 1;
          onStepChange?.(next + 1);
          return next;
        });
      }, 2200);
    } else if (playIntervalRef.current) {
      clearInterval(playIntervalRef.current);
      playIntervalRef.current = null;
    }

    return () => {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
      }
    };
  }, [isPlaying, onStepChange]);

  const handleStepSelect = (idx: number) => {
    setIsPlaying(false);
    setCurrentStepIdx(idx);
    onStepChange?.(idx + 1);
  };

  const handleNext = () => {
    setIsPlaying(false);
    if (currentStepIdx < FLOW_STEPS.length - 1) {
      const next = currentStepIdx + 1;
      setCurrentStepIdx(next);
      onStepChange?.(next + 1);
    }
  };

  const handlePrev = () => {
    setIsPlaying(false);
    if (currentStepIdx > 0) {
      const prev = currentStepIdx - 1;
      setCurrentStepIdx(prev);
      onStepChange?.(prev + 1);
    }
  };

  const handleReset = () => {
    setIsPlaying(false);
    setCurrentStepIdx(0);
    onStepChange?.(1);
  };

  return (
    <div className={`mw__flow-sim ${className}`.trim()} data-testid="sibyl-flow-simulator">
      {/* Simulation Controls Bar */}
      <div className="mw__flow-sim-controls">
        <div className="mw__flow-sim-left">
          <div className="mw__flow-sim-badge">
            <span className="mw__flow-sim-pulse" />
            <span>LIVE FLOW SIMULATOR</span>
          </div>
          <Text size="sm" weight="semibold">
            Step {activeStep.step} of 7: {activeStep.title}
          </Text>
        </div>

        <div className="mw__flow-sim-actions">
          <Button
            size="sm"
            variant="secondary"
            onClick={handleReset}
            label="Reset"
            icon={<RotateCcw size={12} />}
          />
          <Button
            size="sm"
            variant="secondary"
            onClick={handlePrev}
            isDisabled={currentStepIdx === 0}
            label="Prev"
            icon={<ChevronLeft size={12} />}
          />
          <Button
            size="sm"
            variant="primary"
            onClick={() => {
              if (currentStepIdx === FLOW_STEPS.length - 1) {
                handleReset();
                setIsPlaying(true);
              } else {
                setIsPlaying((p) => !p);
              }
            }}
            label={isPlaying ? "Pause" : currentStepIdx === FLOW_STEPS.length - 1 ? "Replay Flow" : "Play Flow"}
            icon={isPlaying ? <Pause size={12} /> : <Play size={12} />}
          />
          <Button
            size="sm"
            variant="secondary"
            onClick={handleNext}
            isDisabled={currentStepIdx === FLOW_STEPS.length - 1}
            label="Next"
            icon={<ChevronRight size={12} />}
          />
        </div>
      </div>

      {/* 7-Step Navigation Pipeline */}
      <div className="mw__flow-sim-stepper" role="tablist" aria-label="Simulation steps">
        {FLOW_STEPS.map((s, idx) => {
          const isActive = idx === currentStepIdx;
          const isCompleted = idx < currentStepIdx;
          return (
            <button
              key={s.step}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`mw__flow-sim-step-btn ${isActive ? "mw__flow-sim-step-btn--active" : ""} ${isCompleted ? "mw__flow-sim-step-btn--done" : ""}`}
              onClick={() => handleStepSelect(idx)}
            >
              <span className="mw__flow-sim-step-dot">
                {isCompleted ? "✓" : s.step}
              </span>
              <span className="mw__flow-sim-step-label">{s.title}</span>
            </button>
          );
        })}
      </div>

      {/* Active Step Intelligence Grid */}
      <div className="mw__flow-sim-body">
        {/* Left Column: Agent Monologue & Step Details */}
        <div className="mw__flow-sim-narrative-card">
          <div className="mw__flow-sim-card-header">
            <HStack gap={2} align="center">
              <Bot size={16} className="mw__flow-sim-bot-icon" />
              <span className="mw__flow-sim-role-pill">{activeStep.role}</span>
              <code className="mw__flow-sim-tool-code">{activeStep.mcpTool}</code>
            </HStack>
          </div>

          <p className="mw__flow-sim-lead-text">{activeStep.narrative}</p>

          <div className="mw__flow-sim-thought-bubble">
            <div className="mw__flow-sim-thought-header">
              <Sparkles size={13} className="mw__flow-sim-thought-icon" />
              <span>AGENT AUTONOMOUS REASONING</span>
            </div>
            <p className="mw__flow-sim-thought-text">&ldquo;{activeStep.agentThought}&rdquo;</p>
          </div>

          {/* Quick Metrics Bar */}
          <div className="mw__flow-sim-metrics-bar">
            <div className="mw__flow-sim-metric-item">
              <span className="mw__flow-sim-metric-label">Treasury Status</span>
              <span className="mw__flow-sim-metric-val">{activeStep.metrics.treasuryState}</span>
            </div>
            <div className="mw__flow-sim-metric-item">
              <span className="mw__flow-sim-metric-label">Sibyl Memory Version</span>
              <span className="mw__flow-sim-metric-val">{activeStep.metrics.sibylVersion}</span>
            </div>
            <div className="mw__flow-sim-metric-item">
              <span className="mw__flow-sim-metric-label">Autonomous Decision</span>
              <span className="mw__flow-sim-metric-val">{activeStep.metrics.decision}</span>
            </div>
          </div>
        </div>

        {/* Right Column: Live Terminal Log & MCP JSON-RPC Payload */}
        <div className="mw__flow-sim-terminal-card">
          <div className="mw__flow-sim-terminal-header">
            <HStack gap={2} align="center">
              <Terminal size={14} className="mw__flow-sim-term-icon" />
              <span>LIVE TERMINAL & MCP PROTOCOL EXECUTION</span>
            </HStack>
            <span className="mw__flow-sim-term-badge">STREAMING</span>
          </div>

          {/* Simulated Terminal Output */}
          <div className="mw__flow-sim-terminal-screen">
            {activeStep.terminalLog.map((line, lIdx) => (
              <div key={lIdx} className="mw__flow-sim-term-line">
                <span className="mw__flow-sim-term-prompt">&gt;</span>
                <span>{line}</span>
              </div>
            ))}
          </div>

          {/* Expandable MCP Request/Response Inspector */}
          <div className="mw__flow-sim-payload-block">
            <div className="mw__flow-sim-payload-title">
              <span>MCP RPC: {activeStep.mcpTool}</span>
            </div>
            <pre className="mw__flow-sim-payload-json">
              <code>{JSON.stringify(activeStep.toolPayload, null, 2)}</code>
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}

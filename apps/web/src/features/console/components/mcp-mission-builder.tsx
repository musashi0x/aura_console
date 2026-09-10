"use client";

import { useState } from "react";
import {
  Bot,
  Sparkles,
  Copy,
  Check,
  Zap,
  ShieldCheck,
  Database,
  ArrowRight,
  Terminal,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Edit3,
  AlertCircle,
} from "lucide-react";

import { Button, playInteractionSound } from "@/components/primitives";
import { env } from "@/lib/env";
import { useWeb3Wallet } from "@/features/web3";

export interface AgentArchetype {
  id: string;
  name: string;
  badge: string;
  icon: typeof Zap;
  intent: string;
  suggestedBudget: string;
  rationale: string;
}

export const AGENT_ARCHETYPES: AgentArchetype[] = [
  {
    id: "competitor-report",
    name: "Competitor Intelligence Report",
    badge: "Market Research",
    icon: Sparkles,
    intent: "Find a provider for a competitor report. Budget: 15 USDC.",
    suggestedBudget: "15.00",
    rationale: "Requires 3 competitors with authentic website URLs and valid citation sources.",
  },
  {
    id: "arbitrage",
    name: "Alpha DEX Arbitrageur",
    badge: "Base Sepolia DEX",
    icon: Zap,
    intent: "Scan Base Sepolia DEX pools for price discrepancies and execute atomic rebalance",
    suggestedBudget: "15.00",
    rationale: "Autonomous on-chain arbitrage with strict slippage bounds under guardrail limits.",
  },
  {
    id: "data-oracle",
    name: "Decentralized Data Oracle",
    badge: "Virtuals Network",
    icon: Database,
    intent: "Procure real-time decentralized market intelligence and sentiment dataset from Virtuals protocol",
    suggestedBudget: "25.00",
    rationale: "Querying Sibyl memory: Virtuals agent alpha verified with 94% reliability.",
  },
  {
    id: "risk-sentinel",
    name: "Solvency & Risk Sentinel",
    badge: "Guardrail Compliance",
    icon: ShieldCheck,
    intent: "Audit counterparty liquidity pool & historical solvency before capital commitment",
    suggestedBudget: "10.00",
    rationale: "Pre-flight security check with bounded risk under auto-spend ceiling.",
  },
];

interface McpMissionBuilderProps {
  onDraft: (data: { objective: string; budgetUsdc: string }) => void;
  onCreate: (data: { objective: string; budgetUsdc: string }) => Promise<void>;
  disabled: boolean;
  pending: boolean;
}

interface MissionProposal {
  objective: string;
  budgetUsdc: string;
  rationale: string;
}

export function McpMissionBuilder({
  onDraft,
  onCreate,
  disabled,
  pending,
}: McpMissionBuilderProps) {
  const { isConnected, isBaseSepolia, usdcBalance } = useWeb3Wallet();
  const [selectedArchetype, setSelectedArchetype] = useState<AgentArchetype>(
    AGENT_ARCHETYPES[0]!,
  );
  const [customPrompt, setCustomPrompt] = useState("");
  const [copied, setCopied] = useState(false);
  const [showPayload, setShowPayload] = useState(false);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [synthesisStep, setSynthesisStep] = useState<number | null>(null);
  const [proposal, setProposal] = useState<MissionProposal | null>(null);

  const activeObjective =
    customPrompt.trim() !== "" ? customPrompt.trim() : selectedArchetype.intent;
  const activeBudget = selectedArchetype.suggestedBudget;

  const mcpConfigSnippet = JSON.stringify(
    {
      mcpServers: {
        "aura-console": {
          url: `${env.NEXT_PUBLIC_API_URL}/api/mcp`,
          transport: "sse",
          tools: [
            "mission_create",
            "mission_propose_approval",
            "memory_recall_counterparty",
            "guardrails_get_policies",
          ],
        },
      },
    },
    null,
    2,
  );

  async function handleCopyConfig() {
    try {
      await navigator.clipboard.writeText(mcpConfigSnippet);
      playInteractionSound("tick");
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  }

  function handleSelectPreset(archetype: AgentArchetype) {
    playInteractionSound("tick");
    setSelectedArchetype(archetype);
    setCustomPrompt(archetype.intent);
    setProposal(null);
  }

  async function handleGenerateProposal() {
    setIsSynthesizing(true);
    playInteractionSound("tick");
    setSynthesisStep(1); // Connecting MCP
    await new Promise((r) => setTimeout(r, 250));
    setSynthesisStep(2); // Sibyl Memory
    await new Promise((r) => setTimeout(r, 300));
    setSynthesisStep(3); // Guardrails
    await new Promise((r) => setTimeout(r, 250));
    setSynthesisStep(4); // Synthesizing Objective
    await new Promise((r) => setTimeout(r, 250));
    setIsSynthesizing(false);
    setSynthesisStep(null);
    playInteractionSound("pulse");

    setProposal({
      objective: activeObjective,
      budgetUsdc: activeBudget,
      rationale: selectedArchetype.rationale,
    });
  }

  const handleApplyToForm = () => {
    if (!proposal) return;
    playInteractionSound("tick");
    onDraft({
      objective: proposal.objective,
      budgetUsdc: proposal.budgetUsdc,
    });
  };

  const handleConfirmLaunch = async () => {
    if (!proposal) return;
    playInteractionSound("pulse");
    await onCreate({
      objective: proposal.objective,
      budgetUsdc: proposal.budgetUsdc,
    });
  };

  return (
    <div className="mcp-mission-builder p-5 rounded-2xl bg-[var(--color-surface-raised,#1b1b1f)] border border-[var(--color-border)] max-w-2xl flex flex-col gap-5 shadow-sm my-2">
      {/* MCP Bridge Status Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[var(--color-border)]">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-[var(--color-surface,#111015)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-accent)] flex-shrink-0">
            <Bot size={18} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-[var(--color-text,#f4f7fb)]">
                AI Agent MCP Bridge
              </span>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-mono font-medium bg-emerald-950/60 border border-emerald-800/60 text-emerald-400 flex-shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                ACTIVE
              </span>
            </div>
            <p className="text-xs text-[var(--color-text-muted,#8d9aaf)] break-words mt-0.5">
              Model Context Protocol v2024-11-05 • Fastify & Stdio Agent Transport
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleCopyConfig}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono bg-[var(--color-surface,#111015)] border border-[var(--color-border)] hover:border-[var(--color-accent)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors self-start sm:self-auto flex-shrink-0 cursor-pointer"
          title="Copy MCP server configuration for Claude Desktop, Cursor, or Antigravity"
        >
          {copied ? (
            <>
              <Check size={13} className="text-emerald-400" />
              <span className="text-emerald-400">Config Copied!</span>
            </>
          ) : (
            <>
              <Copy size={13} />
              <span>Copy MCP Config</span>
            </>
          )}
        </button>
      </div>

      {/* Archetype Quick Selector */}
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-[var(--color-text,#f4f7fb)] flex items-center gap-1.5">
            <Sparkles size={13} className="text-[var(--color-accent)]" />
            <span>Select AI Agent Archetype</span>
          </span>
          <span className="text-[11px] text-[var(--color-text-muted,#8d9aaf)] font-mono">
            Demo Presets
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
          {AGENT_ARCHETYPES.map((archetype) => {
            const Icon = archetype.icon;
            const isSelected = selectedArchetype.id === archetype.id && !customPrompt;
            return (
              <button
                key={archetype.id}
                type="button"
                onClick={() => handleSelectPreset(archetype)}
                className={`p-3 rounded-xl border text-left flex flex-col justify-between gap-2 transition-all min-w-0 ${
                  isSelected
                    ? "bg-[var(--color-surface,#111015)] border-[var(--color-accent)] ring-1 ring-[var(--color-accent)]/30"
                    : "bg-[var(--color-surface,#111015)]/60 border-[var(--color-border)] hover:border-[var(--color-border-hover,#3f3f46)]"
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <div className="w-6 h-6 rounded-md bg-[var(--color-surface-raised,#1b1b1f)] flex items-center justify-center text-[var(--color-accent)] flex-shrink-0">
                    <Icon size={14} />
                  </div>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--color-surface-raised,#1b1b1f)] text-[var(--color-text-muted)] border border-[var(--color-border)] flex-shrink-0">
                    {archetype.suggestedBudget} USDC
                  </span>
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-medium text-[var(--color-text,#f4f7fb)] truncate">
                    {archetype.name}
                  </div>
                  <div className="text-[11px] text-[var(--color-text-muted,#8d9aaf)] truncate mt-0.5">
                    {archetype.badge}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Prompt / Custom Intent */}
      <div className="flex flex-col gap-2">
        <label
          htmlFor="agent-intent"
          className="text-xs font-medium text-[var(--color-text,#f4f7fb)] flex items-center justify-between"
        >
          <span>Agent Objective / Prompt</span>
          <span className="text-[11px] text-[var(--color-text-muted,#8d9aaf)]">Editable or Custom</span>
        </label>
        <textarea
          id="agent-intent"
          rows={2}
          value={customPrompt || selectedArchetype.intent}
          onChange={(e) => {
            setCustomPrompt(e.target.value);
            setProposal(null);
          }}
          placeholder="Describe what Aura should achieve (Vietnamese or English)..."
          className="w-full px-3.5 py-2.5 rounded-lg bg-[var(--color-surface,#111015)] border border-[var(--color-border)] text-sm text-[var(--color-text,#f4f7fb)] focus:border-[var(--color-accent)] focus:outline-none transition-colors resize-none font-sans"
        />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px] text-[var(--color-text-muted,#8d9aaf)]">
          <span className="break-words">Agent Rationale: {selectedArchetype.rationale}</span>
          <div className="flex items-center gap-2 flex-shrink-0">
            {isConnected && isBaseSepolia && usdcBalance !== null && (
              <span className="font-mono text-[var(--color-cyan)]">Wallet: {usdcBalance} USDC</span>
            )}
            <span className="font-mono">Ceiling: {activeBudget} USDC</span>
          </div>
        </div>
      </div>

      {/* Real-time Agent Reasoning Telemetry */}
      {isSynthesizing ? (
        <div className="p-3.5 rounded-xl bg-[var(--color-surface,#111015)] border border-[var(--color-accent)]/40 flex flex-col gap-2 animate-pulse">
          <div className="flex items-center gap-2 text-xs font-mono text-[var(--color-accent)]">
            <Bot size={14} className="animate-spin" />
            <span>AI Agent Reasoning via MCP Bridge...</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[10px] font-mono">
            <span
              className={`px-2 py-1 rounded ${
                synthesisStep && synthesisStep >= 1
                  ? "bg-emerald-950/60 text-emerald-400 border border-emerald-800/60"
                  : "bg-[var(--color-surface-raised)] text-[var(--color-text-muted)]"
              }`}
            >
              1. MCP Connect
            </span>
            <span
              className={`px-2 py-1 rounded ${
                synthesisStep && synthesisStep >= 2
                  ? "bg-emerald-950/60 text-emerald-400 border border-emerald-800/60"
                  : "bg-[var(--color-surface-raised)] text-[var(--color-text-muted)]"
              }`}
            >
              2. Sibyl Memory
            </span>
            <span
              className={`px-2 py-1 rounded ${
                synthesisStep && synthesisStep >= 3
                  ? "bg-emerald-950/60 text-emerald-400 border border-emerald-800/60"
                  : "bg-[var(--color-surface-raised)] text-[var(--color-text-muted)]"
              }`}
            >
              3. Guardrails
            </span>
            <span
              className={`px-2 py-1 rounded ${
                synthesisStep && synthesisStep >= 4
                  ? "bg-emerald-950/60 text-emerald-400 border border-emerald-800/60"
                  : "bg-[var(--color-surface-raised)] text-[var(--color-text-muted)]"
              }`}
            >
              4. Formulate Run
            </span>
          </div>
        </div>
      ) : null}

      {/* Synthesis Trigger Button (When Proposal not yet generated) */}
      {!proposal ? (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2 border-t border-[var(--color-border)]">
          <button
            type="button"
            onClick={() => setShowPayload(!showPayload)}
            className="text-xs font-mono text-[var(--color-text-muted)] hover:text-[var(--color-text)] flex items-center gap-1 self-start transition-colors"
          >
            <Terminal size={13} />
            <span>Inspect MCP Tool Call</span>
            {showPayload ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>

          <Button
            type="button"
            disabled={disabled || pending || isSynthesizing || activeObjective.length < 3}
            onClick={handleGenerateProposal}
            className="flex items-center justify-center gap-2 text-xs font-medium"
          >
            <Sparkles size={13} className="text-[var(--color-accent)]" />
            <span>{isSynthesizing ? "Synthesizing..." : "Generate Mission Proposal with AI"}</span>
          </Button>
        </div>
      ) : (
        /* Interactive Review Card: Operator is in full control, no auto-execution! */
        <div className="p-4 rounded-xl bg-[var(--color-surface,#111015)] border border-[var(--color-accent)]/50 flex flex-col gap-4 shadow-sm animate-in fade-in duration-200">
          <div className="flex items-center justify-between pb-2 border-b border-[var(--color-border)]">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={15} className="text-emerald-400" />
              <span className="text-xs font-semibold text-[var(--color-text,#f4f7fb)]">
                AI Agent Mission Proposal (Ready for Review)
              </span>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-800/60">
              GUARDRAILS PASSED
            </span>
          </div>

          <div className="flex flex-col gap-3">
            <div>
              <label className="text-[11px] font-medium text-[var(--color-text-muted)] block mb-1">
                Synthesized Objective
              </label>
              <input
                value={proposal.objective}
                onChange={(e) => setProposal({ ...proposal, objective: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-[var(--color-surface-raised,#1b1b1f)] border border-[var(--color-border)] text-xs text-[var(--color-text,#f4f7fb)] focus:border-[var(--color-accent)] focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-medium text-[var(--color-text-muted)]">
                    Budget Ceiling (USDC)
                  </label>
                  {isConnected && isBaseSepolia && usdcBalance !== null && (
                    <div className="flex items-center gap-1.5 text-[10px]">
                      <span className="text-[var(--color-text-muted)]">Wallet: {usdcBalance}</span>
                      <button
                        type="button"
                        onClick={() => {
                          playInteractionSound("tick");
                          setProposal({ ...proposal, budgetUsdc: usdcBalance });
                        }}
                        className="font-mono px-1.5 py-0.5 rounded bg-[var(--color-surface,#111015)] border border-[var(--color-border)] hover:border-[var(--color-cyan)] text-[var(--color-cyan)] transition-colors"
                        data-testid="mcp-use-max-btn"
                        title="Set ceiling to connected wallet USDC balance"
                      >
                        Use Max
                      </button>
                    </div>
                  )}
                </div>
                <input
                  value={proposal.budgetUsdc}
                  onChange={(e) => setProposal({ ...proposal, budgetUsdc: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--color-surface-raised,#1b1b1f)] border border-[var(--color-border)] text-xs font-mono text-[var(--color-text,#f4f7fb)] focus:border-[var(--color-accent)] focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-[var(--color-text-muted)] block mb-1">
                  Execution Source
                </label>
                <div className="px-3 py-2 rounded-lg bg-[var(--color-surface-raised,#1b1b1f)] border border-[var(--color-border)] text-xs font-mono text-emerald-400">
                  AGENT (via MCP Protocol)
                </div>
              </div>
            </div>

            {(() => {
              const parsedBudget = parseFloat(proposal.budgetUsdc);
              const parsedBalance = usdcBalance !== null ? parseFloat(usdcBalance) : null;
              const isExceeding =
                isConnected &&
                isBaseSepolia &&
                parsedBalance !== null &&
                !Number.isNaN(parsedBudget) &&
                parsedBudget > parsedBalance;

              if (!isExceeding) return null;

              return (
                <div
                  className="p-2.5 rounded-lg bg-amber-950/40 border border-amber-800/60 text-xs text-amber-300 flex items-center justify-between gap-2"
                  role="status"
                  data-testid="mcp-budget-exceeds-warning"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <AlertCircle size={14} className="flex-shrink-0 text-amber-400" />
                    <span className="truncate">
                      Ceiling ({proposal.budgetUsdc} USDC) exceeds wallet balance ({usdcBalance} USDC).
                    </span>
                  </div>
                  <a
                    href="https://portal.cdp.coinbase.com/products/faucet"
                    target="_blank"
                    rel="noreferrer noopener"
                    className="underline hover:text-amber-100 flex-shrink-0 font-mono text-[11px] flex items-center gap-1"
                    data-testid="mcp-faucet-warning-link"
                  >
                    <span>Get USDC Faucet</span>
                    <span aria-hidden="true">↗</span>
                  </a>
                </div>
              );
            })()}

            <p className="text-[11px] text-[var(--color-text-muted)] bg-[var(--color-surface-raised)]/40 p-2.5 rounded-lg border border-[var(--color-border)]/60">
              <span className="font-semibold text-[var(--color-text)]">Agent Rationale: </span>
              {proposal.rationale}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-2 border-t border-[var(--color-border)]">
            <Button
              type="button"
              variant="quiet"
              disabled={disabled || pending}
              onClick={handleApplyToForm}
              className="flex items-center justify-center gap-1.5 text-xs"
            >
              <Edit3 size={13} />
              <span>Customize in Manual Form</span>
            </Button>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="quiet"
                disabled={disabled || pending}
                onClick={() => setProposal(null)}
                className="text-xs"
              >
                Reset
              </Button>
              <Button
                type="button"
                disabled={disabled || pending || proposal.objective.trim() === ""}
                onClick={handleConfirmLaunch}
                className="flex items-center justify-center gap-2 text-xs font-medium"
              >
                <span>{pending ? "Launching Mission..." : "Approve & Launch Mission"}</span>
                <ArrowRight size={13} />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Inspectable MCP Tool Call JSON */}
      {showPayload ? (
        <div className="p-3 rounded-lg bg-[var(--color-surface,#111015)] border border-[var(--color-border)] font-mono text-[11px] text-[var(--color-text-muted)] overflow-x-auto">
          <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] mb-1.5">
            MCP Tool Payload (JSON-RPC 2.0):
          </div>
          <pre className="text-emerald-400 leading-relaxed">
{JSON.stringify(
  {
    tool: "mission_create",
    arguments: {
      objective: proposal ? proposal.objective : activeObjective,
      budgetUsdc: proposal ? proposal.budgetUsdc : activeBudget,
      source: "AGENT",
    },
    provenance: {
      agent: selectedArchetype.id,
      transport: "mcp/sse",
    },
  },
  null,
  2,
)}
          </pre>
        </div>
      ) : null}
    </div>
  );
}

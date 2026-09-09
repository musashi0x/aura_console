"use client";

import {
  ArrowRight,
  CheckCircle2,
  Code2,
  Copy,
  Check,
  Cpu,
  Database,
  Lock,
  RefreshCw,
  RotateCcw,
  Send,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState, useRef, type ReactNode, type FormEvent } from "react";

type ConsoleMode = "auto" | "safety" | "bayesian" | "onchain";

type ScenarioKey =
  | "deletion"
  | "session_a"
  | "session_b"
  | "base_sepolia"
  | "mcp"
  | "reputation_fsm";

interface SuggestionCard {
  key: ScenarioKey;
  title: string;
  category: "safety" | "memory" | "onchain" | "acp";
  badge: string;
  badgeColor: string;
  prompt: string;
  description: string;
  mode: ConsoleMode;
}

const SUGGESTIONS: SuggestionCard[] = [
  {
    key: "deletion",
    title: "Trigger load-bearing deletion test",
    category: "safety",
    badge: "Fail-Closed Invariant",
    badgeColor: "border-amber-500/30 bg-amber-500/15 text-amber-400",
    prompt: "pnpm demo:deletion-test --check-fail-closed",
    description:
      "Verify SIBYL_PYTHON missing halts execution in run.blocked with zero blind treasury spend.",
    mode: "safety",
  },
  {
    key: "session_b",
    title: "Verify cold start across restart boundaries",
    category: "memory",
    badge: "Zero Amnesia",
    badgeColor: "border-blue-500/30 bg-blue-500/15 text-blue-400",
    prompt:
      "Simulate process crash: drop relational runs, recall reputation from Sibyl memory.db",
    description:
      "Relational PostgreSQL wiped via CASCADE; SQLite memory survives. Beta chosen over failed Alpha.",
    mode: "bayesian",
  },
  {
    key: "base_sepolia",
    title: "Inspect Base Sepolia cryptographic proof",
    category: "onchain",
    badge: "On-Chain Notarization",
    badgeColor: "border-emerald-500/30 bg-emerald-500/15 text-emerald-400",
    prompt: "pnpm memory:verify --network base-sepolia --chainId 84532",
    description:
      "Salted Keccak256 calldata digest committed on-chain without exposing private negotiation details.",
    mode: "onchain",
  },
  {
    key: "session_a",
    title: "Simulate Virtuals ACP settlement",
    category: "acp",
    badge: "Virtuals ACP",
    badgeColor: "border-purple-500/30 bg-purple-500/15 text-purple-400",
    prompt:
      "Simulate procurement: score virtuals:agent:alpha vs virtuals:agent:beta under 0.20 USDC ceiling",
    description:
      "Candidate scoring, fail-closed economic ceiling approval, and failure recording to COLD journal.",
    mode: "auto",
  },
  {
    key: "mcp",
    title: "Query Claude Code MCP memory bridge",
    category: "memory",
    badge: "Claude MCP Server",
    badgeColor: "border-cyan-500/30 bg-cyan-500/15 text-cyan-400",
    prompt: 'Call memory_recall_counterparty tool for "virtuals:agent:beta"',
    description:
      "External agents in Claude Code or Cursor recall structured Bayesian trust scores via stdio/HTTP bridge.",
    mode: "bayesian",
  },
  {
    key: "reputation_fsm",
    title: "Audit Bayesian reputation FSM",
    category: "safety",
    badge: "Bayesian Math",
    badgeColor: "border-rose-500/30 bg-rose-500/15 text-rose-400",
    prompt:
      "Track counterparty FSM state transitions: NEW → KNOWN → PREFERRED → BLOCKED",
    description:
      "Continuous Beta distributions update empirical success rates without manual human intervention.",
    mode: "safety",
  },
];

const CATEGORY_TABS = [
  { key: "all", label: "All Scenarios" },
  { key: "safety", label: "Safety & Invariant" },
  { key: "memory", label: "Memory & Recall" },
  { key: "onchain", label: "On-Chain Proof" },
  { key: "acp", label: "Virtuals ACP" },
] as const;

const MODES = [
  { key: "auto", label: "⚡ Auto", desc: "Adaptive execution routing" },
  {
    key: "safety",
    label: "🛡️ Fail-Closed Policy",
    desc: "Strict economic guardrail gate",
  },
  {
    key: "bayesian",
    label: "🧠 Bayesian Recall",
    desc: "Alpha/Beta distribution scoring",
  },
  {
    key: "onchain",
    label: "⛓️ On-Chain Proof",
    desc: "Base Sepolia Keccak256 commitment",
  },
] as const;

export function AuraChatConsole(): ReactNode {
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [activeMode, setActiveMode] = useState<ConsoleMode>("auto");
  const [prompt, setPrompt] = useState<string>("");
  const [activeScenario, setActiveScenario] = useState<ScenarioKey | null>(null);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [showJson, setShowJson] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [attachedTokens, setAttachedTokens] = useState<string[]>([
    "memory.db (5 Tiers)",
    "ceiling: 0.20 USDC",
    "base-sepolia (84532)",
  ]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const filteredSuggestions =
    activeCategory === "all"
      ? SUGGESTIONS
      : SUGGESTIONS.filter((s) => s.category === activeCategory);

  const handleSelectSuggestion = (suggestion: SuggestionCard) => {
    setPrompt(suggestion.prompt);
    setActiveMode(suggestion.mode);
    setIsExecuting(true);
    setActiveScenario(suggestion.key);
    setShowJson(false);
    setTimeout(() => {
      setIsExecuting(false);
    }, 400);
  };

  const handleSubmit = (e?: FormEvent) => {
    if (e) e.preventDefault();
    const clean = prompt.trim();
    if (!clean) return;

    setIsExecuting(true);
    const matched = SUGGESTIONS.find((s) =>
      clean.toLowerCase().includes(s.key.toLowerCase().replace("_", " "))
    );
    setActiveScenario(matched ? matched.key : "session_a");
    setShowJson(false);
    setTimeout(() => {
      setIsExecuting(false);
    }, 400);
  };

  const handleResetZeroState = () => {
    setActiveScenario(null);
    setPrompt("");
    setShowJson(false);
  };

  const handleInsertToken = (token: string) => {
    setPrompt((prev) => (prev ? `${prev} ${token}` : token));
    textareaRef.current?.focus();
  };

  const removeToken = (tokenToRemove: string) => {
    setAttachedTokens((prev) => prev.filter((t) => t !== tokenToRemove));
  };

  const handleCopyJson = (payload: object) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="relative mx-auto w-full max-w-5xl overflow-hidden rounded-3xl border border-neutral-800 bg-[#0b0a10] font-sans text-neutral-100 shadow-2xl transition-all">
      {/* 1. Astryx Shell Navigation Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-800/90 bg-[#121118] px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2.5">
          <span className="h-2 w-2 rounded-full bg-accent shadow-xs animate-pulse" />
          <span className="font-mono text-xs font-semibold tracking-wider text-neutral-200">
            AURA AGENT CONSOLE
          </span>
          <span className="hidden rounded-md border border-neutral-800 bg-neutral-900/80 px-2 py-0.5 font-mono text-[10px] text-neutral-400 sm:inline">
            ZERO-STATE ENTRY SURFACE
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
          <div className="flex items-center gap-1.5 rounded-lg border border-neutral-800 bg-neutral-900/90 px-2.5 py-1 text-[11px] text-neutral-300">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
            <span>Virtuals ACP v2</span>
          </div>
          <div className="hidden items-center gap-1.5 rounded-lg border border-neutral-800 bg-neutral-900/90 px-2.5 py-1 text-[11px] text-blue-400 md:flex">
            <Lock className="h-3 w-3" />
            <span>Base Sepolia (84532)</span>
          </div>
          <div className="hidden items-center gap-1.5 rounded-lg border border-neutral-800 bg-neutral-900/90 px-2.5 py-1 text-[11px] text-accent lg:flex">
            <Database className="h-3 w-3" />
            <span>Sibyl 5-Tier</span>
          </div>

          {activeScenario && (
            <button
              type="button"
              onClick={handleResetZeroState}
              className="flex cursor-pointer items-center gap-1 rounded-lg border border-accent/40 bg-accent/15 px-2.5 py-1 text-[11px] font-semibold text-accent hover:bg-accent/25 transition-all"
              title="Return to Zero-State Entry Surface"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Zero-State</span>
            </button>
          )}
        </div>
      </div>

      <div className="p-4 sm:p-7">
        {/* 2. Zero-State Entry Surface Banner */}
        <div className="mb-6 flex flex-col items-start gap-2">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent/20 text-accent">
              <Sparkles className="h-4 w-4" />
            </div>
            <span className="font-mono text-xs font-semibold tracking-wider text-accent uppercase">
              Autonomous Command Surface
            </span>
          </div>
          <h2 className="text-xl font-medium tracking-tight text-white sm:text-2xl">
            Where should your agent fleet begin?
          </h2>
          <p className="max-w-2xl text-xs leading-relaxed text-neutral-400 sm:text-sm">
            Zero-state entry composer sized for the moment before content
            exists. Select a load-bearing verification scenario or compose a
            custom instruction.
          </p>
        </div>

        {/* 3. Central Chat Composer (Inspired by Astryx ai-chat-landing) */}
        <div className="rounded-2xl border border-neutral-800 bg-[#121118] p-3 shadow-lg sm:p-4">
          {/* Active Context Tokens Drawer */}
          {attachedTokens.length > 0 && (
            <div className="mb-3 flex flex-wrap items-center gap-1.5">
              <span className="font-mono text-[10px] tracking-wider text-neutral-500 uppercase">
                Active Context:
              </span>
              {attachedTokens.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1 rounded-md border border-neutral-700/80 bg-neutral-800/90 px-2 py-0.5 font-mono text-[10px] text-neutral-300"
                >
                  <span>{t}</span>
                  <button
                    type="button"
                    onClick={() => removeToken(t)}
                    className="cursor-pointer text-neutral-400 hover:text-white"
                    aria-label={`Remove ${t}`}
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Quick Mention Pills */}
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-[10px] text-neutral-500">Insert:</span>
            <button
              type="button"
              onClick={() => handleInsertToken("@virtuals:agent:alpha")}
              className="cursor-pointer rounded-md border border-neutral-800 bg-neutral-900 px-2 py-0.5 font-mono text-[11px] text-amber-300 hover:border-amber-500/40 hover:bg-neutral-800 transition-colors"
            >
              @agent:alpha
            </button>
            <button
              type="button"
              onClick={() => handleInsertToken("@virtuals:agent:beta")}
              className="cursor-pointer rounded-md border border-neutral-800 bg-neutral-900 px-2 py-0.5 font-mono text-[11px] text-blue-300 hover:border-blue-500/40 hover:bg-neutral-800 transition-colors"
            >
              @agent:beta
            </button>
            <button
              type="button"
              onClick={() => handleInsertToken("@acp:job_7f3a")}
              className="cursor-pointer rounded-md border border-neutral-800 bg-neutral-900 px-2 py-0.5 font-mono text-[11px] text-accent hover:border-accent/40 hover:bg-neutral-800 transition-colors"
            >
              @acp:job_7f3a
            </button>
            <button
              type="button"
              onClick={() => handleInsertToken("--fail-closed")}
              className="cursor-pointer rounded-md border border-neutral-800 bg-neutral-900 px-2 py-0.5 font-mono text-[11px] text-emerald-300 hover:border-emerald-500/40 hover:bg-neutral-800 transition-colors"
            >
              --fail-closed
            </button>
          </div>

          {/* Form Composer Input */}
          <form onSubmit={handleSubmit} className="relative">
            <textarea
              ref={textareaRef}
              rows={2}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              placeholder="Ask Aura: e.g., 'Trigger load-bearing deletion test', 'Verify cold start recovery', or 'Inspect Base Sepolia cryptographic proof'..."
              aria-label="Aura Console Prompt Input"
              className="w-full resize-none bg-transparent font-mono text-xs leading-relaxed text-white placeholder:text-neutral-500 focus:outline-none sm:text-sm"
            />

            {/* Composer Footer Controls */}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-neutral-800/80 pt-3">
              {/* Mode Switcher Group */}
              <div className="flex flex-wrap items-center gap-1">
                {MODES.map((m) => (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => setActiveMode(m.key)}
                    className={`cursor-pointer rounded-lg px-2.5 py-1 font-mono text-[11px] transition-all ${
                      activeMode === m.key
                        ? "bg-accent font-semibold text-black shadow-xs"
                        : "text-neutral-400 hover:bg-neutral-800/70 hover:text-neutral-200"
                    }`}
                    title={m.desc}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <span className="hidden font-mono text-[11px] text-neutral-500 sm:inline">
                  Enter ↵ to run
                </span>
                <button
                  type="submit"
                  disabled={isExecuting || !prompt.trim()}
                  className={`flex cursor-pointer items-center gap-1.5 rounded-xl px-4 py-2 font-mono text-xs font-semibold transition-all ${
                    prompt.trim()
                      ? "bg-accent text-black hover:bg-accent/90 shadow-md hover:scale-102"
                      : "cursor-not-allowed bg-neutral-800 text-neutral-500"
                  }`}
                >
                  {isExecuting ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      <span>Executing...</span>
                    </>
                  ) : (
                    <>
                      <span>Execute</span>
                      <Send className="h-3.5 w-3.5" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* 4. Category Filter Tabs + Suggestion Cards Grid (The empty counterpart to a transcript) */}
        {!activeScenario && (
          <div className="mt-8 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                {CATEGORY_TABS.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveCategory(tab.key)}
                    className={`cursor-pointer rounded-xl px-3 py-1.5 font-mono text-xs transition-all ${
                      activeCategory === tab.key
                        ? "border border-neutral-700 bg-neutral-800 font-semibold text-white shadow-xs"
                        : "text-neutral-400 hover:text-neutral-200"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <span className="font-mono text-[11px] text-neutral-500">
                Click any chip to simulate execution
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredSuggestions.map((suggestion) => (
                <div
                  key={suggestion.key}
                  onClick={() => handleSelectSuggestion(suggestion)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleSelectSuggestion(suggestion);
                    }
                  }}
                  className="group flex cursor-pointer flex-col justify-between rounded-2xl border border-neutral-800/80 bg-[#121118]/80 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/40 hover:bg-[#16151f] hover:shadow-xl"
                >
                  <div>
                    <div className="mb-2.5 flex items-center justify-between">
                      <span
                        className={`rounded-md border px-2 py-0.5 font-mono text-[10px] font-bold ${suggestion.badgeColor}`}
                      >
                        {suggestion.badge}
                      </span>
                      <ArrowRight className="h-3.5 w-3.5 text-neutral-500 transition-transform group-hover:translate-x-1 group-hover:text-accent" />
                    </div>
                    <h3 className="text-sm font-semibold tracking-tight text-white group-hover:text-accent transition-colors">
                      {suggestion.title}
                    </h3>
                    <p className="mt-1.5 text-xs leading-relaxed text-neutral-400">
                      {suggestion.description}
                    </p>
                  </div>

                  <div className="mt-4 truncate border-t border-neutral-800/60 pt-2 font-mono text-[10px] text-neutral-500">
                    <span className="text-accent">$</span> {suggestion.prompt}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 5. Interactive Execution Transcript / Response (Revealed upon submission) */}
        <AnimatePresence>
          {activeScenario && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3 }}
              className="mt-6 space-y-4"
            >
              {/* Telemetry Status Bar */}
              <div className="grid grid-cols-2 gap-2 rounded-2xl border border-neutral-800 bg-[#0d0c13] p-3 font-mono text-xs sm:grid-cols-4">
                <div className="flex flex-col gap-1 rounded-xl border border-neutral-800/60 bg-neutral-900/50 p-2.5">
                  <span className="text-[10px] tracking-wider text-neutral-500 uppercase">
                    Mission State
                  </span>
                  <span className="flex items-center gap-1.5 font-semibold">
                    {activeScenario === "deletion" ? (
                      <span className="flex items-center gap-1 text-amber-400">
                        <ShieldAlert className="h-3.5 w-3.5" />
                        BLOCKED (Fail-Closed)
                      </span>
                    ) : activeScenario === "session_b" ? (
                      <span className="flex items-center gap-1 text-blue-400">
                        <RotateCcw className="h-3.5 w-3.5" />
                        RECOVERED (Post-Drop)
                      </span>
                    ) : activeScenario === "mcp" ? (
                      <span className="flex items-center gap-1 text-cyan-400">
                        <Cpu className="h-3.5 w-3.5" />
                        EXTERNAL RECALL
                      </span>
                    ) : activeScenario === "base_sepolia" ? (
                      <span className="flex items-center gap-1 text-emerald-400">
                        <Lock className="h-3.5 w-3.5" />
                        NOTARIZED
                      </span>
                    ) : activeScenario === "reputation_fsm" ? (
                      <span className="flex items-center gap-1 text-rose-400">
                        <TrendingUp className="h-3.5 w-3.5" />
                        FSM CONVERGED
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-emerald-400">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        ACTIVE MISSION
                      </span>
                    )}
                  </span>
                </div>

                <div className="flex flex-col gap-1 rounded-xl border border-neutral-800/60 bg-neutral-900/50 p-2.5">
                  <span className="text-[10px] tracking-wider text-neutral-500 uppercase">
                    Storage Tier
                  </span>
                  <span className="font-medium text-neutral-200">
                    {activeScenario === "deletion"
                      ? "UNAVAILABLE (0 Tiers)"
                      : activeScenario === "session_b"
                        ? "WARM + COLD Ephemeral"
                        : activeScenario === "mcp"
                          ? "WARM Query (Stdio)"
                          : activeScenario === "reputation_fsm"
                            ? "WARM (α/β Distributions)"
                            : "5 Tiers Synced"}
                  </span>
                </div>

                <div className="flex flex-col gap-1 rounded-xl border border-neutral-800/60 bg-neutral-900/50 p-2.5">
                  <span className="text-[10px] tracking-wider text-neutral-500 uppercase">
                    Economic Ceiling
                  </span>
                  <span className="font-medium text-accent">
                    {activeScenario === "deletion"
                      ? "0.00 USDC (Saved)"
                      : activeScenario === "session_b"
                        ? "0.12 USDC (Beta Labs)"
                        : "0.20 USDC (Alpha Auth)"}
                  </span>
                </div>

                <div className="flex flex-col gap-1 rounded-xl border border-neutral-800/60 bg-neutral-900/50 p-2.5">
                  <span className="text-[10px] tracking-wider text-neutral-500 uppercase">
                    Base Sepolia Proof
                  </span>
                  <span className="truncate font-mono text-blue-400">
                    {activeScenario === "deletion"
                      ? "Zero Spend Intent"
                      : "0x8f2a...c4e1"}
                  </span>
                </div>
              </div>

              {/* Execution Detail Callout */}
              {activeScenario === "deletion" && (
                <div className="space-y-3 rounded-2xl border border-amber-800/40 bg-amber-950/20 p-4">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="h-5 w-5 text-amber-400" />
                    <span className="font-mono text-sm font-bold text-amber-300">
                      LOAD-BEARING DELETION INVARIANT TRIGGERED
                    </span>
                  </div>
                  <p className="font-mono text-xs leading-relaxed text-neutral-300">
                    SIBYL_PYTHON=&quot;&quot; — Environment variable missing or
                    memory bridge offline. Aura enforces a strict fail-closed
                    invariant: without verified counterparty reputation,
                    autonomous agents halt in{" "}
                    <code className="text-amber-300">run.blocked</code> before
                    signing spend intents.
                  </p>
                  <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-3 font-mono text-xs">
                    <div className="flex items-center justify-between border-b border-neutral-800 pb-1.5 text-[11px] text-neutral-500">
                      <span>$ pnpm demo:deletion-test</span>
                      <span className="font-bold text-emerald-400">
                        EXIT 0 (PASS)
                      </span>
                    </div>
                    <div className="pt-2 text-neutral-400">
                      Sequence: run.created → run.blocked
                    </div>
                    <div className="font-bold text-emerald-400">
                      ✓ PASS: Halting in run.blocked. Zero blind treasury spend.
                    </div>
                  </div>
                </div>
              )}

              {activeScenario === "session_a" && (
                <div className="space-y-3">
                  <div className="flex flex-col justify-between gap-3 rounded-2xl border border-neutral-800 bg-neutral-900/70 p-4 sm:flex-row sm:items-center">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="rounded border border-amber-500/30 bg-amber-500/20 px-2 py-0.5 font-mono text-[10px] font-semibold text-amber-300">
                          SESSION A: INITIAL PROPOSAL
                        </span>
                        <span className="text-xs text-neutral-400">
                          Evaluated: virtuals:agent:alpha vs virtuals:agent:beta
                        </span>
                      </div>
                      <p className="mt-1 text-sm font-medium text-white">
                        Alpha selected based on baseline score (0.50). 0.20 USDC
                        spend ceiling approved by human operator.
                      </p>
                    </div>
                    <div className="text-left sm:text-right">
                      <span className="font-mono text-[10px] text-neutral-400 uppercase">
                        ACP JOB ID
                      </span>
                      <span className="text-accent block font-mono text-xs font-bold">
                        acp_job_7f3a
                      </span>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 rounded-2xl border border-red-900/40 bg-red-950/20 p-3.5">
                    <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                    <div className="text-xs text-neutral-300">
                      <span className="font-semibold text-red-300">
                        Execution Failure Recorded:{" "}
                      </span>
                      Alpha returned invalid schema payload. Aura wrote failure
                      episode to Sibyl COLD journal (`recordEpisodeToSibyl`).
                      Alpha reliability updated to{" "}
                      <span className="font-bold text-red-300">0.33</span> (α=1,
                      β=2). Keccak256 salt committed to Base Sepolia.
                    </div>
                  </div>
                </div>
              )}

              {activeScenario === "session_b" && (
                <div className="space-y-3">
                  <div className="flex flex-col justify-between gap-3 rounded-2xl border border-blue-900/40 bg-blue-950/20 p-4 sm:flex-row sm:items-center">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="rounded border border-blue-500/30 bg-blue-500/20 px-2 py-0.5 font-mono text-[10px] font-semibold text-blue-300">
                          SESSION B: PROCESS RESTARTS &amp; DB WIPE
                        </span>
                        <span className="text-xs text-neutral-400">
                          PostgreSQL wiped via CASCADE • Sibyl SQLite survived
                        </span>
                      </div>
                      <p className="mt-1 text-sm font-medium text-white">
                        Fresh cold-start process queries Sibyl WARM memory. Alpha
                        is penalized (0.33); Beta Research (0.67) wins
                        procurement.
                      </p>
                    </div>
                    <div className="text-left sm:text-right">
                      <span className="font-mono text-[10px] text-neutral-400 uppercase">
                        Causal Delta
                      </span>
                      <span className="block font-mono text-sm font-bold text-emerald-400">
                        -0.35 USDC Saved
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-2 font-mono text-xs sm:grid-cols-3">
                    <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-2.5">
                      <span className="block text-[10px] text-neutral-500">
                        [01] COLD_START.RECALL
                      </span>
                      <span className="font-medium text-blue-400">
                        Sibyl memory.db intact
                      </span>
                    </div>
                    <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-2.5">
                      <span className="block text-[10px] text-neutral-500">
                        [02] REPUTATION.APPLIED
                      </span>
                      <span className="font-medium text-emerald-400">
                        Beta selected (0.67 vs 0.33)
                      </span>
                    </div>
                    <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-2.5">
                      <span className="block text-[10px] text-neutral-500">
                        [03] ACP.JOB_SETTLED
                      </span>
                      <span className="font-medium text-accent">
                        0.12 USDC completed
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {activeScenario === "base_sepolia" && (
                <div className="space-y-3 rounded-2xl border border-emerald-900/40 bg-emerald-950/20 p-4 font-mono text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-emerald-300">
                      ON-CHAIN CRYPTOGRAPHIC PROOF VERIFIED
                    </span>
                    <span className="text-blue-400">Base Sepolia: 84532</span>
                  </div>
                  <p className="text-neutral-300">
                    Salted Keccak256 hash committed:{" "}
                    <code className="text-accent">
                      0x8f2ac4e1792b51fae9238ddb29c488310c9e
                    </code>
                    . Counterparty trust verifiable on any EVM block explorer.
                  </p>
                </div>
              )}

              {activeScenario === "mcp" && (
                <div className="space-y-3 rounded-2xl border border-cyan-900/40 bg-cyan-950/20 p-4 font-mono text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-cyan-300">
                      ANTHROPIC MODEL CONTEXT PROTOCOL (MCP) BRIDGE
                    </span>
                    <span className="text-emerald-400">Verdict: ok</span>
                  </div>
                  <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-3">
                    <div className="text-accent">
                      Tool Call: memory_recall_counterparty(virtuals:agent:beta)
                    </div>
                    <div className="mt-1 text-neutral-300">
                      Result: &#123; reliability: 0.89, fsm: &quot;PREFERRED&quot;,
                      alpha: 18, beta: 2, episodes: 20 &#125;
                    </div>
                  </div>
                </div>
              )}

              {activeScenario === "reputation_fsm" && (
                <div className="space-y-3 rounded-2xl border border-rose-900/40 bg-rose-950/20 p-4 font-mono text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-rose-300">
                      BAYESIAN FINITE STATE MACHINE TRANSITION
                    </span>
                    <span className="text-emerald-400">Beta: PREFERRED</span>
                  </div>
                  <p className="text-neutral-300">
                    Alpha update: (α=1, β=2) → State: WATCH → BLOCKED. Beta
                    update: (α=18, β=2) → State: PREFERRED.
                  </p>
                </div>
              )}

              {/* Raw JSON Toggle and Actions Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-800 pt-3">
                <div className="flex items-center gap-2 font-mono text-xs">
                  <button
                    type="button"
                    onClick={() => setShowJson(!showJson)}
                    className="cursor-pointer text-accent underline hover:text-accent/80"
                  >
                    {showJson ? "Hide Raw JSON" : "Inspect Raw JSON"}
                  </button>
                  {showJson && (
                    <button
                      type="button"
                      onClick={() =>
                        handleCopyJson({
                          scenario: activeScenario,
                          mode: activeMode,
                          timestamp: 1788879502,
                          status: "VERIFIED",
                          network: "base-sepolia",
                          chainId: 84532,
                        })
                      }
                      className="flex cursor-pointer items-center gap-1 text-neutral-400 hover:text-white"
                    >
                      {copied ? (
                        <>
                          <Check className="h-3 w-3 text-emerald-400" />
                          <span className="text-emerald-400">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleResetZeroState}
                  className="cursor-pointer font-mono text-xs text-neutral-400 hover:text-white"
                >
                  ← New Prompt / Return to Zero-State
                </button>
              </div>

              {showJson && (
                <pre className="overflow-x-auto rounded-xl border border-neutral-800 bg-neutral-950 p-4 font-mono text-[11px] text-neutral-300">
                  {JSON.stringify(
                    {
                      scenario: activeScenario,
                      mode: activeMode,
                      runId: "run_7f3a2c",
                      timestamp: 1788879502,
                      event:
                        activeScenario === "deletion"
                          ? "run.blocked"
                          : "outcome.recorded",
                      candidate:
                        activeScenario === "deletion"
                          ? "UNAVAILABLE"
                          : activeScenario === "session_b"
                            ? "virtuals:agent:beta"
                            : "virtuals:agent:alpha",
                      prior_reliability:
                        activeScenario === "session_b" ? 0.5 : 0.89,
                      new_reliability:
                        activeScenario === "session_a"
                          ? 0.33
                          : activeScenario === "session_b"
                            ? 0.67
                            : 0.89,
                      bayesian: {
                        alpha: activeScenario === "session_a" ? 1 : 18,
                        beta: activeScenario === "session_a" ? 2 : 2,
                      },
                      cold_journal_hash:
                        "0x8f2ac4e1792b51fae9238ddb29c488310c9e",
                      on_chain: {
                        network: "base-sepolia",
                        chainId: 84532,
                        tx: "0x391b48f72ae402d1847c92b",
                      },
                    },
                    null,
                    2
                  )}
                </pre>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 6. Shell Bottom Metadata Rail (from shell-nav) */}
      <div className="flex flex-wrap items-center justify-between border-t border-neutral-800/80 bg-[#0c0b11] px-4 py-2.5 font-mono text-[11px] text-neutral-400 sm:px-6">
        <div className="flex items-center gap-2">
          <Code2 className="h-3 w-3 text-neutral-500" />
          <span>Freeze Commit: hackathon-freeze-1 (e789de7)</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-emerald-400">
            <Sparkles className="h-3 w-3" />
            SQLite memory.db Active
          </span>
          <span className="hidden text-neutral-600 sm:inline">•</span>
          <span className="hidden text-neutral-400 sm:inline">
            Zero Amnesia Invariant
          </span>
        </div>
      </div>
    </div>
  );
}

"use client";

import { LogoLoop, type LogoItem } from "@/components/logo-loop";
import {
  ArrowDownRight,
  CheckCircle2,
  ShieldAlert,
  Layers,
  Terminal,
  RotateCcw,
  Cpu,
  Code2,
  Sparkles,
} from "lucide-react";
import { motion, useMotionValue, useSpring } from "motion/react";
import Link from "next/link";
import { useRef, useState, type ReactNode, type MouseEvent } from "react";

const ease = [0.23, 1, 0.32, 1] as const;

const fadeInUp = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease } },
};

const fadeInScale = {
  hidden: { opacity: 0, scale: 0.98 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.5, ease } },
};

function PartnerLogo({
  name,
  category,
  icon,
}: {
  name: string;
  category: string;
  icon: ReactNode;
}): ReactNode {
  return (
    <div className="border-border bg-frame/90 text-foreground hover:border-accent/40 flex items-center gap-2.5 rounded-xl border px-4 py-2 shadow-xs backdrop-blur-xs transition-all dark:border-neutral-800 dark:bg-neutral-900/90 dark:text-neutral-100">
      <div className="bg-foreground text-background flex h-6 w-6 items-center justify-center rounded-md font-mono text-xs font-bold dark:bg-neutral-100 dark:text-neutral-950">
        {icon}
      </div>
      <div className="flex flex-col text-left">
        <span className="text-foreground text-xs leading-tight font-semibold tracking-tight dark:text-neutral-100">
          {name}
        </span>
        <span className="text-muted-foreground font-mono text-[9px] leading-none tracking-wider uppercase dark:text-neutral-400">
          {category}
        </span>
      </div>
    </div>
  );
}

const logos: LogoItem[] = [
  {
    node: (
      <PartnerLogo
        name="Virtuals Protocol"
        category="ACP Settlement"
        icon={<span className="text-accent font-bold">V</span>}
      />
    ),
    title: "Virtuals Protocol Agent Commerce Protocol",
  },
  {
    node: (
      <PartnerLogo
        name="Base Sepolia"
        category="Cryptographic Proof"
        icon={<span className="font-bold text-blue-500">B</span>}
      />
    ),
    title: "Base Sepolia On-Chain Memory Notarization",
  },
  {
    node: (
      <PartnerLogo
        name="Sibyl Labs"
        category="5-Tier Memory DB"
        icon={<span className="font-bold text-emerald-500">S</span>}
      />
    ),
    title: "Sibyl Labs Persistent Memory Engine",
  },
  {
    node: (
      <PartnerLogo
        name="Claude Code"
        category="MCP Multi-Agent"
        icon={<span className="font-bold text-orange-500">C</span>}
      />
    ),
    title: "Anthropic Claude Code MCP Integration",
  },
  {
    node: (
      <PartnerLogo
        name="TreasuryGuard AI"
        category="DAO Risk Pilot"
        icon={<span className="font-bold text-amber-500">TG</span>}
      />
    ),
    title: "TreasuryGuard AI Pilot Partner",
  },
  {
    node: (
      <PartnerLogo
        name="AutonomousProcure"
        category="Agent Commerce"
        icon={<span className="font-bold text-purple-500">AP</span>}
      />
    ),
    title: "AutonomousProcure Protocol Pilot",
  },
  {
    node: (
      <PartnerLogo
        name="Drizzle ORM"
        category="Event Store"
        icon={<span className="font-bold text-yellow-500">D</span>}
      />
    ),
    title: "Drizzle Immutable Event Logging",
  },
  {
    node: (
      <PartnerLogo
        name="Fastify Engine"
        category="Low-Latency API"
        icon={<span className="font-bold text-cyan-500">F</span>}
      />
    ),
    title: "Fastify SSE & MCP Bridge",
  },
];

const PARALLAX_INTENSITY = 20;

type ConsoleScenario = "session_a" | "session_b" | "deletion" | "mcp";

export function Hero(): ReactNode {
  const sectionRef = useRef<HTMLElement>(null);
  const [scenario, setScenario] = useState<ConsoleScenario>("session_a");
  const [showJson, setShowJson] = useState<boolean>(false);

  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const springConfig = { damping: 25, stiffness: 150 };
  const x = useSpring(mouseX, springConfig);
  const y = useSpring(mouseY, springConfig);

  const handleMouseMove = (e: MouseEvent<HTMLElement>) => {
    if (!sectionRef.current) return;
    if (window.innerWidth < 850) return;

    const rect = sectionRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const offsetX = (e.clientX - centerX) / (rect.width / 2);
    const offsetY = (e.clientY - centerY) / (rect.height / 2);

    mouseX.set(offsetX * PARALLAX_INTENSITY);
    mouseY.set(offsetY * PARALLAX_INTENSITY);
  };

  const handleMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
  };

  return (
    <section
      ref={sectionRef}
      className="relative isolate flex w-full flex-col"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* Background layer: vibrant BG.jpg across hero */}
      <motion.div
        className="absolute inset-0 -z-10 rounded-br-4xl rounded-bl-4xl bg-cover bg-center bg-no-repeat brightness-105 transition-opacity duration-500 min-[850px]:inset-2.5 min-[850px]:scale-105 dark:opacity-15 dark:brightness-50"
        style={{
          backgroundImage: "url(/BG.jpg)",
          x,
          y,
        }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_70%_50%_at_50%_15%,rgba(168,217,70,0.12),transparent_70%)] dark:bg-[radial-gradient(ellipse_70%_50%_at_50%_15%,rgba(168,217,70,0.08),transparent_70%)]"
        aria-hidden="true"
      />

      <div className="flex items-start justify-center px-6 pt-48 max-[850px]:pt-28">
        <motion.div
          className="flex max-w-4xl flex-col items-center text-center max-[850px]:w-full max-[850px]:items-start max-[850px]:text-left"
          initial={false}
          animate="visible"
        >
          <motion.div
            className="border-border bg-frame/90 text-foreground mb-6 inline-flex items-center gap-2 rounded-xl border py-1.5 pr-3 pl-4 font-mono text-xs font-medium shadow-xs backdrop-blur-xs sm:text-sm"
            variants={fadeInUp}
            transition={{ duration: 0.8, ease }}
          >
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
            <span>SIBYL MEMORY • BASE SEPOLIA • VIRTUALS ACP</span>
            <span className="text-accent">✦</span>
          </motion.div>

          <h1 className="text-foreground mb-6 text-7xl leading-[1.1] font-medium tracking-tight max-[850px]:text-4xl">
            <motion.span
              className="block"
              variants={fadeInUp}
              transition={{ duration: 0.8, ease }}
            >
              Autonomous Agents That
            </motion.span>
            <motion.span
              className="block"
              variants={fadeInUp}
              transition={{ duration: 0.8, ease }}
            >
              Never{" "}
              <span className="text-accent font-serif italic">Forget</span>
            </motion.span>
          </h1>

          <motion.p
            className="text-muted-foreground mb-8 max-w-2xl font-sans text-lg leading-relaxed max-[850px]:text-base"
            variants={fadeInUp}
            transition={{ duration: 0.8, ease }}
          >
            The autonomous agent command console and persistent relationship
            memory layer. Equip AI buyer fleets with Bayesian counterparty
            reputation, fail-closed economic guardrails, and on-chain
            cryptographic proof.
          </motion.p>

          <motion.div
            className="flex w-full max-w-md flex-wrap items-center justify-center gap-3"
            variants={fadeInScale}
            transition={{ duration: 0.8, ease }}
          >
            <Link
              href="/runs"
              className="group relative inline-flex cursor-pointer items-center max-[850px]:w-full"
            >
              <span className="bg-accent absolute inset-y-0 right-0 w-[calc(100%-2rem)] rounded-xl max-[850px]:w-full" />
              <span className="bg-foreground text-background relative z-10 rounded-xl px-6 py-3 text-center text-sm font-medium max-[850px]:flex-1">
                Explore Live Console
              </span>
              <span className="relative -left-px z-10 flex h-11 w-11 items-center justify-center rounded-xl text-black">
                <ArrowDownRight className="h-5 w-5 transition-transform duration-300 group-hover:-rotate-45" />
              </span>
            </Link>

            <a
              href="#deletion-test"
              className="border-border bg-frame/80 text-foreground hover:bg-frame hover:border-accent/40 rounded-xl border px-5 py-3 font-mono text-xs font-semibold shadow-xs transition-all"
            >
              Run Deletion Test →
            </a>
          </motion.div>
        </motion.div>
      </div>

      {/* Interactive Live Aura Console Telemetry */}
      <motion.div
        id="console-preview"
        className="relative mt-16 px-4 max-[850px]:mt-10 sm:px-6"
        initial={false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease }}
      >
        <div className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl border border-neutral-800 bg-[#0d0d12] font-sans text-neutral-100 shadow-2xl">
          {/* Mac-style Window Top Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-800/80 bg-[#14141a] px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-full bg-red-500/80" />
              <span className="inline-block h-3 w-3 rounded-full bg-yellow-500/80" />
              <span className="inline-block h-3 w-3 rounded-full bg-green-500/80" />
              <span className="ml-3 font-mono text-xs font-semibold tracking-wide text-neutral-300">
                AURA CONSOLE — MISSION TELEMETRY
              </span>
            </div>

            {/* Scenario Navigation Tabs */}
            <div className="flex flex-wrap items-center gap-1 rounded-xl border border-neutral-800 bg-neutral-900/90 p-1">
              <button
                type="button"
                onClick={() => {
                  setScenario("session_a");
                  setShowJson(false);
                }}
                className={`cursor-pointer rounded-lg px-2.5 py-1 font-mono text-xs transition-all ${
                  scenario === "session_a"
                    ? "bg-accent font-semibold text-black shadow-xs"
                    : "text-neutral-400 hover:text-neutral-200"
                }`}
              >
                ● Session A (Execution)
              </button>
              <button
                type="button"
                onClick={() => {
                  setScenario("session_b");
                  setShowJson(false);
                }}
                className={`cursor-pointer rounded-lg px-2.5 py-1 font-mono text-xs transition-all ${
                  scenario === "session_b"
                    ? "bg-blue-500 font-semibold text-white shadow-xs"
                    : "text-neutral-400 hover:text-neutral-200"
                }`}
              >
                ↻ Session B (Restart Memory)
              </button>
              <button
                type="button"
                onClick={() => {
                  setScenario("deletion");
                  setShowJson(false);
                }}
                className={`cursor-pointer rounded-lg px-2.5 py-1 font-mono text-xs transition-all ${
                  scenario === "deletion"
                    ? "bg-amber-500 font-semibold text-black shadow-xs"
                    : "text-neutral-400 hover:text-neutral-200"
                }`}
              >
                ▲ Deletion Test
              </button>
              <button
                type="button"
                onClick={() => {
                  setScenario("mcp");
                  setShowJson(false);
                }}
                className={`cursor-pointer rounded-lg px-2.5 py-1 font-mono text-xs transition-all ${
                  scenario === "mcp"
                    ? "bg-purple-500 font-semibold text-white shadow-xs"
                    : "text-neutral-400 hover:text-neutral-200"
                }`}
              >
                ⚡ Claude MCP
              </button>
            </div>
          </div>

          {/* Telemetry Status Bar */}
          <div className="grid grid-cols-2 gap-2 border-b border-neutral-800/60 bg-[#101016] p-4 font-mono text-xs sm:grid-cols-4">
            <div className="flex flex-col gap-1 rounded-lg border border-neutral-800/60 bg-neutral-900/50 p-2.5">
              <span className="text-[10px] tracking-wider text-neutral-500 uppercase">
                Mission State
              </span>
              <span className="flex items-center gap-1.5 font-semibold">
                {scenario === "deletion" ? (
                  <span className="flex items-center gap-1 text-amber-400">
                    <ShieldAlert className="h-3.5 w-3.5" />
                    BLOCKED (Fail-Closed)
                  </span>
                ) : scenario === "session_b" ? (
                  <span className="flex items-center gap-1 text-blue-400">
                    <RotateCcw className="h-3.5 w-3.5" />
                    RECOVERED (Post-Drop)
                  </span>
                ) : scenario === "mcp" ? (
                  <span className="flex items-center gap-1 text-purple-400">
                    <Cpu className="h-3.5 w-3.5" />
                    EXTERNAL RECALL
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-emerald-400">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    ACTIVE MISSION
                  </span>
                )}
              </span>
            </div>

            <div className="flex flex-col gap-1 rounded-lg border border-neutral-800/60 bg-neutral-900/50 p-2.5">
              <span className="text-[10px] tracking-wider text-neutral-500 uppercase">
                Sibyl Storage Tier
              </span>
              <span className="font-medium text-neutral-200">
                {scenario === "deletion"
                  ? "UNAVAILABLE (0 Tiers)"
                  : scenario === "session_b"
                    ? "WARM + COLD Ephemeral"
                    : scenario === "mcp"
                      ? "WARM Query (Stdio)"
                      : "5 Tiers Synced (HOT-ARCHIVE)"}
              </span>
            </div>

            <div className="flex flex-col gap-1 rounded-lg border border-neutral-800/60 bg-neutral-900/50 p-2.5">
              <span className="text-[10px] tracking-wider text-neutral-500 uppercase">
                Economic Ceiling
              </span>
              <span className="text-accent font-medium">
                {scenario === "deletion"
                  ? "0.00 USDC (Saved)"
                  : scenario === "session_b"
                    ? "0.12 USDC (Beta Labs)"
                    : scenario === "mcp"
                      ? "Policy Ceilings Bound"
                      : "0.20 USDC (Alpha Auth)"}
              </span>
            </div>

            <div className="flex flex-col gap-1 rounded-lg border border-neutral-800/60 bg-neutral-900/50 p-2.5">
              <span className="text-[10px] tracking-wider text-neutral-500 uppercase">
                Base Sepolia Proof
              </span>
              <span className="truncate font-mono text-blue-400">
                {scenario === "deletion"
                  ? "Zero Spend Intent"
                  : "0x8f2a...c4e1 (Notarized)"}
              </span>
            </div>
          </div>

          {/* Console Scenario Content */}
          <div className="space-y-5 p-5 sm:p-6">
            {scenario === "session_a" && (
              <div className="space-y-4">
                <div className="flex flex-col justify-between gap-3 rounded-xl border border-neutral-800 bg-neutral-900/70 p-4 sm:flex-row sm:items-center">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="rounded border border-amber-500/30 bg-amber-500/20 px-2 py-0.5 font-mono text-[10px] font-semibold text-amber-300">
                        SESSION A: INITIAL PROPOSAL
                      </span>
                      <span className="text-xs text-neutral-400">
                        Evaluated candidates: virtuals:agent:alpha vs
                        virtuals:agent:beta
                      </span>
                    </div>
                    <p className="mt-1.5 text-sm font-medium text-white">
                      Alpha selected based on baseline score (0.50). 0.20 USDC
                      spend ceiling approved by human operator.
                    </p>
                  </div>
                  <div className="text-left sm:text-right">
                    <span className="font-mono text-[10px] text-neutral-400 uppercase">
                      ACP Job ID
                    </span>
                    <span className="text-accent block font-mono text-xs font-bold">
                      acp_job_7f3a
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-xl border border-red-900/40 bg-red-950/20 p-3.5">
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

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <h2 className="flex items-center gap-1.5 font-mono text-xs tracking-wider text-neutral-400 uppercase">
                      <Layers className="text-accent h-3.5 w-3.5" />
                      Causal Execution Log
                    </h2>
                    <button
                      type="button"
                      onClick={() => setShowJson(!showJson)}
                      className="text-accent hover:text-accent/80 cursor-pointer font-mono text-[11px] underline"
                    >
                      {showJson ? "Hide JSON Payload" : "Inspect Raw JSON"}
                    </button>
                  </div>

                  {showJson ? (
                    <pre className="overflow-x-auto rounded-xl border border-neutral-800 bg-neutral-950 p-4 font-mono text-[11px] text-neutral-300">
                      {JSON.stringify(
                        {
                          runId: "run_7f3a2c",
                          event: "outcome.recorded",
                          candidate: "virtuals:agent:alpha",
                          verdict: "FAILED_VALIDATION",
                          prior_reliability: 0.5,
                          new_reliability: 0.33,
                          bayesian: { alpha: 1, beta: 2 },
                          cold_journal_hash: "0x8f2ac4e1792b...",
                          on_chain: {
                            network: "base-sepolia",
                            chainId: 84532,
                            tx: "0x391b48f72a...",
                          },
                        },
                        null,
                        2
                      )}
                    </pre>
                  ) : (
                    <div className="grid grid-cols-1 gap-2 font-mono text-xs sm:grid-cols-3">
                      <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-2.5">
                        <span className="block text-[10px] text-neutral-500">
                          [01] CANDIDATE.SCORED
                        </span>
                        <span className="font-medium text-neutral-200">
                          Alpha 0.50, Beta 0.40
                        </span>
                      </div>
                      <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-2.5">
                        <span className="block text-[10px] text-neutral-500">
                          [02] OUTCOME.FAILED
                        </span>
                        <span className="font-medium text-red-400">
                          Alpha schema invalid
                        </span>
                      </div>
                      <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-2.5">
                        <span className="block text-[10px] text-neutral-500">
                          [03] SIBYL.COMMITTED
                        </span>
                        <span className="text-accent font-medium">
                          Alpha reliability → 0.33
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {scenario === "session_b" && (
              <div className="space-y-4">
                <div className="flex flex-col justify-between gap-3 rounded-xl border border-blue-900/40 bg-blue-950/20 p-4 sm:flex-row sm:items-center">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="rounded border border-blue-500/30 bg-blue-500/20 px-2 py-0.5 font-mono text-[10px] font-semibold text-blue-300">
                        SESSION B: PROCESS RESTARTE &amp; DB WIPE
                      </span>
                      <span className="text-xs text-neutral-400">
                        PostgreSQL runs dropped via CASCADE • Sibyl SQLite
                        survived
                      </span>
                    </div>
                    <p className="mt-1.5 text-sm font-medium text-white">
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

                <div className="rounded-xl border border-neutral-800 bg-neutral-900/70 p-3.5 font-mono text-xs">
                  <div className="flex items-center justify-between text-neutral-400">
                    <span>Counterfactual Projection:</span>
                    <span className="text-accent font-semibold">
                      Without Memory: Alpha wins (blind failure)
                    </span>
                  </div>
                  <div className="mt-1 text-neutral-200">
                    → With Aura Sibyl Memory: Beta chosen. Mission succeeded in
                    1.4s. Treasury protected.
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2 font-mono text-xs sm:grid-cols-3">
                  <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-2.5">
                    <span className="block text-[10px] text-neutral-500">
                      [01] COLD_START.RECALL
                    </span>
                    <span className="font-medium text-blue-400">
                      Sibyl memory.db intact
                    </span>
                  </div>
                  <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-2.5">
                    <span className="block text-[10px] text-neutral-500">
                      [02] REPUTATION.APPLIED
                    </span>
                    <span className="font-medium text-emerald-400">
                      Beta selected (0.67 vs 0.33)
                    </span>
                  </div>
                  <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-2.5">
                    <span className="block text-[10px] text-neutral-500">
                      [03] ACP.JOB_SETTLED
                    </span>
                    <span className="text-accent font-medium">
                      0.12 USDC completed
                    </span>
                  </div>
                </div>
              </div>
            )}

            {scenario === "deletion" && (
              <div className="space-y-4">
                <div className="space-y-2 rounded-xl border border-amber-800/40 bg-amber-950/20 p-4">
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
                    autonomous agents halt before signing spend intents.
                  </p>
                </div>

                <div className="space-y-1.5 rounded-xl border border-neutral-800 bg-neutral-950 p-4 font-mono text-xs">
                  <div className="flex items-center justify-between border-b border-neutral-800/80 pb-2 text-neutral-500">
                    <span className="flex items-center gap-1.5">
                      <Terminal className="text-accent h-3.5 w-3.5" />$ pnpm
                      demo:deletion-test
                    </span>
                    <span className="font-semibold text-emerald-400">
                      EXIT 0 (PASS)
                    </span>
                  </div>
                  <div className="pt-2 text-neutral-400">
                    [HALF A] Running Mission with SIBYL MEMORY REMOVED:
                  </div>
                  <div className="text-amber-400">
                    -&gt; Opening Result : BLOCKED
                  </div>
                  <div className="text-neutral-400">
                    -&gt; Event Sequence : run.created -&gt; run.blocked
                  </div>
                  <div className="font-bold text-emerald-400">
                    ✓ PASS: Halting in run.blocked. Fail-closed invariant
                    preserved. Zero blind treasury spend.
                  </div>
                </div>
              </div>
            )}

            {scenario === "mcp" && (
              <div className="space-y-4">
                <div className="flex flex-col justify-between gap-3 rounded-xl border border-purple-900/40 bg-purple-950/20 p-4 sm:flex-row sm:items-center">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="rounded border border-purple-500/30 bg-purple-500/20 px-2 py-0.5 font-mono text-[10px] font-semibold text-purple-300">
                        ANTHROPIC MCP SERVER
                      </span>
                      <span className="text-xs text-neutral-400">
                        External client: Claude Code / Cursor / Swarm Worker
                      </span>
                    </div>
                    <p className="mt-1.5 text-sm font-medium text-white">
                      External AI models query Aura memory tools via stdio or
                      HTTP to inspect reputation and past failure episodes
                      before proposing spend.
                    </p>
                  </div>
                  <div className="text-left sm:text-right">
                    <span className="font-mono text-[10px] text-neutral-400 uppercase">
                      Protocol
                    </span>
                    <span className="block font-mono text-xs font-bold text-purple-400">
                      Model Context Protocol
                    </span>
                  </div>
                </div>

                <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-3.5 font-mono text-xs text-neutral-300">
                  <div className="flex items-center justify-between border-b border-neutral-800/80 pb-1.5 text-[11px] text-neutral-500">
                    <span>Tool Invocation: memory_recall_counterparty</span>
                    <span className="text-emerald-400">Verdict: ok</span>
                  </div>
                  <div className="text-accent mt-2">
                    Input: {`{ counterpartyKey: "virtuals:agent:beta" }`}
                  </div>
                  <div className="mt-1 text-neutral-400">
                    Output:{" "}
                    {`{ reliability: 0.89, fsm: "PREFERRED", alpha: 18, beta: 2, episodes: 20 }`}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Console Bottom Metadata Bar */}
          <div className="flex flex-wrap items-center justify-between border-t border-neutral-800/80 bg-[#0a0a0f] px-6 py-2.5 font-mono text-[11px] text-neutral-400">
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
              <span className="hidden text-neutral-500 sm:inline">
                Base Sepolia: chainId 84532
              </span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Partner Logo Loop */}
      <motion.div
        className="pt-20 pb-12"
        initial={false}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, ease }}
      >
        <div className="mb-6 text-center">
          <span className="text-muted-foreground font-mono text-xs font-medium tracking-widest uppercase">
            Powering Autonomous Agent Infrastructure Across
          </span>
        </div>
        <LogoLoop logos={logos} speed={40} logoHeight={46} gap={36} />
      </motion.div>
    </section>
  );
}

"use client";

import { motion } from "motion/react";
import {
  CheckCircle2,
  AlertTriangle,
  GitCompare,
  Play,
  Pause,
  History,
  ArrowRight,
  Clock,
  ShieldCheck,
} from "lucide-react";
import { useState, type ReactNode } from "react";

const EASE = [0.23, 1, 0.32, 1] as const;

type PlayheadMode = "live" | "paused" | "history";

export function CounterfactualMatrix(): ReactNode {
  const [activeMode, setActiveMode] = useState<PlayheadMode>("live");

  return (
    <section
      id="replay-matrix"
      className="bg-frame border-border/60 w-full border-t border-b px-6 py-24 dark:border-neutral-800/80 dark:bg-[#0e0d13]"
    >
      <div className="mx-auto max-w-5xl">
        <div className="mb-12 text-center">
          <div className="bg-accent/15 border-accent/30 text-foreground mb-3 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-xs font-medium">
            <GitCompare className="text-accent h-3.5 w-3.5" />
            <span>CAUSAL REPLAY &amp; COUNTERFACTUAL MATRIX</span>
          </div>
          <h2 className="text-foreground text-3xl font-medium tracking-tight sm:text-5xl">
            Pause it. Replay it. Understand it.
          </h2>
          <p className="text-muted-foreground mx-auto mt-3 max-w-2xl text-sm leading-relaxed sm:text-base">
            Historical events stay ordered and labelled. Live state and recorded
            history are never conflated. See how persistent memory alters
            autonomous economic actions.
          </p>
        </div>

        {/* Playhead Mode Selector */}
        <div className="mb-10 flex flex-col items-center justify-center gap-3">
          <div className="bg-muted border-border inline-flex rounded-2xl border p-1.5 dark:border-neutral-800 dark:bg-neutral-900">
            <button
              type="button"
              onClick={() => setActiveMode("live")}
              className={`flex cursor-pointer items-center gap-2 rounded-xl px-4 py-2 font-mono text-xs transition-all sm:text-sm ${
                activeMode === "live"
                  ? "bg-foreground text-background font-semibold shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              LIVE{" "}
              <span className="hidden text-[10px] opacity-70 sm:inline">
                (following newest event)
              </span>
            </button>
            <button
              type="button"
              onClick={() => setActiveMode("paused")}
              className={`flex cursor-pointer items-center gap-2 rounded-xl px-4 py-2 font-mono text-xs transition-all sm:text-sm ${
                activeMode === "paused"
                  ? "bg-foreground text-background font-semibold shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Pause className="h-3.5 w-3.5" />
              PAUSED{" "}
              <span className="hidden text-[10px] opacity-70 sm:inline">
                (playhead held at boundary)
              </span>
            </button>
            <button
              type="button"
              onClick={() => setActiveMode("history")}
              className={`flex cursor-pointer items-center gap-2 rounded-xl px-4 py-2 font-mono text-xs transition-all sm:text-sm ${
                activeMode === "history"
                  ? "bg-foreground text-background font-semibold shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <History className="h-3.5 w-3.5" />
              HISTORY{" "}
              <span className="hidden text-[10px] opacity-70 sm:inline">
                (immutable timestamps)
              </span>
            </button>
          </div>

          {/* Dynamic Playhead Annotation Banner */}
          <div className="border-border bg-muted/60 inline-flex items-center gap-2 rounded-xl border px-3.5 py-1.5 font-mono text-xs text-neutral-600 dark:border-neutral-800/80 dark:bg-neutral-900/60 dark:text-neutral-400">
            <Clock className="text-accent h-3.5 w-3.5" />
            {activeMode === "live" && (
              <span>
                Streaming active SSE events from Base Sepolia &amp; Virtuals ACP
              </span>
            )}
            {activeMode === "paused" && (
              <span className="font-medium text-amber-500 dark:text-amber-400">
                Playhead held at Stage 2: Economic Boundary. Human sign-off
                required.
              </span>
            )}
            {activeMode === "history" && (
              <span>
                Immutable event stream audited from PostgreSQL and Sibyl COLD
                journal
              </span>
            )}
          </div>
        </div>

        {/* Counterfactual Pair Cards */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Side A: Memory Available */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, ease: EASE }}
            className="flex flex-col justify-between rounded-3xl border border-neutral-800 bg-[#111016] p-6 text-white shadow-xl sm:p-8"
          >
            <div>
              <div className="mb-4 flex items-center justify-between">
                <span className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/20 px-3 py-1 font-mono text-xs font-bold text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  MEMORY AVAILABLE
                </span>
                <span className="font-mono text-[11px] text-neutral-400">
                  Sibyl WARM Active
                </span>
              </div>

              <h3 className="mb-2 text-xl font-medium tracking-tight sm:text-2xl">
                Beta Research Selected
              </h3>
              <p className="mb-6 text-xs leading-relaxed text-neutral-400 sm:text-sm">
                Alpha previously failed a relevant research job on Virtuals ACP.
                With persistent memory loaded, Aura derives a Bayesian
                confidence score of 0.89 for Beta and automatically switches
                providers.
              </p>

              <div className="space-y-3 rounded-2xl border border-neutral-800/80 bg-neutral-950/80 p-4 font-mono text-xs">
                <div className="flex items-center justify-between text-neutral-300">
                  <span className="text-[10px] text-neutral-500 uppercase">
                    Counterparty
                  </span>
                  <span className="text-accent font-semibold">
                    virtuals:agent:beta
                  </span>
                </div>
                <div className="flex items-center justify-between text-neutral-300">
                  <span className="text-[10px] text-neutral-500 uppercase">
                    Spend Allocation
                  </span>
                  <span className="font-bold text-emerald-400">0.12 USDC</span>
                </div>
                <div className="flex items-center justify-between text-neutral-300">
                  <span className="text-[10px] text-neutral-500 uppercase">
                    Decision State
                  </span>
                  <span className="text-white">Approved &amp; Settled</span>
                </div>
                <div className="flex items-center justify-between text-neutral-300">
                  <span className="text-[10px] text-neutral-500 uppercase">
                    On-Chain Hash
                  </span>
                  <span className="text-blue-400">
                    Base Sepolia 0x8f2a...c4e1
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between border-t border-neutral-800/80 pt-4 font-mono text-[11px] text-neutral-400">
              <span>Sequence: 7 events committed</span>
              <span className="flex items-center gap-1 font-semibold text-emerald-400">
                <ShieldCheck className="h-3 w-3" />
                Optimal Outcome
              </span>
            </div>
          </motion.div>

          {/* Side B: Memory Unavailable */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, ease: EASE }}
            className="flex flex-col justify-between rounded-3xl border border-amber-900/40 bg-[#120f0a] p-6 text-white shadow-xl sm:p-8"
          >
            <div>
              <div className="mb-4 flex items-center justify-between">
                <span className="flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/20 px-3 py-1 font-mono text-xs font-bold text-amber-400">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  MEMORY UNAVAILABLE
                </span>
                <span className="font-mono text-[11px] text-neutral-400">
                  Fail-Closed Invariant
                </span>
              </div>

              <h3 className="mb-2 text-xl font-medium tracking-tight text-amber-100 sm:text-2xl">
                No Blind Decision
              </h3>
              <p className="mb-6 text-xs leading-relaxed text-neutral-400 sm:text-sm">
                Required memory could not be loaded (
                <code className="font-mono text-xs text-amber-300">
                  SIBYL_PYTHON=&quot;&quot;
                </code>
                ). Rather than guessing or blindly spending treasury funds on an
                unknown agent, Aura halts execution in
                <code className="ml-1 font-mono text-xs text-amber-300">
                  run.blocked
                </code>
                .
              </p>

              <div className="space-y-3 rounded-2xl border border-neutral-800/80 bg-neutral-950/80 p-4 font-mono text-xs">
                <div className="flex items-center justify-between text-neutral-300">
                  <span className="text-[10px] text-neutral-500 uppercase">
                    Counterparty
                  </span>
                  <span className="text-neutral-500">— (Halted)</span>
                </div>
                <div className="flex items-center justify-between text-neutral-300">
                  <span className="text-[10px] text-neutral-500 uppercase">
                    Spend Allocation
                  </span>
                  <span className="font-bold text-neutral-400">
                    0.00 USDC (Saved)
                  </span>
                </div>
                <div className="flex items-center justify-between text-neutral-300">
                  <span className="text-[10px] text-neutral-500 uppercase">
                    Decision State
                  </span>
                  <span className="font-semibold text-amber-400">
                    run.blocked
                  </span>
                </div>
                <div className="flex items-center justify-between text-neutral-300">
                  <span className="text-[10px] text-neutral-500 uppercase">
                    Guardrail Reason
                  </span>
                  <span className="text-neutral-400">
                    Missing Relationship Memory
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between border-t border-neutral-800/80 pt-4 font-mono text-[11px] text-neutral-400">
              <span>Sequence: run.created → run.blocked</span>
              <span className="font-medium text-amber-400">
                Treasury Protected
              </span>
            </div>
          </motion.div>
        </div>

        {/* Audit Callout Footer */}
        <div className="border-border bg-muted/60 text-muted-foreground mt-8 flex flex-col items-center justify-between gap-4 rounded-2xl border p-4 font-mono text-xs sm:flex-row dark:border-neutral-800 dark:bg-neutral-900/60">
          <div className="flex items-center gap-2">
            <span className="bg-accent h-2 w-2 rounded-full" />
            <span>
              The counterfactual comparison is verifiable across restart
              boundaries.
            </span>
          </div>
          <a
            href="https://github.com/musashi0x/aura_memory"
            target="_blank"
            rel="noopener noreferrer"
            className="text-foreground hover:text-accent flex items-center gap-1 font-semibold transition-colors"
          >
            Review scripts/demo-deletion-test.ts{" "}
            <ArrowRight className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    </section>
  );
}

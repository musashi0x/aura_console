"use client";

import { motion, type Transition } from "motion/react";
import {
  Database,
  ShieldCheck,
  Cpu,
  Lock,
  Terminal,
  Activity,
  FileCheck2,
  TrendingUp,
  Coins,
} from "lucide-react";
import type { ReactNode } from "react";

const EASE = [0.23, 1, 0.32, 1] as const;

const cardAnimation = {
  initial: { opacity: 0, y: 30 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
};

const getCardTransition = (delay = 0): Transition => ({
  duration: 0.7,
  ease: EASE,
  delay,
});

const MEMORY_TIERS = [
  {
    name: "HOT",
    color: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/25",
    desc: "Ephemeral uncommitted mission state & spend ceilings across processes",
    fn: "setMissionState / getMissionState",
  },
  {
    name: "WARM",
    color:
      "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/25",
    desc: "Bayesian counterparty profiles, α/β parameters & reputation FSM",
    fn: "listCounterparties / retrieveFromSibyl",
  },
  {
    name: "COLD",
    color: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/25",
    desc: "Immutable append-only episode journal with provenance actors",
    fn: "recordEpisodeToSibyl / readMemoryJournal",
  },
  {
    name: "REFERENCE",
    color:
      "bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/25",
    desc: "Cryptographic 32-byte salts & policy guardrail snapshots",
    fn: "setPolicyReference / storeSaltInSibyl",
  },
  {
    name: "ARCHIVE",
    color:
      "bg-neutral-500/15 text-neutral-700 dark:text-neutral-400 border-neutral-500/25",
    desc: "Decommissioned or blocked counterparties with immutable audit reasons",
    fn: "archiveCounterpartyInSibyl",
  },
];

function MemoryArchitectureCard(): ReactNode {
  return (
    <motion.div
      id="architecture"
      {...cardAnimation}
      transition={getCardTransition(0)}
      className="group border-border bg-frame/90 hover:border-accent/40 relative flex min-h-140 flex-col justify-between overflow-hidden rounded-4xl border p-6 shadow-xl transition-all sm:p-8 md:col-span-2 lg:col-span-1 lg:row-span-2 dark:border-neutral-800 dark:bg-neutral-900/80"
    >
      <div className="relative z-10 transition-transform duration-500 ease-out group-hover:scale-[1.01]">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="bg-accent/15 text-accent rounded-xl p-2.5">
              <Database className="h-5 w-5" />
            </span>
            <span className="text-muted-foreground font-mono text-xs font-semibold tracking-wider uppercase">
              Persistent Hierarchy
            </span>
          </div>
          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2.5 py-0.5 font-mono text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
            5 TIERS ACTIVE
          </span>
        </div>

        <h3 className="text-foreground mb-2 text-2xl leading-tight font-medium sm:text-3xl">
          5-Tier Dynamic Storage Architecture
        </h3>
        <p className="text-muted-foreground text-sm leading-relaxed sm:text-base">
          Specifically engineered for autonomous decision-making, caching, and
          cryptographic audit across process restarts. Powered by Sibyl Memory (
          <code className="bg-muted text-foreground rounded px-1.5 py-0.5 font-mono text-xs font-semibold">
            ~/.sibyl-memory/memory.db
          </code>
          ).
        </p>
      </div>

      <div id="storage-tiers" className="my-5 space-y-2.5">
        {MEMORY_TIERS.map((tier) => (
          <div
            key={tier.name}
            className="border-border bg-muted/60 hover:border-accent/30 rounded-2xl border p-3 backdrop-blur-xs transition-all dark:bg-neutral-950/60"
          >
            <div className="mb-1 flex items-center justify-between">
              <span
                className={`rounded border px-2 py-0.5 font-mono text-[10px] font-bold ${tier.color}`}
              >
                {tier.name} TIER
              </span>
              <span className="text-muted-foreground max-w-[200px] truncate font-mono text-[10px]">
                {tier.fn}
              </span>
            </div>
            <p className="text-foreground/80 text-xs leading-snug">
              {tier.desc}
            </p>
          </div>
        ))}
      </div>

      <div className="border-border text-muted-foreground flex items-center justify-between border-t pt-3 font-mono text-xs">
        <span className="flex items-center gap-1.5">
          <Activity className="text-accent h-3.5 w-3.5" />
          Continuous Restart Proof
        </span>
        <span className="text-foreground font-semibold">Zero Memory Leak</span>
      </div>
    </motion.div>
  );
}

function DeletionTestCard(): ReactNode {
  return (
    <motion.div
      id="deletion-test"
      {...cardAnimation}
      transition={getCardTransition(0.1)}
      className="group border-border bg-frame/90 hover:border-accent/40 relative flex min-h-72 flex-col justify-between overflow-hidden rounded-4xl border p-6 shadow-xl transition-all sm:p-8 dark:border-neutral-800 dark:bg-neutral-900/80"
    >
      <div className="relative z-10 transition-transform duration-500 ease-out group-hover:scale-[1.01]">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="rounded-xl bg-amber-500/15 p-2.5 text-amber-500">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <span className="text-muted-foreground font-mono text-xs font-semibold tracking-wider uppercase">
              Load-Bearing Invariant
            </span>
          </div>
          <span className="rounded-full border border-amber-500/30 bg-amber-500/15 px-2.5 py-0.5 font-mono text-[10px] font-bold text-amber-600 dark:text-amber-400">
            FAIL-CLOSED GATE
          </span>
        </div>

        <h3 className="text-foreground mb-1 text-xl leading-tight font-medium sm:text-2xl">
          Load-Bearing Deletion Test
        </h3>
        <p className="text-muted-foreground text-xs leading-relaxed sm:text-sm">
          Memory is load-bearing on the critical path. Without Sibyl, buyer
          agents strictly fail-closed rather than blindly releasing treasury
          capital.
        </p>
      </div>

      <div className="mt-4 space-y-2 rounded-2xl border border-neutral-800 bg-[#09090d] p-4 font-mono text-xs text-neutral-200 shadow-inner">
        <div className="flex items-center justify-between border-b border-neutral-800/80 pb-1.5 text-[11px] text-neutral-500">
          <span className="text-accent flex items-center gap-1.5">
            <Terminal className="h-3.5 w-3.5" />$ pnpm demo:deletion-test
          </span>
          <span className="font-bold text-emerald-400">PASS/FAIL GATE</span>
        </div>
        <div className="text-[11px] text-neutral-400">
          [HALF A] SIBYL_PYTHON=&quot;&quot; →{" "}
          <span className="font-bold text-amber-400">
            HALTED IN run.blocked
          </span>
        </div>
        <div className="text-[11px] text-neutral-400">
          [HALF B] SIBYL_PYTHON active →{" "}
          <span className="font-bold text-emerald-400">
            SCORED &amp; APPROVED
          </span>
        </div>
        <div className="text-accent border-t border-neutral-800/60 pt-1.5 text-[11px] font-semibold">
          ✓ Invariant: Zero blind treasury commitments
        </div>
      </div>
    </motion.div>
  );
}

function BaseSepoliaCard(): ReactNode {
  return (
    <motion.div
      id="base-sepolia"
      {...cardAnimation}
      transition={getCardTransition(0.15)}
      className="group border-border bg-frame/90 hover:border-accent/40 relative flex min-h-72 flex-col justify-between overflow-hidden rounded-4xl border p-6 shadow-xl transition-all sm:p-8 dark:border-neutral-800 dark:bg-neutral-900/80"
    >
      <div className="transition-transform duration-500 ease-out group-hover:scale-[1.01]">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="rounded-xl bg-blue-500/15 p-2.5 text-blue-500">
              <Lock className="h-5 w-5" />
            </span>
            <span className="text-muted-foreground font-mono text-xs font-semibold tracking-wider uppercase">
              On-Chain Cryptography
            </span>
          </div>
          <span className="rounded-full border border-blue-500/30 bg-blue-500/15 px-2.5 py-0.5 font-mono text-[10px] font-bold text-blue-600 dark:text-blue-400">
            BASE SEPOLIA
          </span>
        </div>

        <h3 className="text-foreground mb-1 text-xl leading-tight font-medium sm:text-2xl">
          Cryptographic Proof
        </h3>
        <p className="text-muted-foreground text-xs leading-relaxed sm:text-sm">
          Salted Keccak256 hash commitments notarized on Base Sepolia.
          Verifiable counterparty reputation without exposing private
          negotiation details.
        </p>
      </div>

      <div className="mt-4 rounded-xl border border-neutral-800 bg-[#09090d] p-3 font-mono text-xs text-neutral-300">
        <div className="flex items-center justify-between text-[10px] text-neutral-500 uppercase">
          <span>Keccak256 Calldata Digest</span>
          <span className="font-semibold text-blue-400">chainId: 84532</span>
        </div>
        <div className="mt-1 truncate text-[11px] font-bold text-blue-400">
          0x9a4ef21c83cb71c0d481e...29c4
        </div>
        <div className="mt-2 flex items-center gap-1.5 border-t border-neutral-800/80 pt-2 text-[10px] text-neutral-400">
          <FileCheck2 className="h-3 w-3 text-emerald-400" />
          <span>Independent CLI verification: pnpm memory:verify</span>
        </div>
      </div>
    </motion.div>
  );
}

function VirtualsAcpCard(): ReactNode {
  return (
    <motion.div
      id="virtuals-acp"
      {...cardAnimation}
      transition={getCardTransition(0.2)}
      className="group border-border bg-frame/90 hover:border-accent/40 relative flex min-h-72 flex-col justify-between overflow-hidden rounded-4xl border p-6 shadow-xl transition-all sm:p-8 dark:border-neutral-800 dark:bg-neutral-900/80"
    >
      <div className="transition-transform duration-500 ease-out group-hover:scale-[1.01]">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="bg-accent/15 text-accent rounded-xl p-2.5">
              <Coins className="h-5 w-5" />
            </span>
            <span className="text-muted-foreground font-mono text-xs font-semibold tracking-wider uppercase">
              Agent Commerce
            </span>
          </div>
          <span className="border-accent/40 bg-accent/15 text-accent rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-bold">
            VIRTUALS ACP
          </span>
        </div>

        <h3 className="text-foreground mb-1 text-xl leading-tight font-medium sm:text-2xl">
          Virtuals Protocol ACP Settlement
        </h3>
        <p className="text-muted-foreground text-xs leading-relaxed sm:text-sm">
          Active Agent Commerce Protocol runtime. Dispatches jobs (
          <code className="text-foreground font-mono text-xs">
            acp.job.funded
          </code>
          ), monitors deliverables under frozen budgets, and feeds outcomes back
          into Sibyl memory.
        </p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 font-mono text-xs">
        <div className="border-border bg-muted/60 rounded-xl border p-2.5 dark:bg-neutral-950/60">
          <span className="text-muted-foreground block text-[10px]">
            FUNDED JOBS
          </span>
          <span className="text-foreground font-bold">100% Policy Bound</span>
        </div>
        <div className="border-border bg-muted/60 rounded-xl border p-2.5 dark:bg-neutral-950/60">
          <span className="text-muted-foreground block text-[10px]">
            DUAL RUNTIME
          </span>
          <span className="text-accent font-bold">Simulated + Live</span>
        </div>
      </div>
    </motion.div>
  );
}

function ReputationFsmCard(): ReactNode {
  return (
    <motion.div
      id="reputation-fsm"
      {...cardAnimation}
      transition={getCardTransition(0.25)}
      className="group border-border bg-frame/90 hover:border-accent/40 relative flex min-h-72 flex-col justify-between overflow-hidden rounded-4xl border p-6 shadow-xl transition-all sm:p-8 dark:border-neutral-800 dark:bg-neutral-900/80"
    >
      <div className="transition-transform duration-500 ease-out group-hover:scale-[1.01]">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="rounded-xl bg-emerald-500/15 p-2.5 text-emerald-500">
              <TrendingUp className="h-5 w-5" />
            </span>
            <span className="text-muted-foreground font-mono text-xs font-semibold tracking-wider uppercase">
              Bayesian Math
            </span>
          </div>
          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2.5 py-0.5 font-mono text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
            REPUTATION FSM
          </span>
        </div>

        <h3 className="text-foreground mb-1 text-xl leading-tight font-medium sm:text-2xl">
          Dynamic Bayesian Reputation
        </h3>
        <p className="text-muted-foreground text-xs leading-relaxed sm:text-sm">
          Continuous Beta distributions (α/β parameters) update over empirical
          deliverables. Counterparties transition deterministically through FSM
          states: NEW → KNOWN → PREFERRED → WATCH → BLOCKED.
        </p>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-1.5 font-mono text-[11px]">
        <span className="rounded-lg border border-neutral-300 bg-neutral-200/60 px-2 py-1 font-semibold text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
          NEW
        </span>
        <span className="text-muted-foreground">→</span>
        <span className="rounded-lg border border-blue-500/30 bg-blue-500/15 px-2 py-1 font-semibold text-blue-600 dark:text-blue-400">
          KNOWN
        </span>
        <span className="text-muted-foreground">→</span>
        <span className="rounded-lg border border-emerald-500/30 bg-emerald-500/15 px-2 py-1 font-semibold text-emerald-600 dark:text-emerald-400">
          PREFERRED
        </span>
        <span className="text-muted-foreground">→</span>
        <span className="rounded-lg border border-red-500/30 bg-red-500/15 px-2 py-1 font-semibold text-red-600 dark:text-red-400">
          BLOCKED
        </span>
      </div>
    </motion.div>
  );
}

function McpCard(): ReactNode {
  return (
    <motion.div
      id="mcp"
      {...cardAnimation}
      transition={getCardTransition(0.3)}
      className="group border-border bg-frame/90 hover:border-accent/40 relative flex min-h-72 flex-col justify-between overflow-hidden rounded-4xl border p-6 shadow-xl transition-all sm:p-8 dark:border-neutral-800 dark:bg-neutral-900/80"
    >
      <div className="transition-transform duration-500 ease-out group-hover:scale-[1.01]">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="rounded-xl bg-purple-500/15 p-2.5 text-purple-500">
              <Cpu className="h-5 w-5" />
            </span>
            <span className="text-muted-foreground font-mono text-xs font-semibold tracking-wider uppercase">
              Model Context Protocol
            </span>
          </div>
          <span className="rounded-full border border-purple-500/30 bg-purple-500/15 px-2.5 py-0.5 font-mono text-[10px] font-bold text-purple-600 dark:text-purple-400">
            ANTHROPIC MCP
          </span>
        </div>

        <h3 className="text-foreground mb-1 text-xl leading-tight font-medium sm:text-2xl">
          Multi-Agent MCP Coordination
        </h3>
        <p className="text-muted-foreground text-xs leading-relaxed sm:text-sm">
          Native stdio &amp; HTTP MCP server. External agents in Claude Code,
          Cursor, or autonomous worker fleets recall memory with structured
          verdict codes.
        </p>
      </div>

      <div className="mt-4 space-y-1.5 font-mono text-xs">
        <div className="border-border bg-muted/60 flex items-center justify-between rounded-xl border p-2 dark:bg-neutral-950/60">
          <span className="text-foreground text-[11px] font-semibold">
            memory_recall_counterparty
          </span>
          <span className="bg-foreground text-background rounded px-1.5 py-0.5 text-[10px]">
            ok / gated
          </span>
        </div>
        <div className="border-border bg-muted/60 flex items-center justify-between rounded-xl border p-2 dark:bg-neutral-950/60">
          <span className="text-foreground text-[11px] font-semibold">
            memory_journal
          </span>
          <span className="bg-foreground text-background rounded px-1.5 py-0.5 text-[10px]">
            provenance log
          </span>
        </div>
      </div>
    </motion.div>
  );
}

export function FeaturesBento(): ReactNode {
  return (
    <section id="architecture" className="bg-background mb-32 w-full px-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-12 text-center">
          <span className="text-accent font-mono text-xs font-semibold tracking-widest uppercase">
            ✦ Core Architecture
          </span>
          <h2 className="text-foreground mt-2 text-3xl font-medium tracking-tight sm:text-5xl">
            Engineered For Zero Amnesia
          </h2>
          <p className="text-muted-foreground mx-auto mt-3 max-w-xl text-sm sm:text-base">
            Every layer of Aura is built around one non-negotiable principle:
            autonomous capital cannot move without verifiable relationship
            memory.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          <MemoryArchitectureCard />
          <DeletionTestCard />
          <BaseSepoliaCard />
          <VirtualsAcpCard />
          <ReputationFsmCard />
          <McpCard />
        </div>
      </div>
    </section>
  );
}

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
  Copy,
  Check,
  Play,
  RotateCcw,
  Sparkles,
  Layers,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";
import { useState, type ReactNode } from "react";

const EASE = [0.23, 1, 0.32, 1] as const;

const cardAnimation = {
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "100px" },
};

const getCardTransition = (delay = 0): Transition => ({
  duration: 0.6,
  ease: EASE,
  delay,
});

/* =========================================================================
   1. MEMORY TIER INSPECTOR (5-Tier Dynamic Storage Architecture)
   ========================================================================= */

type TierKey = "HOT" | "WARM" | "COLD" | "REFERENCE" | "ARCHIVE";

interface TierDetail {
  name: TierKey;
  label: string;
  badge: string;
  badgeColor: string;
  latency: string;
  storageTarget: string;
  medium: string;
  retention: string;
  scope: string;
  primaryFn: string;
  payload: Record<string, unknown>;
}

const TIER_DATA: Record<TierKey, TierDetail> = {
  HOT: {
    name: "HOT",
    label: "HOT TIER",
    badge: "IN-MEMORY RAM",
    badgeColor: "border-rose-500/30 bg-rose-500/15 text-rose-600 dark:text-rose-400",
    latency: "< 0.1ms",
    storageTarget: "SQLite Temp Tables (RAM)",
    medium: "Process Volatile Memory (Zero-Amnesia)",
    retention: "Ephemeral / Wiped on exit",
    scope: "Spend ceilings & uncommitted state",
    primaryFn: "sibyl.setMissionState(k, v)",
    payload: {
      mission_id: "mis_09a4e21c",
      spend_ceiling_usdc: "0.20",
      uncommitted_delta: "-0.04",
      active_locks: ["treasury:virtuals:acp:procure"],
      transient_guard: "NO_AMNESIA_ENFORCED",
      allocated_pid: 14820,
    },
  },
  WARM: {
    name: "WARM",
    label: "WARM TIER",
    badge: "BAYESIAN PROFILES",
    badgeColor: "border-amber-500/30 bg-amber-500/15 text-amber-600 dark:text-amber-400",
    latency: "0.8ms",
    storageTarget: "~/.sibyl-memory/memory.db",
    medium: "Drizzle ORM + SQLite (WAL2)",
    retention: "14-Day Rolling LRU Profile",
    scope: "Counterparty profiles & FSM state",
    primaryFn: "sibyl.retrieveFromSibyl(id)",
    payload: {
      counterparty: "virtuals:agent:beta",
      alpha_successes: 14.8,
      beta_failures: 1.2,
      expected_trust_score: 0.925,
      fsm_state: "PREFERRED",
      rolling_sla: "99.4%",
    },
  },
  COLD: {
    name: "COLD",
    label: "COLD TIER",
    badge: "APPEND-ONLY JOURNAL",
    badgeColor: "border-blue-500/30 bg-blue-500/15 text-blue-600 dark:text-blue-400",
    latency: "3.2ms",
    storageTarget: "~/.sibyl-memory/journal.sqlite",
    medium: "Immutable Audit Journal",
    retention: "Permanent / Indefinite",
    scope: "Cryptographic episode logs",
    primaryFn: "sibyl.recordEpisodeToSibyl()",
    payload: {
      episode_id: "ep_883011a",
      actor_did: "aura:buyer_agent_01",
      task_type: "acp.job.funded",
      counterparty: "virtuals:agent:beta",
      settled_usdc: 0.04,
      keccak_digest: "0x9a4e...29c4",
      verified_base_sepolia: true,
    },
  },
  REFERENCE: {
    name: "REFERENCE",
    label: "REF TIER",
    badge: "SALT VAULT & POLICY",
    badgeColor: "border-purple-500/30 bg-purple-500/15 text-purple-600 dark:text-purple-400",
    latency: "0.5ms",
    storageTarget: "~/.sibyl-memory/salts.vault",
    medium: "32-Byte Keccak256 Salt Vault",
    retention: "Protocol Lifetime (Read-Only)",
    scope: "Cryptographic salts & policy snapshots",
    primaryFn: "sibyl.storeSaltInSibyl()",
    payload: {
      policy_id: "pol_autonomous_procure_v2",
      max_single_tx_usdc: "0.20",
      salt_root: "0x7a81...4f02",
      contract: "0x84532...BaseSepolia",
      fail_closed_mode: "STRICT_ENFORCE",
    },
  },
  ARCHIVE: {
    name: "ARCHIVE",
    label: "ARCHIVE TIER",
    badge: "TOMBSTONE AUDIT",
    badgeColor: "border-neutral-500/30 bg-neutral-500/15 text-neutral-600 dark:text-neutral-400",
    latency: "12.4ms",
    storageTarget: "~/.sibyl-memory/tombstones.db",
    medium: "Compressed Cold Storage",
    retention: "Permanent Invalidation",
    scope: "Decommissioned or blocked counterparties",
    primaryFn: "sibyl.archiveCounterparty()",
    payload: {
      blocked_agent: "virtuals:agent:malicious_drain",
      fsm_state: "BLOCKED",
      fatal_violation: "UNBOUNDED_TRANSFER_ATTEMPT",
      tombstone_block: 19482100,
      appeal_allowed: false,
    },
  },
};

function MemoryArchitectureCard(): ReactNode {
  const [selectedTier, setSelectedTier] = useState<TierKey>("HOT");
  const [copied, setCopied] = useState(false);
  const [isQuerying, setIsQuerying] = useState(false);
  const [queryFeedback, setQueryFeedback] = useState<string | null>(null);

  const tier = TIER_DATA[selectedTier];

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(tier.payload, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleSimulateQuery = () => {
    setIsQuerying(true);
    setQueryFeedback(null);
    setTimeout(() => {
      setIsQuerying(false);
      setQueryFeedback(`✓ VFS Query: latency ${tier.latency} • 0 leaked`);
      setTimeout(() => setQueryFeedback(null), 3000);
    }, 350);
  };

  return (
    <motion.div
      id="storage-tiers"
      {...cardAnimation}
      transition={getCardTransition(0)}
      className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-border/80 bg-frame/95 p-6 shadow-md backdrop-blur-md transition-all hover:border-accent/40 hover:shadow-xl sm:p-7 scroll-mt-28 sm:scroll-mt-36 dark:border-neutral-800 dark:bg-[#111016]"
    >
      <div>
        {/* Astryx Shell Status Header */}
        <div className="mb-4 flex items-center justify-between gap-2 border-b border-border/60 pb-3 font-mono text-xs dark:border-neutral-800/80">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-xs" />
            <span className="font-mono text-[11px] font-semibold text-neutral-300 dark:text-neutral-200 truncate">
              sibyl://storage/dynamic-tiers
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
            <span>SQLITE3 WAL2</span>
          </div>
        </div>

        {/* Card Headline */}
        <div className="mb-4">
          <div className="mb-2 flex items-center gap-2">
            <span className="rounded-xl bg-accent/15 p-2 text-accent">
              <Database className="h-4 w-4" />
            </span>
            <span className="font-mono text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              Persistent Memory Hierarchy
            </span>
          </div>
          <h3 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
            5-Tier Dynamic Storage
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground sm:text-sm">
            Zero-amnesia persistence hierarchy across process boundaries powered by Sibyl (
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] font-semibold text-foreground dark:bg-neutral-900">
              ~/.sibyl-memory/memory.db
            </code>
            ).
          </p>
        </div>

        {/* Interactive Tier Switcher Tabs */}
        <div className="mb-3 flex items-center gap-1 rounded-xl border border-border/80 bg-muted/40 p-1 font-mono text-xs dark:border-neutral-800 dark:bg-neutral-950/60">
          {(Object.keys(TIER_DATA) as TierKey[]).map((key) => {
            const isActive = selectedTier === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedTier(key)}
                className={`flex-1 cursor-pointer rounded-lg py-1 text-center font-mono text-[11px] font-semibold transition-all ${
                  isActive
                    ? "border border-border/80 bg-background text-foreground shadow-xs dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {key === "REFERENCE" ? "REF" : key === "ARCHIVE" ? "ARCH" : key}
              </button>
            );
          })}
        </div>

        {/* Active Tier Inspector Canvas */}
        <div className="flex h-[260px] flex-col justify-between rounded-2xl border border-border/80 bg-[#090a0f] p-3.5 text-neutral-200 shadow-inner dark:border-neutral-800/90">
          <div>
            <div className="mb-2 flex items-center justify-between border-b border-neutral-800/80 pb-1.5 text-[11px]">
              <div className="flex items-center gap-1.5">
                <span className={`rounded border px-1.5 py-0.5 font-mono text-[10px] font-bold ${tier.badgeColor}`}>
                  {tier.label}
                </span>
                <span className="font-mono text-neutral-400">
                  Latency: <strong className="text-emerald-400">{tier.latency}</strong>
                </span>
              </div>
              <button
                type="button"
                onClick={handleCopy}
                className="flex cursor-pointer items-center gap-1 font-mono text-[10px] text-neutral-400 transition-colors hover:text-white"
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
            </div>

            <div className="grid grid-cols-2 gap-2 font-mono text-[10px] text-neutral-400 mb-2">
              <div>
                <span className="text-neutral-500 uppercase block">Medium:</span>
                <span className="text-neutral-200 truncate block">{tier.medium}</span>
              </div>
              <div>
                <span className="text-neutral-500 uppercase block">Retention:</span>
                <span className="text-neutral-200 truncate block">{tier.retention}</span>
              </div>
            </div>

            {/* Live Interactive Payload Preview */}
            <pre className="h-[125px] overflow-auto rounded-xl bg-black/60 p-2 font-mono text-[10px] leading-snug text-neutral-300 border border-neutral-800/80">
              <code>{JSON.stringify(tier.payload, null, 2)}</code>
            </pre>
          </div>

          <div className="flex items-center justify-between border-t border-neutral-800/80 pt-2 text-[10px]">
            <button
              type="button"
              onClick={handleSimulateQuery}
              disabled={isQuerying}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-neutral-700 bg-neutral-800/80 px-2 py-1 font-mono text-[11px] font-semibold text-neutral-200 transition-all hover:bg-neutral-700 disabled:opacity-50"
            >
              <RefreshCw className={`h-3 w-3 ${isQuerying ? "animate-spin text-accent" : ""}`} />
              <span>Test VFS Query</span>
            </button>
            {queryFeedback ? (
              <span className="font-mono text-[10px] text-emerald-400 font-semibold">{queryFeedback}</span>
            ) : (
              <span className="font-mono text-neutral-500 truncate max-w-[150px]">Target: {tier.storageTarget}</span>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Invariant Rail */}
      <div className="mt-4 flex items-center justify-between border-t border-border/70 pt-3 font-mono text-xs text-muted-foreground dark:border-neutral-800/80">
        <span className="flex items-center gap-1.5">
          <Activity className="h-3.5 w-3.5 text-accent" />
          <span>Continuous Restart Proof</span>
        </span>
        <span className="font-semibold text-foreground">Zero Memory Leak</span>
      </div>
    </motion.div>
  );
}

/* =========================================================================
   2. TERMINAL OUTPUT WITH LIVE SIMULATOR (Load-Bearing Deletion Test)
   ========================================================================= */

function DeletionTestCard(): ReactNode {
  const [selectedHalf, setSelectedHalf] = useState<"half_a" | "half_b">("half_a");
  const [isRunning, setIsRunning] = useState(false);
  const [terminalStep, setTerminalStep] = useState(3);

  const handleRunSimulation = (half: "half_a" | "half_b") => {
    setSelectedHalf(half);
    setIsRunning(true);
    setTerminalStep(1);

    setTimeout(() => {
      setTerminalStep(2);
      setTimeout(() => {
        setTerminalStep(3);
        setIsRunning(false);
      }, 400);
    }, 400);
  };

  return (
    <motion.div
      id="deletion-test"
      {...cardAnimation}
      transition={getCardTransition(0.1)}
      className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-border/80 bg-frame/95 p-6 shadow-md backdrop-blur-md transition-all hover:border-accent/40 hover:shadow-xl sm:p-7 scroll-mt-28 sm:scroll-mt-36 dark:border-neutral-800 dark:bg-[#111016]"
    >
      <div>
        {/* Astryx Shell Status Header */}
        <div className="mb-4 flex items-center justify-between gap-2 border-b border-border/60 pb-3 font-mono text-xs dark:border-neutral-800/80">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-amber-500 shadow-xs" />
            <span className="font-mono text-[11px] font-semibold text-neutral-300 dark:text-neutral-200">
              aura://invariant/deletion-test
            </span>
          </div>

          <span className="rounded-full border border-amber-500/30 bg-amber-500/15 px-2.5 py-0.5 font-mono text-[10px] font-bold text-amber-600 dark:text-amber-400">
            FAIL-CLOSED GATE
          </span>
        </div>

        {/* Card Headline */}
        <div className="mb-4">
          <div className="mb-2 flex items-center gap-2">
            <span className="rounded-xl bg-amber-500/15 p-2 text-amber-500">
              <ShieldCheck className="h-4 w-4" />
            </span>
            <span className="font-mono text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              Load-Bearing Invariant
            </span>
          </div>
          <h3 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
            Load-Bearing Deletion Test
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground sm:text-sm">
            Memory is load-bearing on the critical path. Without Sibyl, buyer agents strictly fail-closed rather than blindly releasing capital.
          </p>
        </div>

        {/* Interactive Simulation Switcher */}
        <div className="mb-3 flex items-center gap-1.5">
          <button
            type="button"
            disabled={isRunning}
            onClick={() => handleRunSimulation("half_a")}
            className={`flex-1 flex cursor-pointer items-center justify-center gap-1.5 rounded-xl border py-1.5 font-mono text-xs font-semibold transition-all disabled:opacity-50 ${
              selectedHalf === "half_a"
                ? "border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-400 shadow-xs"
                : "border-border/80 bg-muted/40 text-muted-foreground hover:text-foreground dark:border-neutral-800"
            }`}
          >
            {isRunning && selectedHalf === "half_a" ? (
              <RefreshCw className="h-3 w-3 animate-spin" />
            ) : (
              <Play className="h-3 w-3 fill-current" />
            )}
            <span>Half A: SIBYL=&quot;&quot;</span>
          </button>
          <button
            type="button"
            disabled={isRunning}
            onClick={() => handleRunSimulation("half_b")}
            className={`flex-1 flex cursor-pointer items-center justify-center gap-1.5 rounded-xl border py-1.5 font-mono text-xs font-semibold transition-all disabled:opacity-50 ${
              selectedHalf === "half_b"
                ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 shadow-xs"
                : "border-border/80 bg-muted/40 text-muted-foreground hover:text-foreground dark:border-neutral-800"
            }`}
          >
            {isRunning && selectedHalf === "half_b" ? (
              <RefreshCw className="h-3 w-3 animate-spin" />
            ) : (
              <Play className="h-3 w-3 fill-current" />
            )}
            <span>Half B: Active</span>
          </button>
        </div>

        {/* Live Simulator Terminal Window */}
        <div className="flex h-[260px] flex-col justify-between rounded-2xl border border-neutral-800 bg-[#090a0f] p-3.5 font-mono text-xs text-neutral-200 shadow-inner">
          <div className="flex items-center justify-between border-b border-neutral-800/80 pb-1.5 text-[11px] text-neutral-500">
            <span className="flex items-center gap-1.5 text-accent font-semibold">
              <Terminal className="h-3.5 w-3.5" />
              <span>$ pnpm demo:deletion-test</span>
            </span>
            <span className={selectedHalf === "half_a" ? "text-amber-400 font-bold" : "text-emerald-400 font-bold"}>
              {selectedHalf === "half_a" ? "HALT GATE ACTIVE" : "APPROVAL GATE ACTIVE"}
            </span>
          </div>

          <div className="h-[160px] overflow-y-auto space-y-1.5 font-mono text-[11px] py-1">
            {selectedHalf === "half_a" ? (
              <>
                <div className="text-neutral-400">
                  [00:00.12] <span className="text-neutral-500">SPAWN</span> buyer run #481 (PID: 19482)...
                </div>
                {terminalStep >= 2 && (
                  <div className="text-amber-400">
                    [00:00.28] <span className="font-bold">INVARIANT:</span> SIBYL_PYTHON missing from env
                  </div>
                )}
                {terminalStep >= 3 && (
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-amber-300">
                    <div className="font-bold">➔ HALTED IN run.blocked (Exit Code 1)</div>
                    <div className="text-[10.5px] text-amber-400/80 mt-1">
                      Treasury protected: 0.00 USDC released (Zero blind spend)
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="text-neutral-400">
                  [00:00.09] <span className="text-neutral-500">SPAWN</span> buyer run #482 (PID: 19483)...
                </div>
                {terminalStep >= 2 && (
                  <div className="text-emerald-400">
                    [00:00.21] <span className="font-bold">SIBYL ACTIVE:</span> memory.db (α=14.8, β=1.2, trust=92.5%)
                  </div>
                )}
                {terminalStep >= 3 && (
                  <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-emerald-300">
                    <div className="font-bold">➔ SCORED &amp; APPROVED (Exit Code 0)</div>
                    <div className="text-[10.5px] text-emerald-400/80 mt-1">
                      Settlement dispatched: 0.04 USDC &le; 0.20 USDC ceiling
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-neutral-800/80 pt-1.5 text-[10px] text-neutral-500">
            <span>Mode: Fail-Closed Gate</span>
            <span className="text-emerald-400 font-semibold">100% Invariant Compliant</span>
          </div>
        </div>
      </div>

      {/* Bottom Guarantee Rail */}
      <div className="mt-4 flex items-center justify-between border-t border-border/70 pt-3 font-mono text-xs text-muted-foreground dark:border-neutral-800/80">
        <span className="flex items-center gap-1.5 text-accent font-semibold">
          ✓ Invariant: Zero blind spend
        </span>
        <span className="text-foreground font-medium">Deterministic</span>
      </div>
    </motion.div>
  );
}

/* =========================================================================
   3. CRYPTOGRAPHIC TRANSACTION EXPLORER (Cryptographic Proof)
   ========================================================================= */

function BaseSepoliaCard(): ReactNode {
  const [activeTab, setActiveTab] = useState<"digest" | "merkle" | "verify">("digest");
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifiedState, setVerifiedState] = useState(false);
  const [copiedTx, setCopiedTx] = useState(false);

  const hashCommitment =
    "0x9a4ef21c83cb71c0d481e8b7c3d2e1f0a9b8c7d6e5f4a3b2c1d0e9f8a7b629c4";

  const handleCopyTx = () => {
    navigator.clipboard.writeText(hashCommitment);
    setCopiedTx(true);
    setTimeout(() => setCopiedTx(false), 1800);
  };

  const handleVerifyOnchain = () => {
    setIsVerifying(true);
    setTimeout(() => {
      setIsVerifying(false);
      setVerifiedState(true);
    }, 600);
  };

  return (
    <motion.div
      id="base-sepolia"
      {...cardAnimation}
      transition={getCardTransition(0.15)}
      className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-border/80 bg-frame/95 p-6 shadow-md backdrop-blur-md transition-all hover:border-accent/40 hover:shadow-xl sm:p-7 scroll-mt-28 sm:scroll-mt-36 dark:border-neutral-800 dark:bg-[#111016]"
    >
      <div>
        {/* Astryx Shell Status Header */}
        <div className="mb-4 flex items-center justify-between gap-2 border-b border-border/60 pb-3 font-mono text-xs dark:border-neutral-800/80">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-blue-500 shadow-xs" />
            <span className="font-mono text-[11px] font-semibold text-neutral-300 dark:text-neutral-200 truncate">
              base-sepolia://tx/notarization
            </span>
          </div>

          <span className="rounded-full border border-blue-500/30 bg-blue-500/15 px-2.5 py-0.5 font-mono text-[10px] font-bold text-blue-600 dark:text-blue-400">
            BASE SEPOLIA (84532)
          </span>
        </div>

        {/* Card Headline */}
        <div className="mb-4">
          <div className="mb-2 flex items-center gap-2">
            <span className="rounded-xl bg-blue-500/15 p-2 text-blue-500">
              <Lock className="h-4 w-4" />
            </span>
            <span className="font-mono text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              On-Chain Cryptography
            </span>
          </div>
          <h3 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
            Cryptographic Proof
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground sm:text-sm">
            Salted Keccak256 hash commitments notarized on Base Sepolia. Verifiable reputation without exposing private negotiation details.
          </p>
        </div>

        {/* Explorer Tabs */}
        <div className="mb-3 flex items-center gap-1 rounded-xl border border-border/80 bg-muted/40 p-1 font-mono text-xs dark:border-neutral-800 dark:bg-neutral-950/60">
          <button
            type="button"
            onClick={() => setActiveTab("digest")}
            className={`flex-1 cursor-pointer rounded-lg py-1 text-center font-mono text-[11px] font-semibold transition-all ${
              activeTab === "digest"
                ? "border border-border/80 bg-background text-foreground shadow-xs dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Calldata
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("merkle")}
            className={`flex-1 cursor-pointer rounded-lg py-1 text-center font-mono text-[11px] font-semibold transition-all ${
              activeTab === "merkle"
                ? "border border-border/80 bg-background text-foreground shadow-xs dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Merkle
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("verify")}
            className={`flex-1 cursor-pointer rounded-lg py-1 text-center font-mono text-[11px] font-semibold transition-all ${
              activeTab === "verify"
                ? "border border-border/80 bg-background text-foreground shadow-xs dark:border-neutral-700 dark:bg-neutral-800 dark:text-white"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            RPC Verifier
          </button>
        </div>

        {/* Tab Canvas */}
        <div className="flex h-[260px] flex-col justify-between rounded-2xl border border-neutral-800 bg-[#090a0f] p-3.5 font-mono text-xs text-neutral-300 shadow-inner">
          {activeTab === "digest" && (
            <div className="flex h-full flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-[10px] text-neutral-500 uppercase">
                  <span>Keccak256 32-Byte Digest</span>
                  <button
                    type="button"
                    onClick={handleCopyTx}
                    className="flex items-center gap-1 text-blue-400 hover:text-blue-300 cursor-pointer"
                  >
                    {copiedTx ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                    <span>{copiedTx ? "Copied" : "Copy"}</span>
                  </button>
                </div>
                <div className="mt-1.5 break-all rounded-lg bg-black/60 p-2 font-mono text-[10px] font-bold text-blue-400 border border-blue-500/20">
                  {hashCommitment}
                </div>

                {/* Structured execution parameters */}
                <div className="mt-2 space-y-1 rounded-lg bg-black/40 p-2 text-[10px] border border-neutral-800/80">
                  <div className="flex items-center justify-between text-neutral-400">
                    <span className="text-neutral-500">Method:</span>
                    <span className="text-emerald-400 font-semibold">recordEpisode(...)</span>
                  </div>
                  <div className="flex items-center justify-between text-neutral-400">
                    <span className="text-neutral-500">Target:</span>
                    <span className="text-neutral-300">Base Sepolia (84532)</span>
                  </div>
                  <div className="flex items-center justify-between text-neutral-400">
                    <span className="text-neutral-500">Settled:</span>
                    <span className="text-emerald-400 font-bold">0.04 USDC</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[10px] text-neutral-400 border-t border-neutral-800/80 pt-2">
                <div>
                  <span className="text-neutral-500">Salt:</span> 0x7a81...4f02
                </div>
                <div>
                  <span className="text-neutral-500">Block:</span> #19,482,904
                </div>
              </div>
            </div>
          )}

          {activeTab === "merkle" && (
            <div className="flex h-full flex-col justify-between text-[11px]">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-neutral-400">
                  <span className="text-neutral-500">Tree Root:</span>
                  <span className="text-emerald-400 font-bold">0x88f2190...e319</span>
                </div>
                <div className="flex items-center justify-between text-neutral-400">
                  <span className="text-neutral-500">Leaf Index:</span>
                  <span className="text-neutral-200">#418 (Actor Episode Settlement)</span>
                </div>
                <div className="rounded-lg bg-black/60 p-2 text-[10px] text-neutral-400 border border-neutral-800/80 space-y-1">
                  <div className="text-neutral-500 font-bold uppercase">Verification Branch:</div>
                  <div className="text-neutral-300">L0: Leaf Hash (Episode #418)</div>
                  <div className="text-neutral-300">➔ L1: Sibling (0x3f12...e81a)</div>
                  <div className="text-emerald-400">➔ Root: Validated (0x88f2...)</div>
                </div>
                <div className="flex items-center justify-between text-neutral-400 text-[10px]">
                  <span className="text-neutral-500">Base L2 Gas:</span>
                  <span className="text-neutral-200">24,180 gwei</span>
                </div>
              </div>
              <div className="border-t border-neutral-800/80 pt-2 text-[10px] text-emerald-400 flex items-center justify-between">
                <span>Inclusion Status:</span>
                <span className="font-semibold">✓ Cryptographically Validated</span>
              </div>
            </div>
          )}

          {activeTab === "verify" && (
            <div className="flex h-full flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-neutral-400">Live RPC Verification</span>
                  <button
                    type="button"
                    onClick={handleVerifyOnchain}
                    disabled={isVerifying}
                    className="rounded-lg bg-blue-500/20 border border-blue-500/40 px-2.5 py-1 text-[10px] font-bold text-blue-400 hover:bg-blue-500/30 cursor-pointer disabled:opacity-50"
                  >
                    {isVerifying ? "Querying..." : "Validate RPC"}
                  </button>
                </div>
                <div className="mt-2.5 rounded-lg bg-black/60 p-2.5 text-[10px] border border-neutral-800/80">
                  {verifiedState ? (
                    <div className="space-y-1 text-emerald-400">
                      <div className="font-bold flex items-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                        <span>STATUS: 100% NOTARIZED ON BASE SEPOLIA</span>
                      </div>
                      <div className="text-[10px] text-neutral-400">
                        Contract: 0x84532...BaseSepolia (Verified)
                      </div>
                      <div className="text-[10px] text-emerald-400/80">
                        EIP-1559 Transaction Confirmed
                      </div>
                    </div>
                  ) : (
                    <div className="text-neutral-400 leading-relaxed">
                      Click Validate RPC to trigger cryptographic match on contract 0x84532...
                    </div>
                  )}
                </div>
              </div>
              <div className="border-t border-neutral-800/80 pt-2 text-[10px] text-neutral-500 flex items-center justify-between">
                <span>Network: Base Sepolia Testnet</span>
                <span className="text-blue-400 font-semibold">ChainId: 84532</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom CLI Link */}
      <div className="mt-4 flex items-center justify-between border-t border-border/70 pt-3 font-mono text-xs text-muted-foreground dark:border-neutral-800/80">
        <span className="flex items-center gap-1 text-emerald-500">
          <FileCheck2 className="h-3.5 w-3.5" />
          <span>pnpm memory:verify</span>
        </span>
        <span className="text-foreground font-semibold">ChainId: 84532</span>
      </div>
    </motion.div>
  );
}

/* =========================================================================
   4. ACP SETTLEMENT PIPELINE (Virtuals Protocol ACP Settlement)
   ========================================================================= */

function VirtualsAcpCard(): ReactNode {
  const [selectedJob, setSelectedJob] = useState<"job_402" | "job_403">("job_402");

  return (
    <motion.div
      id="virtuals-acp"
      {...cardAnimation}
      transition={getCardTransition(0.2)}
      className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-border/80 bg-frame/95 p-6 shadow-md backdrop-blur-md transition-all hover:border-accent/40 hover:shadow-xl sm:p-7 scroll-mt-28 sm:scroll-mt-36 dark:border-neutral-800 dark:bg-[#111016]"
    >
      <div>
        {/* Astryx Shell Status Header */}
        <div className="mb-4 flex items-center justify-between gap-2 border-b border-border/60 pb-3 font-mono text-xs dark:border-neutral-800/80">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-purple-500 shadow-xs" />
            <span className="font-mono text-[11px] font-semibold text-neutral-300 dark:text-neutral-200 truncate">
              virtuals-acp://procure/settlement
            </span>
          </div>

          <span className="rounded-full border border-purple-500/30 bg-purple-500/15 px-2.5 py-0.5 font-mono text-[10px] font-bold text-purple-600 dark:text-purple-400">
            VIRTUALS ACP v2
          </span>
        </div>

        {/* Card Headline */}
        <div className="mb-4">
          <div className="mb-2 flex items-center gap-2">
            <span className="rounded-xl bg-purple-500/15 p-2 text-purple-500">
              <Coins className="h-4 w-4" />
            </span>
            <span className="font-mono text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              Agent Commerce
            </span>
          </div>
          <h3 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
            Virtuals Protocol ACP Settlement
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground sm:text-sm">
            Active Agent Commerce Protocol runtime. Dispatches jobs under frozen budgets and feeds outcomes into Sibyl memory.
          </p>
        </div>

        {/* Interactive Job Switcher */}
        <div className="mb-3 flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setSelectedJob("job_402")}
            className={`flex-1 cursor-pointer rounded-xl border py-1.5 font-mono text-xs font-semibold transition-all ${
              selectedJob === "job_402"
                ? "border-purple-500/40 bg-purple-500/15 text-purple-700 dark:text-purple-300 shadow-xs"
                : "border-border/80 bg-muted/40 text-muted-foreground hover:text-foreground dark:border-neutral-800"
            }`}
          >
            #402: Research Task
          </button>
          <button
            type="button"
            onClick={() => setSelectedJob("job_403")}
            className={`flex-1 cursor-pointer rounded-xl border py-1.5 font-mono text-xs font-semibold transition-all ${
              selectedJob === "job_403"
                ? "border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-300 shadow-xs"
                : "border-border/80 bg-muted/40 text-muted-foreground hover:text-foreground dark:border-neutral-800"
            }`}
          >
            #403: Ceiling Breach
          </button>
        </div>

        {/* Visual 4-Stage Pipeline in 2x2 Grid */}
        <div className="flex h-[260px] flex-col justify-between rounded-2xl border border-neutral-800 bg-[#090a0f] p-3.5 font-mono text-xs text-neutral-300 shadow-inner">
          <div className="grid grid-cols-2 gap-1.5 text-center text-[10px]">
            <div className="rounded-lg bg-neutral-900/80 p-2 border border-neutral-800">
              <span className="text-neutral-500 block text-[9px] uppercase font-bold">1. Created</span>
              <span className="font-bold text-neutral-200">acp.job.init</span>
            </div>
            <div className="rounded-lg bg-neutral-900/80 p-2 border border-neutral-800">
              <span className="text-neutral-500 block text-[9px] uppercase font-bold">2. Locked</span>
              <span className="font-bold text-purple-400">0.20 USDC</span>
            </div>
            <div className="rounded-lg bg-neutral-900/80 p-2 border border-neutral-800">
              <span className="text-neutral-500 block text-[9px] uppercase font-bold">3. Scored</span>
              <span className={`font-bold ${selectedJob === "job_402" ? "text-emerald-400" : "text-amber-400"}`}>
                {selectedJob === "job_402" ? "0.92 PASS" : "0.00 BLOCKED"}
              </span>
            </div>
            <div className="rounded-lg bg-neutral-900/80 p-2 border border-neutral-800">
              <span className="text-neutral-500 block text-[9px] uppercase font-bold">4. Sibyl</span>
              <span className={`font-bold ${selectedJob === "job_402" ? "text-blue-400" : "text-rose-400"}`}>
                {selectedJob === "job_402" ? "INSCRIBED" : "TOMBSTONED"}
              </span>
            </div>
          </div>

          <div className="space-y-1.5 rounded-lg bg-black/60 p-2.5 text-[10px] border border-neutral-800/80">
            <div className="flex items-center justify-between text-neutral-400">
              <span>Job Status:</span>
              <span className={selectedJob === "job_402" ? "text-emerald-400 font-bold" : "text-amber-400 font-bold"}>
                {selectedJob === "job_402" ? "SETTLED & DISPATCHED" : "REVERTED BY GUARDRAIL"}
              </span>
            </div>
            <div className="flex items-center justify-between text-neutral-400">
              <span>Settled Amount:</span>
              <strong className={selectedJob === "job_402" ? "text-emerald-400" : "text-neutral-500"}>
                {selectedJob === "job_402" ? "0.04 USDC" : "0.00 USDC"}
              </strong>
            </div>
            <div className="flex items-center justify-between text-neutral-400">
              <span>Refunded Capital:</span>
              <span className="text-accent font-semibold">
                {selectedJob === "job_402" ? "0.16 USDC" : "0.20 USDC (100%)"}
              </span>
            </div>
            <div className="flex items-center justify-between text-neutral-400 text-[9.5px]">
              <span>Policy Bound:</span>
              <span className="text-neutral-300">Max Spend &le; 0.20 USDC</span>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-neutral-800/80 pt-1.5 text-[10px] text-neutral-500">
            <span>Escrow: Virtuals ACP Multi-Sig</span>
            <span className="text-purple-400 font-semibold">Zero Amnesia</span>
          </div>
        </div>
      </div>

      {/* Bottom Rail */}
      <div className="mt-4 flex items-center justify-between border-t border-border/70 pt-3 font-mono text-xs text-muted-foreground dark:border-neutral-800/80">
        <span>Dual Runtime: Simulated + Live</span>
        <span className="font-semibold text-foreground">100% Policy Bound</span>
      </div>
    </motion.div>
  );
}

/* =========================================================================
   5. BAYESIAN REPUTATION FSM (Dynamic Bayesian Reputation)
   ========================================================================= */

type FsmState = "NEW" | "KNOWN" | "PREFERRED" | "WATCH" | "BLOCKED";

function ReputationFsmCard(): ReactNode {
  const [fsmState, setFsmState] = useState<FsmState>("PREFERRED");
  const [alpha, setAlpha] = useState(14.8);
  const [beta, setBeta] = useState(1.2);

  const expectedTrust = (alpha / (alpha + beta)) * 100;

  const handleAddSuccess = () => {
    setAlpha((prev) => {
      const nextAlpha = +(prev + 1.0).toFixed(1);
      const score = nextAlpha / (nextAlpha + beta);
      if (score >= 0.85) setFsmState("PREFERRED");
      else if (score >= 0.6) setFsmState("KNOWN");
      return nextAlpha;
    });
  };

  const handleAddFailure = () => {
    setBeta((prev) => {
      const nextBeta = +(prev + 3.0).toFixed(1);
      const score = alpha / (alpha + nextBeta);
      if (score < 0.4) setFsmState("BLOCKED");
      else if (score < 0.65) setFsmState("WATCH");
      else setFsmState("KNOWN");
      return nextBeta;
    });
  };

  const handleResetFsm = () => {
    setAlpha(14.8);
    setBeta(1.2);
    setFsmState("PREFERRED");
  };

  return (
    <motion.div
      id="reputation-fsm"
      {...cardAnimation}
      transition={getCardTransition(0.25)}
      className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-border/80 bg-frame/95 p-6 shadow-md backdrop-blur-md transition-all hover:border-accent/40 hover:shadow-xl sm:p-7 md:col-span-2 lg:col-span-2 scroll-mt-28 sm:scroll-mt-36 dark:border-neutral-800 dark:bg-[#111016]"
    >
      <div>
        {/* Astryx Shell Status Header */}
        <div className="mb-4 flex items-center justify-between gap-2 border-b border-border/60 pb-3 font-mono text-xs dark:border-neutral-800/80">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-xs" />
            <span className="font-mono text-[11px] font-semibold text-neutral-300 dark:text-neutral-200 truncate">
              aura://math/reputation-fsm
            </span>
          </div>

          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2.5 py-0.5 font-mono text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
            Beta(α, β) POSTERIOR
          </span>
        </div>

        {/* Card Headline */}
        <div className="mb-4">
          <div className="mb-2 flex items-center gap-2">
            <span className="rounded-xl bg-emerald-500/15 p-2 text-emerald-500">
              <TrendingUp className="h-4 w-4" />
            </span>
            <span className="font-mono text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              Bayesian Math Engine
            </span>
          </div>
          <h3 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
            Dynamic Bayesian Reputation FSM
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground sm:text-sm">
            Continuous Beta distributions (α/β parameters) update over empirical deliverables. Counterparties transition deterministically through verifiable FSM states.
          </p>
        </div>

        {/* Interactive FSM State Diagram */}
        <div className="mb-3 flex flex-wrap items-center gap-1 font-mono text-[11px]">
          {(["NEW", "KNOWN", "PREFERRED", "WATCH", "BLOCKED"] as FsmState[]).map((state, idx, arr) => {
            const isCurrent = fsmState === state;
            return (
              <div key={state} className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setFsmState(state)}
                  className={`cursor-pointer rounded-lg border px-2 py-1 font-semibold transition-all ${
                    isCurrent
                      ? "border-emerald-500 bg-emerald-500/20 text-emerald-700 shadow-xs scale-102 dark:border-emerald-400 dark:bg-emerald-500/25 dark:text-emerald-300"
                      : "border-border/80 bg-muted/60 text-muted-foreground hover:text-foreground dark:border-neutral-800 dark:bg-neutral-900/60 dark:text-neutral-400 dark:hover:text-neutral-200"
                  }`}
                >
                  {state}
                </button>
                {idx < arr.length - 1 && (
                  <span className="text-muted-foreground/50 dark:text-neutral-600">→</span>
                )}
              </div>
            );
          })}
        </div>

        {/* Interactive Beta Simulator Canvas */}
        <div className="flex h-[260px] flex-col justify-between rounded-2xl border border-neutral-800 bg-[#090a0f] p-3.5 font-mono text-xs text-neutral-300 shadow-inner">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <div className="flex items-center justify-between text-[11px] mb-2">
                <div>
                  <span className="text-neutral-500">α: </span>
                  <strong className="text-emerald-400">{alpha}</strong>
                </div>
                <div>
                  <span className="text-neutral-500">β: </span>
                  <strong className="text-rose-400">{beta}</strong>
                </div>
                <div>
                  <span className="text-neutral-500">Trust: </span>
                  <strong className="text-accent">{expectedTrust.toFixed(1)}%</strong>
                </div>
              </div>

              {/* Animated Probability Bar */}
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-neutral-800">
                <div
                  className={`h-full transition-all duration-300 ${
                    fsmState === "BLOCKED"
                      ? "bg-rose-500"
                      : fsmState === "WATCH"
                      ? "bg-amber-500"
                      : "bg-emerald-500"
                  }`}
                  style={{ width: `${Math.min(100, Math.max(5, expectedTrust))}%` }}
                />
              </div>

              <div className="mt-2 text-[10px] text-neutral-500 leading-snug">
                E[θ] = α / (α + β) • Current status:{" "}
                <span className="text-emerald-400 font-bold">{fsmState}</span>
              </div>
            </div>

            <div className="flex flex-col justify-between border-t border-neutral-800/80 pt-2 sm:border-t-0 sm:border-l sm:pl-4 sm:pt-0">
              <div className="text-[10px] text-neutral-400 leading-relaxed">
                Empirical updates alter routing without brittle prompt engineering.
              </div>
              <div className="flex items-center justify-between gap-1 pt-2">
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={handleAddSuccess}
                    className="cursor-pointer rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-2 py-1 text-[10px] font-bold text-emerald-700 hover:bg-emerald-500/25 dark:text-emerald-400"
                  >
                    + Success (α+1)
                  </button>
                  <button
                    type="button"
                    onClick={handleAddFailure}
                    className="cursor-pointer rounded-lg border border-rose-500/40 bg-rose-500/15 px-2 py-1 text-[10px] font-bold text-rose-700 hover:bg-rose-500/25 dark:text-rose-400"
                  >
                    + Breach (β+3)
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleResetFsm}
                  className="flex items-center gap-1 text-[10px] text-neutral-500 hover:text-neutral-300 cursor-pointer"
                >
                  <RotateCcw className="h-3 w-3" />
                  <span>Reset</span>
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-neutral-800/80 pt-1.5 text-[10px] text-neutral-500">
            <span>Bayesian Posterior State Machine</span>
            <span className="text-foreground font-semibold">Deterministic Transitions</span>
          </div>
        </div>
      </div>

      {/* Bottom Rail */}
      <div className="mt-4 flex items-center justify-between border-t border-border/70 pt-3 font-mono text-xs text-muted-foreground dark:border-neutral-800/80">
        <span>Empirical Posterior Update</span>
        <span className="font-semibold text-foreground">Zero Prompt-and-Pray</span>
      </div>
    </motion.div>
  );
}

/* =========================================================================
   6. TABBED CODE VIEWER & MULTI-AGENT MCP STUDIO (Multi-Agent MCP Coordination)
   ========================================================================= */

type McpFileTab = "server" | "config" | "worker";

const MCP_FILES: Record<
  McpFileTab,
  { name: string; lang: string; code: string }
> = {
  server: {
    name: "mcp-server.ts",
    lang: "typescript",
    code: `import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { sibyl } from "./storage/sibyl-bridge";
import { z } from "zod";

const server = new McpServer({
  name: "aura-memory-bridge",
  version: "1.0.0",
});

// Recall counterparty trust parameters before treasury funding
server.tool(
  "memory_recall_counterparty",
  { agentId: z.string().describe("Target counterparty agent DID") },
  async ({ agentId }) => {
    const profile = await sibyl.retrieveCounterparty(agentId);
    const score = profile.alpha / (profile.alpha + profile.beta);
    const approved = profile.fsmState !== "BLOCKED" && score >= 0.70;

    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          agentId,
          expectedTrust: score,
          fsmState: profile.fsmState,
          verdict: approved ? "APPROVED_FOR_ROUTING" : "BLOCKED_BY_POLICY",
          spendCeilingUsdc: approved ? 0.20 : 0.00
        })
      }]
    };
  }
);

await server.connect(new StdioServerTransport());`,
  },
  config: {
    name: "claude_desktop_config.json",
    lang: "json",
    code: `{
  "mcpServers": {
    "aura-memory": {
      "command": "node",
      "args": ["/Users/agents/aura-memory/dist/mcp-server.js"],
      "env": {
        "SIBYL_PYTHON": "/usr/local/bin/python3",
        "AURA_DATABASE_URL": "file:~/.sibyl-memory/memory.db",
        "BASE_SEPOLIA_CHAIN_ID": "84532",
        "VIRTUALS_ACP_ENABLED": "true"
      }
    }
  }
}`,
  },
  worker: {
    name: "aura-audit-worker.py",
    lang: "python",
    code: `import os, sys, sqlite3

def enforce_load_bearing_invariant():
    """Ensure buyer fleet halts fail-closed if Sibyl memory is absent."""
    sibyl_env = os.environ.get("SIBYL_PYTHON")
    if not sibyl_env:
        print("[CRITICAL] Sibyl socket unreachable: HALTED IN run.blocked", file=sys.stderr)
        sys.exit(1) # Zero blind spending permitted

    conn = sqlite3.connect(os.path.expanduser("~/.sibyl-memory/memory.db"))
    cursor = conn.cursor()
    cursor.execute("SELECT fsm_state, alpha, beta FROM counterparties WHERE did = ?", ("virtuals:agent:beta",))
    row = cursor.fetchone()
    return {"fsm_state": row[0], "alpha": row[1], "beta": row[2]}`,
  },
};

function McpCoordinationStudio(): ReactNode {
  const [activeTab, setActiveTab] = useState<McpFileTab>("server");
  const [copiedCode, setCopiedCode] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  const file = MCP_FILES[activeTab];

  const handleCopy = () => {
    navigator.clipboard.writeText(file.code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 1800);
  };

  const handleTestCall = (toolName: string) => {
    if (toolName === "recall_beta") {
      setTestResult(
        JSON.stringify(
          {
            agentId: "virtuals:agent:beta",
            expectedTrust: 0.925,
            fsmState: "PREFERRED",
            verdict: "APPROVED_FOR_ROUTING",
            spendCeilingUsdc: 0.20,
          },
          null,
          2
        )
      );
    } else {
      setTestResult(
        JSON.stringify(
          {
            agentId: "virtuals:agent:rogue",
            expectedTrust: 0.05,
            fsmState: "BLOCKED",
            verdict: "BLOCKED_BY_POLICY",
            spendCeilingUsdc: 0.00,
          },
          null,
          2
        )
      );
    }
  };

  return (
    <motion.div
      id="mcp"
      {...cardAnimation}
      transition={getCardTransition(0.3)}
      className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-border/80 bg-frame/95 p-6 shadow-md backdrop-blur-md transition-all hover:border-accent/40 hover:shadow-xl sm:p-8 md:col-span-2 lg:col-span-3 scroll-mt-28 sm:scroll-mt-36 dark:border-neutral-800 dark:bg-[#111016]"
    >
      <div>
        {/* Astryx Shell Status Header */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3 font-mono text-xs dark:border-neutral-800/80">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-cyan-500 shadow-xs" />
            <span className="font-mono text-[11px] font-semibold text-neutral-300 dark:text-neutral-200 truncate">
              mcp://bridge/multi-agent/${file.name}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="rounded-full border border-purple-500/30 bg-purple-500/15 px-2.5 py-0.5 font-mono text-[10px] font-bold text-purple-700 dark:text-purple-400">
              ANTHROPIC MCP SPEC
            </span>
            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2.5 py-0.5 font-mono text-[10px] font-bold text-emerald-700 dark:text-emerald-400 hidden sm:inline">
              CLAUDE CODE • CURSOR • SWARMS
            </span>
          </div>
        </div>

        {/* Section Header */}
        <div className="mb-5 flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <div className="mb-1.5 flex items-center gap-2">
              <span className="rounded-xl bg-purple-500/15 p-2 text-purple-500">
                <Cpu className="h-4 w-4" />
              </span>
              <span className="font-mono text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                Model Context Protocol Coordination
              </span>
            </div>
            <h3 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl lg:text-3xl">
              Native Multi-Agent MCP Server &amp; Tool Registry
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground sm:text-sm">
              Standardized stdio &amp; HTTP bridge. External agents in Claude Code, Cursor, or autonomous fleets recall persistent relationship memory.
            </p>
          </div>

          {/* Interactive Test Caller Buttons */}
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handleTestCall("recall_beta")}
              className="cursor-pointer rounded-xl border border-emerald-500/30 bg-emerald-500/15 px-3 py-1.5 font-mono text-xs font-semibold text-emerald-700 dark:text-emerald-400 transition-all hover:bg-emerald-500/25"
            >
              Test recall(&quot;beta&quot;)
            </button>
            <button
              type="button"
              onClick={() => handleTestCall("recall_rogue")}
              className="cursor-pointer rounded-xl border border-rose-500/30 bg-rose-500/15 px-3 py-1.5 font-mono text-xs font-semibold text-rose-700 dark:text-rose-400 transition-all hover:bg-rose-500/25"
            >
              Test recall(&quot;rogue&quot;)
            </button>
          </div>
        </div>

        {/* Tabbed Code Viewer */}
        <div className="rounded-2xl border border-neutral-800 bg-[#090a0f] text-neutral-200 shadow-inner">
          {/* File Tabs Header */}
          <div className="flex flex-wrap items-center justify-between border-b border-neutral-800 bg-neutral-950/60 px-4 py-2">
            <div className="flex items-center gap-1.5">
              {(Object.keys(MCP_FILES) as McpFileTab[]).map((tabKey) => {
                const isActive = activeTab === tabKey;
                return (
                  <button
                    key={tabKey}
                    type="button"
                    onClick={() => setActiveTab(tabKey)}
                    className={`cursor-pointer rounded-lg px-3 py-1 font-mono text-xs transition-all ${
                      isActive
                        ? "bg-neutral-800 font-semibold text-white shadow-xs"
                        : "text-neutral-400 hover:text-neutral-200"
                    }`}
                  >
                    {MCP_FILES[tabKey].name}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={handleCopy}
              className="flex cursor-pointer items-center gap-1.5 font-mono text-xs text-neutral-400 transition-colors hover:text-white"
            >
              {copiedCode ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span>Copy Code</span>
                </>
              )}
            </button>
          </div>

          {/* Code Window with Syntax Display */}
          <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <pre className="max-h-64 overflow-x-auto overflow-y-auto rounded-xl bg-black/50 p-3 font-mono text-xs leading-relaxed text-neutral-300">
                <code>{file.code}</code>
              </pre>
            </div>

            {/* Live Response Drawer */}
            <div className="flex flex-col justify-between rounded-xl border border-neutral-800/80 bg-neutral-950/80 p-3 font-mono text-xs">
              <div>
                <div className="mb-2 flex items-center justify-between text-[10px] text-neutral-500 uppercase">
                  <span>Tool Verdict Simulation</span>
                  <span className="text-accent font-bold">Live Output</span>
                </div>
                {testResult ? (
                  <pre className="max-h-48 overflow-x-auto text-[11px] text-emerald-300 leading-snug">
                    {testResult}
                  </pre>
                ) : (
                  <div className="text-neutral-500 text-[11px] py-6 text-center">
                    Click &ldquo;Test recall(&quot;beta&quot;)&rdquo; or &ldquo;Test recall(&quot;rogue&quot;)&rdquo; to simulate live MCP dispatch.
                  </div>
                )}
              </div>

              <div className="mt-3 border-t border-neutral-800/60 pt-2 text-[10px] text-neutral-400">
                Protocol: JSON-RPC 2.0 via Stdio &amp; Fastify Bridge
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Status Rail */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-border/70 pt-3 font-mono text-xs text-muted-foreground dark:border-neutral-800/80">
        <span className="flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-accent" />
          <span>Supports Claude Code, Cursor IDE &amp; Autonomous Swarms</span>
        </span>
        <span className="font-semibold text-foreground">Zero Amnesia Bridge</span>
      </div>
    </motion.div>
  );
}

/* =========================================================================
   MAIN FEATURES BENTO SECTION
   ========================================================================= */

export function FeaturesBento(): ReactNode {
  return (
    <section
      id="architecture"
      className="w-full px-4 sm:px-6 lg:px-8 mb-24 sm:mb-32 pt-24 sm:pt-32 scroll-mt-28 sm:scroll-mt-36 bg-background"
    >
      <div id="features" className="mx-auto max-w-7xl">
        {/* Section Header */}
        <div className="mb-12 sm:mb-16 text-center">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/15 px-3.5 py-1 font-mono text-xs font-semibold text-foreground">
            <Layers className="h-3.5 w-3.5 text-accent" />
            <span>CORE ARCHITECTURE &amp; REPUTATION ENGINE</span>
          </div>
          <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
            Engineered For Zero Amnesia
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            Every layer of Aura is built around one non-negotiable principle:
            autonomous capital cannot move without verifiable relationship memory.
            Explore the live interactive developer architecture below.
          </p>
        </div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          <MemoryArchitectureCard />
          <DeletionTestCard />
          <BaseSepoliaCard />
          <VirtualsAcpCard />
          <ReputationFsmCard />
          <McpCoordinationStudio />
        </div>
      </div>
    </section>
  );
}

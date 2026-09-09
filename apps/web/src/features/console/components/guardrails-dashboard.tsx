"use client";

import { useEffect, useState } from "react";
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Lock,
  DollarSign,
  Cpu,
  CheckCircle2,
  AlertTriangle,
  Play,
  Scale,
} from "lucide-react";
import { playInteractionSound } from "@/components/primitives";
import { apiClient, type PolicyHealth } from "@/lib/api-client";

interface PolicyRule {
  id: string;
  name: string;
  category: "spend" | "sandbox" | "reputation" | "crypto";
  status: "ENFORCED" | "MONITORED";
  value: string;
  description: string;
}

export function GuardrailsDashboard() {
  const [policyHealth, setPolicyHealth] = useState<PolicyHealth | null>(null);
  const [simAmount, setSimAmount] = useState("12.00");
  const [simAgent, setSimAgent] = useState("Beta Labs (0.91 Rep)");
  const [simResult, setSimResult] = useState<{
    status: "PASS" | "WARN" | "BLOCK";
    reasons: string[];
  } | null>(null);

  useEffect(() => {
    apiClient
      .policyHealth()
      .then((res) => {
        if (res.ok && res.data.reachable) {
          setPolicyHealth(res.data);
        }
      })
      .catch(() => {});
  }, []);

  const dailyLimitStr = policyHealth?.dailySpendLimitUsdc
    ? parseFloat(policyHealth.dailySpendLimitUsdc).toFixed(2)
    : "100.00";
  const dailySpentStr = policyHealth?.dailySpentUsdc
    ? parseFloat(policyHealth.dailySpentUsdc).toFixed(2)
    : "0.00";
  const remainingAllowanceStr = policyHealth?.remainingDailyGuardrailUsdc
    ? parseFloat(policyHealth.remainingDailyGuardrailUsdc).toFixed(2)
    : Math.max(0, parseFloat(dailyLimitStr) - parseFloat(dailySpentStr)).toFixed(2);
  const approvalGateStr = policyHealth?.humanApprovalAboveUsdc
    ? parseFloat(policyHealth.humanApprovalAboveUsdc).toFixed(2)
    : "10.00";
  const absoluteLimitStr = policyHealth?.absoluteSpendLimitUsdc
    ? parseFloat(policyHealth.absoluteSpendLimitUsdc).toFixed(2)
    : "25.00";
  const minReliabilityVal =
    policyHealth?.minimumReliability !== undefined && policyHealth?.minimumReliability !== null
      ? (policyHealth.minimumReliability > 1 ? policyHealth.minimumReliability / 100 : policyHealth.minimumReliability).toFixed(2)
      : "0.80";

  const dynamicPolicies: PolicyRule[] = [
    {
      id: "tx-ceiling",
      name: "Maximum Single Transaction Ceiling",
      category: "spend",
      status: "ENFORCED",
      value: `${absoluteLimitStr} USDC`,
      description: `Hard barrier: Any mission proposing a spend above ${absoluteLimitStr} USDC is blocked at runtime.`,
    },
    {
      id: "daily-budget",
      name: "24-Hour Rolling Budget Ceiling",
      category: "spend",
      status: "ENFORCED",
      value: `${dailyLimitStr} USDC`,
      description: `Aggregated 24h spending window across all autonomous missions and agent hires. Remaining allowance: ${remainingAllowanceStr} USDC.`,
    },
    {
      id: "approval-gate",
      name: "Operator Approval Threshold",
      category: "spend",
      status: "ENFORCED",
      value: `${approvalGateStr} USDC`,
      description: `Transactions >= ${approvalGateStr} USDC generate an inline ApprovalCard requiring operator signature.`,
    },
    {
      id: "min-reliability",
      name: "Minimum Counterparty Trust Score",
      category: "reputation",
      status: "ENFORCED",
      value: `${minReliabilityVal} Reliability`,
      description: `Counterparties with reliability below ${minReliabilityVal} in Sibyl Memory cannot be hired without manual override.`,
    },
    {
      id: "sandbox-boundary",
      name: "CLI Execution Container Isolation",
      category: "sandbox",
      status: "ENFORCED",
      value: "Read-only RootFS",
      description: "Sandbox execution runs isolated with no external network access except Base Sepolia RPC.",
    },
    {
      id: "eip-712",
      name: "Cryptographic Commitment Signer",
      category: "crypto",
      status: "ENFORCED",
      value: "EIP-712 Typed Data",
      description: "All state changes and memory diffs are cryptographically signed before ledger commit.",
    },
  ];

  const evaluateSimulator = () => {
    playInteractionSound("pulse");
    const amt = parseFloat(simAmount) || 0;
    const isUnknown = simAgent.includes("Unknown");

    const reasons: string[] = [];
    let status: "PASS" | "WARN" | "BLOCK" = "PASS";

    const ceiling = parseFloat(absoluteLimitStr) || 25.0;
    const approvalThreshold = parseFloat(approvalGateStr) || 10.0;
    const remainingNum = parseFloat(remainingAllowanceStr) || 100.0;

    if (amt > ceiling) {
      status = "BLOCK";
      reasons.push(`Exceeds maximum single transaction ceiling of ${ceiling.toFixed(2)} USDC.`);
    }

    if (amt > remainingNum) {
      status = "BLOCK";
      reasons.push(`Exceeds remaining daily guardrail allowance of ${remainingNum.toFixed(2)} USDC.`);
    }

    if (isUnknown) {
      status = "BLOCK";
      reasons.push(`Counterparty has no verified Sibyl profile or trust score < ${minReliabilityVal}.`);
    }

    if (status !== "BLOCK" && amt >= approvalThreshold) {
      status = "WARN";
      reasons.push(`Spend >= ${approvalThreshold.toFixed(2)} USDC requires operator approval via inline approval card.`);
    }

    if (reasons.length === 0) {
      reasons.push("All guardrail checks passed! Mission eligible for autonomous execution.");
    }

    setSimResult({ status, reasons });
  };

  return (
    <div className="flex flex-col gap-6 w-full max-w-5xl my-4">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-[var(--color-surface-raised,#1b1b1f)] border border-[var(--color-border)] flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs text-[var(--color-text-muted,#8d9aaf)]">
            <span className="flex items-center gap-1.5 font-medium">
              <DollarSign size={14} className="text-[var(--color-accent)]" />
              <span>Spend Guardrail</span>
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-950/60 text-emerald-400 border border-emerald-800/40">
              ACTIVE
            </span>
          </div>
          <span className="text-xl font-semibold text-[var(--color-text,#f4f7fb)]">
            {dailyLimitStr} USDC <span className="text-xs font-normal text-[var(--color-text-muted)]">/ 24h</span>
          </span>
          <span className="text-xs text-[var(--color-text-muted,#8d9aaf)]">
            Remaining allowance: <strong className="text-[var(--color-accent)]">{remainingAllowanceStr} USDC</strong>
          </span>
        </div>

        <div className="p-4 rounded-xl bg-[var(--color-surface-raised,#1b1b1f)] border border-[var(--color-border)] flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs text-[var(--color-text-muted,#8d9aaf)]">
            <span className="flex items-center gap-1.5 font-medium">
              <Scale size={14} className="text-[var(--color-accent)]" />
              <span>Trust Threshold</span>
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-950/60 text-emerald-400 border border-emerald-800/40">
              ENFORCED
            </span>
          </div>
          <span className="text-xl font-semibold text-[var(--color-text,#f4f7fb)]">
            {minReliabilityVal} <span className="text-xs font-normal text-[var(--color-text-muted)]">Reliability</span>
          </span>
          <span className="text-xs text-[var(--color-text-muted,#8d9aaf)]">
            Source: Sibyl Relationship Memory
          </span>
        </div>

        <div className="p-4 rounded-xl bg-[var(--color-surface-raised,#1b1b1f)] border border-[var(--color-border)] flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs text-[var(--color-text-muted,#8d9aaf)]">
            <span className="flex items-center gap-1.5 font-medium">
              <Lock size={14} className="text-[var(--color-accent)]" />
              <span>Execution Sandbox</span>
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-950/60 text-emerald-400 border border-emerald-800/40">
              ISOLATED
            </span>
          </div>
          <span className="text-xl font-semibold text-[var(--color-text,#f4f7fb)]">
            Zero Network Egress
          </span>
          <span className="text-xs text-[var(--color-text-muted,#8d9aaf)]">
            Base Sepolia contract whitelist only
          </span>
        </div>
      </div>

      {/* Active Rules Grid */}
      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-[var(--color-text,#f4f7fb)] flex items-center gap-2">
          <ShieldCheck size={16} className="text-[var(--color-accent)]" />
          <span>Active Guardrail Policies</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {dynamicPolicies.map((rule) => (
            <div
              key={rule.id}
              className="p-4 rounded-xl bg-[var(--color-surface-raised,#1b1b1f)] border border-[var(--color-border)] hover:border-[var(--color-accent)] transition-all flex flex-col gap-2"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-xs text-[var(--color-text,#f4f7fb)] flex items-center gap-1.5">
                  <Shield size={13} className="text-[var(--color-accent)]" />
                  <span>{rule.name}</span>
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[var(--color-surface,#111015)] border border-[var(--color-border)] text-[var(--color-accent)]">
                  {rule.value}
                </span>
              </div>
              <p className="text-xs text-[var(--color-text-muted,#8d9aaf)] leading-relaxed">
                {rule.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Interactive Simulator */}
      <div className="p-5 rounded-2xl bg-[var(--color-surface-raised,#1b1b1f)] border border-[var(--color-border)] flex flex-col gap-4">
        <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-3">
          <div className="flex items-center gap-2">
            <Cpu size={16} className="text-[var(--color-accent)]" />
            <span className="font-semibold text-sm text-[var(--color-text,#f4f7fb)]">
              Interactive Policy Simulator
            </span>
          </div>
          <span className="text-[11px] text-[var(--color-text-muted,#8d9aaf)]">
            Preview guardrail evaluation before execution
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="flex flex-col gap-1.5 text-xs text-[var(--color-text-muted,#8d9aaf)]">
            <span>Proposed Spend Amount (USDC)</span>
            <input
              type="text"
              className="px-3 py-2 rounded-lg bg-[var(--color-surface,#111015)] border border-[var(--color-border)] text-sm text-[var(--color-text)] focus:border-[var(--color-accent)] focus:outline-none"
              value={simAmount}
              onChange={(e) => setSimAmount(e.target.value)}
              placeholder="12.00"
            />
          </label>

          <label className="flex flex-col gap-1.5 text-xs text-[var(--color-text-muted,#8d9aaf)]">
            <span>Counterparty Agent</span>
            <select
              className="px-3 py-2 rounded-lg bg-[var(--color-surface,#111015)] border border-[var(--color-border)] text-sm text-[var(--color-text)] focus:border-[var(--color-accent)] focus:outline-none"
              value={simAgent}
              onChange={(e) => setSimAgent(e.target.value)}
            >
              <option value="Beta Labs (0.91 Rep)">Beta Labs · 0.91 Reliability (Verified)</option>
              <option value="Alpha Studio (0.84 Rep)">Alpha Studio · 0.84 Reliability (Verified)</option>
              <option value="Unknown Agent (0.00 Rep)">Unknown Agent · Unverified (0.00 Rep)</option>
            </select>
          </label>
        </div>

        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={evaluateSimulator}
            data-sound="press"
            className="btn btn--primary text-xs flex items-center gap-1.5 px-4 py-2"
          >
            <Play size={12} />
            <span>Evaluate Guardrail</span>
          </button>

          {simResult && (
            <div className="flex items-center gap-2">
              {simResult.status === "PASS" && (
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-800 text-xs text-emerald-300 font-medium">
                  <CheckCircle2 size={13} />
                  <span>PASS: Approved for Autonomous Execution</span>
                </div>
              )}
              {simResult.status === "WARN" && (
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-950/80 border border-amber-800 text-xs text-amber-300 font-medium">
                  <AlertTriangle size={13} />
                  <span>REQUIRES OPERATOR APPROVAL</span>
                </div>
              )}
              {simResult.status === "BLOCK" && (
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-950/80 border border-red-800 text-xs text-red-300 font-medium">
                  <ShieldAlert size={13} />
                  <span>BLOCKED BY GUARDRAIL</span>
                </div>
              )}
            </div>
          )}
        </div>

        {simResult && (
          <div className="p-3 rounded-lg bg-[var(--color-surface,#111015)] border border-[var(--color-border)] text-xs text-[var(--color-text-muted,#8d9aaf)]">
            <ul className="list-disc pl-4 flex flex-col gap-1">
              {simResult.reasons.map((r, i) => (
                <li key={i} className="text-[var(--color-text)]">{r}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

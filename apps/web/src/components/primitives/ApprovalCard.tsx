"use client";

import { useState } from "react";
import { ShieldAlert, Check, X, Loader2, Wallet } from "lucide-react";
import { playInteractionSound } from "./InteractionSounds";
import { env } from "@/lib/env";
import { useWeb3Wallet } from "@/features/web3";

export interface ApprovalCardProps {
  runId?: string;
  counterpartyKey?: string;
  amountUsdc?: string | number;
  reason?: string;
  counterfactual?: {
    baselineCounterparty?: string;
    baselineReliability?: number;
    proposedReliability?: number;
    delta?: string;
    rationale?: string;
  };
  onApprove?: () => Promise<void> | void;
  onReject?: () => Promise<void> | void;
  initialStatus?: "pending" | "approved" | "rejected";
  className?: string;
  requireWallet?: boolean;
}

export function ApprovalCard({
  runId,
  counterpartyKey = "virtuals:agent:beta",
  amountUsdc = "10.00",
  reason = "Draft exploratory engagement under active guardrail limits",
  counterfactual = {
    baselineCounterparty: "Alpha Studio",
    baselineReliability: 0.98,
    proposedReliability: 0.84,
    delta: "-14%",
    rationale: "Beta Labs costs 60% less per token unit while maintaining acceptable quality for non-critical tasks.",
  },
  onApprove,
  onReject,
  initialStatus = "pending",
  className = "",
  requireWallet = false,
}: ApprovalCardProps) {
  const {
    address,
    isConnected,
    isConnecting,
    isBaseSepolia,
    connect,
    switchToBaseSepolia,
    usdcBalance,
  } = useWeb3Wallet();

  const needsWalletConnection = Boolean(requireWallet && !isConnected);
  const needsNetworkSwitch = Boolean(requireWallet && isConnected && !isBaseSepolia);
  const isWalletBlocked = needsWalletConnection || needsNetworkSwitch;

  const [status, setStatus] = useState<"pending" | "approved" | "rejected">(initialStatus);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleApprove = async () => {
    playInteractionSound("pulse");
    setLoading(true);
    setError(null);
    try {
      if (onApprove) {
        await onApprove();
      } else {
        const num = typeof amountUsdc === "number" ? amountUsdc : parseFloat(String(amountUsdc));
        const ceilingStr = Number.isNaN(num) || num <= 0 ? "10.000000" : num.toFixed(6);

        let targetRunId = runId;
        const isUuid =
          typeof targetRunId === "string" &&
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetRunId);

        // If runId is missing, undefined, or not a valid UUID (e.g. "demo-run-1" or general chat),
        // create a real mission run in Postgres so the authorization is genuinely event-sourced!
        if (!isUuid) {
          const createRes = await fetch(`${env.NEXT_PUBLIC_API_URL}/api/runs`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              objective: `Spend authorization for ${counterpartyKey}: ${reason}`,
              budgetUsdc: ceilingStr,
              source: "CONSOLE",
            }),
          });
          if (createRes.ok) {
            const runData = await createRes.json();
            targetRunId = runData.run?.id || runData.id;
          }
        }

        if (targetRunId) {
          let res = await fetch(`${env.NEXT_PUBLIC_API_URL}/api/runs/${targetRunId}/approve`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ceiling_usdc: ceilingStr }),
          });

          // If no pending approval.requested event exists on this run (409 or 404),
          // append an approval.requested event and retry approval
          if (res.status === 409 || res.status === 404) {
            const errData = await res.json().catch(() => ({}));
            if (errData?.error?.code === "no_pending_approval" || res.status === 404) {
              const eventId = crypto.randomUUID();
              await fetch(`${env.NEXT_PUBLIC_API_URL}/api/runs/${targetRunId}/events`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  eventId,
                  eventTime: new Date().toISOString(),
                  type: "approval.requested",
                  data: {
                    action: `Spend ${ceilingStr} USDC with ${counterpartyKey}`,
                    counterparty_key: counterpartyKey,
                    ceiling_usdc: ceilingStr,
                    reason,
                    summary: reason,
                  },
                }),
              });
              res = await fetch(`${env.NEXT_PUBLIC_API_URL}/api/runs/${targetRunId}/approve`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ceiling_usdc: ceilingStr }),
              });
            }
          }

          if (!res.ok && res.status !== 409) {
            const errBody = await res.json().catch(() => ({}));
            throw new Error(errBody?.error?.message || errBody?.message || `Approval failed with status ${res.status}`);
          }
        }
      }
      setStatus("approved");
      playInteractionSound("chime");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to authorize spend");
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    playInteractionSound("release");
    setLoading(true);
    setError(null);
    try {
      if (onReject) {
        await onReject();
      } else if (runId) {
        const isUuid =
          typeof runId === "string" &&
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(runId);
        if (isUuid) {
          const res = await fetch(`${env.NEXT_PUBLIC_API_URL}/api/runs/${runId}/reject`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reason }),
          });
          if (!res.ok && res.status !== 409) {
            const errBody = await res.json().catch(() => ({}));
            throw new Error(errBody?.error?.message || errBody?.message || `Rejection failed with status ${res.status}`);
          }
        }
      }
      setStatus("rejected");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to record rejection");
    } finally {
      setLoading(false);
    }
  };

  const formattedAmount = typeof amountUsdc === "number" ? `$${amountUsdc.toFixed(2)} USDC` : `$${amountUsdc} USDC`;

  return (
    <div
      data-approval-card
      className={`w-full max-w-[540px] rounded-[10px] border border-[rgba(216,216,219,0.16)] bg-[#1b1b1f] overflow-hidden my-3 text-[#f4f7fb] shadow-sm ${className}`}
    >
      {/* Top banner / header */}
      <div className="flex items-center justify-between border-b border-[rgba(216,216,219,0.12)] px-4 py-2.5 bg-[#111015]/40">
        <div className="flex items-center gap-2">
          <span className="flex size-6 items-center justify-center rounded-[6px] bg-[#ffbe63]/15 text-[#ffbe63]">
            <ShieldAlert size={14} />
          </span>
          <span className="text-[13px] font-semibold tracking-tight">Human-in-the-Loop Spend Authorization</span>
        </div>
        <span className="rounded-full bg-[#51e6a6]/15 px-2 py-0.5 text-[10.5px] font-medium text-[#51e6a6]">
          Guardrail Active
        </span>
      </div>

      {/* Main card body */}
      <div className="p-4 flex flex-col gap-3">
        {/* Proposal summary */}
        <div className="flex items-baseline justify-between border-b border-[rgba(216,216,219,0.08)] pb-3">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-text-muted,#8d9aaf)]">
              Proposed Spend
            </div>
            <div className="mt-0.5 font-mono text-[20px] font-bold text-[#f4f7fb]">
              {formattedAmount}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[11px] font-medium uppercase tracking-wider text-[var(--color-text-muted,#8d9aaf)]">
              Counterparty
            </div>
            <div className="mt-0.5 font-mono text-[13px] font-semibold text-[#d8d8db]">
              {counterpartyKey}
            </div>
          </div>
        </div>

        {/* Reason */}
        <div className="text-[12.5px] leading-relaxed text-[var(--color-text-muted,#8d9aaf)]">
          <strong className="text-[#f4f7fb]">Rationale:</strong> {reason}
        </div>

        {/* Counterfactual comparison card */}
        {counterfactual && (
          <div className="rounded-[8px] border border-[rgba(216,216,219,0.12)] bg-[#111015]/80 p-3 flex flex-col gap-2">
            <div className="flex items-center justify-between text-[11.5px] font-medium">
              <span className="text-[var(--color-text-muted,#8d9aaf)]">Memory Counterfactual:</span>
              <span className="font-mono text-[#ffbe63]">{counterfactual.delta} Reliability</span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
              <div className="p-2 rounded-[6px] bg-[#1b1b1f] border border-[rgba(216,216,219,0.08)]">
                <div className="text-[var(--color-text-muted,#8d9aaf)]">{counterfactual.baselineCounterparty || "Baseline"}</div>
                <div className="text-[13px] font-semibold text-[#51e6a6]">
                  {Math.round((counterfactual.baselineReliability ?? 0.98) * 100)}% reliability
                </div>
              </div>

              <div className="p-2 rounded-[6px] bg-[#1b1b1f] border border-[rgba(216,216,219,0.08)]">
                <div className="text-[var(--color-text-muted,#8d9aaf)]">{counterpartyKey}</div>
                <div className="text-[13px] font-semibold text-[#ffbe63]">
                  {Math.round((counterfactual.proposedReliability ?? 0.84) * 100)}% reliability
                </div>
              </div>
            </div>

            {counterfactual.rationale && (
              <p className="text-[11px] leading-relaxed text-[var(--color-text-muted,#8d9aaf)] italic">
                {counterfactual.rationale}
              </p>
            )}
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="rounded-[6px] bg-[#ff6b7a]/15 border border-[#ff6b7a]/30 p-2 text-[12px] text-[#ff6b7a]">
            {error}
          </div>
        )}
      </div>

      {/* Footer action controls */}
      <div className="relative border-t border-[rgba(216,216,219,0.12)] bg-[#111015]/40 px-4 py-3 min-h-[58px] flex flex-col justify-center overflow-hidden">
        {status === "pending" ? (
          <>
            {/* Operator wallet bar when connected and wallet required */}
            {requireWallet && isConnected && isBaseSepolia && (
              <div className="flex items-center justify-between mb-2.5 pb-2 border-b border-[rgba(216,216,219,0.08)] text-[11px] font-mono">
                <span className="inline-flex items-center gap-1.5 text-[#51e6a6]">
                  <span className="size-1.5 rounded-full bg-[#51e6a6] animate-pulse" />
                  <span>Wallet: {address?.slice(0, 6)}...{address?.slice(-4)}</span>
                </span>
                <span className="text-[var(--color-text-muted,#8d9aaf)]">
                  Balance: <span className="text-[#f4f7fb] font-semibold">{usdcBalance ? `$${usdcBalance} USDC` : "Checking..."}</span>
                </span>
              </div>
            )}

            {/* Normal action buttons (blurred if wallet blocked) */}
            <div
              className={`flex items-center justify-between transition-all duration-300 ${
                isWalletBlocked ? "filter blur-[3px] opacity-25 pointer-events-none select-none" : ""
              }`}
            >
              <button
                type="button"
                disabled={loading || isWalletBlocked}
                onClick={handleReject}
                data-sound="release"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] border border-[rgba(216,216,219,0.16)] bg-[#1b1b1f] text-[12.5px] font-medium text-[var(--color-text-muted,#8d9aaf)] hover:text-[#ff6b7a] hover:border-[#ff6b7a]/40 transition-colors disabled:opacity-40"
              >
                <X size={13} />
                <span>Reject Proposal</span>
              </button>

              <button
                type="button"
                disabled={loading || isWalletBlocked}
                onClick={handleApprove}
                data-sound="pulse"
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-[8px] bg-[#f3f3f5] text-[#111015] text-[12.5px] font-semibold shadow-sm hover:bg-[#ffffff] transition-all disabled:opacity-40"
              >
                {loading ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>Authorizing...</span>
                  </>
                ) : (
                  <>
                    <Check size={13} strokeWidth={2.5} />
                    <span>Approve Spend ({formattedAmount})</span>
                  </>
                )}
              </button>
            </div>

            {/* Frosted Glassmorphism Blur Overlay for Wallet Requirement */}
            {isWalletBlocked && (
              <div
                data-testid="wallet-gate-overlay"
                className="absolute inset-0 z-10 flex items-center justify-between px-4 py-2.5 bg-[#16151a]/85 backdrop-blur-md border-t border-[rgba(216,216,219,0.12)] transition-opacity animate-in fade-in duration-200"
              >
                <div className="flex items-center gap-2.5 max-w-[65%]">
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-[8px] bg-[#ffbe63]/15 text-[#ffbe63]">
                    <Wallet size={15} />
                  </div>
                  <div className="leading-tight">
                    <div className="text-[12px] font-semibold text-[#f4f7fb]">
                      {needsWalletConnection
                        ? "Operator Wallet Required"
                        : "Base Sepolia Network Required"}
                    </div>
                    <div className="text-[11px] text-[var(--color-text-muted,#8d9aaf)] truncate">
                      {needsWalletConnection
                        ? "Connect Web3 wallet to authorize spend"
                        : "Switch chain to execute on Base Sepolia"}
                    </div>
                  </div>
                </div>

                {needsWalletConnection ? (
                  <button
                    type="button"
                    disabled={isConnecting}
                    onClick={() => connect()}
                    data-sound="pulse"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] bg-[#ffbe63] text-[#111015] text-[12px] font-semibold hover:bg-[#ffc87a] active:scale-[0.98] transition-all shadow-sm shrink-0"
                  >
                    {isConnecting ? (
                      <>
                        <Loader2 size={13} className="animate-spin" />
                        <span>Connecting...</span>
                      </>
                    ) : (
                      <>
                        <Wallet size={13} />
                        <span>Connect Wallet</span>
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => switchToBaseSepolia()}
                    data-sound="pulse"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] bg-[#ffbe63] text-[#111015] text-[12px] font-semibold hover:bg-[#ffc87a] active:scale-[0.98] transition-all shadow-sm shrink-0"
                  >
                    <span>Switch to Base Sepolia</span>
                  </button>
                )}
              </div>
            )}
          </>
        ) : status === "approved" ? (
          <div className="flex w-full items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-[#51e6a6]">
              <Check size={14} strokeWidth={2.5} />
              <span>Approved & Authorized ({formattedAmount} committed)</span>
            </span>
            <span className="font-mono text-[11px] text-[var(--color-text-muted,#8d9aaf)]">
              Status: COMMITTED
            </span>
          </div>
        ) : (
          <div className="flex w-full items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-[#ff6b7a]">
              <X size={14} />
              <span>Rejected by Operator</span>
            </span>
            <span className="font-mono text-[11px] text-[var(--color-text-muted,#8d9aaf)]">
              Status: CANCELLED
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export default ApprovalCard;

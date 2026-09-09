"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, ArrowRight, Copy, Check, Sparkles } from "lucide-react";
import { playInteractionSound } from "./InteractionSounds";
import { MonoRef } from "./mono-ref";

export interface MissionCardProps {
  runId: string;
  objective?: string;
  budgetUsdc?: string | number;
  source?: string;
  destination?: string;
  onNavigate?: (destination: string) => void;
  className?: string;
}

export function MissionCard({
  runId,
  objective = "Autonomous agent mission executed via MCP",
  budgetUsdc = "25.00",
  source = "AGENT",
  destination,
  onNavigate,
  className = "",
}: MissionCardProps) {
  const [copied, setCopied] = useState(false);
  const targetHref = destination || `/runs/${runId}`;

  const num = typeof budgetUsdc === "number" ? budgetUsdc : parseFloat(budgetUsdc);
  const formattedBudget = Number.isNaN(num) || num <= 0 ? "25.00" : num.toFixed(2);

  const handleCopy = () => {
    playInteractionSound("press");
    navigator.clipboard.writeText(runId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpen = () => {
    playInteractionSound("press");
    if (onNavigate) {
      onNavigate(targetHref);
    }
  };

  return (
    <div
      role="region"
      aria-label="Created Mission"
      className={`rounded-lg p-3.5 sm:p-4 my-2 text-left border border-[rgba(216,216,219,0.12)] bg-[#16151a] ${className}`}
    >
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-[rgba(216,216,219,0.08)] border border-[rgba(216,216,219,0.12)] flex items-center justify-center text-[#e2e2e5]">
            <Sparkles size={13} />
          </div>
          <span className="text-xs font-semibold uppercase tracking-wider text-[#f4f7fb]">
            Mission Created
          </span>
        </div>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-medium bg-[rgba(34,197,94,0.12)] border border-[rgba(34,197,94,0.24)] text-[#4ade80]">
          <CheckCircle2 size={11} />
          Queued & Ready
        </span>
      </div>

      <div className="space-y-2 mb-3">
        <div>
          <div className="text-[11px] font-medium text-[var(--color-text-muted,#8d9aaf)] mb-0.5">
            Objective
          </div>
          <p className="text-xs sm:text-[13px] text-[#f4f7fb] font-medium leading-relaxed">
            {objective}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[rgba(216,216,219,0.08)] text-[11px]">
          <div>
            <span className="text-[var(--color-text-muted,#8d9aaf)]">Ceiling: </span>
            <span className="text-[#f4f7fb] font-semibold">${formattedBudget} USDC</span>
          </div>
          <div>
            <span className="text-[var(--color-text-muted,#8d9aaf)]">Source: </span>
            <span className="text-[#d8d8db] font-mono uppercase">{source}</span>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 pt-1 border-t border-[rgba(216,216,219,0.08)] text-[11px]">
          <span className="text-[var(--color-text-muted,#8d9aaf)]">Mission ID:</span>
          <div className="flex items-center gap-1.5">
            <MonoRef>{runId}</MonoRef>
            <button
              type="button"
              onClick={handleCopy}
              className="p-1 rounded text-[var(--color-text-muted,#8d9aaf)] hover:text-[#f4f7fb] transition-colors"
              title="Copy Mission ID"
              aria-label="Copy Mission ID"
            >
              {copied ? <Check size={12} className="text-[#4ade80]" /> : <Copy size={12} />}
            </button>
          </div>
        </div>
      </div>

      <div className="pt-2 border-t border-[rgba(216,216,219,0.08)] flex justify-end">
        {onNavigate ? (
          <button
            type="button"
            onClick={handleOpen}
            data-sound="press"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-[#25252a] hover:bg-[#2e2d35] border border-[rgba(216,216,219,0.16)] text-[#f4f7fb] transition-colors cursor-pointer"
          >
            <span>Open Mission Workspace</span>
            <ArrowRight size={13} />
          </button>
        ) : (
          <Link
            href={targetHref}
            onClick={handleOpen}
            data-sound="press"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-[#25252a] hover:bg-[#2e2d35] border border-[rgba(216,216,219,0.16)] text-[#f4f7fb] transition-colors cursor-pointer"
          >
            <span>Open Mission Workspace</span>
            <ArrowRight size={13} />
          </Link>
        )}
      </div>
    </div>
  );
}

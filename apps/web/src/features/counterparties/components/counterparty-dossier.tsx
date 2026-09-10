"use client";

import { useState } from "react";
import { HStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { Token } from "@astryxdesign/core/Token";
import { Check, Copy, FileText, GitCommit, ShieldAlert, Sparkles, TrendingUp } from "lucide-react";

import type { CounterpartyDossier } from "@/lib/api-client";

export interface CounterpartyDossierProps {
  dossier: CounterpartyDossier | null;
  counterpartyKey?: string;
  className?: string;
}

export function CounterpartyDossierView({
  dossier,
  counterpartyKey,
  className,
}: CounterpartyDossierProps) {
  const [copied, setCopied] = useState(false);

  if (!dossier || dossier.totalMissions === 0) {
    return (
      <section
        data-testid="dossier-pending-state"
        aria-label="Consolidated Episodic Dossier"
        className={`p-4 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] flex items-center justify-between gap-3 ${className ?? ""}`}
      >
        <div className="flex items-center gap-2.5">
          <FileText size={16} className="text-[var(--color-text-muted)] flex-shrink-0" />
          <Text as="p" size="sm" color="secondary">
            Awaiting first mission consolidation for {counterpartyKey ?? "this counterparty"}. Raw episodes are rolled up deterministically into a unified dossier.
          </Text>
        </div>
        <Token label="Pending Consolidation" size="sm" color="cyan" />
      </section>
    );
  }

  const successPercent = Math.round(dossier.successRate * 100);
  const defectEntries = Object.entries(dossier.recurringDefects || {});

  const handleCopyHash = () => {
    if (dossier.auditTrailHash) {
      void navigator.clipboard.writeText(dossier.auditTrailHash);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <section
      data-testid="dossier-container"
      aria-label="Consolidated Episodic Dossier"
      className={`p-5 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] flex flex-col gap-4 ${className ?? ""}`}
    >
      <div className="flex items-center justify-between gap-2 border-b border-[var(--color-border)] pb-3">
        <HStack gap={2} align="center">
          <TrendingUp size={16} className="text-[var(--color-accent)]" />
          <span className="font-semibold text-sm text-[var(--color-text)]">
            Consolidated Episodic Dossier
          </span>
        </HStack>
        <HStack gap={1} align="center">
          <Sparkles size={13} className="text-[var(--color-accent)] opacity-80" />
          <span className="text-[11px] font-mono text-[var(--color-text-muted)]">
            Sibyl R2 Consolidation Engine
          </span>
        </HStack>
      </div>

      {/* Success Rate Meter & Stats */}
      <div className="p-4 rounded-xl bg-[var(--color-canvas)] border border-[var(--color-border)] flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-[var(--color-text)]">
            Cumulative Success Rate
          </span>
          <span className="font-mono text-sm font-bold text-[var(--color-text)]">
            {successPercent}% ({dossier.acceptedCount} / {dossier.totalMissions} missions)
          </span>
        </div>

        {/* Meter Bar */}
        <div className="w-full h-2.5 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${successPercent >= 80 ? "bg-[var(--color-success)]" : successPercent >= 50 ? "bg-[var(--color-warning)]" : "bg-[var(--color-error)]"}`}
            style={{ width: `${successPercent}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-[11px] text-[var(--color-text-muted)] font-mono pt-1">
          <span>Accepted: {dossier.acceptedCount}</span>
          <span>Rejected: {dossier.rejectedCount}</span>
          <span>Total: {dossier.totalMissions}</span>
        </div>
      </div>

      {/* Recurring Defects Breakdown */}
      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold text-[var(--color-text)] flex items-center gap-1.5">
          <ShieldAlert size={14} className="text-[var(--color-warning)]" />
          <span>Recurring Defect Patterns</span>
        </span>
        {defectEntries.length === 0 ? (
          <div className="p-3 rounded-lg bg-[var(--color-canvas)] border border-[var(--color-border)] text-xs text-[var(--color-text-muted)]">
            Zero recurring defects identified across consolidated episodes.
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {defectEntries.map(([defect, count]) => (
              <Token
                key={defect}
                label={`${defect}: ${count}`}
                size="sm"
                color={count > 1 ? "red" : "orange"}
              />
            ))}
          </div>
        )}
      </div>

      {/* Probation Transitions Log */}
      {dossier.probationHistory && dossier.probationHistory.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold text-[var(--color-text)] flex items-center gap-1.5">
            <GitCommit size={14} className="text-[var(--color-accent)]" />
            <span>Probation State Transitions ({dossier.probationHistory.length})</span>
          </span>
          <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto font-mono text-xs">
            {dossier.probationHistory.map((item, idx) => (
              <div
                key={idx}
                className="p-2.5 rounded-lg bg-[var(--color-canvas)] border border-[var(--color-border)] flex flex-col gap-1"
              >
                <div className="flex items-center justify-between gap-2">
                  <HStack gap={1.5} align="center">
                    <Token label={item.fromStatus} size="sm" color="cyan" />
                    <span className="text-[var(--color-text-muted)]">→</span>
                    <Token
                      label={item.toStatus}
                      size="sm"
                      color={item.toStatus === "BLOCKED" ? "red" : item.toStatus === "WATCH" ? "orange" : "green"}
                    />
                  </HStack>
                  <span className="text-[11px] text-[var(--color-text-muted)]">
                    {new Date(item.timestamp).toLocaleDateString()}
                  </span>
                </div>
                {item.reason && (
                  <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5 font-sans">
                    {item.reason}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SHA-256 Audit Trail Hash */}
      <div className="p-3 rounded-xl bg-[var(--color-canvas)] border border-[var(--color-border)] flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="text-[11px] text-[var(--color-text-muted)] font-mono">
            Cryptographic Audit Trail Hash (SHA-256):
          </span>
          <code
            data-testid="dossier-audit-hash"
            className="text-xs font-mono text-[var(--color-accent)] truncate max-w-sm sm:max-w-md"
            title={dossier.auditTrailHash}
          >
            {dossier.auditTrailHash}
          </code>
        </div>
        <button
          type="button"
          onClick={handleCopyHash}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[var(--color-surface)] border border-[var(--color-border)] text-xs text-[var(--color-text)] hover:border-[var(--color-accent)] transition-colors"
          title="Copy SHA-256 hash"
        >
          {copied ? (
            <>
              <Check size={12} className="text-[var(--color-success)]" />
              <span>Copied</span>
            </>
          ) : (
            <>
              <Copy size={12} />
              <span>Copy Hash</span>
            </>
          )}
        </button>
      </div>
    </section>
  );
}

CounterpartyDossierView.displayName = "CounterpartyDossierView";

"use client";

import { Badge } from "@astryxdesign/core/Badge";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { Token } from "@astryxdesign/core/Token";
import { AlertOctagon, CheckCircle2, AlertTriangle, ShieldCheck, Sparkles } from "lucide-react";

import type { ExecutiveRiskDigest } from "@/lib/api-client";

export interface CounterpartyExecutiveSummaryProps {
  summary: ExecutiveRiskDigest | null;
  counterpartyKey?: string;
  className?: string;
}

function getRiskBadgeVariant(riskLevel: ExecutiveRiskDigest["riskLevel"]): "error" | "warning" | "success" | "neutral" {
  switch (riskLevel) {
    case "CRITICAL":
      return "error";
    case "HIGH":
      return "warning";
    case "MEDIUM":
      return "warning";
    case "LOW":
      return "success";
    default:
      return "neutral";
  }
}

function getActionTokenColor(action: string): "red" | "orange" | "green" | "cyan" {
  if (action === "DO_NOT_HIRE") return "red";
  if (action === "PROCEED_WITH_STRICT_VERIFICATION") return "orange";
  if (action === "HIRE") return "green";
  return "cyan";
}

function getActionLabel(action: string): string {
  switch (action) {
    case "DO_NOT_HIRE":
      return "Action: Do Not Hire";
    case "PROCEED_WITH_STRICT_VERIFICATION":
      return "Action: Strict Verification";
    case "HIRE":
      return "Action: Recommended for Hire";
    default:
      return `Action: ${action}`;
  }
}

export function CounterpartyExecutiveSummary({
  summary,
  counterpartyKey,
  className,
}: CounterpartyExecutiveSummaryProps) {
  if (!summary) {
    return (
      <div
        data-testid="executive-summary-empty"
        className={`p-4 rounded-xl bg-[var(--color-surface)] border border-[var(--color-border)] text-xs text-[var(--color-text-muted)] flex items-center gap-2.5 ${className ?? ""}`}
      >
        <Sparkles size={16} className="text-[var(--color-accent)] opacity-60 flex-shrink-0" />
        <Text as="p" size="sm" color="secondary">
          No executive summary available for {counterpartyKey ?? "this counterparty"}. Memory summarization synthesizes multi-episode interactions.
        </Text>
      </div>
    );
  }

  const primaryAction = summary.recommendations[0] ?? (summary.riskLevel === "CRITICAL" ? "DO_NOT_HIRE" : "HIRE");

  return (
    <section
      data-testid="executive-summary-hero"
      aria-label="Executive Risk Digest"
      className={`p-5 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-sm flex flex-col gap-4 relative overflow-hidden ${className ?? ""}`}
    >
      {/* Top Banner Row */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] pb-3">
        <HStack gap={2} align="center" wrap="wrap">
          <Badge
            variant={getRiskBadgeVariant(summary.riskLevel)}
            label={`RISK: ${summary.riskLevel}`}
          />
          <Token
            label={getActionLabel(primaryAction)}
            size="sm"
            color={getActionTokenColor(primaryAction)}
          />
          <Token
            label={`Status: ${summary.relationshipStatus}`}
            size="sm"
            color="cyan"
          />
        </HStack>

        <HStack gap={1} align="center">
          <Sparkles size={13} className="text-[var(--color-accent)] opacity-80" />
          <span className="text-[11px] font-mono text-[var(--color-text-muted)]">
            Sibyl R5 Executive Digest
          </span>
        </HStack>
      </div>

      {/* Headline & Core Narrative */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-start gap-2.5">
          {summary.riskLevel === "CRITICAL" ? (
            <AlertOctagon size={18} className="text-[var(--color-error)] mt-0.5 flex-shrink-0" />
          ) : summary.riskLevel === "HIGH" || summary.riskLevel === "MEDIUM" ? (
            <AlertTriangle size={18} className="text-[var(--color-warning)] mt-0.5 flex-shrink-0" />
          ) : (
            <CheckCircle2 size={18} className="text-[var(--color-success)] mt-0.5 flex-shrink-0" />
          )}
          <Text as="p" size="sm" weight="bold" className="text-[var(--color-text)]">
            {summary.headline}
          </Text>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-xl bg-[var(--color-canvas)] border border-[var(--color-border)] font-mono text-xs">
        <div className="flex flex-col gap-0.5">
          <span className="text-[11px] text-[var(--color-text-muted)]">Reliability</span>
          <span className="text-sm font-semibold text-[var(--color-text)]">
            {summary.reliabilityRating}
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[11px] text-[var(--color-text-muted)]">Success Rate</span>
          <span className="text-sm font-semibold text-[var(--color-text)]">
            {Math.round(summary.successRate * 100)}%
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[11px] text-[var(--color-text-muted)]">Consecutive Failures</span>
          <span className={`text-sm font-semibold ${summary.consecutiveFailures > 0 ? "text-[var(--color-error)]" : "text-[var(--color-text)]"}`}>
            {summary.consecutiveFailures}
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[11px] text-[var(--color-text-muted)]">Total Missions</span>
          <span className="text-sm font-semibold text-[var(--color-text)]">
            {summary.totalMissions}
          </span>
        </div>
      </div>

      {/* Key Findings & Recommendations */}
      {summary.keyFindings.length > 0 && (
        <VStack gap={1.5} className="pt-1">
          <span className="text-xs font-semibold text-[var(--color-text)]">Key Findings:</span>
          <ul className="list-disc list-inside space-y-1 text-xs text-[var(--color-text-muted)]">
            {summary.keyFindings.map((finding, idx) => (
              <li key={idx} className="leading-relaxed">
                <span className="text-[var(--color-text)]">{finding}</span>
              </li>
            ))}
          </ul>
        </VStack>
      )}

      {summary.recommendations.length > 0 && (
        <div className="flex items-start gap-2 p-2.5 rounded-lg bg-[var(--color-canvas)] border border-[var(--color-border)] text-xs">
          <ShieldCheck size={14} className="text-[var(--color-accent)] mt-0.5 flex-shrink-0" />
          <div className="flex flex-col gap-0.5">
            <span className="font-semibold text-[var(--color-text)]">Remediation & Recommendation:</span>
            <span className="text-[var(--color-text-muted)]">
              {summary.recommendations.join("; ")}
            </span>
          </div>
        </div>
      )}
    </section>
  );
}

CounterpartyExecutiveSummary.displayName = "CounterpartyExecutiveSummary";

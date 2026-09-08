"use client";

import { useState } from "react";
import Link from "next/link";
import { SegmentedControl, SegmentedControlItem } from "@astryxdesign/core/SegmentedControl";
import { StatusDot } from "@astryxdesign/core/StatusDot";
import { ChevronRight, Clock, DollarSign, Layers } from "lucide-react";
import { StatusBadge } from "@/components/primitives";
import { console_, formatEnvironment } from "@/features/console/copy";
import { getRunStatusInfo } from "@/features/console/components/chat-console-view";
import type { RunSummary } from "@/lib/api-client";

interface RunsViewProps {
  runs: RunSummary[];
  exampleRun: {
    objective: string;
    environment: string;
  };
}

type FilterState = "all" | "active" | "settled";

export function RunsView({ runs, exampleRun }: RunsViewProps) {
  const [filter, setFilter] = useState<FilterState>("all");

  const filteredRuns = runs.filter((r) => {
    if (filter === "all") return true;
    const status = (r.status || "").toLowerCase();
    const isActive = status === "running" || status === "pending" || status === "active";
    if (filter === "active") return isActive;
    if (filter === "settled") return !isActive;
    return true;
  });

  const showExample = filter === "all" || filter === "settled";

  return (
    <div className="flex flex-col gap-5 w-full max-w-5xl">
      {/* Top action bar: Filter tabs & New Mission button */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-[var(--color-border)]">
        <div className="flex items-center gap-3">
          <SegmentedControl
            value={filter}
            onChange={(next) => setFilter(next as FilterState)}
            label="Filter missions by status"
            size="sm"
          >
            <SegmentedControlItem
              value="all"
              label={`All (${runs.length + 1})`}
            />
            <SegmentedControlItem
              value="active"
              label="Active"
            />
            <SegmentedControlItem
              value="settled"
              label="Settled"
            />
          </SegmentedControl>
        </div>

        <Link
          href="/runs/new"
          className="btn btn--primary cs__action-link text-xs flex items-center gap-1.5"
          data-sound="press"
        >
          <Layers size={13} />
          <span>{console_.empty.create}</span>
        </Link>
      </div>

      {/* Mission Cards List */}
      <ul className="cs__list flex flex-col gap-3" role="list">
        {/* Demo Mission */}
        {showExample && (
          <li>
            <Link
              className="cs__row block p-4 rounded-xl bg-[var(--color-surface-raised,#1b1b1f)] border border-[var(--color-border)] hover:border-[var(--color-accent)] hover:shadow-lg transition-all"
              href="/runs/example"
              data-sound="tick"
            >
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="cs__row-objective">
                    <span
                      className="cs__row-title-wrap"
                      style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-2)" }}
                    >
                      <StatusDot
                        variant="success"
                        label="Completed"
                        isPulsing={false}
                        tooltip="Completed"
                      />
                      <span className="truncate">{exampleRun.objective}</span>
                    </span>
                  </span>
                  <div className="flex items-center gap-2">
                    <StatusBadge tone="warning">
                      {console_.missions.demoBadge}
                    </StatusBadge>
                    <ChevronRight size={14} className="text-[var(--color-text-muted)] opacity-60" />
                  </div>
                </div>

                <div className="cs__row-meta flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--color-text-muted,#8d9aaf)] pt-1 border-t border-[var(--color-border)]/50">
                  <span className="cs__row-env font-mono">{formatEnvironment(exampleRun.environment)}</span>
                  <span>·</span>
                  <span className="flex items-center gap-1">
                    <Clock size={11} />
                    <span>Fixture · Golden path</span>
                  </span>
                  <span>·</span>
                  <span className="flex items-center gap-1 font-mono text-[var(--color-accent)]">
                    <DollarSign size={11} />
                    <span>0.00 USDC</span>
                  </span>
                </div>
              </div>
            </Link>
          </li>
        )}

        {/* Real API Runs */}
        {filteredRuns.map((run) => {
          const statusInfo = getRunStatusInfo(run.status);
          return (
            <li key={run.id}>
              <Link
                className="cs__row block p-4 rounded-xl bg-[var(--color-surface-raised,#1b1b1f)] border border-[var(--color-border)] hover:border-[var(--color-accent)] hover:shadow-lg transition-all"
                href={`/runs/${run.id}`}
                data-sound="tick"
              >
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="cs__row-objective">
                      <span
                        className="cs__row-title-wrap"
                        style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-2)" }}
                      >
                        <StatusDot
                          variant={statusInfo.variant}
                          label={statusInfo.label}
                          isPulsing={statusInfo.isPulsing}
                          tooltip={statusInfo.tooltip}
                        />
                        <span className="truncate">{run.objective}</span>
                      </span>
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-muted)]">
                        {run.id}
                      </span>
                      <ChevronRight size={14} className="text-[var(--color-text-muted)] opacity-60" />
                    </div>
                  </div>

                  <div className="cs__row-meta flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--color-text-muted,#8d9aaf)] pt-1 border-t border-[var(--color-border)]/50">
                    <span className="cs__row-env font-mono">{formatEnvironment(run.environment)}</span>
                    <span>·</span>
                    <time dateTime={run.createdAt} className="flex items-center gap-1">
                      <Clock size={11} />
                      <span>{run.createdAt.slice(0, 19).replace("T", " ")}</span>
                    </time>
                    {run.budgetUsdc && (
                      <>
                        <span>·</span>
                        <span className="flex items-center gap-1 font-mono text-[var(--color-accent)]">
                          <DollarSign size={11} />
                          <span>{run.budgetUsdc} USDC ceiling</span>
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

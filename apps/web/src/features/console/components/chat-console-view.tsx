"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { Token } from "@astryxdesign/core/Token";
import { StatusDot } from "@astryxdesign/core/StatusDot";
import {
  SegmentedControl,
  SegmentedControlItem,
} from "@astryxdesign/core/SegmentedControl";

import type { RunSummary } from "@/lib/api-client";
import type { ChatGrounding } from "./console-chat";
import { ConsoleChat } from "./console-chat";
import { MissionInspector } from "./mission-inspector";

export type MissionFilterStatus = "all" | "active" | "settled";

export interface RunStatusInfo {
  variant: "accent" | "success" | "error" | "warning" | "neutral";
  label: string;
  isPulsing: boolean;
  tooltip: string;
  filterCategory: "active" | "settled";
}

export type ChatConsoleRun = RunSummary;

export function getRunStatusInfo(
  statusOrRun?: string | { status?: string | null } | null,
): RunStatusInfo {
  const rawStatus =
    typeof statusOrRun === "object" && statusOrRun !== null
      ? statusOrRun.status
      : statusOrRun;
  const status = rawStatus?.toUpperCase();

  switch (status) {
    case "COMPLETED":
    case "SUCCESS":
      return {
        variant: "success",
        label: "Completed",
        isPulsing: false,
        tooltip: "Completed",
        filterCategory: "settled",
      };
    case "FAILED":
    case "ERROR":
      return {
        variant: "error",
        label: "Failed",
        isPulsing: false,
        tooltip: "Failed",
        filterCategory: "settled",
      };
    case "CANCELLED":
    case "CANCELED":
      return {
        variant: "error",
        label: "Failed",
        isPulsing: false,
        tooltip: "Cancelled",
        filterCategory: "settled",
      };
    case "WAITING_APPROVAL":
    case "AWAITING_APPROVAL":
      return {
        variant: "warning",
        label: "Active",
        isPulsing: true,
        tooltip: "Active",
        filterCategory: "active",
      };
    case "BLOCKED":
      return {
        variant: "warning",
        label: "Active",
        isPulsing: true,
        tooltip: "Active",
        filterCategory: "active",
      };
    case "RUNNING":
    case "STARTING":
    case "CREATED":
    case "ACTIVE":
      return {
        variant: "accent",
        label: "Active",
        isPulsing: true,
        tooltip: "Active",
        filterCategory: "active",
      };
    default:
      return {
        variant: "neutral",
        label: "Settled",
        isPulsing: false,
        tooltip: "Settled",
        filterCategory: "settled",
      };
  }
}

export interface ChatConsoleViewProps {
  runs: readonly RunSummary[];
  grounding?: ChatGrounding;
  initialRunId?: string;
  onSelectRun?: (runId: string | null) => void;
}

export function ChatConsoleView({
  runs,
  grounding,
  initialRunId,
  onSelectRun,
}: ChatConsoleViewProps) {
  const [selectedRunId, setSelectedRunId] = useState<string | null>(
    initialRunId ?? (runs.length > 0 ? runs[0]!.id : null),
  );
  const [filter, setFilter] = useState<MissionFilterStatus>("all");

  const counts: Record<MissionFilterStatus, number> = useMemo(() => {
    let active = 0;
    let settled = 0;
    for (const run of runs) {
      const info = getRunStatusInfo(run.status);
      if (info.filterCategory === "active") {
        active++;
      } else {
        settled++;
      }
    }
    return {
      all: runs.length,
      active,
      settled,
    };
  }, [runs]);

  const filteredRuns = useMemo(() => {
    if (filter === "all") return runs;
    return runs.filter((run) => getRunStatusInfo(run.status).filterCategory === filter);
  }, [runs, filter]);

  const activeRun = runs.find((r) => r.id === selectedRunId);

  return (
    <div className="cs__chat-console-layout">
      {/* Run Selector Sidebar */}
      <aside className="cs__chat-console-sidebar" aria-label="Mission context selector">
        <div className="cs__chat-console-sidebar-header">
          <Text as="h2" size="sm" weight="semibold">
            Context Selector
          </Text>
          <Text as="p" size="xsm" color="secondary">
            Select a Mission to ground the agent&apos;s memory retrieval, or use Global Assistant.
          </Text>
        </div>

        <div className="cs__chat-console-sidebar-actions">
          <button
            type="button"
            className={`cs__chat-context-item ${selectedRunId === null ? "is-active" : ""}`}
            onClick={() => {
              setSelectedRunId(null);
              onSelectRun?.(null);
            }}
          >
            <HStack justify="between" align="center">
              <Text as="span" size="sm" weight="medium">
                Global Assistant
              </Text>
              <Token label="SYSTEM" size="sm" color="cyan" />
            </HStack>
            <Text as="span" size="xsm" color="secondary">
              General commands, orientation & system controls
            </Text>
          </button>
        </div>

        <div className="cs__chat-console-missions-header">
          <Text as="h3" size="xsm" color="secondary" weight="semibold">
            RECENT MISSIONS ({counts[filter]})
          </Text>
        </div>

        <div className="cs__chat-console-filter" style={{ marginBottom: "var(--space-2)" }}>
          <SegmentedControl
            value={filter}
            onChange={(val) => setFilter(val as MissionFilterStatus)}
            label="Filter missions by status"
            size="sm"
            layout="fill"
          >
            <SegmentedControlItem value="all" label="All" />
            <SegmentedControlItem value="active" label="Active" />
            <SegmentedControlItem value="settled" label="Settled" />
          </SegmentedControl>
        </div>

        <div className="cs__chat-console-missions-list" role={filteredRuns.length > 0 ? "list" : undefined}>
          {filteredRuns.map((run) => {
            const isSelected = run.id === selectedRunId;
            const statusInfo = getRunStatusInfo(run.status);
            const formattedBudget = run.budgetUsdc
              ? `${Number.parseFloat(run.budgetUsdc)} USDC`
              : "RUN";
            return (
              <div key={run.id} role="listitem">
                <button
                  type="button"
                  className={`cs__chat-context-item ${isSelected ? "is-active" : ""}`}
                  onClick={() => {
                    setSelectedRunId(run.id);
                    onSelectRun?.(run.id);
                  }}
                >
                  <HStack justify="between" align="center" gap={2}>
                    <HStack align="center" gap={2} style={{ minWidth: 0 }}>
                      <StatusDot
                        variant={statusInfo.variant}
                        label={statusInfo.label}
                        isPulsing={statusInfo.isPulsing}
                        tooltip={statusInfo.tooltip}
                      />
                      <span className="cs__chat-context-title">
                        {run.objective}
                      </span>
                    </HStack>
                    <div style={{ flexShrink: 0 }}>
                      <Token
                        label={formattedBudget}
                        size="sm"
                        color={isSelected ? "cyan" : "gray"}
                      />
                    </div>
                  </HStack>
                  <HStack justify="between" align="center" gap={2}>
                    <code className="cs__chat-context-id">{run.id.slice(0, 8)}...</code>
                    <Text as="span" size="xsm" color="secondary">
                      {new Date(run.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </Text>
                  </HStack>
                </button>
              </div>
            );
          })}

          {filteredRuns.length === 0 ? (
            <div className="cs__chat-empty-runs">
              <Text as="p" size="xsm" color="secondary">
                {runs.length === 0
                  ? "No missions found yet."
                  : `No ${filter} missions found.`}
              </Text>
              {runs.length === 0 ? (
                <Link href="/runs/new" className="btn btn--sm btn--primary">
                  + Start a Mission
                </Link>
              ) : null}
            </div>
          ) : null}
        </div>
      </aside>

      {/* Main Chat Conversation Area */}
      <section className="cs__chat-console-main" aria-label="Conversation area">
        <header className="cs__chat-console-main-header">
          <HStack justify="between" align="center" wrap="wrap" gap={3}>
            <VStack gap={1}>
              <HStack align="center" gap={2}>
                {activeRun && (() => {
                  const activeStatus = getRunStatusInfo(activeRun.status);
                  return (
                    <StatusDot
                      variant={activeStatus.variant}
                      label={activeStatus.label}
                      isPulsing={activeStatus.isPulsing}
                      tooltip={activeStatus.tooltip}
                    />
                  );
                })()}
                <Text as="h1" size="lg" weight="semibold">
                  {activeRun ? activeRun.objective : "Global Chat Console"}
                </Text>
                <Token
                  label={activeRun ? "MISSION SCOPED" : "GLOBAL"}
                  size="sm"
                  color={activeRun ? "green" : "cyan"}
                />
              </HStack>
              {activeRun ? (
                <Text as="p" size="xsm" color="secondary">
                  Grounded in Mission <code>{activeRun.id}</code> · Budget: {activeRun.budgetUsdc ? `${Number.parseFloat(activeRun.budgetUsdc)} USDC` : "0 USDC"} · {activeRun.environment}
                </Text>
              ) : (
                <Text as="p" size="xsm" color="secondary">
                  Ready for console navigation commands and general operator queries.
                </Text>
              )}
            </VStack>

            {activeRun ? (
              <Link href={`/runs/${activeRun.id}`} className="btn btn--sm btn--secondary">
                Open Mission Workspace ↗
              </Link>
            ) : (
              <Link href="/runs/new" className="btn btn--sm btn--primary">
                + New Mission
              </Link>
            )}
          </HStack>

          {activeRun && (
            <div className="cs__chat-console-inspector-slot">
              <MissionInspector
                runId={activeRun.id}
                environment={activeRun.environment}
                budgetUsdc={activeRun.budgetUsdc ?? undefined}
                isCollapsible={true}
              />
            </div>
          )}
        </header>

        <div className="cs__chat-console-body">
          <ConsoleChat
            key={selectedRunId ?? "global"}
            runId={selectedRunId ?? undefined}
            grounding={grounding}
          />
        </div>
      </section>
    </div>
  );
}

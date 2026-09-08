"use client";

import { useMemo, useState } from "react";
import { Badge } from "@astryxdesign/core/Badge";
import { Button } from "@astryxdesign/core/Button";
import { ProgressBar } from "@astryxdesign/core/ProgressBar";
import { SegmentedControl, SegmentedControlItem } from "@astryxdesign/core/SegmentedControl";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { Token } from "@astryxdesign/core/Token";
import { CheckCircle2, RotateCcw, Search, ShieldCheck, X, Zap } from "lucide-react";

import { console_ } from "../copy";
import type { RunStatus, TimelineEntry } from "../model/types";
import type { MissionColumn, MissionProgress } from "../projection/mission-rail";
import { MissionStepCard } from "./mission-step-card";

const COLUMNS: readonly MissionColumn[] = ["QUEUED", "RUNNING", "NEEDS_YOU", "DONE"];

export interface MissionBoardProps {
  progress: MissionProgress;
  runId?: string;
  budgetUsdc?: string;
  spentUsdc?: string;
  /** Selecting a Board card scrolls Operator to the event that produced it. */
  onSelect?: (eventId: string) => void;
  onApproved?: () => void;
  onRejected?: () => void;
  /** Full timeline entries to enable historical intelligence, stage jumping & pipeline view */
  allEntries?: readonly TimelineEntry[];
  /** Current filtered/scrubbed entries */
  currentEntries?: readonly TimelineEntry[];
  /** Active status of the run */
  runStatus?: RunStatus;
  /** Selecting a scrub point folds the Run to that event's timestamp. */
  onScrubTo?: (entry: TimelineEntry) => void;
  /** Jump back to the settled end or live head */
  onResetLive?: () => void;
  /** True when the playhead is parked at a historical scrub point */
  isHistorical?: boolean;
  /** Label if run is a fixture demo */
  fixtureLabel?: string;
}

/**
 * Another projection of the same Mission, not a project-management system.
 *
 * Board never gains its own tasks, its own ordering, or a card an event did not
 * create: every card here is one of the six steps, and a step is only present
 * because events classified into it or because it is still ahead of the Run.
 * Two views over one event stream cannot disagree about what happened.
 */
export function MissionBoard({
  progress,
  runId,
  budgetUsdc,
  spentUsdc,
  onSelect,
  onApproved,
  onRejected,
  allEntries,
  currentEntries: _currentEntries,
  runStatus,
  onScrubTo,
  onResetLive,
  isHistorical = false,
  fixtureLabel: _fixtureLabel,
}: MissionBoardProps) {
  const [filterQuery, setFilterQuery] = useState("");
  const [viewMode, setViewMode] = useState<"kanban" | "pipeline">("kanban");

  // Find key milestone events for interactive lifecycle simulation
  const approvalEvent = useMemo(() => {
    if (!allEntries) return undefined;
    return allEntries.find((e) => e.type === "run.blocked" || e.type.includes("approval.requested"));
  }, [allEntries]);

  const runningEvent = useMemo(() => {
    if (!allEntries) return undefined;
    return allEntries.find((e) => e.type === "acp.job.funded" || e.type === "run.started");
  }, [allEntries]);

  // Calculate mission-level KPI stats
  const totalSteps = progress.nodes.length;
  const completedSteps = progress.nodes.filter((n) => n.column === "DONE").length;
  const runningSteps = progress.nodes.filter((n) => n.column === "RUNNING").length;
  const needsYouSteps = progress.nodes.filter((n) => n.column === "NEEDS_YOU").length;
  const progressPercent = Math.round((completedSteps / (totalSteps || 1)) * 100);

  const isWaitingApproval =
    runStatus === "WAITING_APPROVAL" || progress.nodes.some((n) => n.column === "NEEDS_YOU");
  const isExecuting =
    runStatus === "RUNNING" ||
    (progress.nodes.some((n) => n.column === "RUNNING") && !isWaitingApproval);

  // Filter nodes based on user query
  const query = filterQuery.trim().toLowerCase();
  const filteredNodes = useMemo(() => {
    if (!query) return progress.nodes;
    return progress.nodes.filter((node) => {
      const stepLabel = console_.mission.rail.steps[node.step]?.toLowerCase() ?? "";
      const matchesStep = stepLabel.includes(query) || node.step.toLowerCase().includes(query);
      const matchesEntries = node.entries.some((e) => {
        const typeMatch = e.type.toLowerCase().includes(query);
        const summaryMatch = e.summary.toLowerCase().includes(query);
        const cp = typeof e.data?.counterparty_key === "string" ? e.data.counterparty_key.toLowerCase() : "";
        return typeMatch || summaryMatch || cp.includes(query);
      });
      return matchesStep || matchesEntries;
    });
  }, [progress.nodes, query]);

  return (
    <section className="mw__board" aria-labelledby="mission-board-heading">
      {/* Real accessible heading for screen readers */}
      <h2 id="mission-board-heading" className="visually-hidden">
        {console_.mission.board.label}
      </h2>

      {/* Board KPI & Overview Toolbar */}
      <div className="mw__board-toolbar">
        <VStack gap={3}>
          <HStack justify="between" align="center" wrap="wrap" gap={3}>
            <VStack gap={1} className="mw__board-progress-wrap">
              <HStack justify="between" align="center">
                <Text as="span" size="sm" weight="medium" color="primary">
                  Mission Execution Progress
                </Text>
                <Text as="span" size="sm" weight="semibold" color="secondary">
                  {completedSteps}/{totalSteps} Steps ({progressPercent}%)
                </Text>
              </HStack>
              <ProgressBar
                value={progressPercent}
                max={100}
                label="Mission execution progress"
                variant={progressPercent === 100 ? "success" : "accent"}
              />
            </VStack>

            <HStack gap={2} align="center" wrap="wrap" className="mw__board-kpis">
              {spentUsdc ? (
                <Token size="sm" color="green" label={`Spent: ${spentUsdc} USDC`} />
              ) : null}
              {budgetUsdc ? (
                <Token size="sm" color="gray" label={`Ceiling: ${budgetUsdc} USDC`} />
              ) : null}
              {runningSteps > 0 ? (
                <Badge variant="info" label={`${runningSteps} Running`} />
              ) : null}
              {needsYouSteps > 0 ? (
                <Badge variant="warning" label={`${needsYouSteps} Action Needed`} />
              ) : null}
            </HStack>
          </HStack>

          {/* Search / Filter Input */}
          <HStack justify="between" align="center" gap={2} className="mw__board-filter-bar">
            <div className="mw__board-search-box">
              <TextInput
                label="Filter steps"
                isLabelHidden
                value={filterQuery}
                onChange={(val) => setFilterQuery(typeof val === "string" ? val : "")}
                placeholder="Filter steps by name, counterparty, or event..."
                aria-label="Filter board steps"
                startIcon={<Search size={14} />}
              />
            </div>

            {filterQuery ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setFilterQuery("")}
                label="Clear filter"
                icon={<X size={12} />}
              />
            ) : null}

            <p className="cs__hint mw__board-note">{console_.mission.board.note}</p>
          </HStack>

          {/* Lifecycle Simulation & View Mode Toolbar */}
          <div className="mw__board-stage-bar">
            <HStack justify="between" align="center" wrap="wrap" gap={2} className="w-full">
              <HStack gap={2} align="center" wrap="wrap">
                <Text as="span" size="xsm" weight="semibold" color="secondary">
                  LIFECYCLE STAGE:
                </Text>
                <HStack gap={1} wrap="wrap">
                  <Button
                    size="sm"
                    variant={isWaitingApproval ? "primary" : "secondary"}
                    onClick={() => approvalEvent && onScrubTo?.(approvalEvent)}
                    label="⚡ Needs Approval (Decide)"
                    isDisabled={!approvalEvent || !onScrubTo}
                  />
                  <Button
                    size="sm"
                    variant={isExecuting ? "primary" : "secondary"}
                    onClick={() => runningEvent && onScrubTo?.(runningEvent)}
                    label="▶ Running Dispatched (Act)"
                    isDisabled={!runningEvent || !onScrubTo}
                  />
                  <Button
                    size="sm"
                    variant={!isHistorical && !isWaitingApproval && !isExecuting ? "primary" : "secondary"}
                    onClick={onResetLive}
                    label="✓ Completed (Settled)"
                    isDisabled={!isHistorical || !onResetLive}
                  />
                </HStack>
              </HStack>

              <div className="mw__board-view-switch">
                <SegmentedControl
                  value={viewMode}
                  onChange={(val) => setViewMode(val as "kanban" | "pipeline")}
                  label="Board layout mode"
                >
                  <SegmentedControlItem value="kanban" label="Wait-State (Kanban)" />
                  <SegmentedControlItem value="pipeline" label="Pipeline (All 6 Steps)" />
                </SegmentedControl>
              </div>
            </HStack>
          </div>
        </VStack>
      </div>

      {/* Main Content: Pipeline View or Kanban Columns */}
      {viewMode === "pipeline" ? (
        <div className="mw__board-pipeline-grid" role="region" aria-label="Pipeline view of all 6 steps">
          {filteredNodes.map((node) => (
            <div key={node.step} className="mw__board-pipeline-item">
              <MissionStepCard
                node={node}
                runId={runId}
                onSelect={onSelect}
                onApproved={onApproved}
                onRejected={onRejected}
                defaultExpanded={true}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="mw__board-columns">
          {COLUMNS.map((column) => {
            const nodes = filteredNodes.filter((node) => node.column === column);
            const rawCount = progress.nodes.filter((node) => node.column === column).length;
            const title = console_.mission.board.columns[column];

            const columnBadgeVariant =
              column === "DONE"
                ? "success"
                : column === "RUNNING"
                  ? "info"
                  : column === "NEEDS_YOU"
                    ? "warning"
                    : "neutral";

            return (
              <section key={column} className="mw__board-column" aria-label={title}>
                <header className="mw__board-column-header">
                  <h3 className="mw__board-column-title">
                    {title}
                    <span className="mw__board-count">
                      {console_.mission.board.count(nodes.length)}
                    </span>
                  </h3>
                  <Badge
                    variant={columnBadgeVariant}
                    label={rawCount.toString()}
                  />
                </header>

                {nodes.length === 0 ? (
                  <div className="mw__board-empty-state">
                    {filterQuery ? (
                      <p className="cs__muted">No matching steps</p>
                    ) : column === "NEEDS_YOU" && approvalEvent ? (
                      <div className="mw__board-intel-card" data-column="NEEDS_YOU">
                        <HStack gap={2} align="center" className="mw__board-intel-head">
                          <ShieldCheck size={16} className="mw__board-intel-icon" />
                          <Text as="span" size="sm" weight="semibold">
                            1 Approval Gate Resolved
                          </Text>
                        </HStack>
                        <Text as="p" size="xsm" color="secondary" className="mw__board-intel-desc">
                          Step 3 (Decide) required human authorization. Operator authorized 18.50 USDC quote.
                        </Text>
                        {onScrubTo ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => onScrubTo(approvalEvent)}
                            label="Replay Approval Gate"
                            icon={<RotateCcw size={12} />}
                          />
                        ) : null}
                      </div>
                    ) : column === "RUNNING" && (progressPercent === 100 || !isExecuting) ? (
                      <div className="mw__board-intel-card" data-column="RUNNING">
                        <HStack gap={2} align="center" className="mw__board-intel-head">
                          <Zap size={16} className="mw__board-intel-icon" />
                          <Text as="span" size="sm" weight="semibold">
                            All Steps Executed
                          </Text>
                        </HStack>
                        <Text as="p" size="xsm" color="secondary" className="mw__board-intel-desc">
                          Autonomous transactions dispatched and settled on Base Sepolia. Zero active background tasks.
                        </Text>
                        {onScrubTo && runningEvent ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => onScrubTo(runningEvent)}
                            label="Replay Execution State"
                            icon={<RotateCcw size={12} />}
                          />
                        ) : null}
                      </div>
                    ) : column === "QUEUED" && progressPercent === 100 ? (
                      <div className="mw__board-intel-card" data-column="QUEUED">
                        <HStack gap={2} align="center" className="mw__board-intel-head">
                          <CheckCircle2 size={16} className="mw__board-intel-icon" />
                          <Text as="span" size="sm" weight="semibold">
                            Pipeline Fully Dispatched
                          </Text>
                        </HStack>
                        <Text as="p" size="xsm" color="secondary" className="mw__board-intel-desc">
                          All 6 planned steps were scheduled and executed without queued backlog.
                        </Text>
                      </div>
                    ) : (
                      <p className="cs__muted">
                        {column === "QUEUED"
                          ? "All scheduled steps have begun or settled."
                          : column === "RUNNING"
                            ? "No steps currently executing."
                            : column === "NEEDS_YOU"
                              ? "No human actions or approvals required."
                              : console_.mission.board.emptyColumn}
                      </p>
                    )}
                  </div>
                ) : (
                  <ul className="mw__board-cards">
                    {nodes.map((node) => (
                      <li key={node.step} className="mw__board-card" data-column={column}>
                        <MissionStepCard
                          node={node}
                          runId={runId}
                          onSelect={onSelect}
                          onApproved={onApproved}
                          onRejected={onRejected}
                          defaultExpanded={node.column === "RUNNING" || node.column === "NEEDS_YOU"}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}
    </section>
  );
}

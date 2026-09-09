"use client";

import { useReducer, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@astryxdesign/core/Button";
import { Section } from "@astryxdesign/core/Section";
import { SegmentedControl, SegmentedControlItem } from "@astryxdesign/core/SegmentedControl";
import { Theme } from "@astryxdesign/core/theme";
import { Bot, Play } from "lucide-react";

import { MonoRef, StatusBadge, type StatusTone, playInteractionSound } from "@/components/primitives";
import { env } from "@/lib/env";
import { stoneTheme } from "@/themes/stone/stoneTheme";

import { console_, formatEnvironment } from "../copy";
import {
  MEMORY_VIEW_SERVER_SNAPSHOT,
  getMemoryViewEnabled,
  subscribeMemoryView,
} from "../memory-view-state";
import type { CanonicalEvent, RunStatus, RunView, TimelineEntry } from "../model/types";
import { isTerminal } from "../model/types";
import {
  initialPresentation,
  isHistorical,
  playhead,
  presentationReducer,
  transportLabel,
} from "../presentation/presentation-state";
import { foldRun, type FoldSeed } from "../projection/fold-run";
import { buildMissionProgress } from "../projection/mission-rail";
import { buildSpine } from "../projection/spine";
import type { ChatGrounding } from "./console-chat";
import { McpExecutiveOverview } from "./mcp-executive-overview";
import { MissionBoard } from "./mission-board";
import { MissionInspector } from "./mission-inspector";
import { MissionOperator } from "./mission-operator";
import { MissionRail } from "./mission-rail";
import { MissionTrace } from "./mission-trace";

export interface MissionWorkspaceProps {
  events: readonly CanonicalEvent[];
  seed: FoldSeed;
  /** Labelled when the events are a fixture rather than a real Mission. */
  fixtureLabel?: string;
  /** Checked readiness of the answering path, read on the server. */
  grounding?: ChatGrounding;
  /** Initial mode for the workspace view (default: "OPERATOR") */
  initialMode?: MissionMode;
  /** Force show executive autonomous agent & Sibyl memory overview */
  showExecutiveOverview?: boolean;
  /** Default expanded state for step cards in board view */
  defaultExpanded?: boolean;
  /** Initial view mode for the Board (kanban or pipeline) */
  initialBoardView?: "kanban" | "pipeline";
}

type MissionMode = "OPERATOR" | "BOARD" | "TRACE";

const MODES: readonly MissionMode[] = ["OPERATOR", "BOARD", "TRACE"];

/**
 * COMPLETED is a settled success; FAILED and CANCELLED are settled too, and
 * neither is "pending". Only a Mission that is genuinely still moving gets the
 * in-progress tone.
 */
function statusTone(status: RunStatus): StatusTone {
  if (status === "COMPLETED") return "ready";
  if (status === "FAILED") return "error";
  if (status === "CANCELLED") return "neutral";
  return "pending";
}

/**
 * One Mission, in three modes.
 *
 * The modes are projections of the same events, not three systems with three
 * states: all of them read `foldRun(events, seed, playhead)`. Switching mode
 * never re-fetches and never forks state, which is what stops the three views
 * disagreeing about what happened — the same rule that already stops live and
 * replay drifting apart.
 */
export function MissionWorkspace({
  events,
  seed,
  fixtureLabel,
  grounding: _grounding,
  initialMode = "OPERATOR",
  showExecutiveOverview = false,
  defaultExpanded = false,
  initialBoardView,
}: MissionWorkspaceProps) {
  const router = useRouter();
  const [evaluating, setEvaluating] = useState(false);
  const [mode, setMode] = useState<MissionMode>(initialMode);

  const handleStartEvaluation = async () => {
    setEvaluating(true);
    playInteractionSound("tick");
    try {
      await fetch(`${env.NEXT_PUBLIC_API_URL}/api/runs/${seed.runId}/evaluate`, {
        method: "POST",
      });
      playInteractionSound("pulse");
      router.refresh();
    } catch (err) {
      console.error("[mission-workspace] evaluation error", err);
    } finally {
      setEvaluating(false);
    }
  };

  // A finished recording must not open claiming LIVE. "Live" means following a
  // moving edge; a Mission that already ended has no edge to follow, and a
  // fixture never had one.
  const complete = foldRun(events, seed, null);
  const ended = isTerminal(complete.status) || fixtureLabel !== undefined;
  const [presentation, dispatch] = useReducer(
    presentationReducer,
    ended && complete.lastSequence !== null
      ? ({ mode: "ENDED", finalSequence: complete.lastSequence } as const)
      : initialPresentation,
  );
  const at = playhead(presentation);
  // `complete` is already the unfiltered projection, so folding a second time
  // for the same playhead is pure duplicate work on every scrub.
  const view: RunView = at === null ? complete : foldRun(events, seed, at);
  const historical = isHistorical(presentation);

  const memoryOn = useSyncExternalStore(
    subscribeMemoryView,
    getMemoryViewEnabled,
    () => MEMORY_VIEW_SERVER_SNAPSHOT,
  );
  const spine = buildSpine(view.entries, { hideMemory: !memoryOn });
  const progress = buildMissionProgress(view.entries, view.status);
  // The COUNT of events, not the highest sequence NUMBER: sequences are
  // zero-based, so `lastSequence` reports one fewer than the Mission contains.
  const total = complete.entries.length;

  /* Not wrapped in useCallback. The React Compiler memoizes these itself, and
     a manual dependency list it cannot verify makes it skip the whole
     component rather than optimise it. */
  const scrubTo = (entry: TimelineEntry) =>
    dispatch({ kind: "scrubTo", sequence: entry.sequence, atTime: entry.eventTime });

  const resetLive = () => {
    if (ended && complete.lastSequence !== null) {
      dispatch({ kind: "ended", finalSequence: complete.lastSequence });
    } else {
      dispatch({ kind: "jumpToLive" });
    }
  };

  /* Selecting a step scrolls to the event that produced it, in whichever mode
     is open. It opens no panel of its own: the rail is a summary above the
     conversation, never the primary way to read a Mission. */
  const jumpTo = (eventId: string) => {
    setMode("OPERATOR");
    // The element exists only once Operator has rendered it.
    requestAnimationFrame(() => {
      document
        .getElementById(`event-${eventId}`)
        ?.scrollIntoView({ block: "center", behavior: "auto" });
    });
  };

  // Extract Base Sepolia transaction references recorded in the event stream
  const txHashes = view.entries
    .map((e) => {
      const val = e.data?.tx_hash ?? e.data?.reference ?? e.data?.txHash;
      return typeof val === "string" ? val : null;
    })
    .filter((h): h is string => Boolean(h && h.startsWith("0x")));

  return (
    <section className="mw" aria-labelledby="mission-heading">
      <header className="run__head">
        <div className="flex-1 min-w-0">
          <span className="text-[10px] font-mono tracking-wider uppercase px-2 py-0.5 rounded bg-white/5 text-neutral-400 border border-white/10 inline-block mb-1.5">
            Mission Objective
          </span>
          <h1 id="mission-heading" className="run__objective">
            {view.objective}
          </h1>
          <p className="run__meta">
            <MonoRef label="RUN">{view.runId}</MonoRef>
            <MonoRef label="SOURCE">{view.source}</MonoRef>
            <MonoRef label="ENV">{formatEnvironment(view.environment)}</MonoRef>
          </p>
        </div>
        <div className="run__states">
          <StatusBadge tone={statusTone(view.status)}>{view.status}</StatusBadge>
          {historical ? (
            <StatusBadge tone="warning">{`HISTORY · ${presentation.atTime}`}</StatusBadge>
          ) : (
            <StatusBadge tone="pending">{transportLabel(presentation)}</StatusBadge>
          )}
        </div>
      </header>

      {fixtureLabel && mode !== "BOARD" ? <p className="run__fixture">{fixtureLabel}</p> : null}

      {/* Autonomous MCP Agent Executive Overview Hero */}
      {showExecutiveOverview || fixtureLabel ? (
        <McpExecutiveOverview
          runId={view.runId}
          budgetUsdc={view.budgetUsdc ?? undefined}
          spentUsdc={view.spentUsdc ?? undefined}
          onJumpToTool={() => {
            setMode("BOARD");
          }}
        />
      ) : null}

      <MissionInspector
        runId={view.runId}
        environment={formatEnvironment(view.environment)}
        budgetUsdc={view.budgetUsdc ?? undefined}
        spentUsdc={view.spentUsdc ?? undefined}
        memoryStatus={console_.mission.memory[view.retrievalStatus]}
        txHashes={txHashes}
      />

      {view.entries.length <= 1 && !fixtureLabel ? (
        <div className="p-4 rounded-xl bg-gradient-to-r from-neutral-900/90 via-neutral-900/60 to-neutral-950 border border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 my-3 shadow-lg shadow-black/20">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-400 flex-shrink-0 mt-0.5">
              <Bot size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-white tracking-tight">
                  Autonomous Agent Pipeline
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                  READY TO EVALUATE
                </span>
              </div>
              <p className="text-xs text-neutral-400 mt-1 max-w-xl leading-relaxed">
                Economic objective and budget ceiling are declared. Trigger autonomous evaluation to recall Sibyl memory, rank counterparties, and generate spend approval.
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={evaluating}
            onClick={handleStartEvaluation}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-neutral-950 transition-all duration-150 disabled:opacity-50 self-start sm:self-auto flex-shrink-0 shadow-sm shadow-emerald-950 cursor-pointer active:scale-[0.98]"
          >
            <Play size={13} className={evaluating ? "animate-spin" : "fill-current"} />
            <span>{evaluating ? "Evaluating Counterparties..." : "Start Agent Evaluation"}</span>
          </button>
        </div>
      ) : null}

      <MissionRail progress={progress} onJump={jumpTo} />

      <div className="run__modes-bar flex items-center justify-between gap-3 my-2.5">
        <div className="run__modes-wrap w-fit">
          <SegmentedControl
            value={mode}
            onChange={(next) => setMode(next as MissionMode)}
            label={console_.mission.modeLabel}
          >
            {MODES.map((value) => (
              <SegmentedControlItem
                key={value}
                value={value}
                label={console_.mission.modes[value]}
              />
            ))}
          </SegmentedControl>
        </div>
      </div>

      {/* The console operates on a unified dark stone theme matching ai-chat.
          Astryx tokens resolve in dark mode with high contrast (>= 4.5:1 WCAG AA). */}
      {mode === "TRACE" ? (
        <MissionTrace
          spine={spine}
          envelope={view.contextEnvelope}
          memoryOn={memoryOn}
          entries={view.entries}
          totalEvents={total}
          transport={transportLabel(presentation)}
          onScrubTo={scrubTo}
        />
      ) : (
        <Theme theme={stoneTheme} mode="dark">
          <Section padding={0} variant="transparent" className="mw__editorial">
            {mode === "OPERATOR" ? (
              <MissionOperator
                entries={view.entries}
                onScrubTo={scrubTo}
                runId={view.runId}
              />
            ) : (
              <MissionBoard
                progress={progress}
                runId={view.runId}
                budgetUsdc={view.budgetUsdc ?? undefined}
                spentUsdc={view.spentUsdc ?? undefined}
                onSelect={jumpTo}
                allEntries={complete.entries}
                currentEntries={view.entries}
                runStatus={view.status}
                onScrubTo={scrubTo}
                onResetLive={resetLive}
                isHistorical={historical}
                fixtureLabel={fixtureLabel}
                defaultExpanded={defaultExpanded}
                showImpactStrip={!showExecutiveOverview && !fixtureLabel}
                initialViewMode={initialBoardView ?? (fixtureLabel ? "pipeline" : "kanban")}
              />
            )}
          </Section>
        </Theme>
      )}

      {/* No Play or Pause. Nothing advances the playhead: there is no timer and
          no stream, so pressing Play changed a badge while the Mission sat
          still. Scrubbing and returning are the two things that work. */}
      <div className="run__transport" role="group" aria-label="Timeline transport">
        <p className="run__foot">
          Showing {view.entries.length} of {total} {total === 1 ? "event" : "events"}
          {historical ? ", held at an earlier point in this Mission." : "."}
        </p>
        <Button
          size="sm"
          variant="secondary"
          className="btn"
          onClick={() =>
            ended && complete.lastSequence !== null
              ? dispatch({ kind: "ended", finalSequence: complete.lastSequence })
              : dispatch({ kind: "jumpToLive" })
          }
          isDisabled={!historical}
          label={ended ? "Back to the end" : "Back to latest"}
        />
      </div>
    </section>
  );
}

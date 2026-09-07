"use client";

import { useReducer, useState, useSyncExternalStore } from "react";
import { SegmentedControl, SegmentedControlItem } from "@astryxdesign/core/SegmentedControl";
import { Theme } from "@astryxdesign/core/theme";

import { MonoRef, StatusBadge, type StatusTone } from "@/components/primitives";
import { neutralTheme } from "@/themes/neutral/neutral.js";

import { console_ } from "../copy";
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
}: MissionWorkspaceProps) {
  const [mode, setMode] = useState<MissionMode>("OPERATOR");

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
        <div>
          <h1 id="mission-heading" className="run__objective">
            {view.objective}
          </h1>
          <p className="run__meta">
            <MonoRef label="RUN">{view.runId}</MonoRef>
            <MonoRef label="SOURCE">{view.source}</MonoRef>
            <MonoRef label="ENV">{view.environment}</MonoRef>
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

      {fixtureLabel ? <p className="run__fixture">{fixtureLabel}</p> : null}

      <MissionInspector
        runId={view.runId}
        environment={view.environment}
        budgetUsdc={view.budgetUsdc ?? undefined}
        spentUsdc={view.spentUsdc ?? undefined}
        memoryStatus={console_.mission.memory[view.retrievalStatus]}
        txHashes={txHashes}
      />

      <MissionRail progress={progress} onJump={jumpTo} />

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

      {/* Two layers, split by what the surface is for rather than by which app
          it belongs to. Operator and Board are the product layer and read on
          the light editorial scale; Trace is the system layer and keeps the
          dark one. Dark is now a signal that the operator is looking at raw
          system information, not the ambient temperature of the whole product.

          `Theme` is the switch because the tokens are already there: nothing
          below invents a colour, it just resolves the same names against the
          other mode. */}
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
        <Theme theme={neutralTheme} mode="dark">
          <div className="mw__editorial">
            {mode === "OPERATOR" ? (
              <MissionOperator
                entries={view.entries}
                onScrubTo={scrubTo}
              />
            ) : (
              <MissionBoard progress={progress} onSelect={jumpTo} />
            )}
          </div>
        </Theme>
      )}

      {/* No Play or Pause. Nothing advances the playhead: there is no timer and
          no stream, so pressing Play changed a badge while the Mission sat
          still. Scrubbing and returning are the two things that work. */}
      <div className="run__transport" role="group" aria-label="Timeline transport">
        <button
          type="button"
          className="btn"
          onClick={() =>
            ended && complete.lastSequence !== null
              ? dispatch({ kind: "ended", finalSequence: complete.lastSequence })
              : dispatch({ kind: "jumpToLive" })
          }
          disabled={!historical}
        >
          {ended ? "Back to the end" : "Back to latest"}
        </button>
      </div>

      <p className="run__foot">
        Showing {view.entries.length} of {total} {total === 1 ? "event" : "events"}
        {historical ? ", held at an earlier point in this Mission." : "."}
      </p>
    </section>
  );
}

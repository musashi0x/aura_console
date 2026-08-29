"use client";

import { useReducer } from "react";

import { MonoRef, StatusBadge } from "@/components/primitives";

import { isTerminal, type RunView } from "../model/types";
import { foldRun, type FoldSeed } from "../projection/fold-run";
import type { CanonicalEvent } from "../model/types";
import {
  initialPresentation,
  isHistorical,
  playhead,
  presentationReducer,
  transportLabel,
} from "../presentation/presentation-state";

export interface RunTimelineProps {
  events: readonly CanonicalEvent[];
  seed: FoldSeed;
  /** Labelled when the events are a fixture rather than a real Run. */
  fixtureLabel?: string;
}

/**
 * The timeline folds events through the same projection whether it is
 * following live or showing history. Replay is `foldRun(events, seed,
 * playhead)`; live is the same call with `null`. There is no second code path,
 * which is what stops replay and live drifting apart.
 */
export function RunTimeline({ events, seed, fixtureLabel }: RunTimelineProps) {
  // A finished recording must not open claiming LIVE. "Live" means following a
  // moving edge; a Run that already ended has no edge to follow, and a fixture
  // never had one. Opening in LIVE put a "… LIVE" badge on example data, which
  // is exactly the claim this product may never make.
  const complete = foldRun(events, seed, null);
  const ended = isTerminal(complete.status) || fixtureLabel !== undefined;
  const [presentation, dispatch] = useReducer(
    presentationReducer,
    ended && complete.lastSequence !== null
      ? ({ mode: "ENDED", finalSequence: complete.lastSequence } as const)
      : initialPresentation,
  );
  const at = playhead(presentation);
  const view: RunView = foldRun(events, seed, at);
  const historical = isHistorical(presentation);
  // The COUNT of events, not the highest sequence NUMBER. Sequences are
  // zero-based, so `lastSequence` reported one fewer than the Run contains, and
  // a single-event Run read as "0 events".
  const total = complete.entries.length;

  return (
    <section className="run" aria-labelledby="run-heading">
      <header className="run__head">
        <div>
          <h1 id="run-heading" className="run__objective">
            {view.objective}
          </h1>
          <p className="run__meta">
            <MonoRef label="RUN">{view.runId}</MonoRef>
            <MonoRef label="SOURCE">{view.source}</MonoRef>
            <MonoRef label="ENV">{view.environment}</MonoRef>
          </p>
        </div>
        <div className="run__states">
          <StatusBadge tone={view.status === "COMPLETED" ? "ready" : "pending"}>
            {view.status}
          </StatusBadge>
          {/* Historical state must never be mistaken for live state. */}
          {historical ? (
            <StatusBadge tone="warning">
              HISTORY
              {presentation.mode === "HISTORY" ? ` · ${presentation.atTime}` : ""}
            </StatusBadge>
          ) : (
            <StatusBadge tone="pending">{transportLabel(presentation)}</StatusBadge>
          )}
        </div>
      </header>

      {fixtureLabel ? <p className="run__fixture">{fixtureLabel}</p> : null}

      <dl className="run__facts">
        <div>
          <dt>Budget</dt>
          <dd>{view.budgetUsdc ?? "Not set"}</dd>
        </div>
        <div>
          <dt>Spent</dt>
          {/* null means not yet projected. Rendering it as 0.00 would assert a
              fact no event has reported. */}
          <dd>{view.spentUsdc ?? "Not yet reported"}</dd>
        </div>
        <div>
          <dt>Memory</dt>
          <dd>{view.retrievalStatus}</dd>
        </div>
      </dl>

      <div className="run__transport" role="group" aria-label="Timeline transport">
        <button
          type="button"
          className="btn"
          onClick={() => dispatch({ kind: "pause" })}
          disabled={ended || at === null}
        >
          Pause
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => dispatch({ kind: "play" })}
          disabled={ended || at === null}
        >
          Play
        </button>
        {/* Offered only where it means something. Without a stream there is no
            live edge to return to on an unfinished Run, and an ended Run has
            none at all. The control is removed rather than disabled, so it does
            not advertise a capability the Console does not have. */}
        {ended ? null : (
          <button
            type="button"
            className="btn"
            onClick={() => dispatch({ kind: "jumpToLive" })}
            disabled={!historical}
          >
            Back to latest
          </button>
        )}
      </div>

      <ol className="run__events">
        {view.entries.map((entry) => (
          <li key={entry.eventId} className="run__event">
            <button
              type="button"
              className="run__event-btn"
              onClick={() =>
                dispatch({ kind: "scrubTo", sequence: entry.sequence, atTime: entry.eventTime })
              }
              aria-label={`Show the Run as of ${entry.summary}`}
            >
              <span className="run__seq" aria-hidden="true">
                {String(entry.sequence).padStart(2, "0")}
              </span>
              <span className="run__event-body">
                <span className="run__event-title">{entry.summary}</span>
                <span className="run__event-meta">
                  {/* Three different answers, and they were collapsed into one.
                      A stage is where the event sits in the decision story. A
                      lifecycle event has no stage but is fully understood.
                      UNRECOGNISED is reserved for a type the fold knows nothing
                      about, which is the only case worth a warning. */}
                  {entry.stage ?? (entry.support === "SUPPORTED" ? "LIFECYCLE" : "UNRECOGNISED")} ·{" "}
                  {entry.type}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ol>

      <p className="run__foot">
        Showing {view.entries.length} of {total} {total === 1 ? "event" : "events"}
        {historical ? ", held at an earlier point in this Run." : "."}
      </p>
    </section>
  );
}

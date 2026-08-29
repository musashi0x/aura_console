"use client";

import { useReducer } from "react";

import { MonoRef, StatusBadge } from "@/components/primitives";

import type { RunView } from "../model/types";
import { foldRun, type FoldSeed } from "../projection/fold-run";
import type { CanonicalEvent } from "../model/types";
import {
  initialPresentation,
  isHistorical,
  playhead,
  presentationReducer,
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
  const [presentation, dispatch] = useReducer(presentationReducer, initialPresentation);
  const at = playhead(presentation);
  const view: RunView = foldRun(events, seed, at);
  const historical = isHistorical(presentation);
  const last = foldRun(events, seed, null).lastSequence;

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
            <StatusBadge tone="pending">{presentation.mode}</StatusBadge>
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
          disabled={at === null}
        >
          Pause
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => dispatch({ kind: "play" })}
          disabled={at === null}
        >
          Play
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => dispatch({ kind: "jumpToLive" })}
          disabled={!historical}
        >
          Jump to live
        </button>
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
                  {entry.stage ?? "UNRECOGNISED"} · {entry.type}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ol>

      <p className="run__foot">
        Showing {view.entries.length} of {last ?? 0} events
        {historical ? ", held at an earlier point in this Run." : "."}
      </p>
    </section>
  );
}

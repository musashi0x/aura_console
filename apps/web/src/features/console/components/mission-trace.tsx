"use client";

import { MonoRef } from "@/components/primitives";

import { console_ } from "../copy";
import type { ContextEnvelope, TimelineEntry } from "../model/types";
import type { Spine } from "../projection/spine";
import { RunSpine } from "./run-spine";

export interface MissionTraceProps {
  spine: Spine;
  envelope: ContextEnvelope | null;
  memoryOn: boolean;
  entries: readonly TimelineEntry[];
  totalEvents: number;
  /** What actually carried these events, e.g. LATEST SNAPSHOT. */
  transport: string;
  onScrubTo?: (entry: TimelineEntry) => void;
}

/**
 * The system layer: raw lifecycle events, and the full canonical spine.
 *
 * The stages are not deleted, they are moved. They are system ontology, and
 * system ontology belongs behind a mode a developer opens deliberately rather
 * than on the surface an operator opens first.
 *
 * The connection strip reports the real transport. While there is no stream it
 * says what the read actually was; "live events connected" is the shape this
 * takes once a stream exists, not a label to render early.
 */
export function MissionTrace({
  spine,
  envelope,
  memoryOn,
  entries,
  totalEvents,
  transport,
  onScrubTo,
}: MissionTraceProps) {
  return (
    <section className="mw__trace" aria-labelledby="mission-trace-heading">
      <h2 id="mission-trace-heading" className="visually-hidden">
        {console_.mission.trace.label}
      </h2>
      <p className="mw__trace-strip">
        <MonoRef label={console_.mission.trace.connectionTitle}>{transport}</MonoRef>
        <MonoRef label="EVENTS">{console_.mission.trace.events(totalEvents)}</MonoRef>
      </p>
      <p className="cs__hint">{console_.mission.trace.note}</p>

      <RunSpine spine={spine} envelope={envelope} memoryOn={memoryOn} />

      <ol className="run__events">
        {entries.map((entry) => (
          <li key={entry.eventId} className="run__event">
            <button
              type="button"
              className="run__event-btn"
              onClick={() => onScrubTo?.(entry)}
              aria-label={console_.mission.operator.scrubTo(entry.summary)}
            >
              <span className="run__seq" aria-hidden="true">
                {String(entry.sequence).padStart(2, "0")}
              </span>
              <span className="run__event-body">
                <span className="run__event-title">{entry.summary}</span>
                <span className="run__event-meta">
                  {/* A stage is where the event sits in the decision story. A
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
    </section>
  );
}

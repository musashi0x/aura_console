"use client";

import { useState } from "react";
import { Button } from "@astryxdesign/core/Button";
import { TextInput } from "@astryxdesign/core/TextInput";
import { MonoRef } from "@/components/primitives";
import { ChevronDown, ChevronUp } from "lucide-react";

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
  const [filterQuery, setFilterQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filteredEntries = filterQuery.trim()
    ? entries.filter(
        (e) =>
          e.summary.toLowerCase().includes(filterQuery.toLowerCase()) ||
          e.type.toLowerCase().includes(filterQuery.toLowerCase()),
      )
    : entries;

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

      <div className="mw__trace-filter">
        <TextInput
          size="sm"
          label="Filter trace events"
          isLabelHidden
          placeholder="Filter trace events by type or summary..."
          value={filterQuery}
          onChange={(val) => setFilterQuery(val)}
        />
      </div>

      <ol className="run__events">
        {filteredEntries.map((entry) => {
          const isExpanded = expandedId === entry.eventId;
          return (
            <li key={entry.eventId} className="run__event">
              <div className="mw__trace-item">
                <div className="mw__trace-row">
                  <button
                    type="button"
                    className="run__event-btn mw__trace-btn"
                    onClick={() => onScrubTo?.(entry)}
                    aria-label={console_.mission.operator.scrubTo(entry.summary)}
                  >
                    <span className="run__seq" aria-hidden="true">
                      {String(entry.sequence).padStart(2, "0")}
                    </span>
                    <span className="run__event-body">
                      <span className="run__event-title">{entry.summary}</span>
                      <span className="run__event-meta">
                        {entry.stage ??
                          (entry.support === "SUPPORTED" ? "LIFECYCLE" : "UNRECOGNISED")}{" "}
                        · {entry.type}
                      </span>
                    </span>
                  </button>
                  {entry.data ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="mw__card-action-btn mw__trace-action"
                      onClick={() => setExpandedId(isExpanded ? null : entry.eventId)}
                      icon={isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      label="JSON"
                    />
                  ) : null}
                </div>

                {isExpanded && entry.data ? (
                  <pre className="mw__card-payload mw__trace-payload">
                    <code>{JSON.stringify(entry.data, null, 2)}</code>
                  </pre>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

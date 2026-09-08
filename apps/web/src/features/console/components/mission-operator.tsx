"use client";

import type { ReactNode } from "react";
import { List, ListItem } from "@astryxdesign/core/List";
import { Button } from "@astryxdesign/core/Button";

import { console_ } from "../copy";
import { EventCard } from "./cards/event-card";
import type { TimelineEntry } from "../model/types";
import type { Counterfactual } from "../projection/counterfactual";

export interface MissionOperatorProps {
  entries: readonly TimelineEntry[];
  /** Selecting a scrub point folds the Run to that event's timestamp. */
  onScrubTo?: (entry: TimelineEntry) => void;
  /**
   * Rendered inline below the stream when the surface hosts conversation,
   * not a column docked to one edge of it.
   */
  conversation?: ReactNode;
  /** The live Mission. Absent for the fixture, which offers no live control. */
  runId?: string;
  /** Re-read the Mission once an approval is recorded. */
  onApproved?: () => void;
  /** Re-read the Mission once a rejection is recorded. */
  onRejected?: () => void;
  /** The no-memory comparison, folded from this Mission's own events. */
  counterfactual?: Counterfactual;
}

/**
 * The primary view of a Mission: an edge-to-edge list stream of verified facts.
 *
 * Each row is rendered via Astryx List and ListItem, edge-to-edge with dividers.
 * Every fact can be scrubbed to, but scrubbing is a separate control so a
 * screen reader reads the event record without turning the whole item into a button name.
 */
export function MissionOperator({
  entries,
  onScrubTo,
  conversation,
  runId,
  onApproved,
  onRejected,
  counterfactual,
}: MissionOperatorProps) {
  if (entries.length === 0) {
    return (
      <section className="mw__operator" aria-labelledby="mission-operator-heading">
        <h2 id="mission-operator-heading" className="visually-hidden">
          {console_.mission.operator.label}
        </h2>
        <h3 className="mw__empty-title">{console_.mission.operator.emptyTitle}</h3>
        <p className="cs__hint">{console_.mission.operator.emptyBody}</p>
        {conversation ? <div className="mw__conversation">{conversation}</div> : null}
      </section>
    );
  }

  return (
    <section className="mw__operator" aria-labelledby="mission-operator-heading">
      <h2 id="mission-operator-heading" className="visually-hidden">
        {console_.mission.operator.label}
      </h2>
      <List hasDividers density="balanced" className="mw__stream">
        {entries.map((entry) => (
          <ListItem
            key={entry.eventId}
            id={`event-${entry.eventId}`}
            className="mw__entry"
            label={
              <div className="mw__entry-content">
                <EventCard
                  entry={entry}
                  runId={runId}
                  onApproved={onApproved}
                  onRejected={onRejected}
                  counterfactual={counterfactual}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="mw__entry-scrub"
                  onClick={() => onScrubTo?.(entry)}
                  label={console_.mission.operator.scrubTo(entry.summary)}
                />
              </div>
            }
          />
        ))}
      </List>

      {conversation ? <div className="mw__conversation">{conversation}</div> : null}
    </section>
  );
}

"use client";

import type { ReactNode } from "react";

import { console_ } from "../copy";
import type { TimelineEntry } from "../model/types";

export interface MissionOperatorProps {
  entries: readonly TimelineEntry[];
  /** Scrubs the Mission back to the moment an entry was recorded. */
  onScrubTo?: (entry: TimelineEntry) => void;
  /**
   * The conversation, rendered in the centre of the Mission rather than in a
   * panel beside it. Conversation is the default mode INSIDE a Mission, so the
   * place an operator types is the middle of the thing they are directing —
   * not a column docked to one edge of it.
   */
  conversation?: ReactNode;
}

/**
 * The default mode: what happened, in the order it happened.
 *
 * Progressive rendering. A Mission with no events shows a prompt, not six empty
 * stage cards; a Mission with events shows exactly what those events produced.
 *
 * Every entry here is currently an inspectable raw entry — the treatment an
 * unrecognised type already gets — because the event-to-card renderer is not
 * built. That is a placeholder for CARDS, never for facts: it shows what the
 * event recorded and adds nothing to it. A card that a model wrote, or that
 * rendered a number the stream does not contain, would take every guarantee
 * this Console has with it.
 */
export function MissionOperator({ entries, onScrubTo, conversation }: MissionOperatorProps) {
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
      <p className="cs__hint">{console_.mission.operator.rawNote}</p>
      <ol className="mw__stream">
        {entries.map((entry) => (
          <li key={entry.eventId} id={`event-${entry.eventId}`} className="mw__entry">
            <button
              type="button"
              className="mw__entry-btn"
              onClick={() => onScrubTo?.(entry)}
              aria-label={console_.mission.operator.scrubTo(entry.summary)}
            >
              <span className="mw__entry-title">{entry.summary}</span>
              <span className="mw__entry-meta">
                <time dateTime={entry.eventTime}>{entry.eventTime}</time>
                {" · "}
                {entry.type}
              </span>
            </button>
          </li>
        ))}
      </ol>

      {conversation ? <div className="mw__conversation">{conversation}</div> : null}
    </section>
  );
}

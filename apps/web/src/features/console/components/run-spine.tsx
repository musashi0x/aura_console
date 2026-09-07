"use client";

import { useState } from "react";

import { StatusBadge } from "@/components/primitives";

import { console_ } from "../copy";
import type { ContextEnvelope } from "../model/types";
import type { Spine, SpineStage } from "../projection/spine";
import { EvidenceDrawer } from "./evidence-drawer";

export interface RunSpineProps {
  spine: Spine;
  envelope: ContextEnvelope | null;
  /** False while the Memory Off view is on, so the banner can say so once. */
  memoryOn: boolean;
}

/**
 * EVIDENCE -> DECISION -> ECONOMIC ACTION -> OUTCOME -> MEMORY DIFF.
 *
 * Every node states what it is, whether the Run reached it, and when — in the
 * markup, not behind a click. Without JavaScript this is still an ordered list
 * that reads correctly; the drawer only adds provenance on top of it.
 */
/**
 * Split an event time into date and clock so a narrow column breaks it at a
 * meaningful point. `overflow-wrap: anywhere` broke it mid-token — "2026-08-"
 * over "29T09:00:12.000Z" — which reads as a corrupted value. The full instant
 * stays in the `datetime` attribute either way, so nothing is lost.
 */
function splitEventTime(value: string): { date: string; clock: string } | null {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})/.exec(value);
  if (!match) return null;
  return { date: match[1]!, clock: `${match[2]!}Z` };
}

export function RunSpine({ spine, envelope, memoryOn }: RunSpineProps) {
  const [open, setOpen] = useState<SpineStage | null>(null);
  const selected = spine.nodes.find((node) => node.stage === open) ?? null;
  const reached = spine.nodes.filter((node) => node.state === "REACHED");

  return (
    <section className="cs__spine" aria-labelledby="spine-heading">
      <h2 id="spine-heading" className="cs__spine-heading">
        {console_.spine.title}
      </h2>

      {!memoryOn ? (
        <p className="cs__spine-banner" role="status">
          {console_.memoryView.banner}
        </p>
      ) : null}

      {/* Only stages the Run has actually reached.
       *
       * `NOT REACHED` used to render as a full card per unreached stage, so a
       * fresh Mission spent most of the viewport saying nothing has happened
       * yet. A stage that has not happened is not a state worth drawing.
       *
       * The distinction that rendering was protecting is real and is kept
       * elsewhere: "we could not look" is not "we looked and there is nothing",
       * and that belongs to a surface whose data source failed — which is what
       * the unavailable states are for. A future stage is neither. */}
      {/* The whole spine, as markers. Five cards for five stages meant a fresh
       * Mission spent its viewport saying nothing had happened; one hollow
       * marker says the same thing in a line. The state is in the text, not
       * only in the marker, so it survives without colour or shape. */}
      <ol className="cs__spine-rail" aria-label={console_.spine.rail.label}>
        {spine.nodes.map((node) => {
          const stage = console_.spine.stages[node.stage];
          return (
            <li key={node.stage} className="cs__spine-rail-step" data-state={node.state}>
              <span className="cs__spine-marker" aria-hidden="true" />
              <span className="cs__spine-rail-label" aria-hidden="true">
                {stage.label}
              </span>
              <span className="visually-hidden">
                {node.state === "REACHED"
                  ? console_.spine.rail.reached(stage.label)
                  : console_.spine.rail.notReached(stage.label)}
              </span>
            </li>
          );
        })}
      </ol>

      <ol className="cs__spine-list">
        {reached.map((node, index) => {
          const stage = console_.spine.stages[node.stage];
          return (
            <li key={node.stage} className="cs__spine-node" data-state={node.state}>
              <span className="cs__spine-index" aria-hidden="true">
                {index + 1}
              </span>
              <div className="cs__spine-body">
                <h3 className="cs__spine-title">{stage.label}</h3>
                <p className="cs__state-badge">
                  <StatusBadge tone="ready">
                    {console_.spine.events(node.entries.length)}
                  </StatusBadge>
                </p>
                {/* A reached stage always carries the moment it was reached. A
                    stage with a state but no time is a claim the operator
                    cannot place in the Run. */}
                {node.firstTime ? (
                  <p className="cs__spine-time">
                    <time dateTime={node.firstTime}>
                      {(() => {
                        const parts = splitEventTime(node.firstTime);
                        return parts ? (
                          <>
                            <span className="cs__spine-date">{parts.date}</span>{" "}
                            <span className="cs__spine-clock">{parts.clock}</span>
                          </>
                        ) : (
                          node.firstTime
                        );
                      })()}
                    </time>
                  </p>
                ) : null}
                <p className="cs__detail">{stage.explanation}</p>
                {node.hiddenByMemoryOff > 0 ? (
                  <p className="cs__hint">{console_.spine.hidden(node.hiddenByMemoryOff)}</p>
                ) : null}
                <button
                  type="button"
                  className="btn cs__spine-inspect"
                  onClick={() => setOpen(node.stage)}
                  aria-haspopup="dialog"
                >
                  {console_.spine.inspect(stage.label)}
                </button>
              </div>
            </li>
          );
        })}
      </ol>

      {spine.offSpine.length > 0 ? (
        <details className="cs__spine-off">
          <summary>
            {console_.spine.offSpine} ({console_.spine.events(spine.offSpine.length)})
          </summary>
          <p className="cs__hint">{console_.spine.offSpineNote}</p>
          <ul className="cs__spine-off-list">
            {spine.offSpine.map((entry) => (
              <li key={entry.eventId}>
                {entry.summary} — <code>{entry.type}</code>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {selected ? (
        <EvidenceDrawer node={selected} envelope={envelope} onClose={() => setOpen(null)} />
      ) : null}
    </section>
  );
}

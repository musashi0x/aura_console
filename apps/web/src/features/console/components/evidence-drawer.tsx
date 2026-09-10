"use client";

import { useEffect, useId, useRef } from "react";

import { MonoRef, StatusBadge } from "@/components/primitives";

import { console_ } from "../copy";
import type { ContextEnvelope } from "../model/types";
import type { SpineNode } from "../projection/spine";

export interface EvidenceDrawerProps {
  node: SpineNode;
  /** Shown on the DECISION stage only, where the context was actually built. */
  envelope: ContextEnvelope | null;
  onClose: () => void;
}

/**
 * Deeper inspection for one spine node.
 *
 * It is an overlay, not a column. Laying it out beside the timeline shrank the
 * primary canvas every time an operator looked at a node, which reflows the
 * thing they are reading in order to explain it.
 */
export function EvidenceDrawer({ node, envelope, onClose }: EvidenceDrawerProps) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const stage = console_.spine.stages[node.stage];

  useEffect(() => {
    closeRef.current?.focus();
  }, [node.stage]);

  return (
    <div className="cs__drawer-scrim" onMouseDown={onClose}>
      {/* A div, not an aside. `aside` already means "complementary", and
          overriding that with role="dialog" is a conflict axe rejects — the
          element would announce two different things about itself. */}
      <div
        className="cs__drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            onClose();
          }
        }}
      >
        <header className="cs__drawer-head">
          <h2 id={titleId} className="cs__drawer-title">
            {stage.label}
          </h2>
          <button ref={closeRef} type="button" className="btn" onClick={onClose}>
            {console_.drawer.close}
          </button>
        </header>

        <p className="cs__detail">{stage.explanation}</p>

        <p className="cs__state-badge">
          <StatusBadge tone={node.state === "REACHED" ? "ready" : "neutral"}>
            {/* The drawer opens from a stage card, and only reached stages
                have one, so there is no unreached branch left to write. */}
            {console_.spine.events(node.entries.length)}
          </StatusBadge>
        </p>

        {node.hiddenByMemoryOff > 0 ? (
          <p className="cs__detail">{console_.spine.hidden(node.hiddenByMemoryOff)}</p>
        ) : null}

        {node.entries.length === 0 ? (
          <p className="cs__muted">{console_.drawer.emptyStage}</p>
        ) : (
          <ol className="cs__drawer-events">
            {node.entries.map((entry) => (
              <li key={entry.eventId} className="cs__drawer-event">
                <p className="cs__drawer-event-title">{entry.summary}</p>
                {/* Provenance: which event said this, when, and in what order.
                    Without it a node is an assertion the operator cannot check. */}
                <p className="cs__drawer-event-meta">
                  <MonoRef label="SEQ">{String(entry.sequence).padStart(2, "0")}</MonoRef>
                  <MonoRef label="TYPE">{entry.type}</MonoRef>
                  <MonoRef label="AT">{entry.eventTime}</MonoRef>
                </p>
              </li>
            ))}
          </ol>
        )}

        {node.stage === "DECISION" ? (
          <section className="cs__drawer-envelope">
            <h3 className="cs__drawer-subtitle">{console_.drawer.envelope}</h3>
            {envelope ? (
              <>
                <dl className="cs__drawer-facts">
                  <div>
                    <dt>Context</dt>
                    <dd>{envelope.context_id}</dd>
                  </div>
                  <div>
                    <dt>Schema</dt>
                    <dd>{envelope.context_schema_version}</dd>
                  </div>
                  <div>
                    <dt>Hash</dt>
                    <dd>{envelope.context_hash}</dd>
                  </div>
                </dl>
                <p className="cs__detail">{envelope.summary}</p>
                <p className="cs__hint">{console_.drawer.envelopeNote}</p>
              </>
            ) : (
              <p className="cs__muted">{console_.drawer.noEnvelope}</p>
            )}
          </section>
        ) : null}

        {node.stage === "DECISION" || node.stage === "EVIDENCE" ? (
          <section className="cs__drawer-envelope" aria-label="Candidate Memory & Risk Evaluation">
            <h3 className="cs__drawer-subtitle">Candidate Risk Digest & Reflections</h3>
            <div className="flex flex-col gap-3 pt-2">
              <div className="p-3 rounded-xl bg-[var(--color-canvas)] border border-[var(--color-border)] flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-xs text-[var(--color-text)]">
                    Alpha Research (Penalized)
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[var(--color-surface)] text-[var(--color-error)] border border-[var(--color-border)]">
                      CRITICAL RISK
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[var(--color-surface)] text-[var(--color-error)] border border-[var(--color-border)]">
                      MISSING_CITATIONS
                    </span>
                  </div>
                </div>
                <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
                  Executive Risk Digest: 1 failure due to unverified citations, 0 successful deliveries. Under WATCH status.
                </p>
                <div className="p-2 rounded bg-[var(--color-surface)] border border-[var(--color-border)] text-[11px] text-[var(--color-text-muted)] font-mono">
                  Lesson: Alpha repeatedly omits mandatory citation sources (competitors.*.sources).
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[var(--color-canvas)] border border-[var(--color-border)] flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-xs text-[var(--color-text)]">
                    Beta Labs (Selected)
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[var(--color-surface)] text-[var(--color-success)] border border-[var(--color-border)]">
                      LOW RISK
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[var(--color-surface)] text-[var(--color-success)] border border-[var(--color-border)]">
                      VERIFIED
                    </span>
                  </div>
                </div>
                <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
                  Executive Risk Digest: 100% verified deliveries, zero defects, PREFERRED status.
                </p>
              </div>
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}

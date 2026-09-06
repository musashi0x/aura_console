"use client";

import { console_ } from "../copy";
import type { MissionProgress } from "../projection/mission-rail";

export interface MissionRailProps {
  progress: MissionProgress;
  /** Scrolls Operator to the first card in a step. */
  onJump?: (eventId: string) => void;
}

/**
 * Six steps, because six is the story an operator reads. The ten canonical
 * stages remain the system's vocabulary and remain in Trace.
 *
 * A step that has not happened is a hollow marker. It is not a card, and it
 * does not say NOT REACHED: a stage in the future is neither "we could not
 * look" nor "we looked and there is nothing", which are the two claims the old
 * rendering was conflating.
 *
 * The rail is never the primary way to read a Mission. It is a summary above
 * the conversation, and clicking a step only scrolls — it opens no panel of its
 * own.
 *
 * Not Astryx's Stepper, and the reason is measured rather than stylistic.
 * Stepper derives progress from position: every step before `activeStep` is
 * drawn as completed, connector filled. A Mission's reached set has holes —
 * it can reach Decide without ever consulting memory — and rendering that
 * through Stepper marked the skipped step `data-progress="completed"` with a
 * filled bar running through it. No prop reaches that: `status` sets colour
 * only, `indicator` sets the badge only, and moving `activeStep` to avoid the
 * gap misreports the steps after it instead.
 *
 * A filled progress bar through a stage that never happened is a claim the
 * events do not support, so this stays a list that says exactly what each step
 * is. Stepper is the right component for a linear flow; this is not one.
 */
export function MissionRail({ progress, onJump }: MissionRailProps) {
  return (
    <ol className="mw__rail" aria-label={console_.mission.rail.label}>
      {progress.nodes.map((node) => {
        const label = console_.mission.rail.steps[node.step];
        const state = node.reached ? "REACHED" : "NOT_REACHED";
        const anchor = node.firstEventId;
        return (
          <li key={node.step} className="mw__rail-step" data-state={state}>
            {anchor !== null && onJump ? (
              <button
                type="button"
                className="mw__rail-jump"
                onClick={() => onJump(anchor)}
                aria-label={console_.mission.rail.jump(label)}
              >
                <span className="mw__rail-marker" aria-hidden="true" />
                <span aria-hidden="true">{label}</span>
              </button>
            ) : (
              /* Nothing to scroll to, so nothing to click. A control that
                 cannot act is not rendered. */
              <span className="mw__rail-static">
                <span className="mw__rail-marker" aria-hidden="true" />
                <span aria-hidden="true">{label}</span>
              </span>
            )}
            {/* The marker is decorative. State has to survive without colour
                and without shape, so it is stated in text. */}
            <span className="visually-hidden">
              {node.reached
                ? console_.mission.rail.reached(label)
                : console_.mission.rail.notReached(label)}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

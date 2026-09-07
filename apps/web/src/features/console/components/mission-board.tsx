"use client";

import { console_ } from "../copy";
import type { MissionColumn, MissionProgress } from "../projection/mission-rail";

const COLUMNS: readonly MissionColumn[] = ["QUEUED", "RUNNING", "NEEDS_YOU", "DONE"];

export interface MissionBoardProps {
  progress: MissionProgress;
  /** Selecting a Board card scrolls Operator to the event that produced it. */
  onSelect?: (eventId: string) => void;
}

/**
 * Another projection of the same Mission, not a project-management system.
 *
 * Board never gains its own tasks, its own ordering, or a card an event did not
 * create: every card here is one of the six steps, and a step is only present
 * because events classified into it or because it is still ahead of the Run.
 * Two views over one event stream cannot disagree about what happened, which is
 * the same reason live and replay share one fold.
 */
export function MissionBoard({ progress, onSelect }: MissionBoardProps) {
  return (
    <section className="mw__board" aria-labelledby="mission-board-heading">
      {/* A real heading, not just an aria-label: the columns below are h3, and
          a region that jumps from the Mission's h1 straight to h3 gives a
          screen-reader user a level with nothing at it. */}
      <h2 id="mission-board-heading" className="visually-hidden">
        {console_.mission.board.label}
      </h2>
      <p className="cs__hint">{console_.mission.board.note}</p>
      <div className="mw__board-columns">
        {COLUMNS.map((column) => {
          const nodes = progress.nodes.filter((node) => node.column === column);
          const title = console_.mission.board.columns[column];
          return (
            <section key={column} className="mw__board-column" aria-label={title}>
              <h3 className="mw__board-column-title">
                {title}
                <span className="mw__board-count">
                  {console_.mission.board.count(nodes.length)}
                </span>
              </h3>
              {nodes.length === 0 ? (
                <p className="cs__muted">{console_.mission.board.emptyColumn}</p>
              ) : (
                <ul className="mw__board-cards">
                  {nodes.map((node) => {
                    const label = console_.mission.rail.steps[node.step];
                    const anchor = node.firstEventId;
                    return (
                      <li key={node.step} className="mw__board-card" data-column={column}>
                        {anchor !== null && onSelect ? (
                          <button
                            type="button"
                            className="mw__board-card-btn"
                            onClick={() => onSelect(anchor)}
                          >
                            <span className="mw__board-card-title">{label}</span>
                            <span className="mw__board-card-meta">
                              {console_.spine.events(node.entries.length)}
                            </span>
                          </button>
                        ) : (
                          <span className="mw__board-card-btn" aria-disabled="true">
                            <span className="mw__board-card-title">{label}</span>
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </section>
  );
}

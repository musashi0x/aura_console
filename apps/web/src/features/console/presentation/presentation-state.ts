/**
 * Timeline transport state, from State Machines section 21.
 *
 * This is a union rather than a pair of booleans because replay shown as
 * current is a named trust-boundary threat: the operator must always be able
 * to tell live from recorded.
 */
export type PresentationState =
  | { mode: "LIVE" }
  /* Kept in the union because they are real presentation states the product
     will have once the playhead can advance. Nothing produces them today: the
     reducer has no command that returns either. */
  | { mode: "PLAYING"; sequence: number }
  | { mode: "PAUSED"; sequence: number }
  | { mode: "HISTORY"; sequence: number; atTime: string }
  | { mode: "ENDED"; finalSequence: number };

export type TransportCommand =
  /* No `play` or `pause`. Removing the commands rather than ignoring them
     makes PLAYING and PAUSED unreachable at COMPILE time: a caller that tries
     to dispatch one does not typecheck, so the states cannot come back by
     accident before the progression that justifies them. */
  | { kind: "scrubTo"; sequence: number; atTime: string }
  | { kind: "jumpToLive" }
  | { kind: "ended"; finalSequence: number };

export const initialPresentation: PresentationState = { mode: "LIVE" };

/**
 * What the transport badge says, in words the reader can act on.
 *
 * LIVE is a claim that the Console is following a moving edge. It has no
 * stream, so a single read of an unfinished Run is the newest state it knows
 * about, not a subscription to the newest state that exists. Saying LIVE there
 * promised an update that would never arrive.
 *
 * The mode stays LIVE internally because it is the same fold — `playhead`
 * returns null, meaning "no ceiling" — and renaming the mode would rename the
 * projection's own vocabulary for a labelling problem.
 */
export const transportLabel = (state: PresentationState): string =>
  state.mode === "LIVE" ? "LATEST SNAPSHOT" : state.mode;

/** True when the operator is not looking at the newest event. */
export const isHistorical = (state: PresentationState): boolean =>
  state.mode === "PAUSED" || state.mode === "HISTORY";

/** The playhead, or null when following live. */
export function playhead(state: PresentationState): number | null {
  switch (state.mode) {
    case "LIVE":
      return null;
    case "ENDED":
      return state.finalSequence;
    default:
      return state.sequence;
  }
}

export function presentationReducer(
  state: PresentationState,
  command: TransportCommand,
): PresentationState {
  switch (command.kind) {
    case "scrubTo":
      // Scrubbing always lands in HISTORY, never in a mode that could read as
      // live, and it carries the timestamp the banner has to show.
      return { mode: "HISTORY", sequence: command.sequence, atTime: command.atTime };
    case "jumpToLive":
      return { mode: "LIVE" };
    case "ended":
      return { mode: "ENDED", finalSequence: command.finalSequence };
    default:
      return state;
  }
}

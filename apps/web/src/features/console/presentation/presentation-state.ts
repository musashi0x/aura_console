/**
 * Timeline transport state, from State Machines section 21.
 *
 * This is a union rather than a pair of booleans because replay shown as
 * current is a named trust-boundary threat: the operator must always be able
 * to tell live from recorded.
 */
export type PresentationState =
  | { mode: "LIVE" }
  | { mode: "PLAYING"; sequence: number }
  | { mode: "PAUSED"; sequence: number }
  | { mode: "HISTORY"; sequence: number; atTime: string }
  | { mode: "ENDED"; finalSequence: number };

export type TransportCommand =
  | { kind: "play" }
  | { kind: "pause" }
  | { kind: "scrubTo"; sequence: number; atTime: string }
  | { kind: "jumpToLive" }
  | { kind: "ended"; finalSequence: number };

export const initialPresentation: PresentationState = { mode: "LIVE" };

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
    case "play": {
      const at = playhead(state);
      return at === null ? state : { mode: "PLAYING", sequence: at };
    }
    case "pause": {
      const at = playhead(state);
      return at === null ? state : { mode: "PAUSED", sequence: at };
    }
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

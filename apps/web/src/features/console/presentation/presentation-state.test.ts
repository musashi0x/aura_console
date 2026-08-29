import { describe, expect, it } from "vitest";

import {
  initialPresentation,
  isHistorical,
  playhead,
  presentationReducer,
} from "./presentation-state";

describe("presentation state", () => {
  it("starts live and follows the newest event", () => {
    expect(initialPresentation.mode).toBe("LIVE");
    expect(playhead(initialPresentation)).toBeNull();
    expect(isHistorical(initialPresentation)).toBe(false);
  });

  it("scrubbing always lands in HISTORY and carries its timestamp", () => {
    const state = presentationReducer(initialPresentation, {
      kind: "scrubTo",
      sequence: 4,
      atTime: "2026-08-29T10:00:04Z",
    });
    expect(state).toEqual({ mode: "HISTORY", sequence: 4, atTime: "2026-08-29T10:00:04Z" });
    // Historical state must never be indistinguishable from live.
    expect(isHistorical(state)).toBe(true);
  });

  it("returns to live and stops being historical", () => {
    const scrubbed = presentationReducer(initialPresentation, {
      kind: "scrubTo",
      sequence: 4,
      atTime: "t",
    });
    const live = presentationReducer(scrubbed, { kind: "jumpToLive" });
    expect(live.mode).toBe("LIVE");
    expect(isHistorical(live)).toBe(false);
  });

  it("pausing while live is a no-op, because there is no playhead yet", () => {
    expect(presentationReducer(initialPresentation, { kind: "pause" })).toEqual(initialPresentation);
  });

  it("pauses and resumes from a scrubbed position", () => {
    const scrubbed = presentationReducer(initialPresentation, { kind: "scrubTo", sequence: 3, atTime: "t" });
    const paused = presentationReducer(scrubbed, { kind: "pause" });
    expect(paused).toEqual({ mode: "PAUSED", sequence: 3 });
    expect(presentationReducer(paused, { kind: "play" })).toEqual({ mode: "PLAYING", sequence: 3 });
  });

  it("ended is its own mode, not live with the pulse removed", () => {
    const ended = presentationReducer(initialPresentation, { kind: "ended", finalSequence: 9 });
    expect(ended).toEqual({ mode: "ENDED", finalSequence: 9 });
    expect(playhead(ended)).toBe(9);
    expect(isHistorical(ended)).toBe(false);
  });
});

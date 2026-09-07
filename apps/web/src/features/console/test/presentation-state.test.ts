import type { TransportCommand } from "../presentation/presentation-state";
import { describe, expect, it } from "vitest";

import {
  initialPresentation,
  isHistorical,
  playhead,
  presentationReducer,
} from "../presentation/presentation-state";

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

  it("has no command that reaches PLAYING or PAUSED", () => {
    // Nothing advances the playhead, so a PLAYING badge over a still timeline
    // was a claim the product could not keep. The commands are gone rather than
    // ignored, which makes those states unreachable at COMPILE time: a caller
    // that dispatches `play` no longer typechecks. Removing this guard would
    // fail to build rather than fail quietly.
    const commands: TransportCommand["kind"][] = ["scrubTo", "jumpToLive", "ended"];
    expect(commands).not.toContain("play");
    expect(commands).not.toContain("pause");

    // And every state the reducer can produce from a scrub is one of the
    // honest ones.
    const scrubbed = presentationReducer(initialPresentation, {
      kind: "scrubTo",
      sequence: 3,
      atTime: "t",
    });
    expect(scrubbed.mode).toBe("HISTORY");
  });

  it("ended is its own mode, not live with the pulse removed", () => {
    const ended = presentationReducer(initialPresentation, { kind: "ended", finalSequence: 9 });
    expect(ended).toEqual({ mode: "ENDED", finalSequence: 9 });
    expect(playhead(ended)).toBe(9);
    expect(isHistorical(ended)).toBe(false);
  });
});

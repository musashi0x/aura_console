import { describe, expect, it, vi } from "vitest";

import {
  clearProgress,
  hasAcknowledged,
  readProgress,
  writeProgress,
} from "../acknowledgement";

describe("acknowledgement store", () => {
  it("starts empty and unacknowledged", () => {
    const progress = readProgress();
    expect(progress.acknowledgedAt).toBeNull();
    expect(hasAcknowledged(progress)).toBe(false);
  });

  it("round-trips progress", () => {
    writeProgress({ step: "disclosure", acknowledgedAt: null, skippedAt: "2026-08-28T00:00:00Z" });
    const progress = readProgress();
    expect(progress.step).toBe("disclosure");
    expect(progress.skippedAt).toBe("2026-08-28T00:00:00Z");
    expect(hasAcknowledged(progress)).toBe(false);
  });

  it("treats corrupt storage as absent rather than throwing", () => {
    window.localStorage.setItem("aura.onboarding.v1", "{not json");
    expect(readProgress().step).toBe("welcome");
  });

  it("ignores an unknown step value", () => {
    window.localStorage.setItem("aura.onboarding.v1", JSON.stringify({ step: "nonsense" }));
    expect(readProgress().step).toBe("welcome");
  });

  it("survives storage that throws, as in a locked-down browser", () => {
    const store = window.localStorage;
    const getItem = vi.spyOn(store, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    const setItem = vi.spyOn(store, "setItem").mockImplementation(() => {
      throw new Error("denied");
    });

    expect(() => readProgress()).not.toThrow();
    expect(() =>
      writeProgress({ step: "welcome", acknowledgedAt: null, skippedAt: null }),
    ).not.toThrow();

    getItem.mockRestore();
    setItem.mockRestore();
  });

  it("clears", () => {
    writeProgress({ step: "complete", acknowledgedAt: "2026-08-28T00:00:00Z", skippedAt: null });
    clearProgress();
    expect(hasAcknowledged(readProgress())).toBe(false);
  });
});

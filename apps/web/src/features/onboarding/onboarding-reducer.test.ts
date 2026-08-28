import { describe, expect, it } from "vitest";

import { canContinue, initialState, onboardingReducer } from "./onboarding-reducer";

const at = "2026-08-28T10:00:00.000Z";

describe("onboardingReducer", () => {
  it("walks forward through every step", () => {
    let state = initialState;
    state = onboardingReducer(state, { type: "next" });
    expect(state.step).toBe("readiness");
    state = onboardingReducer(state, { type: "next" });
    expect(state.step).toBe("disclosure");
  });

  it("will not advance past the disclosure without an acknowledgement", () => {
    const disclosure = { ...initialState, step: "disclosure" as const };
    expect(onboardingReducer(disclosure, { type: "next" }).step).toBe("disclosure");
    expect(canContinue(disclosure)).toBe(false);
  });

  it("unlocks but does not auto-advance when acknowledged", () => {
    const disclosure = { ...initialState, step: "disclosure" as const };
    const state = onboardingReducer(disclosure, { type: "acknowledge", at });
    expect(state.acknowledgedAt).toBe(at);
    // Ticking the box must not be mistaken for pressing the button.
    expect(state.step).toBe("disclosure");
    expect(canContinue(state)).toBe(true);
    expect(onboardingReducer(state, { type: "next" }).step).toBe("complete");
  });

  it("lets an acknowledgement be withdrawn without breaking anything", () => {
    let state = onboardingReducer(
      { ...initialState, step: "disclosure" },
      { type: "acknowledge", at },
    );
    state = onboardingReducer(state, { type: "decline" });
    expect(state.acknowledgedAt).toBeNull();
    expect(canContinue(state)).toBe(false);
  });

  it("records a skip without acknowledging anything", () => {
    const state = onboardingReducer(initialState, { type: "skip", at });
    expect(state.skippedAt).toBe(at);
    expect(state.acknowledgedAt).toBeNull();
  });

  it("never moves before the first or past the last step", () => {
    expect(onboardingReducer(initialState, { type: "back" }).step).toBe("welcome");
    const done = { ...initialState, step: "complete" as const };
    expect(onboardingReducer(done, { type: "next" }).step).toBe("complete");
  });

  it("marks a row checking and then settles only that row", () => {
    let state = onboardingReducer(initialState, { type: "checkStarted", id: "api" });
    expect(state.rows.find((r) => r.id === "api")?.status).toBe("checking");
    state = onboardingReducer(state, {
      type: "checkSettled",
      id: "api",
      status: "ready",
      detail: "Responding.",
    });
    expect(state.rows.find((r) => r.id === "api")?.status).toBe("ready");
    expect(state.rows.find((r) => r.id === "database")?.status).toBe("checking");
  });

  it("reports dependencies it cannot verify as not checked, never ready", () => {
    const unverifiable = initialState.rows.filter((r) => !r.retryable);
    expect(unverifiable.map((r) => r.id)).toEqual(["policy", "agent"]);
    for (const row of unverifiable) {
      expect(row.status).toBe("not_checked");
      expect(row.detail.length).toBeGreaterThan(0);
    }
  });

  it("restores a saved position", () => {
    const state = onboardingReducer(initialState, {
      type: "restore",
      state: { step: "disclosure", acknowledgedAt: null, skippedAt: at },
    });
    expect(state.step).toBe("disclosure");
    expect(state.skippedAt).toBe(at);
  });
});

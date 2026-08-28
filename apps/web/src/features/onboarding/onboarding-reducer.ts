import { initialRows } from "./readiness";
import type { OnboardingAction, OnboardingState, OnboardingStep } from "./types";

const order: OnboardingStep[] = ["welcome", "readiness", "disclosure", "complete"];

export const initialState: OnboardingState = {
  step: "welcome",
  acknowledgedAt: null,
  skippedAt: null,
  rows: initialRows,
};

const move = (step: OnboardingStep, delta: number): OnboardingStep => {
  const next = order.indexOf(step) + delta;
  if (next < 0) return order[0]!;
  if (next > order.length - 1) return order[order.length - 1]!;
  return order[next]!;
};

/**
 * Pure. The whole flow is testable without a DOM, which is why readiness
 * results arrive as actions rather than being fetched in here.
 */
export function onboardingReducer(
  state: OnboardingState,
  action: OnboardingAction,
): OnboardingState {
  switch (action.type) {
    case "next":
      // Advancing past the disclosure requires an explicit acknowledgement.
      if (state.step === "disclosure" && state.acknowledgedAt === null) return state;
      return { ...state, step: move(state.step, 1) };

    case "back":
      return { ...state, step: move(state.step, -1) };

    case "skip":
      // Skipping records where to resume. It never acknowledges anything.
      return { ...state, skippedAt: action.at };

    case "acknowledge":
      // Acknowledging only unlocks the action. The operator still chooses to
      // continue, so the tick is never mistaken for pressing the button.
      return { ...state, acknowledgedAt: action.at };

    case "decline":
      // Declining is allowed and reversible. Nothing is stored, nothing breaks.
      return { ...state, acknowledgedAt: null };

    case "checkStarted":
      return {
        ...state,
        rows: state.rows.map((row) =>
          row.id === action.id ? { ...row, status: "checking", detail: "" } : row,
        ),
      };

    case "checkSettled":
      return {
        ...state,
        rows: state.rows.map((row) =>
          row.id === action.id ? { ...row, status: action.status, detail: action.detail } : row,
        ),
      };

    case "restore":
      return { ...state, ...action.state };

    default:
      return state;
  }
}

/** Readiness never blocks progress; an unavailable dependency is reported, not enforced. */
export const canContinue = (state: OnboardingState): boolean =>
  state.step !== "disclosure" || state.acknowledgedAt !== null;

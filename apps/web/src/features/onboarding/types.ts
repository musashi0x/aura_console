/** Onboarding is client-only. It creates no server state and no Run. */

export type OnboardingStep = "welcome" | "readiness" | "disclosure" | "complete";

/**
 * A readiness row is never "ready" without a successful response, and never
 * guesses. `not_checked` is a first-class outcome, not a failure: v0.1 has no
 * endpoint for some dependencies and saying so is more honest than omitting
 * the row.
 */
export type ReadinessStatus = "checking" | "ready" | "unavailable" | "not_checked";

export interface ReadinessRow {
  id: string;
  /** Owning domain, named in failures per the UX spec error pattern. */
  domain: string;
  label: string;
  status: ReadinessStatus;
  /** Consequence plus next action when unavailable; reason when not checked. */
  detail: string;
  /** Only checks backed by a real endpoint can be retried. */
  retryable: boolean;
}

export interface OnboardingState {
  step: OnboardingStep;
  acknowledgedAt: string | null;
  skippedAt: string | null;
  rows: ReadinessRow[];
}

export type OnboardingAction =
  | { type: "next" }
  | { type: "back" }
  | { type: "skip"; at: string }
  | { type: "acknowledge"; at: string }
  | { type: "decline" }
  | { type: "checkStarted"; id: string }
  | { type: "checkSettled"; id: string; status: ReadinessStatus; detail: string }
  | { type: "restore"; state: Partial<OnboardingState> };

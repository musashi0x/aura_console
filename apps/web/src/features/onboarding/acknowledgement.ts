import type { OnboardingStep } from "./types";

/**
 * Browser-local only. This is an acknowledgement that the operator read the
 * disclosure, not a consent record: nothing is sent to a server, and a cleared
 * browser simply shows onboarding again.
 */
const KEY = "aura.onboarding.v1";

export interface StoredProgress {
  step: OnboardingStep;
  acknowledgedAt: string | null;
  skippedAt: string | null;
}

const empty: StoredProgress = { step: "welcome", acknowledgedAt: null, skippedAt: null };

const isStep = (value: unknown): value is OnboardingStep =>
  value === "welcome" || value === "readiness" || value === "disclosure" || value === "complete";

/** Every access is guarded: private mode and disabled storage must not throw. */
export function readProgress(): StoredProgress {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return empty;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return empty;
    const record = parsed as Record<string, unknown>;
    return {
      step: isStep(record.step) ? record.step : "welcome",
      acknowledgedAt: typeof record.acknowledgedAt === "string" ? record.acknowledgedAt : null,
      skippedAt: typeof record.skippedAt === "string" ? record.skippedAt : null,
    };
  } catch {
    return empty;
  }
}

export function writeProgress(progress: StoredProgress): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(progress));
  } catch {
    // Storage unavailable. Onboarding still works, it just cannot be resumed.
  }
}

export function clearProgress(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Nothing to do; absence is the default state anyway.
  }
}

/** Onboarding is only skipped for a browser that acknowledged the disclosure. */
export const hasAcknowledged = (progress: StoredProgress): boolean =>
  progress.acknowledgedAt !== null;

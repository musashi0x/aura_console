import { randomUUID } from "node:crypto";
import type { DeliverableVerificationResult } from "./verifier-agent.js";
import {
  type ReflectionRecord,
  getNativeReflections,
  recordNativeReflection,
} from "./native-sibyl.js";

export type { ReflectionRecord };

export type ReflectionFailureCategory =
  | "MISSING_CITATIONS"
  | "INSUFFICIENT_COMPETITORS"
  | "SCHEMA_VIOLATION"
  | "TEST_FAILURE"
  | "TIMEOUT";

export interface AnalyzeFailureInput {
  counterpartyKey: string;
  runId: string;
  evaluation: DeliverableVerificationResult;
}

/**
 * Analyzes deliverable verification failure notes, schema breaches, and errors
 * to determine the root cause, categorize the failure, extract durable lessons,
 * and formulate actionable remediation guidance for future hiring decisions.
 */
export function analyzeFailureAndReflect(input: AnalyzeFailureInput): ReflectionRecord {
  const { counterpartyKey, runId, evaluation } = input;
  const errors = evaluation.errors ?? [];
  const failureReason = evaluation.failure_reason ?? "";
  const summary = evaluation.summary ?? "";

  let failureCategory: ReflectionFailureCategory = "SCHEMA_VIOLATION";
  let rootCause = "";
  let lesson = "";
  let remediationGuidance = "";

  const allText = [summary, failureReason, ...errors].join(" ").toLowerCase();

  if (
    errors.some((e) => /citation|source/i.test(e)) ||
    /citation|source/i.test(failureReason) ||
    /citation|source/i.test(summary)
  ) {
    failureCategory = "MISSING_CITATIONS";
    rootCause =
      "Deliverable failed verification due to missing mandatory source citations across competitor entries.";
    lesson = `Counterparty ${counterpartyKey} repeatedly omits required source citations on competitor research tasks; enforce strict citation checks or apply candidate ranking penalties.`;
    remediationGuidance =
      "Enforce mandatory URL source citations validation for each competitor before accepting deliverables.";
  } else if (
    errors.some((e) => /competitor/i.test(e)) ||
    /competitor/i.test(failureReason) ||
    /fewer than|insufficient/i.test(allText) ||
    (evaluation.competitorsCount !== undefined && evaluation.competitorsCount < 3)
  ) {
    failureCategory = "INSUFFICIENT_COMPETITORS";
    const count = evaluation.competitorsCount ?? 0;
    rootCause = `Deliverable failed verification due to insufficient competitor entries (expected >= 3, found ${count}).`;
    lesson = `Counterparty ${counterpartyKey} delivers incomplete reports with fewer than 3 required competitor entries.`;
    remediationGuidance =
      "Require minimum 3 fully researched competitors with validated profile schemas.";
  } else if (/timeout|timed out/i.test(allText)) {
    failureCategory = "TIMEOUT";
    rootCause = "Deliverable execution timed out before completion.";
    lesson = `Counterparty ${counterpartyKey} exceeded task execution timeout SLA.`;
    remediationGuidance =
      "Increase task timeout allocation or penalize slow counterparty responsiveness.";
  } else if (evaluation.tests_passed === false && errors.length === 0 && (failureReason || summary)) {
    failureCategory = "TEST_FAILURE";
    rootCause = `Deliverable failed automated tests: ${failureReason || summary || "objective test failure"}`;
    lesson = `Counterparty ${counterpartyKey} produced deliverables that failed automated acceptance test verification.`;
    remediationGuidance = "Run pre-flight validation checks before final submission.";
  } else {
    failureCategory = "SCHEMA_VIOLATION";
    const errorDetails = errors.length > 0 ? errors.join("; ") : failureReason || summary || "invalid deliverable structure";
    rootCause = `Deliverable payload failed schema validation: ${errorDetails}`;
    lesson = `Counterparty ${counterpartyKey} produced deliverables violating the expected schema contract.`;
    remediationGuidance = "Enforce schema validation before deliverable acceptance.";
  }

  const schemaErrors =
    errors.length > 0
      ? errors
      : failureReason
        ? [failureReason]
        : summary
          ? [summary]
          : ["Verification rejection"];

  return {
    id: `ref_${randomUUID()}`,
    counterpartyKey,
    runId,
    failureCategory,
    rootCause,
    lesson,
    schemaErrors,
    remediationGuidance,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Persists a structured reflection record to Sibyl native SQLite store.
 */
export async function recordReflectionToSibyl(reflection: ReflectionRecord): Promise<void> {
  const result = recordNativeReflection(reflection);
  if (!result.ok) {
    throw new Error(`Failed to persist reflection: ${result.detail ?? result.code}`);
  }
}

/**
 * Synchronous variant for persistence in immediate execution paths.
 */
export function recordReflectionToSibylSync(reflection: ReflectionRecord): void {
  const result = recordNativeReflection(reflection);
  if (!result.ok) {
    throw new Error(`Failed to persist reflection: ${result.detail ?? result.code}`);
  }
}

/**
 * Retrieves all reflections stored for a given counterparty.
 */
export function getReflectionsForCounterparty(counterpartyKey: string): ReflectionRecord[] {
  return getNativeReflections(counterpartyKey);
}

/**
 * Lists all stored reflections across counterparties.
 */
export function listAllReflections(): ReflectionRecord[] {
  return getNativeReflections();
}

/**
 * Calculates candidate ranking penalty points and diagnostic reasons
 * based on active failure reflections in Sibyl memory.
 *
 * Each active reflection applies a -4 point penalty (scaled up to -20 max).
 */
export function getReflectionPenalty(
  counterpartyKey: string,
  reflections?: ReflectionRecord[],
): { penaltyPoints: number; reasonCount: number; reasons: string[] } {
  const active = reflections ?? getReflectionsForCounterparty(counterpartyKey);
  if (!active || active.length === 0) {
    return { penaltyPoints: 0, reasonCount: 0, reasons: [] };
  }

  // -4 points per reflection, capped at -20
  const penaltyPoints = Math.max(-20, active.length * -4);
  const reasons = active.map((r) => `[Reflection: ${r.failureCategory}] ${r.lesson}`);

  return {
    penaltyPoints,
    reasonCount: active.length,
    reasons,
  };
}

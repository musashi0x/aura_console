import {
  type ExecutiveRiskDigest,
  getNativeDossier,
  getNativeReflections,
  getNativeSummary,
  readNativeMemoryJournal,
  retrieveNativeFromSibyl,
  setNativeSummary,
} from "./native-sibyl.js";
import { consolidateEpisodesSync } from "./consolidation-engine.js";
import type { RelationshipStatus } from "./reputation-fsm.js";

export type { ExecutiveRiskDigest };

/**
 * Generates an executive risk digest for a counterparty by synthesizing
 * Bayesian reputation parameters, consolidated execution dossiers, and
 * reflected root-cause lessons into a human- and agent-readable summary.
 */
export function generateExecutiveSummary(
  counterpartyKey: string,
): ExecutiveRiskDigest | null {
  const profileLookup = retrieveNativeFromSibyl(counterpartyKey);
  let dossier = getNativeDossier(counterpartyKey);

  // If dossier does not exist, attempt to consolidate on demand only if counterparty has history
  if (!dossier) {
    const journal = readNativeMemoryJournal(1, counterpartyKey);
    if (profileLookup.status === "AVAILABLE" || (journal.episodes && journal.episodes.length > 0)) {
      try {
        dossier = consolidateEpisodesSync(counterpartyKey);
      } catch {
        dossier = null;
      }
    }
  }

  const reflections = getNativeReflections(counterpartyKey);

  if (
    profileLookup.status === "NO_HISTORY" &&
    (!dossier || dossier.totalMissions === 0) &&
    reflections.length === 0
  ) {
    return null;
  }

  const profile = profileLookup.status === "AVAILABLE" ? profileLookup : null;
  const displayName =
    dossier?.displayName ||
    (profile?.displayName ? profile.displayName : counterpartyKey);

  const relationshipStatus = (profile?.relationshipStatus || "NEW") as RelationshipStatus;
  const overallReliability = profile?.overallReliability ?? 0.5;
  const confidence = profile?.confidence ?? 0.0;
  const consecutiveFailures = profile?.consecutiveFailures ?? 0;
  const totalMissions = dossier?.totalMissions ?? profile?.totalMissions ?? 0;
  const successRate = dossier?.successRate ?? (totalMissions > 0 ? (totalMissions - consecutiveFailures) / totalMissions : 0);

  // Determine qualitative risk level
  let riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  if (relationshipStatus === "BLOCKED") {
    riskLevel = "CRITICAL";
  } else if (
    relationshipStatus === "WATCH" ||
    consecutiveFailures >= 1 ||
    overallReliability < 0.5
  ) {
    riskLevel = "HIGH";
  } else if (relationshipStatus === "PREFERRED" && overallReliability >= 0.8) {
    riskLevel = "LOW";
  } else if (relationshipStatus === "KNOWN") {
    riskLevel = "MEDIUM";
  } else {
    riskLevel = overallReliability >= 0.8 ? "LOW" : overallReliability >= 0.6 ? "MEDIUM" : "HIGH";
  }

  // Qualitative rating label
  const ratingQual =
    overallReliability >= 0.8
      ? "EXCELLENT"
      : overallReliability >= 0.6
        ? "MODERATE"
        : overallReliability >= 0.45
          ? "NEUTRAL"
          : "POOR";
  const reliabilityRating = `${(overallReliability * 100).toFixed(1)}% (${ratingQual})`;

  // Headline synthesis
  let headline = "";
  if (relationshipStatus === "BLOCKED") {
    headline = `${displayName}: Excluded under hard veto due to repeated verification failures (${totalMissions} missions, ${(overallReliability * 100).toFixed(1)}% reliability).`;
  } else if (relationshipStatus === "WATCH") {
    const defectMention = reflections[0]?.failureCategory ? `due to ${reflections[0].failureCategory.toLowerCase()}` : "under probation";
    headline = `${displayName}: ${consecutiveFailures} failure ${defectMention}, currently under WATCH status (Reliability: ${(overallReliability * 100).toFixed(1)}%, ${(successRate * 100).toFixed(0)}% pass rate).`;
  } else if (relationshipStatus === "PREFERRED") {
    headline = `${displayName}: Verified high-trust provider with ${(successRate * 100).toFixed(0)}% success rate across ${totalMissions} missions (Reliability: ${(overallReliability * 100).toFixed(1)}%).`;
  } else if (relationshipStatus === "KNOWN") {
    headline = `${displayName}: Active counterparty with ${totalMissions} completed missions (${(successRate * 100).toFixed(0)}% pass rate).`;
  } else {
    headline = `${displayName}: Unobserved candidate with no completed mission history (neutral prior).`;
  }

  // Key findings synthesis
  const keyFindings: string[] = [
    `Relationship status on record is ${relationshipStatus}${consecutiveFailures > 0 ? ` with ${consecutiveFailures} consecutive failure(s)` : ""}.`,
    `Overall Bayesian reliability is ${(overallReliability * 100).toFixed(1)}% with ${(confidence * 100).toFixed(1)}% confidence.`,
    `Completed ${totalMissions} missions (${Math.round(successRate * 100)}% pass rate).`,
  ];

  if (reflections.length > 0) {
    const topRef = reflections[0]!;
    keyFindings.push(
      `Active defect finding: Recorded ${reflections.length} failure reflection(s). Root cause: ${topRef.rootCause}`,
    );
  }

  if (dossier && Object.keys(dossier.recurringDefects).length > 0) {
    const defectList = Object.entries(dossier.recurringDefects)
      .map(([k, v]) => `${k} (${v})`)
      .join(", ");
    keyFindings.push(`Recurring defect distribution: ${defectList}.`);
  }

  // Recommendations synthesis
  const recommendations: string[] = [];
  if (relationshipStatus === "BLOCKED") {
    recommendations.push("DO NOT HIRE: Candidate is currently subject to hard operator veto.");
    recommendations.push("Requires explicit operator manual intervention to restore assignment eligibility.");
  } else if (relationshipStatus === "WATCH") {
    recommendations.push("PROCEED WITH CAUTION: Enforce strict automated verification checks before settling deliverable.");
    recommendations.push("Next deliverable failure will trigger automatic transition to BLOCKED status.");
  } else if (relationshipStatus === "PREFERRED") {
    recommendations.push("RECOMMENDED: High-priority counterparty for mission assignment.");
    recommendations.push("Eligible for streamlined settlement and preferential quote evaluation.");
  } else if (relationshipStatus === "KNOWN") {
    recommendations.push("ELIGIBLE: Standard automated verification checks recommended.");
  } else {
    recommendations.push("UNTESTED: Assign small initial test mission and enforce full verification pipeline.");
  }

  const digest: ExecutiveRiskDigest = {
    counterpartyKey,
    displayName,
    headline,
    riskLevel,
    reliabilityRating,
    relationshipStatus,
    consecutiveFailures,
    totalMissions,
    successRate,
    keyFindings,
    recommendations,
    generatedAt: new Date().toISOString(),
  };

  setNativeSummary(counterpartyKey, digest);
  return digest;
}

/**
 * Retrieves the stored executive summary or dynamically generates a fresh one.
 */
export function getExecutiveSummary(counterpartyKey: string): ExecutiveRiskDigest | null {
  const existing = getNativeSummary(counterpartyKey);
  if (existing) return existing;
  return generateExecutiveSummary(counterpartyKey);
}

import { beforeEach, describe, expect, it } from "vitest";
import {
  generateExecutiveSummary,
  getExecutiveSummary,
} from "./executive-summarizer.js";
import {
  recordEpisodeToNativeSibyl,
  recordNativeReflection,
  resetNativeSibylStorage,
  updateNativeCounterpartyInSibyl,
} from "./native-sibyl.js";

describe("ExecutiveSummarizer", () => {
  beforeEach(() => {
    resetNativeSibylStorage();
  });

  it("returns null for counterparty with zero history or profile", () => {
    const summary = generateExecutiveSummary("virtuals:agent:nonexistent");
    expect(summary).toBeNull();
  });

  it("generates HIGH risk summary for candidate under WATCH status", () => {
    const key = "virtuals:agent:alpha";
    updateNativeCounterpartyInSibyl(key, {
      relationshipStatus: "WATCH",
      overallReliability: 0.42,
      confidence: 0.88,
      consecutiveFailures: 1,
      totalMissions: 2,
    });
    recordEpisodeToNativeSibyl(key, {
      run: "run-1",
      outcome: "rejected",
      note: "Missing citation sources in report",
      occurredAt: "2026-09-01T10:00:00Z",
    });
    recordNativeReflection({
      id: "ref-1",
      counterpartyKey: key,
      runId: "run-1",
      failureCategory: "MISSING_CITATIONS",
      rootCause: "Deliverable failed due to unverified citations",
      lesson: "Alpha omits mandatory citations",
      schemaErrors: ["citations required"],
      remediationGuidance: "Enforce citation check",
      createdAt: "2026-09-01T10:05:00Z",
    });

    const summary = generateExecutiveSummary(key);
    expect(summary).not.toBeNull();
    expect(summary?.riskLevel).toBe("HIGH");
    expect(summary?.relationshipStatus).toBe("WATCH");
    expect(summary?.reliabilityRating).toContain("42.0%");
    expect(summary?.headline).toContain("WATCH");
    expect(summary?.headline).toContain("failure");
    expect(summary?.keyFindings.some((k) => k.includes("failure reflection"))).toBe(true);
    expect(summary?.recommendations.some((r) => r.includes("PROCEED WITH CAUTION"))).toBe(true);
  });

  it("generates CRITICAL risk summary with DO NOT HIRE for BLOCKED candidate", () => {
    const key = "virtuals:agent:blocked";
    updateNativeCounterpartyInSibyl(key, {
      relationshipStatus: "BLOCKED",
      overallReliability: 0.25,
      confidence: 0.95,
      consecutiveFailures: 2,
      totalMissions: 3,
      blockedReason: "2 consecutive failures in WATCH state",
    });

    const summary = generateExecutiveSummary(key);
    expect(summary?.riskLevel).toBe("CRITICAL");
    expect(summary?.relationshipStatus).toBe("BLOCKED");
    expect(summary?.headline).toContain("Excluded under hard veto");
    expect(summary?.recommendations.some((r) => r.includes("DO NOT HIRE"))).toBe(true);
  });

  it("generates LOW risk summary with RECOMMENDED for PREFERRED candidate", () => {
    const key = "virtuals:agent:beta";
    updateNativeCounterpartyInSibyl(key, {
      relationshipStatus: "PREFERRED",
      overallReliability: 0.91,
      confidence: 0.90,
      consecutiveFailures: 0,
      totalMissions: 5,
    });
    recordEpisodeToNativeSibyl(key, {
      run: "run-50",
      outcome: "accepted",
      note: "Flawless delivery",
      occurredAt: "2026-09-02T10:00:00Z",
    });

    const summary = generateExecutiveSummary(key);
    expect(summary?.riskLevel).toBe("LOW");
    expect(summary?.relationshipStatus).toBe("PREFERRED");
    expect(summary?.reliabilityRating).toContain("91.0% (EXCELLENT)");
    expect(summary?.headline).toContain("Verified high-trust provider");
    expect(summary?.recommendations.some((r) => r.includes("RECOMMENDED"))).toBe(true);
  });

  it("persists summary and retrieves from getExecutiveSummary", () => {
    const key = "virtuals:agent:persisted";
    updateNativeCounterpartyInSibyl(key, {
      relationshipStatus: "KNOWN",
      overallReliability: 0.70,
      confidence: 0.50,
      consecutiveFailures: 0,
      totalMissions: 1,
    });

    const created = generateExecutiveSummary(key);
    expect(created).not.toBeNull();

    const fetched = getExecutiveSummary(key);
    expect(fetched).not.toBeNull();
    expect(fetched?.counterpartyKey).toBe(key);
    expect(fetched?.headline).toBe(created?.headline);
  });
});

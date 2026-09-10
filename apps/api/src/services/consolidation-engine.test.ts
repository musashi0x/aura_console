import { beforeEach, describe, expect, it } from "vitest";
import {
  computeAuditTrailHash,
  consolidateEpisodes,
  getConsolidatedDossier,
} from "./consolidation-engine.js";
import {
  recordEpisodeToNativeSibyl,
  recordNativeReflection,
  resetNativeSibylStorage,
} from "./native-sibyl.js";

describe("ConsolidationEngine", () => {
  beforeEach(() => {
    resetNativeSibylStorage();
  });

  describe("computeAuditTrailHash", () => {
    it("returns a deterministic sha256 hash for empty episodes", () => {
      const hash1 = computeAuditTrailHash([]);
      const hash2 = computeAuditTrailHash([]);
      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64);
    });

    it("detects any mutation in episode lineage", () => {
      const epA = [{ run: "run-1", outcome: "accepted", occurredAt: "2026-09-01T00:00:00Z" }];
      const epB = [{ run: "run-1", outcome: "rejected", occurredAt: "2026-09-01T00:00:00Z" }];
      const hashA = computeAuditTrailHash(epA);
      const hashB = computeAuditTrailHash(epB);
      expect(hashA).not.toBe(hashB);
    });
  });

  describe("consolidateEpisodes", () => {
    it("consolidates an unobserved counterparty with zero missions", async () => {
      const dossier = await consolidateEpisodes("virtuals:agent:newbie");
      expect(dossier.totalMissions).toBe(0);
      expect(dossier.acceptedCount).toBe(0);
      expect(dossier.rejectedCount).toBe(0);
      expect(dossier.successRate).toBe(0);
      expect(dossier.probationHistory).toEqual([]);
      expect(dossier.auditTrailHash).toHaveLength(64);

      const persisted = getConsolidatedDossier("virtuals:agent:newbie");
      expect(persisted).toBeNull();
    });

    it("consolidates multiple episodes and traces probation transitions NEW -> WATCH -> BLOCKED", async () => {
      const key = "virtuals:agent:failing";

      // 1st episode: failure -> transitions NEW -> WATCH
      recordEpisodeToNativeSibyl(key, {
        run: "run-001",
        outcome: "rejected",
        note: "Failed verification: missing citations",
        occurredAt: "2026-09-01T10:00:00Z",
      });

      // Reflection for run-001
      recordNativeReflection({
        id: "ref-001",
        counterpartyKey: key,
        runId: "run-001",
        failureCategory: "MISSING_CITATIONS",
        rootCause: "No source URLs in report",
        lesson: "Candidate omits sources",
        schemaErrors: ["missing citations"],
        remediationGuidance: "Require citations",
        createdAt: "2026-09-01T10:05:00Z",
      });

      let dossier = await consolidateEpisodes(key);
      expect(dossier.totalMissions).toBe(1);
      expect(dossier.acceptedCount).toBe(0);
      expect(dossier.rejectedCount).toBe(1);
      expect(dossier.successRate).toBe(0);
      expect(dossier.recurringDefects["missing_citations"]).toBe(1);
      expect(dossier.probationHistory).toHaveLength(1);
      expect(dossier.probationHistory[0]?.fromStatus).toBe("NEW");
      expect(dossier.probationHistory[0]?.toStatus).toBe("WATCH");

      // 2nd episode: 2nd consecutive failure while in WATCH -> transitions WATCH -> BLOCKED
      recordEpisodeToNativeSibyl(key, {
        run: "run-002",
        outcome: "rejected",
        note: "Failed verification: missing citations again",
        occurredAt: "2026-09-02T10:00:00Z",
      });

      recordNativeReflection({
        id: "ref-002",
        counterpartyKey: key,
        runId: "run-002",
        failureCategory: "MISSING_CITATIONS",
        rootCause: "Repeated citation absence",
        lesson: "Candidate repeatedly omits sources",
        schemaErrors: ["missing citations"],
        remediationGuidance: "Do not assign research tasks",
        createdAt: "2026-09-02T10:05:00Z",
      });

      dossier = await consolidateEpisodes(key);
      expect(dossier.totalMissions).toBe(2);
      expect(dossier.acceptedCount).toBe(0);
      expect(dossier.rejectedCount).toBe(2);
      expect(dossier.recurringDefects["missing_citations"]).toBe(2);
      expect(dossier.probationHistory).toHaveLength(2);
      expect(dossier.probationHistory[0]?.fromStatus).toBe("NEW");
      expect(dossier.probationHistory[0]?.toStatus).toBe("WATCH");
      expect(dossier.probationHistory[1]?.fromStatus).toBe("WATCH");
      expect(dossier.probationHistory[1]?.toStatus).toBe("BLOCKED");
    });

    it("consolidates successful episodes and calculates correct successRate", async () => {
      const key = "virtuals:agent:stellar";

      recordEpisodeToNativeSibyl(key, {
        run: "run-101",
        outcome: "accepted",
        note: "Delivered on time",
        occurredAt: "2026-09-03T10:00:00Z",
      });
      recordEpisodeToNativeSibyl(key, {
        run: "run-102",
        outcome: "accepted",
        note: "Excellent delivery",
        occurredAt: "2026-09-04T10:00:00Z",
      });
      recordEpisodeToNativeSibyl(key, {
        run: "run-103",
        outcome: "rejected",
        note: "Late submission",
        occurredAt: "2026-09-05T10:00:00Z",
      });

      const dossier = await consolidateEpisodes(key);
      expect(dossier.totalMissions).toBe(3);
      expect(dossier.acceptedCount).toBe(2);
      expect(dossier.rejectedCount).toBe(1);
      expect(dossier.successRate).toBe(0.6667);
      expect(dossier.probationHistory.length).toBeGreaterThanOrEqual(1);
      expect(dossier.probationHistory[0]?.fromStatus).toBe("NEW");
      expect(dossier.probationHistory[0]?.toStatus).toBe("KNOWN");
    });
  });
});

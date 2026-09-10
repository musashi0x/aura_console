import { beforeEach, describe, expect, it } from "vitest";
import {
  expandQueryTokens,
  searchMemoryRecords,
  tokenizeQuery,
} from "./semantic-search.js";
import {
  recordEpisodeToNativeSibyl,
  recordNativeReflection,
  resetNativeSibylStorage,
  setNativeDossier,
} from "./native-sibyl.js";

describe("SemanticSearchEngine", () => {
  beforeEach(() => {
    resetNativeSibylStorage();
  });

  describe("tokenization and expansion", () => {
    it("strips punctuation and removes stopwords", () => {
      const tokens = tokenizeQuery("The delivery failed with a missing source citation!");
      expect(tokens).toEqual(["delivery", "failed", "missing", "source", "citation"]);
      expect(tokens).not.toContain("the");
      expect(tokens).not.toContain("with");
      expect(tokens).not.toContain("a");
    });

    it("expands domain synonyms and intents", () => {
      const { primary, expanded } = expandQueryTokens(["citation", "failure"]);
      expect(primary).toEqual(["citation", "failure"]);
      expect(expanded.has("sources")).toBe(true);
      expect(expanded.has("rejected")).toBe(true);
      expect(expanded.get("citation")).toBe(1.0);
      expect(expanded.get("sources")).toBe(0.7);
    });
  });

  describe("searchMemoryRecords", () => {
    it("returns empty array on blank query", () => {
      expect(searchMemoryRecords("")).toEqual([]);
      expect(searchMemoryRecords("   ")).toEqual([]);
      expect(searchMemoryRecords("the a an")).toEqual([]);
    });

    it("retrieves and ranks reflections matching intent-based queries", () => {
      recordNativeReflection({
        id: "ref-alpha-1",
        counterpartyKey: "virtuals:agent:alpha",
        runId: "run-001",
        failureCategory: "MISSING_CITATIONS",
        rootCause: "Deliverable failed verification due to missing mandatory source citations.",
        lesson: "Alpha repeatedly omits required source citations on competitor research tasks.",
        schemaErrors: ["competitors.0.sources: At least one source citation URL is required"],
        remediationGuidance: "Enforce strict source validation.",
        createdAt: "2026-09-01T10:00:00Z",
      });

      recordNativeReflection({
        id: "ref-beta-1",
        counterpartyKey: "virtuals:agent:beta",
        runId: "run-002",
        failureCategory: "TIMEOUT",
        rootCause: "Execution timed out before completion.",
        lesson: "Beta exceeded 30000ms SLA during data gathering.",
        schemaErrors: ["timeout"],
        remediationGuidance: "Increase timeout allocation.",
        createdAt: "2026-09-02T10:00:00Z",
      });

      // Search for "missing citation sources"
      const results = searchMemoryRecords("missing citation sources");
      expect(results.length).toBeGreaterThanOrEqual(1);

      const topResult = results[0];
      expect(topResult?.id).toBe("ref-alpha-1");
      expect(topResult?.category).toBe("reflection");
      expect(topResult?.score).toBeGreaterThan(50);
      expect(topResult?.score).toBeLessThanOrEqual(100);
      expect(topResult?.matchedTerms).toContain("citation");
      expect(topResult?.headline).toContain("MISSING_CITATIONS");
    });

    it("searches episodes and dossiers across counterparties", () => {
      recordEpisodeToNativeSibyl("virtuals:agent:gamma", {
        run: "run-77",
        outcome: "accepted",
        taskType: "competitor-research",
        note: "Verified deliverable accepted with complete source URLs and competitor analysis.",
        occurredAt: "2026-09-03T12:00:00Z",
      });

      setNativeDossier("virtuals:agent:gamma", {
        counterpartyKey: "virtuals:agent:gamma",
        displayName: "Gamma Analytics",
        totalMissions: 5,
        acceptedCount: 5,
        rejectedCount: 0,
        successRate: 1.0,
        recurringDefects: {},
        probationHistory: [],
        auditTrailHash: "abcdef123456",
        lastConsolidatedAt: "2026-09-03T12:05:00Z",
      });

      const epResults = searchMemoryRecords("verified deliverable accepted", {
        category: "episode",
      });
      expect(epResults).toHaveLength(1);
      expect(epResults[0]?.category).toBe("episode");
      expect(epResults[0]?.name).toBe("virtuals:agent:gamma");

      const dossierResults = searchMemoryRecords("Gamma Analytics", {
        category: "dossier",
      });
      expect(dossierResults).toHaveLength(1);
      expect(dossierResults[0]?.category).toBe("dossier");
      expect(dossierResults[0]?.headline).toContain("Gamma Analytics");
    });

    it("supports counterpartyKey filtering and limits", () => {
      recordNativeReflection({
        id: "ref-alpha-2",
        counterpartyKey: "virtuals:agent:alpha",
        runId: "run-10",
        failureCategory: "SCHEMA_VIOLATION",
        rootCause: "Schema violation in output",
        lesson: "Alpha schema defect",
        schemaErrors: ["invalid field"],
        remediationGuidance: "Fix schema",
        createdAt: "2026-09-04T10:00:00Z",
      });

      recordNativeReflection({
        id: "ref-beta-2",
        counterpartyKey: "virtuals:agent:beta",
        runId: "run-11",
        failureCategory: "SCHEMA_VIOLATION",
        rootCause: "Schema violation in output",
        lesson: "Beta schema defect",
        schemaErrors: ["invalid field"],
        remediationGuidance: "Fix schema",
        createdAt: "2026-09-04T10:05:00Z",
      });

      const alphaOnly = searchMemoryRecords("schema violation", {
        counterpartyKey: "virtuals:agent:alpha",
      });
      expect(alphaOnly).toHaveLength(1);
      expect(alphaOnly[0]?.name).toBe("virtuals:agent:alpha");

      const limited = searchMemoryRecords("schema violation", { limit: 1 });
      expect(limited).toHaveLength(1);
    });
  });
});

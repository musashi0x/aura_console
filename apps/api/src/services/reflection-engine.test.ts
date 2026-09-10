import { beforeEach, describe, expect, it } from "vitest";
import {
  analyzeFailureAndReflect,
  getReflectionPenalty,
  getReflectionsForCounterparty,
  listAllReflections,
  recordReflectionToSibyl,
  recordReflectionToSibylSync,
} from "./reflection-engine.js";
import { resetNativeSibylStorage } from "./native-sibyl.js";

describe("ReflectionEngine", () => {
  beforeEach(() => {
    resetNativeSibylStorage();
  });

  describe("analyzeFailureAndReflect", () => {
    it("classifies missing citation failures with actionable lessons", () => {
      const reflection = analyzeFailureAndReflect({
        counterpartyKey: "virtuals:agent:alpha",
        runId: "run-101",
        evaluation: {
          score: 0.0,
          tests_passed: false,
          summary: "Competitor report failed validation: missing mandatory citations",
          errors: ["competitors.0.sources: At least one source citation URL is required"],
          failure_reason: "Missing source citations",
          competitorsCount: 3,
        },
      });

      expect(reflection.failureCategory).toBe("MISSING_CITATIONS");
      expect(reflection.counterpartyKey).toBe("virtuals:agent:alpha");
      expect(reflection.runId).toBe("run-101");
      expect(reflection.rootCause).toContain("missing mandatory source citations");
      expect(reflection.lesson).toContain("virtuals:agent:alpha");
      expect(reflection.lesson).toContain("omits required source citations");
      expect(reflection.remediationGuidance).toContain("Enforce mandatory URL source citations");
      expect(reflection.schemaErrors).toHaveLength(1);
    });

    it("classifies insufficient competitor count failures", () => {
      const reflection = analyzeFailureAndReflect({
        counterpartyKey: "virtuals:agent:alpha",
        runId: "run-102",
        evaluation: {
          score: 0.0,
          tests_passed: false,
          summary: "Insufficient competitors delivered",
          errors: ["Expected >= 3 competitors, received 1"],
          competitorsCount: 1,
        },
      });

      expect(reflection.failureCategory).toBe("INSUFFICIENT_COMPETITORS");
      expect(reflection.rootCause).toContain("expected >= 3, found 1");
      expect(reflection.lesson).toContain("fewer than 3 required competitor entries");
    });

    it("classifies task timeouts", () => {
      const reflection = analyzeFailureAndReflect({
        counterpartyKey: "virtuals:agent:gamma",
        runId: "run-103",
        evaluation: {
          score: 0.0,
          tests_passed: false,
          summary: "Task execution timed out after 30000ms",
          failure_reason: "CLI runner process timed out",
        },
      });

      expect(reflection.failureCategory).toBe("TIMEOUT");
      expect(reflection.rootCause).toContain("timed out before completion");
      expect(reflection.lesson).toContain("exceeded task execution timeout SLA");
    });

    it("classifies test assertion failures", () => {
      const reflection = analyzeFailureAndReflect({
        counterpartyKey: "virtuals:agent:delta",
        runId: "run-104",
        evaluation: {
          score: 0.0,
          tests_passed: false,
          summary: "Objective test failed: exit code 1",
          failure_reason: "vitest exited with code 1",
        },
      });

      expect(reflection.failureCategory).toBe("TEST_FAILURE");
      expect(reflection.rootCause).toContain("failed automated tests");
    });

    it("classifies general schema violations", () => {
      const reflection = analyzeFailureAndReflect({
        counterpartyKey: "virtuals:agent:epsilon",
        runId: "run-105",
        evaluation: {
          score: 0.0,
          tests_passed: false,
          summary: "Malformed JSON payload",
          errors: ["Invalid URL format in website field"],
        },
      });

      expect(reflection.failureCategory).toBe("SCHEMA_VIOLATION");
      expect(reflection.rootCause).toContain("Invalid URL format");
    });
  });

  describe("persistence and recall", () => {
    it("persists and retrieves reflections from SQLite", async () => {
      const record = analyzeFailureAndReflect({
        counterpartyKey: "virtuals:agent:alpha",
        runId: "run-201",
        evaluation: {
          score: 0,
          tests_passed: false,
          summary: "Missing citations",
          errors: ["citations missing"],
        },
      });

      await recordReflectionToSibyl(record);

      const recalled = getReflectionsForCounterparty("virtuals:agent:alpha");
      expect(recalled).toHaveLength(1);
      expect(recalled[0]?.id).toBe(record.id);
      expect(recalled[0]?.failureCategory).toBe("MISSING_CITATIONS");
      expect(recalled[0]?.lesson).toBe(record.lesson);
    });

    it("supports synchronous persistence and listing all reflections", () => {
      const r1 = analyzeFailureAndReflect({
        counterpartyKey: "virtuals:agent:alpha",
        runId: "run-202",
        evaluation: {
          score: 0,
          tests_passed: false,
          summary: "Missing citations",
          errors: ["citations missing"],
        },
      });
      const r2 = analyzeFailureAndReflect({
        counterpartyKey: "virtuals:agent:beta",
        runId: "run-203",
        evaluation: {
          score: 0,
          tests_passed: false,
          summary: "Timeout",
          failure_reason: "timed out",
        },
      });

      recordReflectionToSibylSync(r1);
      recordReflectionToSibylSync(r2);

      const alphaOnly = getReflectionsForCounterparty("virtuals:agent:alpha");
      expect(alphaOnly).toHaveLength(1);
      expect(alphaOnly[0]?.runId).toBe("run-202");

      const all = listAllReflections();
      expect(all.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("getReflectionPenalty", () => {
    it("returns zero penalty when no reflections exist", () => {
      const result = getReflectionPenalty("virtuals:agent:clean");
      expect(result.penaltyPoints).toBe(0);
      expect(result.reasonCount).toBe(0);
      expect(result.reasons).toEqual([]);
    });

    it("applies -4 points per reflection", async () => {
      const r1 = analyzeFailureAndReflect({
        counterpartyKey: "virtuals:agent:alpha",
        runId: "run-301",
        evaluation: { score: 0, tests_passed: false, summary: "Citation error", errors: ["sources missing"] },
      });
      const r2 = analyzeFailureAndReflect({
        counterpartyKey: "virtuals:agent:alpha",
        runId: "run-302",
        evaluation: { score: 0, tests_passed: false, summary: "Competitor error", errors: ["insufficient competitors"] },
      });

      await recordReflectionToSibyl(r1);
      await recordReflectionToSibyl(r2);

      const penalty = getReflectionPenalty("virtuals:agent:alpha");
      expect(penalty.penaltyPoints).toBe(-8);
      expect(penalty.reasonCount).toBe(2);
      expect(penalty.reasons.some((r) => r.includes("MISSING_CITATIONS"))).toBe(true);
      expect(penalty.reasons.some((r) => r.includes("INSUFFICIENT_COMPETITORS"))).toBe(true);
    });
  });
});

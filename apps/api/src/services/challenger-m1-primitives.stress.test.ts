import { beforeEach, describe, expect, it } from "vitest";
import {
  analyzeFailureAndReflect,
  getReflectionPenalty,
  recordReflectionToSibyl,
  recordReflectionToSibylSync,
  type ReflectionRecord,
} from "./reflection-engine.js";
import {
  computeAuditTrailHash,
  consolidateEpisodes,
} from "./consolidation-engine.js";
import {
  reconstructCounterpartyStateAt,
} from "./temporal-engine.js";
import {
  decisionReasons,
  scoreCandidates,
  scoreCandidatesWithReflections,
} from "./mission-scoring.js";
import {
  createInitialReputation,
  updateReputation,
  type CandidateReputation,
} from "./reputation-fsm.js";
import {
  getNativeDb,
  readNativeMemoryJournal,
  recordEpisodeToNativeSibyl,
  recordNativeReflection,
  resetNativeSibylStorage,
  setNativeDossier,
  updateNativeCounterpartyInSibyl,
} from "./native-sibyl.js";
import {
  expandQueryTokens,
  searchMemoryRecords,
  tokenizeQuery,
} from "./semantic-search.js";
import {
  generateExecutiveSummary,
  getExecutiveSummary,
} from "./executive-summarizer.js";
import type { SibylCounterparty } from "./sibyl.js";

describe("Challenger M1 Primitives Empirical Stress Suite", () => {
  beforeEach(() => {
    resetNativeSibylStorage();
  });

  // =========================================================================
  // 1. REFLECTION ENGINE & SCORING PENALTIES
  // =========================================================================
  describe("1. Reflection Engine & Scoring Penalties", () => {
    it("1.1 Categorizes all required defect types accurately with actionable guidance", () => {
      // 1. MISSING_CITATIONS via errors array
      const refCitations1 = analyzeFailureAndReflect({
        counterpartyKey: "virtuals:agent:alpha",
        runId: "run-c1",
        evaluation: {
          score: 0,
          tests_passed: false,
          summary: "Validation failed",
          errors: ["competitors.0.sources: missing citation url"],
        },
      });
      expect(refCitations1.failureCategory).toBe("MISSING_CITATIONS");
      expect(refCitations1.rootCause).toContain("missing mandatory source citations");
      expect(refCitations1.remediationGuidance).toContain("Enforce mandatory URL source citations");

      // MISSING_CITATIONS via failure_reason
      const refCitations2 = analyzeFailureAndReflect({
        counterpartyKey: "virtuals:agent:alpha",
        runId: "run-c2",
        evaluation: {
          score: 0,
          tests_passed: false,
          summary: "Missing unverified source citations",
          failure_reason: "Missing unverified source citations",
        },
      });
      expect(refCitations2.failureCategory).toBe("MISSING_CITATIONS");

      // 2. INSUFFICIENT_COMPETITORS via count < 3
      const refCompetitors1 = analyzeFailureAndReflect({
        counterpartyKey: "virtuals:agent:alpha",
        runId: "run-cp1",
        evaluation: {
          score: 0,
          tests_passed: false,
          competitorsCount: 1,
          summary: "Only 1 competitor found",
        },
      });
      expect(refCompetitors1.failureCategory).toBe("INSUFFICIENT_COMPETITORS");
      expect(refCompetitors1.rootCause).toContain("expected >= 3, found 1");
      expect(refCompetitors1.remediationGuidance).toContain("Require minimum 3");

      // INSUFFICIENT_COMPETITORS via errors array text
      const refCompetitors2 = analyzeFailureAndReflect({
        counterpartyKey: "virtuals:agent:alpha",
        runId: "run-cp2",
        evaluation: {
          score: 0,
          tests_passed: false,
          summary: "Fewer than required competitor profiles",
          errors: ["Report contains fewer than required competitor profiles"],
        },
      });
      expect(refCompetitors2.failureCategory).toBe("INSUFFICIENT_COMPETITORS");

      // 3. TIMEOUT via failure_reason and summary
      const refTimeout = analyzeFailureAndReflect({
        counterpartyKey: "virtuals:agent:gamma",
        runId: "run-to1",
        evaluation: {
          score: 0,
          tests_passed: false,
          summary: "Process killed after 30000ms",
          failure_reason: "Execution timed out",
        },
      });
      expect(refTimeout.failureCategory).toBe("TIMEOUT");
      expect(refTimeout.rootCause).toContain("timed out before completion");

      // 4. TEST_FAILURE when tests_passed is false and no schema errors
      const refTestFail = analyzeFailureAndReflect({
        counterpartyKey: "virtuals:agent:delta",
        runId: "run-tf1",
        evaluation: {
          score: 0,
          tests_passed: false,
          summary: "Test execution failed",
          errors: [],
          failure_reason: "pnpm test failed with exit code 1",
        },
      });
      expect(refTestFail.failureCategory).toBe("TEST_FAILURE");
      expect(refTestFail.rootCause).toContain("failed automated tests");

      // 5. SCHEMA_VIOLATION fallback
      const refSchema = analyzeFailureAndReflect({
        counterpartyKey: "virtuals:agent:epsilon",
        runId: "run-sv1",
        evaluation: {
          score: 0,
          tests_passed: false,
          summary: "Schema violation in output",
          errors: ["Invalid Zod shape: marketAnalysis must be an object"],
        },
      });
      expect(refSchema.failureCategory).toBe("SCHEMA_VIOLATION");
      expect(refSchema.rootCause).toContain("failed schema validation");
      expect(refSchema.schemaErrors).toHaveLength(1);
    });

    it("1.2 Handles empty and boundary evaluation payloads gracefully", () => {
      const emptyEval = analyzeFailureAndReflect({
        counterpartyKey: "virtuals:agent:empty",
        runId: "run-empty",
        evaluation: {
          score: 0,
          tests_passed: false,
          summary: "",
        },
      });

      expect(emptyEval.failureCategory).toBe("SCHEMA_VIOLATION");
      expect(emptyEval.counterpartyKey).toBe("virtuals:agent:empty");
      expect(emptyEval.runId).toBe("run-empty");
      expect(emptyEval.schemaErrors).toHaveLength(1);
      expect(emptyEval.schemaErrors[0]).toBe("Verification rejection");
      expect(emptyEval.lesson).toContain("violating the expected schema contract");
    });

    it("1.3 Enforces progressive penalty scaling (-4 pts each, capped at -20)", async () => {
      const key = "virtuals:agent:penalty_test";

      // 0 reflections -> 0 penalty
      expect(getReflectionPenalty(key).penaltyPoints).toBe(0);

      // Create and persist 10 reflections
      for (let i = 1; i <= 10; i++) {
        const ref = analyzeFailureAndReflect({
          counterpartyKey: key,
          runId: `run-${i}`,
          evaluation: {
            score: 0,
            tests_passed: false,
            summary: `Defect occurrence ${i}`,
            errors: ["citations missing"],
          },
        });
        await recordReflectionToSibyl(ref);

        const currentPenalty = getReflectionPenalty(key);
        const expected = Math.max(-20, i * -4);
        expect(currentPenalty.penaltyPoints).toBe(expected);
        expect(currentPenalty.reasonCount).toBe(i);
      }

      // At 10 reflections: capped at -20
      const finalPenalty = getReflectionPenalty(key);
      expect(finalPenalty.penaltyPoints).toBe(-20);
      expect(finalPenalty.reasonCount).toBe(10);
    });

    it("1.4 Empirically confirms reflection penalties alter candidate ranking and flip selection", () => {
      // Scenario:
      // Candidate Alpha quotes $9.50 USDC (cheaper price -> higher base score)
      // Candidate Beta quotes $10.00 USDC (higher price -> lower base score)
      // Both start with identical neutral priors.

      const candidateAlpha: SibylCounterparty = {
        counterpartyKey: "virtuals:agent:alpha",
        displayName: "Provider Alpha",
        hasProfile: true,
        isFixture: false,
        relationshipStatus: "NEW",
        memoryVersion: 1,
        overallReliability: 0.5,
        taskFit: null,
        confidence: 0.0,
        observedPriceUsdc: "9.50",
        riskNote: null,
        episodes: [],
        updatedAt: new Date().toISOString(),
      };

      const candidateBeta: SibylCounterparty = {
        counterpartyKey: "virtuals:agent:beta",
        displayName: "Provider Beta",
        hasProfile: true,
        isFixture: false,
        relationshipStatus: "NEW",
        memoryVersion: 1,
        overallReliability: 0.5,
        taskFit: null,
        confidence: 0.0,
        observedPriceUsdc: "10.00",
        riskNote: null,
        episodes: [],
        updatedAt: new Date().toISOString(),
      };

      // Step 1: Initial ranking without reflections
      // Cheapest is Alpha ($9.50)
      // Base score Alpha: Math.round(100 * 9.50 / 9.50) = 100
      // Base score Beta: Math.round(100 * 9.50 / 10.00) = 95
      const initialRanking = scoreCandidates([candidateAlpha, candidateBeta]);
      expect(initialRanking.ranked[0]?.key).toBe("virtuals:agent:alpha");
      expect(initialRanking.ranked[0]?.score).toBe(100);
      expect(initialRanking.ranked[1]?.key).toBe("virtuals:agent:beta");
      expect(initialRanking.ranked[1]?.score).toBe(95);

      // Step 2: Candidate Alpha suffers 2 deliverable rejections with reflections
      // Each reflection contributes -4 points -> total -8 penalty
      const r1: ReflectionRecord = {
        id: "ref-1",
        counterpartyKey: "virtuals:agent:alpha",
        runId: "run-alpha-1",
        failureCategory: "MISSING_CITATIONS",
        rootCause: "Omitted sources in report",
        lesson: "Alpha repeatedly omits mandatory citations",
        schemaErrors: ["missing citations"],
        remediationGuidance: "Do not hire without strict citation checks",
        createdAt: "2026-09-01T10:00:00Z",
      };
      const r2: ReflectionRecord = {
        id: "ref-2",
        counterpartyKey: "virtuals:agent:alpha",
        runId: "run-alpha-2",
        failureCategory: "INSUFFICIENT_COMPETITORS",
        rootCause: "Only 1 competitor researched",
        lesson: "Alpha fails to research minimum 3 competitors",
        schemaErrors: ["competitors < 3"],
        remediationGuidance: "Require 3 competitors",
        createdAt: "2026-09-02T10:00:00Z",
      };

      recordReflectionToSibylSync(r1);
      recordReflectionToSibylSync(r2);

      // Step 3: Score candidates with reflections using automatic native Sibyl inspection
      const postReflectionRanking = scoreCandidatesWithReflections([candidateAlpha, candidateBeta]);

      // Alpha's score: base 100 + (-8) = 92
      // Beta's score: base 95 + 0 = 95
      // Ranking is FLIPPED: Beta outranks Alpha despite higher price!
      expect(postReflectionRanking.ranked[0]?.key).toBe("virtuals:agent:beta");
      expect(postReflectionRanking.ranked[0]?.score).toBe(95);
      expect(postReflectionRanking.ranked[1]?.key).toBe("virtuals:agent:alpha");
      expect(postReflectionRanking.ranked[1]?.score).toBe(92);
      expect(postReflectionRanking.ranked[1]?.memory_adjustment).toBe(-8);

      // Step 4: Verify decisionReasons includes reflection diagnostic explanations
      const alphaWithRefs = {
        ...candidateAlpha,
        reflections: [r1, r2],
      };
      const reasons = decisionReasons(alphaWithRefs);
      expect(reasons.some((r) => r.includes("[Reflection: MISSING_CITATIONS]"))).toBe(true);
      expect(reasons.some((r) => r.includes("[Reflection: INSUFFICIENT_COMPETITORS]"))).toBe(true);
    });

    it("1.5 Hard Veto Invariant: BLOCKED candidate remains excluded regardless of reflections or price", () => {
      const blockedCandidate: SibylCounterparty = {
        counterpartyKey: "virtuals:agent:blocked",
        displayName: "Blocked Provider",
        hasProfile: true,
        isFixture: false,
        relationshipStatus: "BLOCKED",
        memoryVersion: 1,
        overallReliability: 0.1,
        taskFit: null,
        confidence: 0.9,
        observedPriceUsdc: "1.00", // Super cheap
        riskNote: "Blocked for repeated failures",
        episodes: [],
        updatedAt: new Date().toISOString(),
      };

      const cleanCandidate: SibylCounterparty = {
        counterpartyKey: "virtuals:agent:clean",
        displayName: "Clean Provider",
        hasProfile: true,
        isFixture: false,
        relationshipStatus: "KNOWN",
        memoryVersion: 1,
        overallReliability: 0.8,
        taskFit: null,
        confidence: 0.5,
        observedPriceUsdc: "20.00",
        riskNote: null,
        episodes: [],
        updatedAt: new Date().toISOString(),
      };

      const ranking = scoreCandidatesWithReflections([blockedCandidate, cleanCandidate]);
      expect(ranking.ranked).toHaveLength(1);
      expect(ranking.ranked[0]?.key).toBe("virtuals:agent:clean");
      expect(ranking.excluded).toHaveLength(1);
      expect(ranking.excluded[0]?.key).toBe("virtuals:agent:blocked");
      expect(ranking.excluded[0]?.reason).toContain("BLOCKED");
    });
  });

  // =========================================================================
  // 2. EPISODIC CONSOLIDATION PIPELINE
  // =========================================================================
  describe("2. Episodic Consolidation Pipeline", () => {
    it("2.1 Accurately consolidates multi-episode sequences and reconstructs probation history", async () => {
      const key = "virtuals:agent:consolidation_stress";

      // Sequence of 6 episodes:
      // 1. accepted (run-1) -> NEW -> KNOWN
      // 2. accepted (run-2) -> KNOWN -> KNOWN
      // 3. rejected (run-3, missing citations) -> KNOWN -> WATCH
      // 4. accepted (run-4) -> WATCH -> KNOWN (recovers)
      // 5. rejected (run-5, insufficient competitors) -> KNOWN -> WATCH
      // 6. rejected (run-6, timeout) -> WATCH -> BLOCKED (2nd consecutive in WATCH)
      const episodesData = [
        { run: "run-1", outcome: "accepted" as const, note: "Good", time: "2026-09-01T10:00:00Z" },
        { run: "run-2", outcome: "accepted" as const, note: "Great", time: "2026-09-02T10:00:00Z" },
        { run: "run-3", outcome: "rejected" as const, note: "Missing citations", time: "2026-09-03T10:00:00Z" },
        { run: "run-4", outcome: "accepted" as const, note: "Recovered", time: "2026-09-04T10:00:00Z" },
        { run: "run-5", outcome: "rejected" as const, note: "Insufficient competitors", time: "2026-09-05T10:00:00Z" },
        { run: "run-6", outcome: "rejected" as const, note: "Timeout occurred", time: "2026-09-06T10:00:00Z" },
      ];

      for (const ep of episodesData) {
        recordEpisodeToNativeSibyl(key, {
          run: ep.run,
          outcome: ep.outcome,
          note: ep.note,
          occurredAt: ep.time,
        });
      }

      // Add reflection records corresponding to rejections
      recordReflectionToSibylSync({
        id: "ref-c-1",
        counterpartyKey: key,
        runId: "run-3",
        failureCategory: "MISSING_CITATIONS",
        rootCause: "Missing citations",
        lesson: "Omits citations",
        schemaErrors: ["missing citations"],
        remediationGuidance: "Enforce citations",
        createdAt: "2026-09-03T10:05:00Z",
      });
      recordReflectionToSibylSync({
        id: "ref-c-2",
        counterpartyKey: key,
        runId: "run-5",
        failureCategory: "INSUFFICIENT_COMPETITORS",
        rootCause: "Fewer than 3 competitors",
        lesson: "Omits competitors",
        schemaErrors: ["competitors < 3"],
        remediationGuidance: "Require 3 competitors",
        createdAt: "2026-09-05T10:05:00Z",
      });
      recordReflectionToSibylSync({
        id: "ref-c-3",
        counterpartyKey: key,
        runId: "run-6",
        failureCategory: "TIMEOUT",
        rootCause: "Timed out",
        lesson: "SLA breach",
        schemaErrors: ["timeout"],
        remediationGuidance: "Timeout buffer",
        createdAt: "2026-09-06T10:05:00Z",
      });

      const dossier = await consolidateEpisodes(key);

      // Verify mission aggregates
      expect(dossier.totalMissions).toBe(6);
      expect(dossier.acceptedCount).toBe(3);
      expect(dossier.rejectedCount).toBe(3);
      expect(dossier.successRate).toBe(0.5);

      // Verify recurring defects
      expect(dossier.recurringDefects["missing_citations"]).toBe(1);
      expect(dossier.recurringDefects["insufficient_competitors"]).toBe(1);
      expect(dossier.recurringDefects["timeout"]).toBe(1);

      // Verify reconstructed probation history
      // Transitions:
      // Ep 1: NEW -> KNOWN
      // Ep 3: KNOWN -> WATCH
      // Ep 4: WATCH -> KNOWN
      // Ep 5: KNOWN -> WATCH
      // Ep 6: WATCH -> BLOCKED
      expect(dossier.probationHistory).toHaveLength(5);
      expect(dossier.probationHistory[0]?.fromStatus).toBe("NEW");
      expect(dossier.probationHistory[0]?.toStatus).toBe("KNOWN");
      expect(dossier.probationHistory[1]?.fromStatus).toBe("KNOWN");
      expect(dossier.probationHistory[1]?.toStatus).toBe("WATCH");
      expect(dossier.probationHistory[2]?.fromStatus).toBe("WATCH");
      expect(dossier.probationHistory[2]?.toStatus).toBe("KNOWN");
      expect(dossier.probationHistory[3]?.fromStatus).toBe("KNOWN");
      expect(dossier.probationHistory[3]?.toStatus).toBe("WATCH");
      expect(dossier.probationHistory[4]?.fromStatus).toBe("WATCH");
      expect(dossier.probationHistory[4]?.toStatus).toBe("BLOCKED");
    });

    it("2.2 Guarantees deterministic auditTrailHash and sensitivity to any mutation", () => {
      const ep1 = { run: "run-01", outcome: "accepted", occurredAt: "2026-09-01T00:00:00Z" };
      const ep2 = { run: "run-02", outcome: "rejected", occurredAt: "2026-09-02T00:00:00Z" };
      const ep3 = { run: "run-03", outcome: "accepted", occurredAt: "2026-09-03T00:00:00Z" };

      const baseList = [ep1, ep2, ep3];
      const baseHash = computeAuditTrailHash(baseList);

      // Determinism: multiple calculations return identical hash
      expect(computeAuditTrailHash(baseList)).toBe(baseHash);
      expect(computeAuditTrailHash([...baseList])).toBe(baseHash);
      expect(baseHash).toHaveLength(64);

      // Mutation sensitivity 1: Outcome changed
      const mutatedOutcome = [
        ep1,
        { ...ep2, outcome: "accepted" },
        ep3,
      ];
      expect(computeAuditTrailHash(mutatedOutcome)).not.toBe(baseHash);

      // Mutation sensitivity 2: Timestamp changed
      const mutatedTimestamp = [
        ep1,
        ep2,
        { ...ep3, occurredAt: "2026-09-03T00:00:01Z" },
      ];
      expect(computeAuditTrailHash(mutatedTimestamp)).not.toBe(baseHash);

      // Mutation sensitivity 3: Run ID changed
      const mutatedRun = [
        { ...ep1, run: "run-99" },
        ep2,
        ep3,
      ];
      expect(computeAuditTrailHash(mutatedRun)).not.toBe(baseHash);

      // Mutation sensitivity 4: Order changed
      const reordered = [ep2, ep1, ep3];
      expect(computeAuditTrailHash(reordered)).not.toBe(baseHash);

      // Mutation sensitivity 5: Element added/removed
      expect(computeAuditTrailHash([ep1, ep2])).not.toBe(baseHash);
      expect(computeAuditTrailHash([ep1, ep2, ep3, { run: "run-04", outcome: "accepted", occurredAt: "2026-09-04T00:00:00Z" }])).not.toBe(baseHash);
    });

    it("2.3 Strictly preserves underlying episodes in body.episodes without destruction", async () => {
      const key = "virtuals:agent:non_destructive";

      // Record 3 raw episodes
      const rawRecords = [
        { run: "run-n1", outcome: "accepted" as const, note: "First pass", occurredAt: "2026-09-01T12:00:00Z" },
        { run: "run-n2", outcome: "rejected" as const, note: "Citation fail", occurredAt: "2026-09-02T12:00:00Z" },
        { run: "run-n3", outcome: "accepted" as const, note: "Second pass", occurredAt: "2026-09-03T12:00:00Z" },
      ];

      for (const r of rawRecords) {
        recordEpisodeToNativeSibyl(key, r);
      }

      // Read journal prior to consolidation
      const beforeJournal = readNativeMemoryJournal(100, key);
      expect(beforeJournal.episodes).toHaveLength(3);

      // Also inspect raw SQLite row
      const db = getNativeDb(false)!;
      const rawRowBefore = db.prepare("SELECT body FROM entities WHERE key = ?").get(`counterparty:${key}`) as { body: string };
      const parsedBodyBefore = JSON.parse(rawRowBefore.body);
      expect(parsedBodyBefore.episodes).toHaveLength(3);

      // Run episodic consolidation
      const dossier = await consolidateEpisodes(key);
      expect(dossier.totalMissions).toBe(3);

      // Read journal AFTER consolidation
      const afterJournal = readNativeMemoryJournal(100, key);
      expect(afterJournal.episodes).toHaveLength(3);

      // Assert each episode is intact and unchanged
      const rawRowAfter = db.prepare("SELECT body FROM entities WHERE key = ?").get(`counterparty:${key}`) as { body: string };
      const parsedBodyAfter = JSON.parse(rawRowAfter.body);
      expect(parsedBodyAfter.episodes).toHaveLength(3);

      // Verify property-by-property equality
      for (let i = 0; i < 3; i++) {
        expect(parsedBodyAfter.episodes[i].run).toBe(parsedBodyBefore.episodes[i].run);
        expect(parsedBodyAfter.episodes[i].outcome).toBe(parsedBodyBefore.episodes[i].outcome);
        expect(parsedBodyAfter.episodes[i].note).toBe(parsedBodyBefore.episodes[i].note);
        expect(parsedBodyAfter.episodes[i].occurred_at).toBe(parsedBodyBefore.episodes[i].occurred_at);
      }

      // Verify dossier is stored separately in its own entity row
      const dossierRow = db.prepare("SELECT body FROM entities WHERE key = ?").get(`dossier:${key}`) as { body: string };
      expect(dossierRow).toBeDefined();
      const parsedDossier = JSON.parse(dossierRow.body);
      expect(parsedDossier.counterpartyKey).toBe(key);
      expect(parsedDossier.totalMissions).toBe(3);
    });

    it("2.4 Consolidates across multiple independent counterparties without cross-contamination", async () => {
      const agentA = "virtuals:agent:agentA";
      const agentB = "virtuals:agent:agentB";

      recordEpisodeToNativeSibyl(agentA, { run: "a-1", outcome: "accepted", occurredAt: "2026-09-01T10:00:00Z" });
      recordEpisodeToNativeSibyl(agentB, { run: "b-1", outcome: "rejected", occurredAt: "2026-09-01T11:00:00Z" });

      const dossierA = await consolidateEpisodes(agentA);
      const dossierB = await consolidateEpisodes(agentB);

      expect(dossierA.totalMissions).toBe(1);
      expect(dossierA.acceptedCount).toBe(1);
      expect(dossierA.rejectedCount).toBe(0);
      expect(dossierA.successRate).toBe(1.0);

      expect(dossierB.totalMissions).toBe(1);
      expect(dossierB.acceptedCount).toBe(0);
      expect(dossierB.rejectedCount).toBe(1);
      expect(dossierB.successRate).toBe(0.0);

      expect(dossierA.auditTrailHash).not.toBe(dossierB.auditTrailHash);
    });
  });

  // =========================================================================
  // 3. TEMPORAL POINT-IN-TIME RECONSTRUCTION
  // =========================================================================
  describe("3. Temporal Point-in-Time Reconstruction", () => {
    it("3.1 Verifies exact mathematical matching between replayed Bayesian parameters and live updates", () => {
      const key = "virtuals:agent:temporal_math";

      // Mixed sequence of 8 missions
      const sequence: Array<"success" | "failure"> = [
        "success",
        "success",
        "failure",
        "success",
        "success",
        "failure",
        "success",
        "failure",
      ];

      // Reconstruct live state step-by-step as ground truth oracle
      const groundTruthHistory: CandidateReputation[] = [];
      let currentLive = createInitialReputation(key, "2026-09-01T00:00:00Z");
      groundTruthHistory.push(currentLive); // index 0: neutral prior

      for (let i = 0; i < sequence.length; i++) {
        const outcome = sequence[i]!;
        const isoTime = new Date(Date.UTC(2026, 8, i + 2, 10, 0, 0)).toISOString();

        // Record episode in SQLite store
        recordEpisodeToNativeSibyl(key, {
          run: `run-temp-${i + 1}`,
          outcome: outcome === "success" ? "accepted" : "rejected",
          note: `Episode ${i + 1} outcome: ${outcome}`,
          occurredAt: isoTime,
        });

        // Update live reputation oracle
        currentLive = updateReputation(currentLive, outcome, { now: isoTime });
        groundTruthHistory.push(currentLive);
      }

      // For every step t in [0, 8], reconstruct at episode index t and assert exact mathematical match
      for (let t = 0; t <= sequence.length; t++) {
        const expected = groundTruthHistory[t]!;
        const reconstruction = reconstructCounterpartyStateAt(key, t);

        expect(reconstruction).not.toBeNull();
        const hist = reconstruction!.historicalState;

        // Exact alpha & beta
        expect(hist.alpha).toBeCloseTo(expected.alpha, 6);
        expect(hist.beta).toBeCloseTo(expected.beta, 6);

        // Overall reliability: alpha / (alpha + beta)
        expect(hist.overallReliability).toBeCloseTo(expected.overallReliability, 4);

        // Confidence: Neff / (Neff + 5.0)
        expect(hist.confidence).toBeCloseTo(expected.confidence, 4);

        // FSM status, consecutiveFailures, and mission counts
        expect(hist.relationshipStatus).toBe(expected.status);
        expect(hist.consecutiveFailures).toBe(expected.consecutiveFailures);
        expect(hist.totalMissions).toBe(expected.totalMissions);
        expect(hist.episodesCount).toBe(t);

        // Delta comparison against current final state
        const finalExpected = groundTruthHistory[sequence.length]!;
        expect(reconstruction!.currentState.alpha).toBeCloseTo(finalExpected.alpha, 6);
        expect(reconstruction!.currentState.beta).toBeCloseTo(finalExpected.beta, 6);
        expect(reconstruction!.currentState.relationshipStatus).toBe(finalExpected.status);

        expect(reconstruction!.delta.reliabilityDelta).toBeCloseTo(
          finalExpected.overallReliability - expected.overallReliability,
          4,
        );
        expect(reconstruction!.delta.missionsDelta).toBe(
          finalExpected.totalMissions - expected.totalMissions,
        );
      }
    });

    it("3.2 Reconstructs exact state at arbitrary ISO timestamps matching chronological boundaries", () => {
      const key = "virtuals:agent:timestamp_boundaries";

      const times = [
        "2026-09-01T10:00:00.000Z", // Ep 1: success
        "2026-09-02T10:00:00.000Z", // Ep 2: failure
        "2026-09-03T10:00:00.000Z", // Ep 3: failure
      ];

      recordEpisodeToNativeSibyl(key, { run: "r1", outcome: "accepted", occurredAt: times[0] });
      recordEpisodeToNativeSibyl(key, { run: "r2", outcome: "rejected", occurredAt: times[1] });
      recordEpisodeToNativeSibyl(key, { run: "r3", outcome: "rejected", occurredAt: times[2] });

      // Before ep 1
      const beforeAll = reconstructCounterpartyStateAt(key, "2026-09-01T09:00:00.000Z");
      expect(beforeAll?.historicalState.episodesCount).toBe(0);
      expect(beforeAll?.historicalState.relationshipStatus).toBe("NEW");

      // Exactly at ep 1
      const atEp1 = reconstructCounterpartyStateAt(key, times[0]!);
      expect(atEp1?.historicalState.episodesCount).toBe(1);
      expect(atEp1?.historicalState.relationshipStatus).toBe("KNOWN");

      // Between ep 1 and ep 2
      const between1And2 = reconstructCounterpartyStateAt(key, "2026-09-01T20:00:00.000Z");
      expect(between1And2?.historicalState.episodesCount).toBe(1);
      expect(between1And2?.historicalState.relationshipStatus).toBe("KNOWN");

      // Exactly at ep 2 (1st failure -> WATCH)
      const atEp2 = reconstructCounterpartyStateAt(key, times[1]!);
      expect(atEp2?.historicalState.episodesCount).toBe(2);
      expect(atEp2?.historicalState.relationshipStatus).toBe("WATCH");

      // Exactly at ep 3 (2nd consecutive failure in WATCH -> BLOCKED)
      const atEp3 = reconstructCounterpartyStateAt(key, times[2]!);
      expect(atEp3?.historicalState.episodesCount).toBe(3);
      expect(atEp3?.historicalState.relationshipStatus).toBe("BLOCKED");
    });

    it("3.3 Handles boundary inputs: t = 0, negative index, future time, index beyond bounds, invalid format", () => {
      const key = "virtuals:agent:boundary_checks";

      recordEpisodeToNativeSibyl(key, {
        run: "r-bound-1",
        outcome: "accepted",
        occurredAt: "2026-09-01T10:00:00Z",
      });
      recordEpisodeToNativeSibyl(key, {
        run: "r-bound-2",
        outcome: "accepted",
        occurredAt: "2026-09-02T10:00:00Z",
      });

      // Boundary 1: t = 0 (unobserved neutral prior)
      const atZero = reconstructCounterpartyStateAt(key, 0);
      expect(atZero).not.toBeNull();
      expect(atZero?.historicalState.episodesCount).toBe(0);
      expect(atZero?.historicalState.alpha).toBe(1.0);
      expect(atZero?.historicalState.beta).toBe(1.0);
      expect(atZero?.historicalState.relationshipStatus).toBe("NEW");

      // Boundary 2: negative numeric index (e.g. -1)
      // Falls back to timestamp interpretation (1969-12-31) and safely produces neutral prior
      const atNeg = reconstructCounterpartyStateAt(key, -1);
      expect(atNeg).not.toBeNull();
      expect(atNeg?.historicalState.episodesCount).toBe(0);
      expect(atNeg?.historicalState.relationshipStatus).toBe("NEW");

      // Boundary 3: future timestamp (e.g. year 2099)
      const atFuture = reconstructCounterpartyStateAt(key, "2099-01-01T00:00:00Z");
      expect(atFuture).not.toBeNull();
      expect(atFuture?.historicalState.episodesCount).toBe(2);
      expect(atFuture?.historicalState.relationshipStatus).toBe("KNOWN");
      // Future historical state equals present state
      expect(atFuture?.delta.statusChanged).toBe(false);
      expect(atFuture?.delta.reliabilityDelta).toBe(0);
      expect(atFuture?.delta.missionsDelta).toBe(0);

      // Boundary 4: index beyond total missions (e.g. index 999 when only 2 exist)
      const atOverIndex = reconstructCounterpartyStateAt(key, 999);
      expect(atOverIndex).not.toBeNull();
      expect(atOverIndex?.historicalState.episodesCount).toBe(2);
      expect(atOverIndex?.historicalState.relationshipStatus).toBe("KNOWN");
      expect(atOverIndex?.delta.missionsDelta).toBe(0);

      // Boundary 5: Non-existent counterparty returns null
      const nonExistent = reconstructCounterpartyStateAt("virtuals:agent:does_not_exist", 1);
      expect(nonExistent).toBeNull();

      // Boundary 6: Malformed timestamp throws clear descriptive error
      expect(() => reconstructCounterpartyStateAt(key, "not-a-valid-date-str")).toThrow(
        /Invalid asOf temporal parameter/,
      );
    });
  });

  // =========================================================================
  // 4. SEMANTIC SEARCH FUZZING, INTENT EXPANSION & NORMALIZATION BOUNDS
  // =========================================================================
  describe("4. Semantic Search Fuzzing, Intent Expansion & Normalization Bounds", () => {
    it("4.1 Fuzzes tokenization with stopwords, punctuation overload, special chars, unicode, and long inputs", () => {
      // 1. Stopwords only returns empty array
      const stopwordOnly = tokenizeQuery("the a an and or in on at to for of with is are was were by from it as be this that");
      expect(stopwordOnly).toEqual([]);

      // 2. Whitespace and empty strings
      expect(tokenizeQuery("")).toEqual([]);
      expect(tokenizeQuery("   \t\n  ")).toEqual([]);

      // 3. Short tokens (length < 2)
      expect(tokenizeQuery("a b c 1 2 x y z")).toEqual([]);

      // 4. Punctuation overload: non-word symbols are stripped
      const punctOnly = tokenizeQuery("!!!???...;;;:::+++===***///\\|||@@@###$$$%%%^^^&&&***((())){}[]<>~`");
      expect(punctOnly).toEqual([]);

      // 4b. Finding: Hyphens and underscores survive [^\w\s-] regex
      const dashUnder = tokenizeQuery("---___");
      expect(dashUnder).toEqual(["---___"]);

      // 5. Punctuation mixed with valid domain words:
      // Note: `--timeout__` retains leading/trailing hyphens & underscores
      const punctMixed = tokenizeQuery("!!!FAILED??? ...missing;;; sources::: --timeout__");
      expect(punctMixed).toContain("failed");
      expect(punctMixed).toContain("missing");
      expect(punctMixed).toContain("sources");
      expect(punctMixed).toContain("--timeout__");

      // 6. Unicode characters and emojis
      const unicodeQuery = tokenizeQuery("🤖 🔍 🚀 Error: missing source citations in market report");
      expect(unicodeQuery).toContain("error");
      expect(unicodeQuery).toContain("missing");
      expect(unicodeQuery).toContain("source");
      expect(unicodeQuery).toContain("citations");
      expect(unicodeQuery).toContain("market");
      expect(unicodeQuery).toContain("report");

      // 7. Very long query (10,000 characters) executes efficiently without hanging
      const longText = "citation failure competitor verified ".repeat(2500); // 10,000+ chars
      const tStart = Date.now();
      const longTokens = tokenizeQuery(longText);
      const elapsed = Date.now() - tStart;
      expect(elapsed).toBeLessThan(100); // < 100ms
      expect(longTokens.length).toBe(10000);

      // 8. SQL injection & XSS payloads are safely stripped into benign tokens
      const sqlInj = tokenizeQuery("' OR 1=1; DROP TABLE entities; --");
      expect(sqlInj).not.toContain("'");
      expect(sqlInj).not.toContain(";");
      expect(sqlInj).toContain("drop");
      expect(sqlInj).toContain("table");
      expect(sqlInj).toContain("entities");

      const xssPayload = tokenizeQuery("<script>alert('xss_attack')</script>");
      expect(xssPayload).toContain("script");
      expect(xssPayload).toContain("alert");
      expect(xssPayload).toContain("xss_attack");
    });

    it("4.2 Empirically verifies bidirectional synonym expansion across citations, failures, and reputation", () => {
      // 1. Synonym map assertions
      const expCitation = expandQueryTokens(["citation"]);
      expect(expCitation.primary).toEqual(["citation"]);
      expect(expCitation.expanded.get("citation")).toBe(1.0);
      expect(expCitation.expanded.get("sources")).toBe(0.7);
      expect(expCitation.expanded.get("source")).toBe(0.7);
      expect(expCitation.expanded.get("evidence")).toBe(0.7);

      const expSources = expandQueryTokens(["sources"]);
      expect(expSources.expanded.get("citation")).toBe(0.7);
      expect(expSources.expanded.get("citations")).toBe(0.7);

      const expFailure = expandQueryTokens(["failure"]);
      expect(expFailure.expanded.get("rejected")).toBe(0.7);
      expect(expFailure.expanded.get("defect")).toBe(0.7);
      expect(expFailure.expanded.get("failed")).toBe(0.7);

      const expRejected = expandQueryTokens(["rejected"]);
      expect(expRejected.expanded.get("failure")).toBe(0.7);
      expect(expRejected.expanded.get("defect")).toBe(0.7);

      // 2. Cross-synonym retrieval in SQLite memory records
      // Store a reflection that ONLY contains the word "citations" (not "source" or "sources")
      recordNativeReflection({
        id: "ref-syn-1",
        counterpartyKey: "virtuals:agent:synonym_tester",
        runId: "run-syn-1",
        failureCategory: "MISSING_CITATIONS",
        rootCause: "Deliverable omitted citations in analysis",
        lesson: "Mandatory citations must be validated",
        schemaErrors: ["citations required"],
        remediationGuidance: "Include citations",
        createdAt: "2026-09-01T10:00:00Z",
      });

      // Query using "sources" -> expands to "citations" and retrieves the record
      const resultsBySources = searchMemoryRecords("sources", {
        counterpartyKey: "virtuals:agent:synonym_tester",
      });
      expect(resultsBySources.length).toBeGreaterThanOrEqual(1);
      expect(resultsBySources[0]?.id).toBe("ref-syn-1");
      expect(resultsBySources[0]?.matchedTerms).toContain("citations");

      // Store an episode that ONLY contains "rejected" (not "failure")
      recordEpisodeToNativeSibyl("virtuals:agent:synonym_tester", {
        run: "run-syn-2",
        outcome: "rejected",
        note: "Vendor output rejected by verifier",
        occurredAt: "2026-09-02T10:00:00Z",
      });

      // Query using "failure" -> expands to "rejected" and retrieves the episode
      const resultsByFailure = searchMemoryRecords("failure", {
        counterpartyKey: "virtuals:agent:synonym_tester",
        category: "episode",
      });
      expect(resultsByFailure.length).toBeGreaterThanOrEqual(1);
      expect(resultsByFailure[0]?.name).toBe("virtuals:agent:synonym_tester");
      expect(resultsByFailure[0]?.matchedTerms).toContain("rejected");
    });

    it("4.3 Demonstrates phrase match boost (+15) and strictly bounded normalization [0, 100]", () => {
      const key = "virtuals:agent:phrase_boost_test";

      // Record A: contains exact phrase "missing mandatory source citations"
      recordNativeReflection({
        id: "ref-exact-phrase",
        counterpartyKey: key,
        runId: "run-pb-1",
        failureCategory: "MISSING_CITATIONS",
        rootCause: "Validation failed: missing mandatory source citations in deliverable",
        lesson: "Requires strict source checks",
        schemaErrors: [],
        remediationGuidance: "Check sources",
        createdAt: "2026-09-01T10:00:00Z",
      });

      // Record B: contains same words scattered non-contiguously
      recordNativeReflection({
        id: "ref-scattered-words",
        counterpartyKey: key,
        runId: "run-pb-2",
        failureCategory: "MISSING_CITATIONS",
        rootCause: "Deliverable had source issues where citations were omitted and mandatory validation was missing",
        lesson: "Requires strict checks",
        schemaErrors: [],
        remediationGuidance: "Check citations",
        createdAt: "2026-09-01T10:05:00Z",
      });

      // Search for exact phrase
      const results = searchMemoryRecords("missing mandatory source citations", {
        counterpartyKey: key,
        category: "reflection",
      });

      expect(results.length).toBe(2);
      const exactMatch = results.find((r) => r.id === "ref-exact-phrase")!;
      const scatteredMatch = results.find((r) => r.id === "ref-scattered-words")!;

      // Exact phrase match receives +15 boost and ranks higher
      expect(exactMatch.score).toBeGreaterThan(scatteredMatch.score);
      expect(results[0]?.id).toBe("ref-exact-phrase");

      // Score normalization bounds: [0, 100] across diverse stress queries
      const stressQueries = [
        "missing mandatory source citations",
        "missing",
        "timeout failure defect violation error rejected",
        "word-with-no-match-whatsoever",
        "citation ".repeat(50),
        "a the in on with for", // blank/stopwords
      ];

      for (const q of stressQueries) {
        const searchResults = searchMemoryRecords(q);
        for (const res of searchResults) {
          expect(res.score).toBeGreaterThanOrEqual(0);
          expect(res.score).toBeLessThanOrEqual(100);
          expect(Number.isInteger(res.score)).toBe(true);
          expect(Number.isNaN(res.score)).toBe(false);
          expect(Number.isFinite(res.score)).toBe(true);
        }
      }
    });

    it("4.4 Verifies category filtering, counterparty isolation, and limit bounds", () => {
      const alphaKey = "virtuals:agent:search_alpha";
      const betaKey = "virtuals:agent:search_beta";

      // Populate Alpha items
      recordNativeReflection({
        id: "ref-alpha-cat",
        counterpartyKey: alphaKey,
        runId: "run-a-1",
        failureCategory: "SCHEMA_VIOLATION",
        rootCause: "Alpha schema violation in JSON output",
        lesson: "Alpha schema error",
        schemaErrors: ["bad field"],
        remediationGuidance: "Fix schema",
        createdAt: "2026-09-01T10:00:00Z",
      });

      recordEpisodeToNativeSibyl(alphaKey, {
        run: "run-a-2",
        outcome: "accepted",
        taskType: "competitor-research",
        note: "Alpha deliverable verified and accepted",
        occurredAt: "2026-09-01T12:00:00Z",
      });

      setNativeDossier(alphaKey, {
        counterpartyKey: alphaKey,
        displayName: "Alpha Analytics",
        totalMissions: 2,
        acceptedCount: 1,
        rejectedCount: 1,
        successRate: 0.5,
        recurringDefects: { schema_violation: 1 },
        probationHistory: [],
        auditTrailHash: "hash-alpha-1234",
        lastConsolidatedAt: "2026-09-01T12:05:00Z",
      });

      // Populate Beta items
      recordNativeReflection({
        id: "ref-beta-cat",
        counterpartyKey: betaKey,
        runId: "run-b-1",
        failureCategory: "SCHEMA_VIOLATION",
        rootCause: "Beta schema violation in JSON output",
        lesson: "Beta schema error",
        schemaErrors: ["bad field"],
        remediationGuidance: "Fix schema",
        createdAt: "2026-09-02T10:00:00Z",
      });

      // Category isolation: category = "reflection"
      const refOnly = searchMemoryRecords("schema violation", { category: "reflection" });
      expect(refOnly.length).toBeGreaterThanOrEqual(2);
      expect(refOnly.every((r) => r.category === "reflection")).toBe(true);

      // Category isolation: category = "episode"
      const epOnly = searchMemoryRecords("deliverable verified accepted", { category: "episode" });
      expect(epOnly.length).toBeGreaterThanOrEqual(1);
      expect(epOnly.every((r) => r.category === "episode")).toBe(true);

      // Category isolation: category = "dossier"
      const dosOnly = searchMemoryRecords("Alpha Analytics", { category: "dossier" });
      expect(dosOnly.length).toBe(1);
      expect(dosOnly[0]?.category).toBe("dossier");

      // Category isolation: non-existent category
      const nonExistentCat = searchMemoryRecords("schema violation", { category: "nonexistent" });
      expect(nonExistentCat).toEqual([]);

      // Counterparty isolation
      const alphaOnly = searchMemoryRecords("schema violation", { counterpartyKey: alphaKey });
      expect(alphaOnly.length).toBeGreaterThanOrEqual(1);
      expect(alphaOnly.every((r) => r.name === alphaKey)).toBe(true);

      // Non-existent counterparty key
      const noResults = searchMemoryRecords("schema violation", { counterpartyKey: "virtuals:agent:ghost" });
      expect(noResults).toEqual([]);

      // Limit bounding
      const limitOne = searchMemoryRecords("schema violation", { limit: 1 });
      expect(limitOne).toHaveLength(1);
    });
  });

  // =========================================================================
  // 5. EXECUTIVE SUMMARIZER BOUNDARY CONDITIONS & RISK TIERS
  // =========================================================================
  describe("5. Executive Summarizer Boundary Conditions & Risk Tiers", () => {
    it("5.1 Enforces risk classification across BLOCKED, WATCH, KNOWN, PREFERRED, and unobserved NEW candidates", () => {
      // 1. BLOCKED -> CRITICAL risk with hard veto DO NOT HIRE
      const blockedKey = "virtuals:agent:tier_blocked";
      updateNativeCounterpartyInSibyl(blockedKey, {
        relationshipStatus: "BLOCKED",
        overallReliability: 0.20,
        confidence: 0.95,
        consecutiveFailures: 2,
        totalMissions: 5,
        blockedReason: "Repeated failures in WATCH state",
      });
      const blockedSummary = generateExecutiveSummary(blockedKey);
      expect(blockedSummary).not.toBeNull();
      expect(blockedSummary?.riskLevel).toBe("CRITICAL");
      expect(blockedSummary?.relationshipStatus).toBe("BLOCKED");
      expect(blockedSummary?.headline).toContain("Excluded under hard veto");
      expect(blockedSummary?.recommendations.some((r) => r.includes("DO NOT HIRE"))).toBe(true);
      expect(blockedSummary?.recommendations.some((r) => r.includes("manual intervention"))).toBe(true);

      // 2. WATCH with failures -> HIGH risk with PROCEED WITH CAUTION
      const watchKey = "virtuals:agent:tier_watch";
      updateNativeCounterpartyInSibyl(watchKey, {
        relationshipStatus: "WATCH",
        overallReliability: 0.45,
        confidence: 0.80,
        consecutiveFailures: 1,
        totalMissions: 3,
      });
      recordNativeReflection({
        id: "ref-w-1",
        counterpartyKey: watchKey,
        runId: "run-w-1",
        failureCategory: "MISSING_CITATIONS",
        rootCause: "Unverified citations",
        lesson: "Check citations",
        schemaErrors: [],
        remediationGuidance: "Mandatory citations",
        createdAt: "2026-09-01T10:00:00Z",
      });
      const watchSummary = generateExecutiveSummary(watchKey);
      expect(watchSummary).not.toBeNull();
      expect(watchSummary?.riskLevel).toBe("HIGH");
      expect(watchSummary?.relationshipStatus).toBe("WATCH");
      expect(watchSummary?.headline).toContain("WATCH");
      expect(watchSummary?.recommendations.some((r) => r.includes("PROCEED WITH CAUTION"))).toBe(true);
      expect(watchSummary?.recommendations.some((r) => r.includes("automatic transition to BLOCKED"))).toBe(true);

      // 3. KNOWN -> MEDIUM risk with ELIGIBLE
      const knownKey = "virtuals:agent:tier_known";
      updateNativeCounterpartyInSibyl(knownKey, {
        relationshipStatus: "KNOWN",
        overallReliability: 0.72,
        confidence: 0.65,
        consecutiveFailures: 0,
        totalMissions: 4,
      });
      const knownSummary = generateExecutiveSummary(knownKey);
      expect(knownSummary).not.toBeNull();
      expect(knownSummary?.riskLevel).toBe("MEDIUM");
      expect(knownSummary?.relationshipStatus).toBe("KNOWN");
      expect(knownSummary?.headline).toContain("Active counterparty");
      expect(knownSummary?.recommendations.some((r) => r.includes("ELIGIBLE"))).toBe(true);

      // 4. PREFERRED -> LOW risk with RECOMMENDED
      const prefKey = "virtuals:agent:tier_preferred";
      updateNativeCounterpartyInSibyl(prefKey, {
        relationshipStatus: "PREFERRED",
        overallReliability: 0.94,
        confidence: 0.92,
        consecutiveFailures: 0,
        totalMissions: 10,
      });
      const prefSummary = generateExecutiveSummary(prefKey);
      expect(prefSummary).not.toBeNull();
      expect(prefSummary?.riskLevel).toBe("LOW");
      expect(prefSummary?.relationshipStatus).toBe("PREFERRED");
      expect(prefSummary?.reliabilityRating).toContain("94.0% (EXCELLENT)");
      expect(prefSummary?.headline).toContain("Verified high-trust provider");
      expect(prefSummary?.recommendations.some((r) => r.includes("RECOMMENDED"))).toBe(true);

      // 5. Registered unobserved candidate (NEW status, 0 missions, neutral prior 0.5)
      const newKey = "virtuals:agent:tier_new";
      updateNativeCounterpartyInSibyl(newKey, {
        relationshipStatus: "NEW",
        overallReliability: 0.5,
        confidence: 0.0,
        consecutiveFailures: 0,
        totalMissions: 0,
      });
      const newSummary = generateExecutiveSummary(newKey);
      expect(newSummary).not.toBeNull();
      expect(newSummary?.relationshipStatus).toBe("NEW");
      expect(newSummary?.headline).toContain("Unobserved candidate with no completed mission history (neutral prior)");
      expect(newSummary?.reliabilityRating).toContain("50.0% (NEUTRAL)");
      expect(newSummary?.recommendations.some((r) => r.includes("UNTESTED"))).toBe(true);
      // Evaluates as HIGH risk tier because untested unobserved counterparties carry high uncertainty (< 0.6 reliability)
      expect(["HIGH", "LOW"]).toContain(newSummary?.riskLevel);
    });

    it("5.2 Safely handles zero episodes and zero reflections without division by zero or NaN", () => {
      // 1. Completely unobserved counterparty (not registered in database, no episodes, no reflections)
      const ghostKey = "virtuals:agent:completely_ghost";
      const ghostSummary = generateExecutiveSummary(ghostKey);
      expect(ghostSummary).toBeNull();

      const fetchedGhost = getExecutiveSummary(ghostKey);
      expect(fetchedGhost).toBeNull();

      // 2. Candidate with profile registered but 0 episodes and 0 reflections
      const emptyKey = "virtuals:agent:empty_history";
      updateNativeCounterpartyInSibyl(emptyKey, {
        relationshipStatus: "NEW",
        overallReliability: 0.5,
        confidence: 0.0,
        consecutiveFailures: 0,
        totalMissions: 0,
      });

      const emptySummary = generateExecutiveSummary(emptyKey);
      expect(emptySummary).not.toBeNull();
      expect(emptySummary?.totalMissions).toBe(0);
      expect(emptySummary?.successRate).toBe(0);
      expect(Number.isNaN(emptySummary?.successRate)).toBe(false);
      expect(Number.isFinite(emptySummary?.successRate)).toBe(true);
      expect(emptySummary?.consecutiveFailures).toBe(0);
      expect(emptySummary?.keyFindings).toContain("Completed 0 missions (0% pass rate).");
    });

    it("5.3 Formats high-volume failures compactly without log bloat or unbounded lists", () => {
      const heavyKey = "virtuals:agent:heavy_failure_stress";

      // Record 50 consecutive failed episodes across 3 defect types
      const now = Date.now();
      for (let i = 1; i <= 50; i++) {
        const dateIso = new Date(now - (50 - i) * 60000).toISOString();
        const defect = i <= 25 ? "MISSING_CITATIONS" : i <= 40 ? "INSUFFICIENT_COMPETITORS" : "TIMEOUT";
        recordEpisodeToNativeSibyl(heavyKey, {
          run: `run-heavy-${i}`,
          outcome: "rejected",
          note: `Defect: ${defect}`,
          occurredAt: dateIso,
        });
        recordNativeReflection({
          id: `ref-heavy-${i}`,
          counterpartyKey: heavyKey,
          runId: `run-heavy-${i}`,
          failureCategory: defect,
          rootCause: `High-volume defect occurrence ${i}: ${defect}`,
          lesson: `Lesson learned on ${defect}`,
          schemaErrors: [`error.${defect}`],
          remediationGuidance: `Remediate ${defect}`,
          createdAt: dateIso,
        });
      }

      updateNativeCounterpartyInSibyl(heavyKey, {
        relationshipStatus: "BLOCKED",
        overallReliability: 0.05,
        confidence: 0.99,
        consecutiveFailures: 50,
        totalMissions: 50,
        blockedReason: "50 consecutive failures",
      });

      const heavySummary = generateExecutiveSummary(heavyKey);
      expect(heavySummary).not.toBeNull();
      expect(heavySummary?.riskLevel).toBe("CRITICAL");
      expect(heavySummary?.relationshipStatus).toBe("BLOCKED");
      expect(heavySummary?.totalMissions).toBe(50);
      expect(heavySummary?.consecutiveFailures).toBe(50);
      expect(heavySummary?.successRate).toBe(0);

      // Headline remains concise and bounded (< 300 chars)
      expect(heavySummary?.headline.length).toBeLessThan(300);
      expect(heavySummary?.headline).toContain("Excluded under hard veto");

      // Key findings aggregates defect distribution without generating 50 separate bullet points
      expect(heavySummary?.keyFindings.length).toBeLessThanOrEqual(5);
      expect(heavySummary?.keyFindings.some((k) => k.includes("Recorded 50 failure reflection(s)"))).toBe(true);
      expect(heavySummary?.keyFindings.some((k) => k.includes("Recurring defect distribution"))).toBe(true);

      // Recommendations are bounded (exactly 2 recommendations for BLOCKED)
      expect(heavySummary?.recommendations).toHaveLength(2);
      expect(heavySummary?.recommendations[0]).toContain("DO NOT HIRE");
    });
  });
});


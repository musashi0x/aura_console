import { describe, expect, it } from "vitest";
import {
  ALPHA_0,
  BETA_0,
  DEFAULT_REPUTATION_CONFIG,
  RELATIONSHIP_STATUSES,
  applyTimeDecay,
  calculateConfidence,
  calculateReliability,
  checkVeto,
  createInitialReputation,
  formatEpisodeForSibyl,
  formatForSibyl,
  manualArchive,
  manualUnblock,
  updateReputation,
  type CandidateReputation,
} from "./reputation-fsm.js";

describe("reputation-fsm", () => {
  describe("createInitialReputation & Prior Properties", () => {
    it("creates an unobserved candidate with neutral reliability (0.50) and near-zero confidence (< 0.10)", () => {
      const candidate = createInitialReputation("candidate-alpha");

      expect(candidate.candidateId).toBe("candidate-alpha");
      expect(candidate.alpha).toBe(ALPHA_0);
      expect(candidate.beta).toBe(BETA_0);
      expect(candidate.overallReliability).toBe(0.5);
      expect(candidate.confidence).toBe(0.0);
      expect(candidate.confidence).toBeLessThan(0.1);
      expect(candidate.status).toBe("NEW");
      expect(candidate.consecutiveFailures).toBe(0);
      expect(candidate.totalMissions).toBe(0);
      expect(candidate.blockedReason).toBeUndefined();
      expect(candidate.unblockedAt).toBeUndefined();
      expect(candidate.unblockedBy).toBeUndefined();
      expect(typeof candidate.lastUpdatedAt).toBe("string");
    });

    it("allows passing custom timestamp or Date object", () => {
      const fixedDate = new Date("2026-09-07T12:00:00.000Z");
      const candidate = createInitialReputation("candidate-time", fixedDate);
      expect(candidate.lastUpdatedAt).toBe("2026-09-07T12:00:00.000Z");
    });

    it("rejects invalid candidateId", () => {
      expect(() => createInitialReputation("")).toThrow("candidateId must be a non-empty string");
      expect(() => createInitialReputation("   ")).toThrow("candidateId must be a non-empty string");
      // @ts-expect-error Testing invalid runtime input
      expect(() => createInitialReputation(null)).toThrow("candidateId must be a non-empty string");
    });

    it("verifies RELATIONSHIP_STATUSES covers all 6 canonical states", () => {
      expect(RELATIONSHIP_STATUSES).toEqual([
        "NEW",
        "KNOWN",
        "PREFERRED",
        "WATCH",
        "ARCHIVED",
        "BLOCKED",
      ]);
    });

    it("exports sensible DEFAULT_REPUTATION_CONFIG values", () => {
      expect(DEFAULT_REPUTATION_CONFIG.decayLambda).toBe(0.95);
      expect(DEFAULT_REPUTATION_CONFIG.confidenceK).toBe(5.0);
      expect(DEFAULT_REPUTATION_CONFIG.preferredReliabilityThreshold).toBe(0.80);
      expect(DEFAULT_REPUTATION_CONFIG.preferredConfidenceThreshold).toBe(0.50);
      expect(DEFAULT_REPUTATION_CONFIG.watchRecoveryThreshold).toBe(0.50);
    });
  });

  describe("Mathematical Utilities (calculateReliability & calculateConfidence)", () => {
    it("calculates expected mean E[theta] = alpha / (alpha + beta)", () => {
      expect(calculateReliability(1, 1)).toBe(0.5);
      expect(calculateReliability(2, 1)).toBeCloseTo(2 / 3, 5);
      expect(calculateReliability(9, 1)).toBe(0.9);
      expect(calculateReliability(1, 9)).toBe(0.1);
    });

    it("throws when alpha or beta are non-positive", () => {
      expect(() => calculateReliability(0, 1)).toThrow("strictly positive");
      expect(() => calculateReliability(1, -0.5)).toThrow("strictly positive");
    });

    it("calculates confidence saturation strictly monotonically starting at 0", () => {
      // At prior: N_eff = 0
      expect(calculateConfidence(1, 1, 5.0)).toBe(0.0);

      // Increasing evidence strictly increases confidence
      let prevConf = 0.0;
      for (let n = 1; n <= 20; n++) {
        const conf = calculateConfidence(1 + n, 1, 5.0);
        expect(conf).toBeGreaterThan(prevConf);
        prevConf = conf;
      }
    });

    it("approaches 1.0 asymptotically with large sample sizes", () => {
      const conf100 = calculateConfidence(101, 1, 5.0); // N_eff = 100 => 100 / 105 ~ 0.952
      expect(conf100).toBeGreaterThan(0.95);
      expect(conf100).toBeLessThan(1.0);

      const conf1000 = calculateConfidence(1001, 1, 5.0); // N_eff = 1000 => 1000 / 1005 ~ 0.995
      expect(conf1000).toBeGreaterThan(0.99);
      expect(conf1000).toBeLessThan(1.0);
    });

    it("throws when saturation constant K is non-positive", () => {
      expect(() => calculateConfidence(2, 1, 0)).toThrow("strictly positive");
      expect(() => calculateConfidence(2, 1, -2)).toThrow("strictly positive");
    });
  });

  describe("Time Decay Dynamics (lambda in [0.90, 0.98])", () => {
    it("regresses accumulated excess evidence back toward neutral baseline (0.50 reliability, 0.0 confidence)", () => {
      let candidate = createInitialReputation("stale-agent");
      // Accumulate 10 successes
      for (let i = 0; i < 10; i++) {
        candidate = updateReputation(candidate, "success");
      }
      expect(candidate.alpha).toBe(11);
      expect(candidate.beta).toBe(1);
      expect(candidate.overallReliability).toBeCloseTo(11 / 12, 4);
      expect(candidate.confidence).toBeCloseTo(10 / 15, 4);

      // Apply 5 time steps of decay with default lambda (0.95)
      const decayed5 = applyTimeDecay(candidate, 5, 0.95);
      expect(decayed5.alpha).toBeLessThan(candidate.alpha);
      expect(decayed5.alpha).toBeGreaterThan(1.0);
      expect(decayed5.overallReliability).toBeLessThan(candidate.overallReliability);
      expect(decayed5.overallReliability).toBeGreaterThan(0.5);
      expect(decayed5.confidence).toBeLessThan(candidate.confidence);

      // Apply extreme decay over 200 time steps: returns close to neutral baseline
      const decayed200 = applyTimeDecay(candidate, 200, 0.95);
      expect(decayed200.alpha).toBeCloseTo(1.0, 3);
      expect(decayed200.beta).toBe(1.0);
      expect(decayed200.overallReliability).toBeCloseTo(0.5, 3);
      expect(decayed200.confidence).toBeCloseTo(0.0, 3);
    });

    it("guarantees alpha and beta never drop below prior baseline (1.0)", () => {
      const candidate = createInitialReputation("decay-floor");
      const decayed = applyTimeDecay(candidate, 50, 0.90);
      expect(decayed.alpha).toBe(1.0);
      expect(decayed.beta).toBe(1.0);
      expect(decayed.overallReliability).toBe(0.5);
      expect(decayed.confidence).toBe(0.0);
    });

    it("respects faster decay with lambda = 0.90 vs slower decay with lambda = 0.98", () => {
      let candidate = createInitialReputation("lambda-compare");
      for (let i = 0; i < 10; i++) {
        candidate = updateReputation(candidate, "success");
      }

      const strongDecay = applyTimeDecay(candidate, 10, 0.90); // 0.90^10 ~ 0.3487
      const mildDecay = applyTimeDecay(candidate, 10, 0.98);   // 0.98^10 ~ 0.8171

      expect(strongDecay.alpha).toBeLessThan(mildDecay.alpha);
      expect(strongDecay.overallReliability).toBeLessThan(mildDecay.overallReliability);
      expect(strongDecay.confidence).toBeLessThan(mildDecay.confidence);
    });

    it("handles zero or negative timeSteps by returning an untouched copy", () => {
      const candidate = createInitialReputation("no-decay");
      const noDecay0 = applyTimeDecay(candidate, 0);
      const noDecayNeg = applyTimeDecay(candidate, -5);

      expect(noDecay0.alpha).toBe(candidate.alpha);
      expect(noDecayNeg.alpha).toBe(candidate.alpha);
    });

    it("rejects invalid decay lambda outside (0, 1]", () => {
      const candidate = createInitialReputation("invalid-lambda");
      expect(() => applyTimeDecay(candidate, 5, 0)).toThrow("must be in (0, 1]");
      expect(() => applyTimeDecay(candidate, 5, -0.5)).toThrow("must be in (0, 1]");
      expect(() => applyTimeDecay(candidate, 5, 1.1)).toThrow("must be in (0, 1]");
    });

    it("integrates decay seamlessly inside updateReputation via decayTimeSteps option", () => {
      let candidate = createInitialReputation("decay-in-update");
      candidate = updateReputation(candidate, "success"); // alpha=2, beta=1

      // Next update applies 2 timeSteps of decay then a success
      const decayedAndUpdated = updateReputation(candidate, "success", {
        decayTimeSteps: 2,
        config: { decayLambda: 0.95 },
      });

      // alpha excess before decay was 1.0. Decayed excess = 1.0 * (0.95^2) = 0.9025.
      // New alpha = 1.0 + 0.9025 + 1.0 = 2.9025.
      expect(decayedAndUpdated.alpha).toBeCloseTo(2.9025, 4);
      expect(decayedAndUpdated.totalMissions).toBe(2);
    });
  });

  describe("Monotonicity & Convergence Under Successive Outcomes", () => {
    it("monotonically increases overallReliability and confidence on consecutive successes", () => {
      let current = createInitialReputation("monotonic-success");

      for (let i = 1; i <= 15; i++) {
        const next = updateReputation(current, "success");
        expect(next.overallReliability).toBeGreaterThan(current.overallReliability);
        expect(next.confidence).toBeGreaterThan(current.confidence);
        expect(next.consecutiveFailures).toBe(0);
        expect(next.totalMissions).toBe(current.totalMissions + 1);
        current = next;
      }

      // After 15 consecutive successes
      expect(current.overallReliability).toBeCloseTo(16 / 17, 4); // ~0.941
      expect(current.confidence).toBeCloseTo(15 / 20, 4);         // ~0.75
    });

    it("monotonically decreases overallReliability while increasing confidence on failure from fresh state", () => {
      const c0 = createInitialReputation("monotonic-fail");
      const c1 = updateReputation(c0, "failure"); // NEW -> WATCH (fail 1)

      expect(c1.overallReliability).toBeLessThan(c0.overallReliability); // 0.333 < 0.50
      expect(c1.confidence).toBeGreaterThan(c0.confidence);             // 0.167 > 0.0
      expect(c1.consecutiveFailures).toBe(1);
    });

    it("converges to empirical ratio on large sample sizes (e.g., 70% success over 1000 runs)", () => {
      let candidate = createInitialReputation("monte-carlo-agent");
      // 700 successes and 300 failures, simulated via weights or step loop
      candidate = updateReputation(candidate, "success", { weight: 700 });
      candidate = updateReputation(candidate, "failure", { weight: 300 });

      // alpha = 1 + 700 = 701, beta = 1 + 300 = 301
      expect(candidate.alpha).toBe(701);
      expect(candidate.beta).toBe(301);
      expect(candidate.overallReliability).toBeCloseTo(701 / 1002, 4); // ~0.6996
      expect(candidate.confidence).toBeGreaterThan(0.99);              // 1000 / 1005 ~ 0.9950
    });

    it("handles 100% pass edge case (100 successes)", () => {
      let candidate = createInitialReputation("perfect-agent");
      for (let i = 0; i < 100; i++) {
        candidate = updateReputation(candidate, "success");
      }
      expect(candidate.alpha).toBe(101);
      expect(candidate.beta).toBe(1);
      expect(candidate.overallReliability).toBeCloseTo(101 / 102, 4); // ~0.9902
      expect(candidate.confidence).toBeCloseTo(100 / 105, 4);         // ~0.9524
      expect(candidate.status).toBe("PREFERRED");
    });

    it("handles 100% fail edge case", () => {
      let candidate = createInitialReputation("failing-agent");
      candidate = updateReputation(candidate, "failure"); // -> WATCH (1)
      candidate = updateReputation(candidate, "failure"); // -> BLOCKED (2)

      expect(candidate.status).toBe("BLOCKED");
      expect(candidate.alpha).toBe(1);
      expect(candidate.beta).toBe(3);
      expect(candidate.overallReliability).toBe(0.25);
      expect(candidate.confidence).toBeCloseTo(2 / 7, 4);
    });
  });

  describe("FSM State Transitions", () => {
    it("transitions NEW -> KNOWN on first success", () => {
      const initial = createInitialReputation("agent-1");
      expect(initial.status).toBe("NEW");

      const afterSuccess = updateReputation(initial, "success");
      expect(afterSuccess.status).toBe("KNOWN");
      expect(afterSuccess.consecutiveFailures).toBe(0);
      expect(afterSuccess.totalMissions).toBe(1);
    });

    it("transitions NEW -> WATCH on first failure", () => {
      const initial = createInitialReputation("agent-2");
      const afterFailure = updateReputation(initial, "failure");

      expect(afterFailure.status).toBe("WATCH");
      expect(afterFailure.consecutiveFailures).toBe(1);
      expect(afterFailure.totalMissions).toBe(1);
    });

    it("transitions KNOWN -> PREFERRED when reliability >= 0.80 and confidence >= 0.50 with 0 failures", () => {
      let candidate = createInitialReputation("agent-star");
      // 1st success -> KNOWN (rel=0.667, conf=0.167)
      candidate = updateReputation(candidate, "success");
      expect(candidate.status).toBe("KNOWN");

      // 2nd success -> KNOWN (rel=0.75, conf=0.286)
      candidate = updateReputation(candidate, "success");
      expect(candidate.status).toBe("KNOWN");

      // 3rd success -> KNOWN (rel=0.80, conf=0.375) (reliability >= 0.80, but confidence < 0.50)
      candidate = updateReputation(candidate, "success");
      expect(candidate.status).toBe("KNOWN");

      // 4th success -> KNOWN (rel=0.833, conf=0.444)
      candidate = updateReputation(candidate, "success");
      expect(candidate.status).toBe("KNOWN");

      // 5th success -> PREFERRED! (rel=6/7=0.857 >= 0.80, conf=5/10=0.50 >= 0.50)
      candidate = updateReputation(candidate, "success");
      expect(candidate.status).toBe("PREFERRED");
      expect(candidate.overallReliability).toBeGreaterThanOrEqual(0.80);
      expect(candidate.confidence).toBeGreaterThanOrEqual(0.50);
      expect(candidate.consecutiveFailures).toBe(0);
    });

    it("maintains PREFERRED status on subsequent successes", () => {
      let candidate = createInitialReputation("agent-star-2");
      for (let i = 0; i < 5; i++) {
        candidate = updateReputation(candidate, "success");
      }
      expect(candidate.status).toBe("PREFERRED");

      // 6th success maintains PREFERRED
      const next = updateReputation(candidate, "success");
      expect(next.status).toBe("PREFERRED");
      expect(next.consecutiveFailures).toBe(0);
    });

    it("transitions KNOWN -> WATCH on failure", () => {
      let candidate = createInitialReputation("agent-known");
      candidate = updateReputation(candidate, "success"); // -> KNOWN
      expect(candidate.status).toBe("KNOWN");

      candidate = updateReputation(candidate, "failure");
      expect(candidate.status).toBe("WATCH");
      expect(candidate.consecutiveFailures).toBe(1);
    });

    it("transitions PREFERRED -> WATCH on failure", () => {
      let candidate = createInitialReputation("agent-pref");
      for (let i = 0; i < 5; i++) {
        candidate = updateReputation(candidate, "success");
      }
      expect(candidate.status).toBe("PREFERRED");

      candidate = updateReputation(candidate, "failure");
      expect(candidate.status).toBe("WATCH");
      expect(candidate.consecutiveFailures).toBe(1);
    });

    it("recovers WATCH -> KNOWN on success when reliability >= 0.50", () => {
      let candidate = createInitialReputation("agent-recovery");
      // 2 successes, then 1 failure -> WATCH (consecutiveFailures = 1)
      candidate = updateReputation(candidate, "success");
      candidate = updateReputation(candidate, "success");
      candidate = updateReputation(candidate, "failure");
      expect(candidate.status).toBe("WATCH");
      expect(candidate.consecutiveFailures).toBe(1);

      // Success recovers reliability (alpha=4, beta=2 => rel = 4/6 = 0.667 >= 0.50)
      candidate = updateReputation(candidate, "success");
      expect(candidate.status).toBe("KNOWN");
      expect(candidate.consecutiveFailures).toBe(0);
    });

    it("promotes WATCH directly to PREFERRED on success if both reliability and confidence thresholds are met", () => {
      let candidate = createInitialReputation("agent-watch-to-pref");
      // Build 10 successes
      for (let i = 0; i < 10; i++) {
        candidate = updateReputation(candidate, "success");
      }
      expect(candidate.status).toBe("PREFERRED");

      // 1 failure demotes to WATCH
      candidate = updateReputation(candidate, "failure");
      expect(candidate.status).toBe("WATCH");
      expect(candidate.consecutiveFailures).toBe(1);

      // 1 success immediately restores reliability > 0.80 and confidence > 0.50
      candidate = updateReputation(candidate, "success");
      expect(candidate.status).toBe("PREFERRED");
      expect(candidate.consecutiveFailures).toBe(0);
    });

    it("remains in WATCH on success if reliability is still below recovery threshold (0.50)", () => {
      let candidate = createInitialReputation("heavily-failing");
      // Start with 1 failure -> WATCH
      candidate = updateReputation(candidate, "failure");
      expect(candidate.status).toBe("WATCH");

      // Manually set alpha/beta for a candidate with high failure history
      const unblocked = {
        ...candidate,
        alpha: 2,
        beta: 6, // reliability = 2/8 = 0.25 < 0.50
        overallReliability: 0.25,
        consecutiveFailures: 0,
      };

      // A success brings alpha to 3, beta to 6 => reliability = 3/9 = 0.333 < 0.50
      const afterSuccess = updateReputation(unblocked, "success");
      expect(afterSuccess.status).toBe("WATCH");
      expect(afterSuccess.consecutiveFailures).toBe(0);
    });

    it("manualArchive transitions candidate to ARCHIVED", () => {
      const candidate = createInitialReputation("candidate-arch");
      const archived = manualArchive(candidate);
      expect(archived.status).toBe("ARCHIVED");
    });

    it("manualArchive operates normally on non-BLOCKED candidates (NEW, KNOWN, PREFERRED, WATCH)", () => {
      // NEW -> ARCHIVED
      const candidateNew = createInitialReputation("candidate-arch-new");
      const archivedNew = manualArchive(candidateNew);
      expect(archivedNew.status).toBe("ARCHIVED");
      expect(archivedNew.alpha).toBe(candidateNew.alpha);
      expect(archivedNew.beta).toBe(candidateNew.beta);
      expect(archivedNew.overallReliability).toBe(candidateNew.overallReliability);
      expect(archivedNew.confidence).toBe(candidateNew.confidence);
      expect(archivedNew.consecutiveFailures).toBe(0);
      expect(archivedNew.totalMissions).toBe(0);

      // KNOWN -> ARCHIVED
      let candidateKnown = createInitialReputation("candidate-arch-known");
      candidateKnown = updateReputation(candidateKnown, "success");
      expect(candidateKnown.status).toBe("KNOWN");
      const archivedKnown = manualArchive(candidateKnown);
      expect(archivedKnown.status).toBe("ARCHIVED");
      expect(archivedKnown.alpha).toBe(2.0);
      expect(archivedKnown.beta).toBe(1.0);
      expect(archivedKnown.overallReliability).toBeCloseTo(2 / 3, 4);
      expect(archivedKnown.totalMissions).toBe(1);

      // PREFERRED -> ARCHIVED
      let candidatePref = createInitialReputation("candidate-arch-pref");
      for (let i = 0; i < 6; i++) {
        candidatePref = updateReputation(candidatePref, "success");
      }
      expect(candidatePref.status).toBe("PREFERRED");
      const archivedPref = manualArchive(candidatePref);
      expect(archivedPref.status).toBe("ARCHIVED");
      expect(archivedPref.overallReliability).toBeGreaterThanOrEqual(0.80);
      expect(archivedPref.confidence).toBeGreaterThanOrEqual(0.50);
      expect(archivedPref.totalMissions).toBe(6);

      // WATCH -> ARCHIVED
      let candidateWatch = createInitialReputation("candidate-arch-watch");
      candidateWatch = updateReputation(candidateWatch, "failure");
      expect(candidateWatch.status).toBe("WATCH");
      expect(candidateWatch.consecutiveFailures).toBe(1);
      const archivedWatch = manualArchive(candidateWatch);
      expect(archivedWatch.status).toBe("ARCHIVED");
      expect(archivedWatch.consecutiveFailures).toBe(1);
      expect(archivedWatch.totalMissions).toBe(1);

      // ARCHIVED -> ARCHIVED (idempotent)
      const reArchived = manualArchive(archivedWatch, "2026-09-07T11:00:00.000Z");
      expect(reArchived.status).toBe("ARCHIVED");
      expect(reArchived.lastUpdatedAt).toBe("2026-09-07T11:00:00.000Z");
    });

    it("manualArchive correctly accepts Date instance or ISO string for timestamp", () => {
      const candidate = createInitialReputation("timestamp-candidate");
      const dateObj = new Date("2026-09-07T08:30:00.000Z");

      const fromDate = manualArchive(candidate, dateObj);
      expect(fromDate.lastUpdatedAt).toBe("2026-09-07T08:30:00.000Z");

      const fromString = manualArchive(candidate, "2026-09-07T09:45:00.000Z");
      expect(fromString.lastUpdatedAt).toBe("2026-09-07T09:45:00.000Z");
    });
  });

  describe("2 Consecutive Failures in WATCH -> BLOCKED Trigger", () => {
    it("transitions NEW -> WATCH (fail 1) -> BLOCKED (fail 2)", () => {
      const initial = createInitialReputation("double-fail-new");
      const fail1 = updateReputation(initial, "failure");
      expect(fail1.status).toBe("WATCH");
      expect(fail1.consecutiveFailures).toBe(1);

      const fail2 = updateReputation(fail1, "failure");
      expect(fail2.status).toBe("BLOCKED");
      expect(fail2.consecutiveFailures).toBe(2);
      expect(fail2.blockedReason).toContain("2 consecutive failures in WATCH state");
    });

    it("transitions KNOWN -> WATCH (fail 1) -> BLOCKED (fail 2)", () => {
      let candidate = createInitialReputation("double-fail-known");
      candidate = updateReputation(candidate, "success"); // -> KNOWN
      expect(candidate.status).toBe("KNOWN");

      candidate = updateReputation(candidate, "failure"); // -> WATCH (fail 1)
      expect(candidate.status).toBe("WATCH");
      expect(candidate.consecutiveFailures).toBe(1);

      candidate = updateReputation(candidate, "failure"); // -> BLOCKED (fail 2)
      expect(candidate.status).toBe("BLOCKED");
      expect(candidate.consecutiveFailures).toBe(2);
      expect(candidate.blockedReason).toContain("2 consecutive failures in WATCH state");
    });

    it("transitions PREFERRED -> WATCH (fail 1) -> BLOCKED (fail 2)", () => {
      let candidate = createInitialReputation("double-fail-pref");
      for (let i = 0; i < 5; i++) {
        candidate = updateReputation(candidate, "success");
      }
      expect(candidate.status).toBe("PREFERRED");

      candidate = updateReputation(candidate, "failure"); // -> WATCH (fail 1)
      expect(candidate.status).toBe("WATCH");
      expect(candidate.consecutiveFailures).toBe(1);

      candidate = updateReputation(candidate, "failure"); // -> BLOCKED (fail 2)
      expect(candidate.status).toBe("BLOCKED");
      expect(candidate.consecutiveFailures).toBe(2);
      expect(candidate.blockedReason).toContain("2 consecutive failures in WATCH state");
    });

    it("intermittent success in WATCH resets consecutiveFailures and prevents BLOCKED transition", () => {
      let candidate = createInitialReputation("intermittent-agent");
      candidate = updateReputation(candidate, "success"); // -> KNOWN
      candidate = updateReputation(candidate, "success"); // -> KNOWN

      // 1st failure -> WATCH
      candidate = updateReputation(candidate, "failure");
      expect(candidate.status).toBe("WATCH");
      expect(candidate.consecutiveFailures).toBe(1);

      // Intermittent success resets failure count and restores to KNOWN
      candidate = updateReputation(candidate, "success");
      expect(candidate.status).toBe("KNOWN");
      expect(candidate.consecutiveFailures).toBe(0);

      // Another failure demotes to WATCH with failure count 1 (NOT blocked!)
      candidate = updateReputation(candidate, "failure");
      expect(candidate.status).toBe("WATCH");
      expect(candidate.consecutiveFailures).toBe(1);
    });
  });

  describe("Hard Veto Invariant & Ranking Exclusion", () => {
    it("produces veto exclusion reason for BLOCKED candidate in checkVeto", () => {
      const candidate: CandidateReputation = {
        ...createInitialReputation("blocked-candidate"),
        status: "BLOCKED",
        blockedReason: "2 consecutive failures in WATCH state",
      };

      const vetoResult = checkVeto(candidate);
      expect(vetoResult.allowed).toBe(false);
      expect(vetoResult.reason).toBeDefined();
      expect(vetoResult.reason).toContain("BLOCKED");
      expect(vetoResult.reason).toContain("2 consecutive failures in WATCH state");
    });

    it("returns allowed: true in checkVeto for non-blocked candidates", () => {
      const statuses = ["NEW", "KNOWN", "PREFERRED", "WATCH", "ARCHIVED"] as const;
      for (const status of statuses) {
        const candidate: CandidateReputation = {
          ...createInitialReputation(`cand-${status}`),
          status,
        };
        const result = checkVeto(candidate);
        expect(result.allowed).toBe(true);
        expect(result.reason).toBeUndefined();
      }
    });

    it("cannot be auto-promoted or updated by positive scores when BLOCKED", () => {
      let candidate = createInitialReputation("unpromotable-blocked");
      candidate = updateReputation(candidate, "failure"); // -> WATCH (1)
      candidate = updateReputation(candidate, "failure"); // -> BLOCKED (2)
      expect(candidate.status).toBe("BLOCKED");

      const alphaBefore = candidate.alpha;
      const betaBefore = candidate.beta;
      const relBefore = candidate.overallReliability;
      const confBefore = candidate.confidence;

      // Attempt positive updates
      for (let i = 0; i < 10; i++) {
        candidate = updateReputation(candidate, "success");
        expect(candidate.status).toBe("BLOCKED");
        expect(candidate.alpha).toBe(alphaBefore);
        expect(candidate.beta).toBe(betaBefore);
        expect(candidate.overallReliability).toBe(relBefore);
        expect(candidate.confidence).toBe(confBefore);
      }
    });

    it("maintains BLOCKED status even if additional failure outcomes arrive", () => {
      let candidate = createInitialReputation("blocked-repeat-fail");
      candidate = updateReputation(candidate, "failure");
      candidate = updateReputation(candidate, "failure");
      expect(candidate.status).toBe("BLOCKED");

      const updated = updateReputation(candidate, "failure");
      expect(updated.status).toBe("BLOCKED");
    });

    it("manualArchive strictly throws when called on a naturally BLOCKED candidate", () => {
      let candidate = createInitialReputation("blocked-candidate-archive-attempt");
      candidate = updateReputation(candidate, "failure"); // -> WATCH (consecutiveFailures = 1)
      candidate = updateReputation(candidate, "failure"); // -> BLOCKED (consecutiveFailures = 2)
      expect(candidate.status).toBe("BLOCKED");
      expect(checkVeto(candidate).allowed).toBe(false);

      expect(() => manualArchive(candidate)).toThrow(
        "Cannot archive a candidate that is BLOCKED; candidate must be manually unblocked first."
      );

      // Candidate state remains strictly intact
      expect(candidate.status).toBe("BLOCKED");
      expect(checkVeto(candidate).allowed).toBe(false);
      expect(candidate.blockedReason).toContain("2 consecutive failures in WATCH state");
    });

    it("manualArchive strictly throws when called on an artificially configured BLOCKED candidate", () => {
      const candidate: CandidateReputation = {
        ...createInitialReputation("direct-blocked-candidate"),
        status: "BLOCKED",
        blockedReason: "Security team blacklist",
      };

      expect(() => manualArchive(candidate)).toThrow(
        "Cannot archive a candidate that is BLOCKED; candidate must be manually unblocked first."
      );
      expect(checkVeto(candidate).allowed).toBe(false);
    });

    it("manualArchive strictly throws on a candidate re-blocked after previous manual unblock", () => {
      let candidate = createInitialReputation("reblocked-candidate");
      candidate = updateReputation(candidate, "failure");
      candidate = updateReputation(candidate, "failure"); // BLOCKED
      expect(candidate.status).toBe("BLOCKED");

      // Temporarily unblock to WATCH
      candidate = manualUnblock(candidate, "operator-1", "Temporary probation review");
      expect(candidate.status).toBe("WATCH");

      // Candidate fails again twice -> re-blocked
      candidate = updateReputation(candidate, "failure"); // WATCH (1)
      candidate = updateReputation(candidate, "failure"); // BLOCKED (2)
      expect(candidate.status).toBe("BLOCKED");

      expect(() => manualArchive(candidate)).toThrow(
        "Cannot archive a candidate that is BLOCKED; candidate must be manually unblocked first."
      );
      expect(checkVeto(candidate).allowed).toBe(false);
    });

    it("anti-circumvention: manualArchive cannot be used to bypass checkVeto ranking exclusion", () => {
      let blockedCandidate = createInitialReputation("anti-circumvention-candidate");
      blockedCandidate = updateReputation(blockedCandidate, "failure");
      blockedCandidate = updateReputation(blockedCandidate, "failure");
      expect(blockedCandidate.status).toBe("BLOCKED");
      expect(checkVeto(blockedCandidate).allowed).toBe(false);

      // Backdoor attempt to archive and bypass ranking exclusion
      expect(() => manualArchive(blockedCandidate)).toThrow(
        "Cannot archive a candidate that is BLOCKED; candidate must be manually unblocked first."
      );

      // Candidate status is not mutated
      expect(blockedCandidate.status).toBe("BLOCKED");

      // Ranking selection pool must strictly filter out the blocked candidate
      const pool: CandidateReputation[] = [
        blockedCandidate,
        createInitialReputation("valid-candidate-1"),
        createInitialReputation("valid-candidate-2"),
      ];
      const eligible = pool.filter((c) => checkVeto(c).allowed);
      expect(eligible).toHaveLength(2);
      expect(eligible.map((c) => c.candidateId)).toEqual([
        "valid-candidate-1",
        "valid-candidate-2",
      ]);
    });

    it("anti-circumvention: applyTimeDecay on BLOCKED candidate leaves candidate unchanged and cannot bypass ranking", () => {
      let candidate = createInitialReputation("decay-bypass-candidate");
      candidate = updateReputation(candidate, "failure");
      candidate = updateReputation(candidate, "failure");
      expect(candidate.status).toBe("BLOCKED");

      const alphaBefore = candidate.alpha;
      const betaBefore = candidate.beta;
      const relBefore = candidate.overallReliability;
      const confBefore = candidate.confidence;

      // Time decay must not regress evidence on BLOCKED candidate
      const decayed = applyTimeDecay(candidate, 100, 0.95);
      expect(decayed.status).toBe("BLOCKED");
      expect(decayed.alpha).toBe(alphaBefore);
      expect(decayed.beta).toBe(betaBefore);
      expect(decayed.overallReliability).toBe(relBefore);
      expect(decayed.confidence).toBe(confBefore);
      expect(checkVeto(decayed).allowed).toBe(false);

      // Attempting to archive decayed candidate still throws
      expect(() => manualArchive(decayed)).toThrow(
        "Cannot archive a candidate that is BLOCKED; candidate must be manually unblocked first."
      );
    });
  });

  describe("Manual Operator Unblock", () => {
    it("successfully unblocks candidate with operator metadata and transitions to WATCH", () => {
      let candidate = createInitialReputation("candidate-unblock");
      candidate = updateReputation(candidate, "failure");
      candidate = updateReputation(candidate, "failure");
      expect(candidate.status).toBe("BLOCKED");
      expect(candidate.consecutiveFailures).toBe(2);

      const unblocked = manualUnblock(
        candidate,
        "operator-sarah",
        "Investigated root cause; transient upstream network issue resolved."
      );

      expect(unblocked.status).toBe("WATCH");
      expect(unblocked.consecutiveFailures).toBe(0);
      expect(unblocked.unblockedBy).toBe("operator-sarah");
      expect(unblocked.unblockedReason).toBe(
        "Investigated root cause; transient upstream network issue resolved."
      );
      expect(typeof unblocked.unblockedAt).toBe("string");
      expect(unblocked.blockedReason).toBeUndefined();

      // checkVeto now allows the candidate
      const veto = checkVeto(unblocked);
      expect(veto.allowed).toBe(true);
      expect(veto.reason).toBeUndefined();
    });

    it("supports unblocking directly to custom targetStatus (e.g. KNOWN)", () => {
      let candidate = createInitialReputation("candidate-unblock-known");
      candidate = updateReputation(candidate, "failure");
      candidate = updateReputation(candidate, "failure");

      const unblocked = manualUnblock(
        candidate,
        "operator-alex",
        "Manual approval granted",
        "KNOWN"
      );
      expect(unblocked.status).toBe("KNOWN");
      expect(unblocked.consecutiveFailures).toBe(0);
    });

    it("allows candidate to earn promotions normally after being unblocked", () => {
      let candidate = createInitialReputation("rehabilitated");
      candidate = updateReputation(candidate, "failure");
      candidate = updateReputation(candidate, "failure");
      expect(candidate.status).toBe("BLOCKED");

      // Unblock to WATCH
      let active = manualUnblock(candidate, "operator-1", "Security review cleared");
      expect(active.status).toBe("WATCH");

      // Now successful missions can recover the candidate
      // alpha=1, beta=3. 1st success: alpha=2, beta=3 (rel=2/5=0.40 < 0.50, stays WATCH)
      active = updateReputation(active, "success");
      expect(active.status).toBe("WATCH");
      expect(active.consecutiveFailures).toBe(0);

      // 2nd success: alpha=3, beta=3 (rel=3/6=0.50 >= 0.50, recovers to KNOWN!)
      active = updateReputation(active, "success");
      expect(active.status).toBe("KNOWN");
      expect(active.consecutiveFailures).toBe(0);
    });

    it("throws when operatorId or reason is missing or whitespace", () => {
      const blocked: CandidateReputation = {
        ...createInitialReputation("blocked-err"),
        status: "BLOCKED",
      };

      expect(() => manualUnblock(blocked, "", "Reason")).toThrow("operatorId is required");
      expect(() => manualUnblock(blocked, "   ", "Reason")).toThrow("operatorId is required");
      expect(() => manualUnblock(blocked, "op-1", "")).toThrow("reason is required");
      expect(() => manualUnblock(blocked, "op-1", "   ")).toThrow("reason is required");
    });

    it("throws when attempting to unblock a candidate that is not BLOCKED", () => {
      const active = createInitialReputation("active-agent");
      expect(() => manualUnblock(active, "op-1", "Valid reason")).toThrow(
        "Cannot unblock a candidate that is not BLOCKED"
      );
    });

    it("throws when targetStatus is BLOCKED", () => {
      const blocked: CandidateReputation = {
        ...createInitialReputation("blocked-err-target"),
        status: "BLOCKED",
      };
      expect(() => manualUnblock(blocked, "op-1", "Reason", "BLOCKED")).toThrow(
        "targetStatus cannot be BLOCKED"
      );
    });

    it("manualUnblock preserves unblockedReason audit metadata", () => {
      let candidate = createInitialReputation("candidate-unblock-audit");
      candidate = updateReputation(candidate, "failure");
      candidate = updateReputation(candidate, "failure");
      expect(candidate.status).toBe("BLOCKED");

      const reason = "Audited post-incident report #402 and approved release";
      const unblocked = manualUnblock(
        candidate,
        "operator-dan",
        reason,
        "WATCH"
      );

      expect(unblocked.unblockedReason).toBe(reason);
      expect(unblocked.unblockedBy).toBe("operator-dan");
      expect(typeof unblocked.unblockedAt).toBe("string");
      expect(unblocked.blockedReason).toBeUndefined();
    });

    it("allows manualArchive on a candidate only after legitimate manualUnblock", () => {
      let candidate = createInitialReputation("unblock-then-archive");
      candidate = updateReputation(candidate, "failure");
      candidate = updateReputation(candidate, "failure");
      expect(candidate.status).toBe("BLOCKED");

      // Before unblock: manualArchive throws
      expect(() => manualArchive(candidate)).toThrow(
        "Cannot archive a candidate that is BLOCKED; candidate must be manually unblocked first."
      );

      // Operator explicitly unblocks
      const unblocked = manualUnblock(
        candidate,
        "operator-dan",
        "Retiring decommissioned service safely",
        "WATCH"
      );
      expect(unblocked.status).toBe("WATCH");
      expect(unblocked.unblockedReason).toBe("Retiring decommissioned service safely");

      // Now manualArchive succeeds
      const archived = manualArchive(unblocked);
      expect(archived.status).toBe("ARCHIVED");
      expect(archived.unblockedBy).toBe("operator-dan");
      expect(archived.unblockedReason).toBe("Retiring decommissioned service safely");
    });
  });

  describe("Sibyl Write-Back Formatting", () => {
    it("formats a mission execution outcome into SibylEpisode", () => {
      const episode = formatEpisodeForSibyl(
        "run-101",
        "code_generation",
        "success",
        "Passed all verification test suites",
        "2026-09-07T12:30:00.000Z"
      );

      expect(episode).toEqual({
        run: "run-101",
        taskType: "code_generation",
        outcome: "accepted",
        note: "Passed all verification test suites",
        occurredAt: "2026-09-07T12:30:00.000Z",
      });

      const failureEpisode = formatEpisodeForSibyl(
        "run-102",
        "code_generation",
        "failure",
        "Test suite failed with exit code 1"
      );
      expect(failureEpisode.outcome).toBe("rejected");
    });

    it("serializes candidate reputation into SibylCounterparty entity schema", () => {
      const candidate: CandidateReputation = {
        candidateId: "virtuals:agent:charlie",
        alpha: 9.0,
        beta: 1.0,
        overallReliability: 0.9,
        confidence: 0.8,
        status: "PREFERRED",
        consecutiveFailures: 0,
        totalMissions: 8,
        lastUpdatedAt: "2026-09-07T12:35:00.000Z",
      };

      const episodes = [
        formatEpisodeForSibyl("run-1", "task-a", "success", "Clean build"),
      ];

      const counterparty = formatForSibyl(candidate, {
        displayName: "Charlie Agent",
        taskFit: 0.85,
        observedPriceUsdc: "12.50",
        episodes,
      });

      expect(counterparty).toEqual({
        counterpartyKey: "virtuals:agent:charlie",
        displayName: "Charlie Agent",
        hasProfile: true,
        isFixture: false,
        relationshipStatus: "PREFERRED",
        memoryVersion: 1,
        overallReliability: 0.9,
        taskFit: 0.85,
        confidence: 0.8,
        observedPriceUsdc: "12.50",
        riskNote: null,
        episodes,
        updatedAt: "2026-09-07T12:35:00.000Z",
      });
    });
  });
});

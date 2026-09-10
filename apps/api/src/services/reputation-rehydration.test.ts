import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createInitialReputation,
  updateReputation,
  formatForSibyl,
  checkVeto,
  rehydrateFromSibyl,
  type CandidateReputation,
} from "./reputation-fsm.js";
import { scoreCandidates } from "./mission-scoring.js";
import {
  retrieveFromSibyl,
  updateCounterpartyInSibyl,
  type SibylCounterparty,
} from "./sibyl.js";
import {
  resetNativeSibylStorage,
  closeNativeSibylDatabase,
} from "./native-sibyl.js";

/** Helper to construct test counterparty records */
function makeCounterparty(over: Partial<SibylCounterparty>): SibylCounterparty {
  return {
    counterpartyKey: "virtuals:agent:test-provider",
    displayName: "Test Provider",
    hasProfile: true,
    isFixture: false,
    relationshipStatus: "KNOWN",
    memoryVersion: 1,
    overallReliability: 0.5,
    taskFit: 0.5,
    confidence: 0.0,
    observedPriceUsdc: "10.00",
    riskNote: null,
    episodes: [],
    updatedAt: new Date().toISOString(),
    ...over,
  };
}

describe("Reputation Rehydration, Cross-Session Persistence & Price Parity Scoring (M3)", () => {
  beforeEach(() => {
    resetNativeSibylStorage({ seedFixtures: false });
  });

  afterEach(() => {
    closeNativeSibylDatabase();
  });

  afterAll(() => {
    resetNativeSibylStorage({ seedFixtures: true });
    closeNativeSibylDatabase();
  });

  // =========================================================================
  // SUITE 1: FULL SERIALIZATION & DESERIALIZATION OF EXTENDED BAYESIAN STATE
  // =========================================================================
  describe("Suite 1: Bayesian State Serialization & Round-Trip Persistence", () => {
    it("persists and restores alpha, beta, consecutiveFailures, totalMissions, and blockedReason in Sibyl storage", async () => {
      const key = "virtuals:agent:alpha-serial";

      const updatePayload = {
        relationshipStatus: "WATCH",
        overallReliability: 0.3333,
        confidence: 0.1667,
        alpha: 1.0,
        beta: 2.0,
        consecutiveFailures: 1,
        totalMissions: 1,
        riskNote: "One acceptance failure inside the last 30 days applies a risk penalty.",
        blockedReason: undefined,
      };

      const writeResult = await updateCounterpartyInSibyl(key, updatePayload);
      expect(writeResult.ok).toBe(true);

      const retrieved = await retrieveFromSibyl(key);
      expect(retrieved.status).toBe("AVAILABLE");
      if (retrieved.status === "AVAILABLE") {
        expect(retrieved.counterpartyKey).toBe(key);
        expect(retrieved.relationshipStatus).toBe("WATCH");
        expect(retrieved.overallReliability).toBeCloseTo(0.3333, 4);
        expect(retrieved.confidence).toBeCloseTo(0.1667, 4);
        expect(retrieved.alpha).toBe(1.0);
        expect(retrieved.beta).toBe(2.0);
        expect(retrieved.consecutiveFailures).toBe(1);
        expect(retrieved.totalMissions).toBe(1);
        expect(retrieved.riskNote).toBe("One acceptance failure inside the last 30 days applies a risk penalty.");
        expect(retrieved.blockedReason).toBeUndefined();
      }
    });

    it("persists and restores BLOCKED status with blockedReason string", async () => {
      const key = "virtuals:agent:blocked-serial";

      const updatePayload = {
        relationshipStatus: "BLOCKED",
        overallReliability: 0.25,
        confidence: 0.2857,
        alpha: 1.0,
        beta: 3.0,
        consecutiveFailures: 2,
        totalMissions: 2,
        blockedReason: "2 consecutive failures in WATCH state",
      };

      const writeResult = await updateCounterpartyInSibyl(key, updatePayload);
      expect(writeResult.ok).toBe(true);

      const retrieved = await retrieveFromSibyl(key);
      expect(retrieved.status).toBe("AVAILABLE");
      if (retrieved.status === "AVAILABLE") {
        expect(retrieved.relationshipStatus).toBe("BLOCKED");
        expect(retrieved.consecutiveFailures).toBe(2);
        expect(retrieved.totalMissions).toBe(2);
        expect(retrieved.blockedReason).toBe("2 consecutive failures in WATCH state");
      }
    });

    it("formatForSibyl preserves extended Bayesian fields on the SibylCounterparty contract", () => {
      const candidate: CandidateReputation = {
        candidateId: "virtuals:agent:fsm-export",
        alpha: 3.0,
        beta: 1.0,
        overallReliability: 0.75,
        confidence: 0.375,
        status: "PREFERRED",
        consecutiveFailures: 0,
        totalMissions: 3,
        lastUpdatedAt: new Date().toISOString(),
        blockedReason: undefined,
      };

      const formatted = formatForSibyl(candidate, {
        displayName: "Exported Agent",
        observedPriceUsdc: "15.00",
      });

      expect(formatted.counterpartyKey).toBe("virtuals:agent:fsm-export");
      expect(formatted.alpha).toBe(3.0);
      expect(formatted.beta).toBe(1.0);
      expect(formatted.consecutiveFailures).toBe(0);
      expect(formatted.totalMissions).toBe(3);
      expect(formatted.relationshipStatus).toBe("PREFERRED");
      expect(formatted.overallReliability).toBe(0.75);
    });

    it("handles unobserved / non-existent counterparty with default neutral priors", async () => {
      const retrieved = await retrieveFromSibyl("virtuals:agent:ghost");
      expect(retrieved.status).toBe("NO_HISTORY");
      if (retrieved.status === "NO_HISTORY") {
        expect(retrieved.overallReliability).toBe(0.5);
        expect(retrieved.confidence).toBe(0.0);
        expect("alpha" in retrieved).toBe(false);
        expect("consecutiveFailures" in retrieved).toBe(false);
      }
    });
  });

  // =========================================================================
  // SUITE 2: MULTI-MISSION REHYDRATION & SEQUENTIAL CONSECUTIVE FAILURE ACCUMULATION
  // =========================================================================
  describe("Suite 2: Multi-Mission Rehydration & Escalation to BLOCKED", () => {
    it("accumulates consecutiveFailures across separate missions from WATCH to BLOCKED", async () => {
      const candidateKey = "virtuals:agent:failing-provider";

      // --- MISSION 1: Initial Run ---
      // Starts fresh
      let rep1 = createInitialReputation(candidateKey);
      expect(rep1.status).toBe("NEW");
      expect(rep1.consecutiveFailures).toBe(0);
      expect(rep1.totalMissions).toBe(0);

      // Mission 1 fails
      rep1 = updateReputation(rep1, "failure");
      expect(rep1.status).toBe("WATCH");
      expect(rep1.consecutiveFailures).toBe(1);
      expect(rep1.totalMissions).toBe(1);
      expect(rep1.alpha).toBe(1.0);
      expect(rep1.beta).toBe(2.0);

      // Persist Mission 1 outcome to Sibyl
      await updateCounterpartyInSibyl(candidateKey, {
        relationshipStatus: rep1.status,
        overallReliability: rep1.overallReliability,
        confidence: rep1.confidence,
        alpha: rep1.alpha,
        beta: rep1.beta,
        consecutiveFailures: rep1.consecutiveFailures,
        totalMissions: rep1.totalMissions,
        riskNote: "One acceptance failure inside the last 30 days applies a risk penalty.",
      });

      // --- MISSION 2: Cold Rehydration Seam ---
      // Fresh execution context reads from Sibyl
      const sibyl1 = await retrieveFromSibyl(candidateKey);
      expect(sibyl1.status).toBe("AVAILABLE");
      if (sibyl1.status !== "AVAILABLE") throw new Error("Expected AVAILABLE");

      // Full rehydration into working CandidateReputation
      const rehydratedRep = rehydrateFromSibyl(candidateKey, sibyl1);

      expect(rehydratedRep.status).toBe("WATCH");
      expect(rehydratedRep.consecutiveFailures).toBe(1);
      expect(rehydratedRep.totalMissions).toBe(1);
      expect(rehydratedRep.beta).toBe(2.0);

      // Mission 2 fails: 2nd consecutive failure in WATCH state
      const rep2 = updateReputation(rehydratedRep, "failure");
      expect(rep2.status).toBe("BLOCKED");
      expect(rep2.consecutiveFailures).toBe(2);
      expect(rep2.totalMissions).toBe(2);
      expect(rep2.alpha).toBe(1.0);
      expect(rep2.beta).toBe(3.0);
      expect(rep2.blockedReason).toContain("2 consecutive failures in WATCH state");

      // Hard veto invariant holds on the rehydrated candidate
      const vetoCheck = checkVeto(rep2);
      expect(vetoCheck.allowed).toBe(false);
      expect(vetoCheck.reason).toContain("BLOCKED");

      // Persist Mission 2 outcome to Sibyl
      await updateCounterpartyInSibyl(candidateKey, {
        relationshipStatus: rep2.status,
        overallReliability: rep2.overallReliability,
        confidence: rep2.confidence,
        alpha: rep2.alpha,
        beta: rep2.beta,
        consecutiveFailures: rep2.consecutiveFailures,
        totalMissions: rep2.totalMissions,
        blockedReason: rep2.blockedReason,
      });

      // Verify read-back from storage holds BLOCKED and consecutiveFailures = 2
      const sibyl2 = await retrieveFromSibyl(candidateKey);
      expect(sibyl2.status).toBe("AVAILABLE");
      if (sibyl2.status === "AVAILABLE") {
        expect(sibyl2.relationshipStatus).toBe("BLOCKED");
        expect(sibyl2.consecutiveFailures).toBe(2);
        expect(sibyl2.blockedReason).toContain("2 consecutive failures in WATCH state");
      }
    });

    it("resets consecutiveFailures to 0 on subsequent success after rehydration", async () => {
      const candidateKey = "virtuals:agent:recovering-provider";

      // Seed provider in WATCH with 1 failure
      await updateCounterpartyInSibyl(candidateKey, {
        relationshipStatus: "WATCH",
        overallReliability: 0.3333,
        confidence: 0.1667,
        alpha: 1.0,
        beta: 2.0,
        consecutiveFailures: 1,
        totalMissions: 1,
      });

      // Rehydrate
      const retrieval = await retrieveFromSibyl(candidateKey);
      if (retrieval.status !== "AVAILABLE") throw new Error("Expected AVAILABLE");

      const workingRep = rehydrateFromSibyl(candidateKey, retrieval);

      // Mission succeeds
      const updated = updateReputation(workingRep, "success");
      expect(updated.consecutiveFailures).toBe(0);
      expect(updated.status).toBe("KNOWN"); // overallReliability = 2/4 = 0.50 >= recoveryThreshold
      expect(updated.alpha).toBe(2.0);
      expect(updated.beta).toBe(2.0);

      // Persist & read back
      await updateCounterpartyInSibyl(candidateKey, {
        relationshipStatus: updated.status,
        overallReliability: updated.overallReliability,
        confidence: updated.confidence,
        alpha: updated.alpha,
        beta: updated.beta,
        consecutiveFailures: updated.consecutiveFailures,
        totalMissions: updated.totalMissions,
      });

      const afterSuccess = await retrieveFromSibyl(candidateKey);
      if (afterSuccess.status === "AVAILABLE") {
        expect(afterSuccess.consecutiveFailures).toBe(0);
        expect(afterSuccess.relationshipStatus).toBe("KNOWN");
      }
    });
  });

  // =========================================================================
  // SUITE 3: CANDIDATE SCORING UNDER PRICE PARITY & SELECTION SHIFT
  // =========================================================================
  describe("Suite 3: Price Parity Scoring & Selection Shift", () => {
    it("ranks candidates tied under identical quotes when both have neutral history", () => {
      const alphaQuote = makeCounterparty({
        counterpartyKey: "virtuals:agent:alpha",
        observedPriceUsdc: "10.00",
        overallReliability: 0.5,
        confidence: 0.0,
        relationshipStatus: "NEW",
      });

      const betaQuote = makeCounterparty({
        counterpartyKey: "virtuals:agent:beta",
        observedPriceUsdc: "10.00",
        overallReliability: 0.5,
        confidence: 0.0,
        relationshipStatus: "NEW",
      });

      const { ranked } = scoreCandidates([alphaQuote, betaQuote]);
      expect(ranked).toHaveLength(2);
      expect(ranked[0]?.score).toBe(100);
      expect(ranked[1]?.score).toBe(100);
      expect(ranked[0]?.memory_adjustment).toBe(0);
      expect(ranked[1]?.memory_adjustment).toBe(0);
    });

    it("shifts selection from Alpha to Beta under price parity ($10.00 vs $10.00) after Alpha records 1 failure", () => {
      // Degraded candidate Alpha after 1 failure: reliability 0.3333, WATCH, confidence 0.1667
      const alpha = makeCounterparty({
        counterpartyKey: "virtuals:agent:alpha",
        observedPriceUsdc: "10.00",
        relationshipStatus: "WATCH",
        overallReliability: 0.3333,
        confidence: 0.1667,
        taskFit: 0.5,
        riskNote: "One acceptance failure inside the last 30 days applies a risk penalty.",
      });

      // Fresh candidate Beta with 0 history: reliability 0.50, NEW, confidence 0.0
      const beta = makeCounterparty({
        counterpartyKey: "virtuals:agent:beta",
        observedPriceUsdc: "10.00",
        relationshipStatus: "NEW",
        overallReliability: 0.5,
        confidence: 0.0,
        taskFit: 0.5,
        riskNote: null,
      });

      const { ranked, excluded } = scoreCandidates([alpha, beta]);

      expect(excluded).toHaveLength(0);
      expect(ranked).toHaveLength(2);

      const [winner, runnerUp] = ranked;

      // Beta is selected as winner (score: 100 > 98)
      expect(winner?.key).toBe("virtuals:agent:beta");
      expect(winner?.score).toBe(100);
      expect(winner?.memory_adjustment).toBe(0);

      // Alpha is degraded (score: 98, adjustment: -2)
      expect(runnerUp?.key).toBe("virtuals:agent:alpha");
      expect(runnerUp?.score).toBe(98);
      expect(runnerUp?.memory_adjustment).toBe(-2);
      expect(runnerUp?.memory_note).toBe("One acceptance failure inside the last 30 days applies a risk penalty.");

      // Counterfactual proof: Removing memory adjustment restores exact price parity (100 vs 100)
      const alphaBase = runnerUp!.score - runnerUp!.memory_adjustment;
      const betaBase = winner!.score - winner!.memory_adjustment;
      expect(alphaBase).toBe(100);
      expect(betaBase).toBe(100);
    });
  });

  // =========================================================================
  // SUITE 4: HARD VETO INVARIANT UNDER EXTREME PRICE DISPARITY
  // =========================================================================
  describe("Suite 4: Hard Veto Invariant Under Price Disparity", () => {
    it("excludes BLOCKED counterparty even when quoted price is 10x cheaper ($1.00 vs $10.00)", () => {
      const blockedAlpha = makeCounterparty({
        counterpartyKey: "virtuals:agent:alpha",
        observedPriceUsdc: "1.00", // 10x cheaper!
        relationshipStatus: "BLOCKED",
        overallReliability: 0.25,
        confidence: 0.2857,
      });

      const normalBeta = makeCounterparty({
        counterpartyKey: "virtuals:agent:beta",
        observedPriceUsdc: "10.00",
        relationshipStatus: "KNOWN",
        overallReliability: 0.60,
        confidence: 0.20,
      });

      const { ranked, excluded } = scoreCandidates([blockedAlpha, normalBeta]);

      // Alpha must be completely excluded
      expect(ranked.map((r) => r.key)).toEqual(["virtuals:agent:beta"]);
      expect(excluded).toEqual([
        {
          key: "virtuals:agent:alpha",
          reason: "Relationship status on record is BLOCKED, so this counterparty was not ranked.",
        },
      ]);
    });

    it("excludes BLOCKED counterparty when quoted price is 100x cheaper ($0.10 vs $10.00)", () => {
      const ultraCheapBlocked = makeCounterparty({
        counterpartyKey: "virtuals:agent:cheap-exploit",
        observedPriceUsdc: "0.10", // 100x cheaper!
        relationshipStatus: "BLOCKED",
      });

      const legitBeta = makeCounterparty({
        counterpartyKey: "virtuals:agent:beta",
        observedPriceUsdc: "10.00",
        relationshipStatus: "PREFERRED",
        overallReliability: 0.90,
        confidence: 0.50,
      });

      const { ranked, excluded } = scoreCandidates([ultraCheapBlocked, legitBeta]);
      expect(ranked.map((r) => r.key)).toEqual(["virtuals:agent:beta"]);
      expect(excluded[0]?.key).toBe("virtuals:agent:cheap-exploit");
    });

    it("reports empty ranked list when all candidates are BLOCKED (fail-closed)", () => {
      const blocked1 = makeCounterparty({
        counterpartyKey: "virtuals:agent:b1",
        observedPriceUsdc: "5.00",
        relationshipStatus: "BLOCKED",
      });
      const blocked2 = makeCounterparty({
        counterpartyKey: "virtuals:agent:b2",
        observedPriceUsdc: "2.00",
        relationshipStatus: "BLOCKED",
      });

      const { ranked, excluded } = scoreCandidates([blocked1, blocked2]);
      expect(ranked).toEqual([]);
      expect(excluded).toHaveLength(2);
    });

    it("proves BLOCKED candidate cannot be auto-unblocked by positive scores or cheap prices", () => {
      let candidate = createInitialReputation("candidate-locked");
      candidate = updateReputation(candidate, "failure"); // -> WATCH
      candidate = updateReputation(candidate, "failure"); // -> BLOCKED
      expect(candidate.status).toBe("BLOCKED");

      // Attempting positive updates on BLOCKED candidate is a no-op
      const afterSuccess = updateReputation(candidate, "success");
      expect(afterSuccess.status).toBe("BLOCKED");
      expect(checkVeto(afterSuccess).allowed).toBe(false);

      // Scoring candidate continues to exclude it
      const scored = scoreCandidates([
        makeCounterparty({
          counterpartyKey: "candidate-locked",
          relationshipStatus: afterSuccess.status,
          observedPriceUsdc: "1.00",
        }),
      ]);
      expect(scored.ranked).toHaveLength(0);
      expect(scored.excluded).toHaveLength(1);
    });
  });
});

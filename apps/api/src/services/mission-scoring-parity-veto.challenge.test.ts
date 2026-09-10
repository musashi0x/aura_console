import { describe, expect, it } from "vitest";
import { scoreCandidates, decisionReasons } from "./mission-scoring.js";
import type { SibylCounterparty } from "./sibyl.js";

/** Helper to construct test counterparty records */
function makeCounterparty(over: Partial<SibylCounterparty>): SibylCounterparty {
  return {
    counterpartyKey: "virtuals:agent:test-provider",
    displayName: "Test Provider",
    hasProfile: true,
    isFixture: false,
    relationshipStatus: "NEW",
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

describe("Empirical Challenger M3 2: Price Parity Scoring & Hard Veto Stress Challenge", () => {
  // =========================================================================
  // SUITE 1: EXACT PRICE PARITY RANKING ($10.00 vs $10.00) & CAUSAL ISOLATION
  // =========================================================================
  describe("Suite 1: Exact Price Parity Ranking ($10.00 vs $10.00)", () => {
    it("ranks Beta #1 (score 100) and Alpha #2 (score 98) under identical $10 quotes with 4-decimal values", () => {
      // Degraded candidate Alpha after 1 recorded failure
      const alpha = makeCounterparty({
        counterpartyKey: "virtuals:agent:alpha",
        observedPriceUsdc: "10.00",
        relationshipStatus: "WATCH",
        overallReliability: 0.3333,
        confidence: 0.1667,
        taskFit: 0.5,
        riskNote: "One acceptance failure inside the last 30 days applies a risk penalty.",
      });

      // Fresh unobserved candidate Beta with 0 history
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

      const [first, second] = ranked;

      // 1. Assert Beta is strictly ranked #1, Alpha is strictly ranked #2
      expect(first?.key).toBe("virtuals:agent:beta");
      expect(second?.key).toBe("virtuals:agent:alpha");

      // 2. Assert exact scores and memory adjustments
      // Beta: baseScore = 100, memory_adjustment = 0 => score = 100
      expect(first?.score).toBe(100);
      expect(first?.memory_adjustment).toBe(0);

      // Alpha: baseScore = 100, memory_adjustment = -2 => score = 98
      expect(second?.score).toBe(98);
      expect(second?.memory_adjustment).toBe(-2);
      expect(second?.memory_note).toBe("One acceptance failure inside the last 30 days applies a risk penalty.");

      // 3. Counterfactual causal proof: Zeroing memory adjustment ties at 100 vs 100
      const betaBase = first!.score - first!.memory_adjustment;
      const alphaBase = second!.score - second!.memory_adjustment;
      expect(betaBase).toBe(100);
      expect(alphaBase).toBe(100);
      expect(betaBase).toBe(alphaBase);
    });

    it("evaluates identical scores and rankings with exact rational Bayesian fractions (1/3 and 1/6)", () => {
      const alphaExact = makeCounterparty({
        counterpartyKey: "virtuals:agent:alpha",
        observedPriceUsdc: "10.00",
        relationshipStatus: "WATCH",
        overallReliability: 1 / 3,
        confidence: 1 / 6,
        taskFit: 0.5,
      });

      const betaExact = makeCounterparty({
        counterpartyKey: "virtuals:agent:beta",
        observedPriceUsdc: "10.00",
        relationshipStatus: "NEW",
        overallReliability: 0.5,
        confidence: 0.0,
        taskFit: 0.5,
      });

      const { ranked } = scoreCandidates([alphaExact, betaExact]);
      expect(ranked[0]?.key).toBe("virtuals:agent:beta");
      expect(ranked[0]?.score).toBe(100);
      expect(ranked[0]?.memory_adjustment).toBe(0);

      expect(ranked[1]?.key).toBe("virtuals:agent:alpha");
      expect(ranked[1]?.score).toBe(98);
      expect(ranked[1]?.memory_adjustment).toBe(-2);
    });

    it("confirms memory adjustment is strictly zero when confidence is zero regardless of reliability or status", () => {
      const zeroConfidenceCandidate = makeCounterparty({
        counterpartyKey: "virtuals:agent:zero-conf",
        observedPriceUsdc: "10.00",
        relationshipStatus: "WATCH",
        overallReliability: 0.1, // terrible reliability
        taskFit: 0.1,
        confidence: 0.0, // but zero confidence
      });

      const [res] = scoreCandidates([zeroConfidenceCandidate]).ranked;
      // In JS IEEE-754 arithmetic, 0 * (-negativePoints) evaluates to -0, which is numerically 0 (0 === -0)
      expect(res?.memory_adjustment === 0).toBe(true);
      expect(Math.abs(res?.memory_adjustment ?? 1)).toBe(0);
      expect(res?.score).toBe(100);
    });

    it("verifies decisionReasons accurately reflects winner's attributes", () => {
      const beta = makeCounterparty({
        counterpartyKey: "virtuals:agent:beta",
        observedPriceUsdc: "10.00",
        relationshipStatus: "NEW",
        overallReliability: 0.5,
        confidence: 0.0,
      });

      const reasons = decisionReasons(beta);
      expect(reasons).toContain("Relationship status on record is NEW.");
      expect(reasons).toContain("Observed price is 10.00 USDC.");
    });
  });

  // =========================================================================
  // SUITE 2: HARD VETO INVARIANT UNDER EXTREME PRICE DISPARITIES ($100.00 vs $0.01)
  // =========================================================================
  describe("Suite 2: Hard Veto Invariant Under Extreme Price Disparities", () => {
    it("strictly excludes BLOCKED candidate quoting $0.01 against Active candidate quoting $100.00", () => {
      // 10,000x price advantage for the BLOCKED candidate!
      const blockedCandidate = makeCounterparty({
        counterpartyKey: "virtuals:agent:exploiter",
        relationshipStatus: "BLOCKED",
        observedPriceUsdc: "0.01", // ultra cheap
        overallReliability: 0.99, // even with high reliability claimed
        confidence: 1.0,
        riskNote: "Hard blocked due to multiple violations",
      });

      const activeCandidate = makeCounterparty({
        counterpartyKey: "virtuals:agent:honest-provider",
        relationshipStatus: "KNOWN",
        observedPriceUsdc: "100.00",
        overallReliability: 0.65,
        confidence: 0.3,
      });

      const { ranked, excluded } = scoreCandidates([blockedCandidate, activeCandidate]);

      // 1. Assert BLOCKED candidate is categorically excluded from selection
      expect(ranked).toHaveLength(1);
      expect(ranked[0]?.key).toBe("virtuals:agent:honest-provider");
      // Honest provider is cheapest of priced candidates, so baseScore = 100
      expect(ranked[0]?.score).toBeGreaterThan(0);

      expect(excluded).toHaveLength(1);
      expect(excluded[0]?.key).toBe("virtuals:agent:exploiter");
      expect(excluded[0]?.reason).toBe(
        "Relationship status on record is BLOCKED, so this counterparty was not ranked."
      );

      // 2. Assert no scoring arithmetic bypasses the veto:
      // Exploiter's key NEVER appears in ranked results
      expect(ranked.map((r) => r.key)).not.toContain("virtuals:agent:exploiter");

      // Cheapest calculation must NOT have been contaminated by the $0.01 bid
      // If $0.01 were considered cheapest, $100.00 would have received Math.round((100 * 0.01) / 100) = 0!
      // But because honest-provider was the only priced candidate, cheapest was 100.00, so base = 100!
      const activeBase = ranked[0]!.score - ranked[0]!.memory_adjustment;
      expect(activeBase).toBe(100);
    });

    it("preserves hard veto under astronomical price disparity ($1,000,000.00 vs $0.000001)", () => {
      const microPricedBlocked = makeCounterparty({
        counterpartyKey: "virtuals:agent:micro-cost",
        relationshipStatus: "BLOCKED",
        observedPriceUsdc: "0.000001",
      });

      const highCostActive = makeCounterparty({
        counterpartyKey: "virtuals:agent:mega-corp",
        relationshipStatus: "PREFERRED",
        observedPriceUsdc: "1000000.00",
        overallReliability: 0.95,
        confidence: 0.8,
      });

      const { ranked, excluded } = scoreCandidates([microPricedBlocked, highCostActive]);

      expect(ranked).toHaveLength(1);
      expect(ranked[0]?.key).toBe("virtuals:agent:mega-corp");
      expect(excluded).toHaveLength(1);
      expect(excluded[0]?.key).toBe("virtuals:agent:micro-cost");

      const baseScoreOfActive = ranked[0]!.score - ranked[0]!.memory_adjustment;
      expect(baseScoreOfActive).toBe(100); // not 0!
    });

    it("strictly excludes BLOCKED candidate even if price is missing or invalid", () => {
      const blockedNoPrice = makeCounterparty({
        counterpartyKey: "virtuals:agent:blocked-no-price",
        relationshipStatus: "BLOCKED",
        observedPriceUsdc: null,
      });

      const { ranked, excluded } = scoreCandidates([blockedNoPrice]);
      expect(ranked).toHaveLength(0);
      expect(excluded).toHaveLength(1);
      // Status check is priority before price check
      expect(excluded[0]?.reason).toContain("BLOCKED");
    });

    it("fails closed when every candidate in the comparison pool is BLOCKED", () => {
      const b1 = makeCounterparty({ counterpartyKey: "b1", relationshipStatus: "BLOCKED", observedPriceUsdc: "0.01" });
      const b2 = makeCounterparty({ counterpartyKey: "b2", relationshipStatus: "BLOCKED", observedPriceUsdc: "0.02" });
      const b3 = makeCounterparty({ counterpartyKey: "b3", relationshipStatus: "BLOCKED", observedPriceUsdc: "100.00" });

      const { ranked, excluded } = scoreCandidates([b1, b2, b3]);
      expect(ranked).toHaveLength(0);
      expect(excluded).toHaveLength(3);
      for (const ex of excluded) {
        expect(ex.reason).toContain("BLOCKED");
      }
    });

    it("verifies multiple BLOCKED candidates at various price points are all categorically excluded", () => {
      const pool = [
        makeCounterparty({ counterpartyKey: "b-penny", relationshipStatus: "BLOCKED", observedPriceUsdc: "0.01" }),
        makeCounterparty({ counterpartyKey: "b-dollar", relationshipStatus: "BLOCKED", observedPriceUsdc: "1.00" }),
        makeCounterparty({ counterpartyKey: "b-mid", relationshipStatus: "BLOCKED", observedPriceUsdc: "50.00" }),
        makeCounterparty({ counterpartyKey: "b-high", relationshipStatus: "BLOCKED", observedPriceUsdc: "5000.00" }),
        makeCounterparty({ counterpartyKey: "active-1", relationshipStatus: "KNOWN", observedPriceUsdc: "100.00" }),
        makeCounterparty({ counterpartyKey: "active-2", relationshipStatus: "PREFERRED", observedPriceUsdc: "200.00" }),
      ];

      const { ranked, excluded } = scoreCandidates(pool);
      expect(ranked).toHaveLength(2);
      expect(ranked.map((r) => r.key)).toEqual(["active-1", "active-2"]);
      expect(excluded).toHaveLength(4);
      expect(excluded.map((e) => e.key)).toEqual(["b-penny", "b-dollar", "b-mid", "b-high"]);
    });
  });

  // =========================================================================
  // SUITE 3: 10-CANDIDATE MULTI-PROVIDER STRESS RANKING & MONOTONICITY
  // =========================================================================
  describe("Suite 3: 10-Candidate Multi-Provider Stress Ranking & Monotonicity", () => {
    it("ranks 10 candidates with varying failure counts, statuses, and prices with strict monotonicity", () => {
      const c1_preferred_cheap = makeCounterparty({
        counterpartyKey: "agent-1-preferred-cheap",
        relationshipStatus: "PREFERRED",
        overallReliability: 0.95,
        taskFit: 0.9,
        confidence: 0.9,
        observedPriceUsdc: "10.00",
      });

      const c2_preferred_mid = makeCounterparty({
        counterpartyKey: "agent-2-preferred-mid",
        relationshipStatus: "PREFERRED",
        overallReliability: 0.90,
        taskFit: 0.85,
        confidence: 0.8,
        observedPriceUsdc: "12.00",
      });

      const c3_known_fair = makeCounterparty({
        counterpartyKey: "agent-3-known-fair",
        relationshipStatus: "KNOWN",
        overallReliability: 0.70,
        taskFit: 0.5,
        confidence: 0.5,
        observedPriceUsdc: "10.00",
      });

      const c4_new_beta = makeCounterparty({
        counterpartyKey: "agent-4-new-beta",
        relationshipStatus: "NEW",
        overallReliability: 0.5,
        taskFit: 0.5,
        confidence: 0.0,
        observedPriceUsdc: "10.00",
      });

      const c5_watch_alpha = makeCounterparty({
        counterpartyKey: "agent-5-watch-alpha",
        relationshipStatus: "WATCH",
        overallReliability: 0.3333,
        taskFit: 0.5,
        confidence: 0.1667,
        observedPriceUsdc: "10.00",
      });

      const c6_watch_expensive = makeCounterparty({
        counterpartyKey: "agent-6-watch-expensive",
        relationshipStatus: "WATCH",
        overallReliability: 0.3333,
        taskFit: 0.5,
        confidence: 0.1667,
        observedPriceUsdc: "15.00",
      });

      const c7_archived_cheap = makeCounterparty({
        counterpartyKey: "agent-7-archived-cheap",
        relationshipStatus: "ARCHIVED",
        overallReliability: 0.20,
        taskFit: 0.4,
        confidence: 0.7,
        observedPriceUsdc: "8.00", // Cheapest on table ($8.00)!
      });

      const c8_blocked_cent = makeCounterparty({
        counterpartyKey: "agent-8-blocked-cent",
        relationshipStatus: "BLOCKED",
        observedPriceUsdc: "0.01",
      });

      const c9_blocked_pricey = makeCounterparty({
        counterpartyKey: "agent-9-blocked-pricey",
        relationshipStatus: "BLOCKED",
        observedPriceUsdc: "100.00",
      });

      const c10_no_price = makeCounterparty({
        counterpartyKey: "agent-10-no-price",
        relationshipStatus: "KNOWN",
        observedPriceUsdc: null,
      });

      const candidates10 = [
        c1_preferred_cheap,
        c2_preferred_mid,
        c3_known_fair,
        c4_new_beta,
        c5_watch_alpha,
        c6_watch_expensive,
        c7_archived_cheap,
        c8_blocked_cent,
        c9_blocked_pricey,
        c10_no_price,
      ];

      const { ranked, excluded } = scoreCandidates(candidates10);

      // 1. Check exclusions: exactly 3 candidates excluded
      expect(excluded).toHaveLength(3);
      const excludedKeys = excluded.map((e) => e.key);
      expect(excludedKeys).toContain("agent-8-blocked-cent");
      expect(excludedKeys).toContain("agent-9-blocked-pricey");
      expect(excludedKeys).toContain("agent-10-no-price");

      const blockedReasons = excluded.filter((e) => e.key.includes("blocked"));
      expect(blockedReasons).toHaveLength(2);
      for (const br of blockedReasons) {
        expect(br.reason).toContain("BLOCKED");
      }

      const noPriceReason = excluded.find((e) => e.key === "agent-10-no-price");
      expect(noPriceReason?.reason).toContain("No observed price on record");

      // 2. Check ranked candidates count
      expect(ranked).toHaveLength(7);

      // Cheapest allowed candidate is c7 at $8.00
      // Let's verify base scores:
      // c7 base: round(100 * 8 / 8) = 100
      // c1 ($10) base: round(100 * 8 / 10) = 80
      // c4 ($10) base: 80
      // c5 ($10) base: 80
      // c6 ($15) base: round(100 * 8 / 15) = 53
      // c2 ($12) base: round(100 * 8 / 12) = 67

      // Verify counterfactual decomposition holds for all ranked candidates
      for (const r of ranked) {
        const matchingCand = candidates10.find((c) => c.counterpartyKey === r.key)!;
        const price = Number(matchingCand.observedPriceUsdc);
        const expectedBase = Math.round((100 * 8) / price);
        expect(r.score - r.memory_adjustment).toBe(expectedBase);
      }

      // 3. Monotonicity at equal price ($10.00):
      // c1_preferred_cheap vs c3_known_fair vs c4_new_beta vs c5_watch_alpha
      const scoreC1 = ranked.find((r) => r.key === "agent-1-preferred-cheap")!.score;
      const scoreC3 = ranked.find((r) => r.key === "agent-3-known-fair")!.score;
      const scoreC4 = ranked.find((r) => r.key === "agent-4-new-beta")!.score;
      const scoreC5 = ranked.find((r) => r.key === "agent-5-watch-alpha")!.score;

      expect(scoreC1).toBeGreaterThan(scoreC3);
      expect(scoreC3).toBeGreaterThan(scoreC4);
      expect(scoreC4).toBeGreaterThan(scoreC5);

      // 4. Monotonicity at equal reputation (WATCH, 1 failure):
      // c5 ($10.00) vs c6 ($15.00)
      const scoreC6 = ranked.find((r) => r.key === "agent-6-watch-expensive")!.score;
      expect(scoreC5).toBeGreaterThan(scoreC6);

      // 5. Memory penalty dampens cheap low-reputation candidate (c7 at $8.00):
      // c7 base is 100, but archived penalty drops it significantly
      const r7 = ranked.find((r) => r.key === "agent-7-archived-cheap")!;
      expect(r7.memory_adjustment).toBeLessThan(-10);
      expect(r7.score).toBeLessThan(scoreC1); // c1 wins over c7 despite c7 being cheaper!
    });
  });

  // =========================================================================
  // SUITE 4: PERMUTATION INVARIANCE, STABILITY & TIE DETERMINISM
  // =========================================================================
  describe("Suite 4: Permutation Invariance & Ranking Stability", () => {
    it("produces identical ranking order across 100 randomized input permutations", () => {
      const candidates = [
        makeCounterparty({ counterpartyKey: "p1", observedPriceUsdc: "10.00", overallReliability: 0.95, confidence: 0.9, relationshipStatus: "PREFERRED" }),
        makeCounterparty({ counterpartyKey: "p2", observedPriceUsdc: "10.00", overallReliability: 0.85, confidence: 0.7, relationshipStatus: "KNOWN" }),
        makeCounterparty({ counterpartyKey: "p3", observedPriceUsdc: "10.00", overallReliability: 0.5, confidence: 0.0, relationshipStatus: "NEW" }),
        makeCounterparty({ counterpartyKey: "p4", observedPriceUsdc: "10.00", overallReliability: 0.33, confidence: 0.2, relationshipStatus: "WATCH" }),
        makeCounterparty({ counterpartyKey: "p5", observedPriceUsdc: "10.00", overallReliability: 0.1, confidence: 0.8, relationshipStatus: "ARCHIVED" }),
        makeCounterparty({ counterpartyKey: "p6", observedPriceUsdc: "0.01", relationshipStatus: "BLOCKED" }),
        makeCounterparty({ counterpartyKey: "p7", observedPriceUsdc: null, relationshipStatus: "KNOWN" }),
      ];

      const baseline = scoreCandidates(candidates);
      const baselineRankedKeys = baseline.ranked.map((r) => r.key);
      const baselineExcludedKeys = new Set(baseline.excluded.map((e) => e.key));

      // Shuffle 100 times
      for (let i = 0; i < 100; i++) {
        const shuffled = [...candidates].sort(() => Math.random() - 0.5);
        const result = scoreCandidates(shuffled);

        expect(result.ranked.map((r) => r.key)).toEqual(baselineRankedKeys);
        expect(new Set(result.excluded.map((e) => e.key))).toEqual(baselineExcludedKeys);
        for (let j = 0; j < baseline.ranked.length; j++) {
          expect(result.ranked[j]?.score).toBe(baseline.ranked[j]?.score);
          expect(result.ranked[j]?.memory_adjustment).toBe(baseline.ranked[j]?.memory_adjustment);
        }
      }
    });

    it("verifies empty candidate pool returns empty arrays without throwing", () => {
      const emptyResult = scoreCandidates([]);
      expect(emptyResult.ranked).toEqual([]);
      expect(emptyResult.excluded).toEqual([]);
    });

    it("handles multiple candidates with identical ties gracefully", () => {
      const t1 = makeCounterparty({ counterpartyKey: "tie-1", observedPriceUsdc: "10.00", overallReliability: 0.5, confidence: 0 });
      const t2 = makeCounterparty({ counterpartyKey: "tie-2", observedPriceUsdc: "10.00", overallReliability: 0.5, confidence: 0 });
      const t3 = makeCounterparty({ counterpartyKey: "tie-3", observedPriceUsdc: "10.00", overallReliability: 0.5, confidence: 0 });

      const { ranked } = scoreCandidates([t1, t2, t3]);
      expect(ranked).toHaveLength(3);
      expect(ranked.every((r) => r.score === 100)).toBe(true);
      expect(ranked.every((r) => r.memory_adjustment === 0)).toBe(true);
    });
  });

  // =========================================================================
  // SUITE 5: ADVERSARIAL NUMERICAL FUZZING & BOUNDARY HARNESS
  // =========================================================================
  describe("Suite 5: Adversarial Numerical Fuzzing & Boundary Harness", () => {
    it("excludes candidates with malformed, zero, or negative price strings", () => {
      const malformed = [
        makeCounterparty({ counterpartyKey: "zero", observedPriceUsdc: "0" }),
        makeCounterparty({ counterpartyKey: "negative", observedPriceUsdc: "-10.00" }),
        makeCounterparty({ counterpartyKey: "nan", observedPriceUsdc: "not-a-number" }),
        makeCounterparty({ counterpartyKey: "empty", observedPriceUsdc: "" }),
        makeCounterparty({ counterpartyKey: "infinity", observedPriceUsdc: "Infinity" }),
        makeCounterparty({ counterpartyKey: "neg-infinity", observedPriceUsdc: "-Infinity" }),
      ];

      const { ranked, excluded } = scoreCandidates(malformed);
      expect(ranked).toHaveLength(0);
      expect(excluded).toHaveLength(6);
      for (const ex of excluded) {
        expect(ex.reason).toBe("No observed price on record, so there was nothing to compare on.");
      }
    });

    it("fuzz testing: 500 randomized candidate combinations never throw, crash, or violate invariants", () => {
      const statuses = ["PREFERRED", "KNOWN", "NEW", "WATCH", "ARCHIVED", "BLOCKED", "UNKNOWN_STATUS", null] as const;

      for (let run = 0; run < 500; run++) {
        const poolSize = Math.floor(Math.random() * 8) + 1;
        const pool: SibylCounterparty[] = [];

        for (let idx = 0; idx < poolSize; idx++) {
          const status = statuses[Math.floor(Math.random() * statuses.length)];
          const price = Math.random() < 0.2
            ? null
            : (Math.random() * 100 + 0.01).toFixed(2);

          pool.push(
            makeCounterparty({
              counterpartyKey: `fuzz-${run}-${idx}`,
              relationshipStatus: status as SibylCounterparty["relationshipStatus"],
              observedPriceUsdc: price,
              overallReliability: Math.random() < 0.1 ? null : Math.random(),
              taskFit: Math.random() < 0.1 ? null : Math.random(),
              confidence: Math.random() < 0.1 ? null : Math.random(),
            })
          );
        }

        const result = scoreCandidates(pool);

        // Invariant 1: No BLOCKED counterparty ever in ranked
        for (const r of result.ranked) {
          const original = pool.find((p) => p.counterpartyKey === r.key)!;
          expect(original.relationshipStatus).not.toBe("BLOCKED");
          expect(Number.isFinite(r.score)).toBe(true);
          expect(Number.isFinite(r.memory_adjustment)).toBe(true);
        }

        // Invariant 2: Every BLOCKED counterparty is in excluded
        for (const p of pool) {
          if (p.relationshipStatus === "BLOCKED") {
            const inExcluded = result.excluded.find((e) => e.key === p.counterpartyKey);
            expect(inExcluded).toBeDefined();
            expect(inExcluded?.reason).toContain("BLOCKED");
          }
        }

        // Invariant 3: Ranked scores are monotonically non-increasing (sorted descending)
        for (let i = 0; i < result.ranked.length - 1; i++) {
          expect(result.ranked[i]!.score).toBeGreaterThanOrEqual(result.ranked[i + 1]!.score);
        }
      }
    });
  });
});

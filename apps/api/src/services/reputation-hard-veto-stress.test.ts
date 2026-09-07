import { describe, expect, it } from "vitest";
import {
  createInitialReputation,
  updateReputation,
  applyTimeDecay,
  checkVeto,
  manualUnblock,
  manualArchive,
  formatForSibyl,
  type CandidateReputation,
} from "./reputation-fsm.js";

describe("Empirical Challenger 3: Hard Veto Invariant & BLOCKED State Transition Proof", () => {
  // =========================================================================
  // SUITE 1: manualArchive ON BLOCKED STATUS STRICTLY THROWS & CANNOT BYPASS HARD VETO
  // =========================================================================
  describe("Suite 1: manualArchive on BLOCKED Status Strictly Throws & Cannot Bypass Hard Veto", () => {
    it("strictly throws when called on candidate naturally BLOCKED from NEW -> WATCH -> BLOCKED", () => {
      let cand = createInitialReputation("cand-new-blocked");
      cand = updateReputation(cand, "failure"); // -> WATCH (consecutiveFailures = 1)
      cand = updateReputation(cand, "failure"); // -> BLOCKED (consecutiveFailures = 2)
      expect(cand.status).toBe("BLOCKED");
      expect(checkVeto(cand).allowed).toBe(false);

      expect(() => manualArchive(cand)).toThrow(
        "Cannot archive a candidate that is BLOCKED; candidate must be manually unblocked first."
      );
      expect(cand.status).toBe("BLOCKED");
      expect(checkVeto(cand).allowed).toBe(false);
    });

    it("strictly throws when called on candidate naturally BLOCKED from KNOWN -> WATCH -> BLOCKED", () => {
      let cand = createInitialReputation("cand-known-blocked");
      cand = updateReputation(cand, "success"); // -> KNOWN
      expect(cand.status).toBe("KNOWN");

      cand = updateReputation(cand, "failure"); // -> WATCH
      cand = updateReputation(cand, "failure"); // -> BLOCKED
      expect(cand.status).toBe("BLOCKED");

      expect(() => manualArchive(cand)).toThrow(
        "Cannot archive a candidate that is BLOCKED; candidate must be manually unblocked first."
      );
      expect(cand.status).toBe("BLOCKED");
      expect(checkVeto(cand).allowed).toBe(false);
    });

    it("strictly throws when called on candidate naturally BLOCKED from PREFERRED -> WATCH -> BLOCKED", () => {
      let cand = createInitialReputation("cand-preferred-blocked");
      for (let i = 0; i < 15; i++) {
        cand = updateReputation(cand, "success");
      }
      expect(cand.status).toBe("PREFERRED");

      cand = updateReputation(cand, "failure"); // -> WATCH
      cand = updateReputation(cand, "failure"); // -> BLOCKED
      expect(cand.status).toBe("BLOCKED");

      expect(() => manualArchive(cand)).toThrow(
        "Cannot archive a candidate that is BLOCKED; candidate must be manually unblocked first."
      );
      expect(cand.status).toBe("BLOCKED");
      expect(checkVeto(cand).allowed).toBe(false);
    });

    it("strictly throws when called on candidate naturally BLOCKED from ARCHIVED state", () => {
      let cand = createInitialReputation("cand-archived-blocked");
      cand = manualArchive(cand);
      expect(cand.status).toBe("ARCHIVED");

      cand = updateReputation(cand, "failure"); // consecutiveFailures = 1
      cand = updateReputation(cand, "failure"); // consecutiveFailures = 2 -> BLOCKED
      expect(cand.status).toBe("BLOCKED");

      expect(() => manualArchive(cand)).toThrow(
        "Cannot archive a candidate that is BLOCKED; candidate must be manually unblocked first."
      );
      expect(cand.status).toBe("BLOCKED");
      expect(checkVeto(cand).allowed).toBe(false);
    });

    it("strictly throws when called on candidate re-blocked after legitimate manualUnblock", () => {
      let cand = createInitialReputation("cand-reblocked");
      cand = updateReputation(cand, "failure");
      cand = updateReputation(cand, "failure"); // -> BLOCKED
      expect(cand.status).toBe("BLOCKED");

      // Valid unblock to WATCH
      cand = manualUnblock(cand, "admin-audit", "Probationary restart", "WATCH");
      expect(cand.status).toBe("WATCH");
      expect(checkVeto(cand).allowed).toBe(true);

      // Fails twice again -> BLOCKED
      cand = updateReputation(cand, "failure");
      cand = updateReputation(cand, "failure");
      expect(cand.status).toBe("BLOCKED");
      expect(checkVeto(cand).allowed).toBe(false);

      expect(() => manualArchive(cand)).toThrow(
        "Cannot archive a candidate that is BLOCKED; candidate must be manually unblocked first."
      );
      expect(cand.status).toBe("BLOCKED");
      expect(checkVeto(cand).allowed).toBe(false);
    });

    it("strictly throws when called on artificially constructed BLOCKED candidates with varied parameters", () => {
      const candidates: CandidateReputation[] = [
        {
          candidateId: "art-1",
          alpha: 1.0,
          beta: 1.0,
          overallReliability: 0.5,
          confidence: 0.0,
          status: "BLOCKED",
          consecutiveFailures: 0,
          totalMissions: 0,
          lastUpdatedAt: new Date().toISOString(),
        },
        {
          candidateId: "art-2",
          alpha: 999.0,
          beta: 1.0,
          overallReliability: 0.999,
          confidence: 0.995,
          status: "BLOCKED",
          consecutiveFailures: 2,
          totalMissions: 1000,
          lastUpdatedAt: new Date().toISOString(),
          blockedReason: "Compliance violation",
        },
        {
          candidateId: "art-3",
          alpha: 1.0,
          beta: 50.0,
          overallReliability: 0.02,
          confidence: 0.9,
          status: "BLOCKED",
          consecutiveFailures: 10,
          totalMissions: 51,
          lastUpdatedAt: new Date().toISOString(),
        },
      ];

      for (const c of candidates) {
        expect(() => manualArchive(c)).toThrow(
          "Cannot archive a candidate that is BLOCKED; candidate must be manually unblocked first."
        );
        expect(checkVeto(c).allowed).toBe(false);
      }
    });

    it("strictly throws regardless of custom now arguments (Date or string timestamp)", () => {
      let cand = createInitialReputation("date-arg-blocked");
      cand = updateReputation(cand, "failure");
      cand = updateReputation(cand, "failure");
      expect(cand.status).toBe("BLOCKED");

      expect(() => manualArchive(cand, new Date("2026-10-01T00:00:00Z"))).toThrow(
        "Cannot archive a candidate that is BLOCKED; candidate must be manually unblocked first."
      );
      expect(() => manualArchive(cand, "2026-10-01T00:00:00.000Z")).toThrow(
        "Cannot archive a candidate that is BLOCKED; candidate must be manually unblocked first."
      );
    });

    it("verifies that a try/catch around manualArchive leaves candidate completely intact and vetoed", () => {
      let cand = createInitialReputation("try-catch-probe");
      cand = updateReputation(cand, "failure");
      cand = updateReputation(cand, "failure");
      expect(cand.status).toBe("BLOCKED");

      const snapshotBefore = JSON.stringify(cand);

      let thrownError: unknown;
      try {
        manualArchive(cand);
      } catch (err) {
        thrownError = err;
      }

      expect(thrownError).toBeInstanceOf(Error);
      expect((thrownError as Error).message).toBe(
        "Cannot archive a candidate that is BLOCKED; candidate must be manually unblocked first."
      );

      // Snapshot comparison confirms zero mutation
      expect(JSON.stringify(cand)).toBe(snapshotBefore);
      expect(checkVeto(cand).allowed).toBe(false);
    });

    it("confirms candidate cannot be sneaked into ranking filters after failed manualArchive attempt", () => {
      let blockedCand = createInitialReputation("sneaky-candidate");
      blockedCand = updateReputation(blockedCand, "failure");
      blockedCand = updateReputation(blockedCand, "failure");

      try {
        manualArchive(blockedCand);
      } catch {
        // Suppress error
      }

      const pool: CandidateReputation[] = [
        blockedCand,
        createInitialReputation("honest-candidate-1"),
        createInitialReputation("honest-candidate-2"),
      ];

      const ranked = pool.filter((c) => checkVeto(c).allowed);
      expect(ranked).toHaveLength(2);
      expect(ranked.find((c) => c.candidateId === "sneaky-candidate")).toBeUndefined();
    });

    it("permits manualArchive ONLY after legitimate manualUnblock", () => {
      let cand = createInitialReputation("legitimate-lifecycle");
      cand = updateReputation(cand, "failure");
      cand = updateReputation(cand, "failure");
      expect(cand.status).toBe("BLOCKED");

      // Direct archive fails
      expect(() => manualArchive(cand)).toThrow();

      // Legitimate unblock
      const unblocked = manualUnblock(cand, "ops-lead", "Transition to cold storage", "ARCHIVED");
      expect(unblocked.status).toBe("ARCHIVED");
      expect(unblocked.unblockedBy).toBe("ops-lead");
      expect(unblocked.unblockedReason).toBe("Transition to cold storage");
      expect(checkVeto(unblocked).allowed).toBe(true);

      // Now manualArchive on already unblocked candidate works
      const archivedAgain = manualArchive(unblocked);
      expect(archivedAgain.status).toBe("ARCHIVED");
    });
  });

  // =========================================================================
  // SUITE 2: NO COMBINATION OF OPERATIONS CAN TRANSITION BLOCKED OUT OF BLOCKED
  // =========================================================================
  describe("Suite 2: No Combination of Operations Can Transition BLOCKED Out of BLOCKED Without manualUnblock", () => {
    it("proves single operations leave BLOCKED status and parameters strictly intact", () => {
      let baseCand = createInitialReputation("base-blocked");
      baseCand = updateReputation(baseCand, "failure");
      baseCand = updateReputation(baseCand, "failure");
      expect(baseCand.status).toBe("BLOCKED");

      const a0 = baseCand.alpha;
      const b0 = baseCand.beta;
      const r0 = baseCand.overallReliability;
      const c0 = baseCand.confidence;
      const f0 = baseCand.consecutiveFailures;
      const m0 = baseCand.totalMissions;

      // 1. updateReputation with success
      const uSuccess = updateReputation(baseCand, "success");
      expect(uSuccess.status).toBe("BLOCKED");
      expect(uSuccess.alpha).toBe(a0);
      expect(uSuccess.beta).toBe(b0);
      expect(uSuccess.overallReliability).toBe(r0);
      expect(uSuccess.confidence).toBe(c0);
      expect(uSuccess.consecutiveFailures).toBe(f0);
      expect(uSuccess.totalMissions).toBe(m0);
      expect(checkVeto(uSuccess).allowed).toBe(false);

      // 2. updateReputation with failure
      const uFailure = updateReputation(baseCand, "failure");
      expect(uFailure.status).toBe("BLOCKED");
      expect(uFailure.alpha).toBe(a0);
      expect(uFailure.beta).toBe(b0);
      expect(uFailure.overallReliability).toBe(r0);
      expect(uFailure.confidence).toBe(c0);
      expect(uFailure.consecutiveFailures).toBe(f0);
      expect(uFailure.totalMissions).toBe(m0);
      expect(checkVeto(uFailure).allowed).toBe(false);

      // 3. applyTimeDecay
      const decayed = applyTimeDecay(baseCand, 100, 0.90);
      expect(decayed.status).toBe("BLOCKED");
      expect(decayed.alpha).toBe(a0);
      expect(decayed.beta).toBe(b0);
      expect(decayed.overallReliability).toBe(r0);
      expect(decayed.confidence).toBe(c0);
      expect(decayed.consecutiveFailures).toBe(f0);
      expect(decayed.totalMissions).toBe(m0);
      expect(checkVeto(decayed).allowed).toBe(false);

      // 4. formatForSibyl
      const sibylRecord = formatForSibyl(baseCand);
      expect(sibylRecord.relationshipStatus).toBe("BLOCKED");
      expect(sibylRecord.overallReliability).toBe(r0);
      expect(sibylRecord.confidence).toBe(c0);
    });

    it("proves sequential multi-step combinations cannot alter BLOCKED status or escape veto", () => {
      let cand = createInitialReputation("sequential-attack");
      cand = updateReputation(cand, "failure");
      cand = updateReputation(cand, "failure");
      expect(cand.status).toBe("BLOCKED");

      const a0 = cand.alpha;
      const b0 = cand.beta;

      // Pipeline of diverse operations
      for (let cycle = 0; cycle < 50; cycle++) {
        // Step A: apply time decay
        cand = applyTimeDecay(cand, 10, 0.95);
        expect(cand.status).toBe("BLOCKED");
        expect(checkVeto(cand).allowed).toBe(false);

        // Step B: massive success update
        cand = updateReputation(cand, "success", { weight: 1000.0, decayTimeSteps: 25 });
        expect(cand.status).toBe("BLOCKED");
        expect(checkVeto(cand).allowed).toBe(false);

        // Step C: failure update
        cand = updateReputation(cand, "failure", { weight: 50.0 });
        expect(cand.status).toBe("BLOCKED");
        expect(checkVeto(cand).allowed).toBe(false);

        // Step D: manualArchive attempt (caught)
        try {
          cand = manualArchive(cand);
        } catch {
          // Expected
        }
        expect(cand.status).toBe("BLOCKED");
        expect(checkVeto(cand).allowed).toBe(false);

        // Step E: check Sibyl representation
        const s = formatForSibyl(cand);
        expect(s.relationshipStatus).toBe("BLOCKED");
      }

      // Parameters are strictly unmodified from initial entry into BLOCKED
      expect(cand.alpha).toBe(a0);
      expect(cand.beta).toBe(b0);
      expect(cand.status).toBe("BLOCKED");
      expect(checkVeto(cand).allowed).toBe(false);
    });

    it("fuzz testing: 10,000 randomized operation sequences strictly preserve BLOCKED status and veto", () => {
      let cand = createInitialReputation("fuzz-target");
      cand = updateReputation(cand, "failure");
      cand = updateReputation(cand, "failure");
      expect(cand.status).toBe("BLOCKED");

      const a0 = cand.alpha;
      const b0 = cand.beta;
      const r0 = cand.overallReliability;
      const c0 = cand.confidence;
      const f0 = cand.consecutiveFailures;
      const m0 = cand.totalMissions;

      // 10,000 randomized steps chosen across all operations
      for (let i = 0; i < 10000; i++) {
        const op = i % 7;
        switch (op) {
          case 0:
            cand = updateReputation(cand, "success");
            break;
          case 1:
            cand = updateReputation(cand, "failure");
            break;
          case 2:
            cand = updateReputation(cand, "success", {
              weight: Math.random() * 100 + 0.1,
              decayTimeSteps: Math.floor(Math.random() * 100),
            });
            break;
          case 3:
            cand = updateReputation(cand, "failure", {
              weight: Math.random() * 100 + 0.1,
              decayTimeSteps: Math.floor(Math.random() * 100),
            });
            break;
          case 4:
            cand = applyTimeDecay(
              cand,
              Math.floor(Math.random() * 50) + 1,
              0.90 + Math.random() * 0.08
            );
            break;
          case 5:
            try {
              cand = manualArchive(cand);
            } catch {
              // Intentionally caught
            }
            break;
          case 6:
            formatForSibyl(cand);
            break;
        }

        // At every single iteration:
        if (i % 500 === 0) {
          expect(cand.status).toBe("BLOCKED");
          expect(checkVeto(cand).allowed).toBe(false);
          expect(cand.alpha).toBe(a0);
          expect(cand.beta).toBe(b0);
          expect(cand.overallReliability).toBe(r0);
          expect(cand.confidence).toBe(c0);
          expect(cand.consecutiveFailures).toBe(f0);
          expect(cand.totalMissions).toBe(m0);
        }
      }

      // Final post-fuzz assertions
      expect(cand.status).toBe("BLOCKED");
      expect(checkVeto(cand).allowed).toBe(false);
      expect(cand.alpha).toBe(a0);
      expect(cand.beta).toBe(b0);
      expect(cand.overallReliability).toBe(r0);
      expect(cand.confidence).toBe(c0);
      expect(cand.consecutiveFailures).toBe(f0);
      expect(cand.totalMissions).toBe(m0);
    });

    it("confirms manualUnblock strictly rejects invalid inputs and cannot unblock without valid credentials", () => {
      let cand = createInitialReputation("unblock-guard-test");
      cand = updateReputation(cand, "failure");
      cand = updateReputation(cand, "failure");
      expect(cand.status).toBe("BLOCKED");

      // 1. Missing / whitespace operatorId
      expect(() => manualUnblock(cand, "", "Valid reason")).toThrow(
        "operatorId is required to manually unblock candidate"
      );
      expect(() => manualUnblock(cand, "   ", "Valid reason")).toThrow(
        "operatorId is required to manually unblock candidate"
      );
      expect(() => manualUnblock(cand, null as unknown as string, "Valid reason")).toThrow(
        "operatorId is required to manually unblock candidate"
      );

      // 2. Missing / whitespace reason
      expect(() => manualUnblock(cand, "operator-1", "")).toThrow(
        "reason is required to manually unblock candidate"
      );
      expect(() => manualUnblock(cand, "operator-1", "   ")).toThrow(
        "reason is required to manually unblock candidate"
      );
      expect(() => manualUnblock(cand, "operator-1", null as unknown as string)).toThrow(
        "reason is required to manually unblock candidate"
      );

      // 3. targetStatus cannot be BLOCKED
      expect(() => manualUnblock(cand, "operator-1", "Valid reason", "BLOCKED")).toThrow(
        "targetStatus cannot be BLOCKED when manually unblocking candidate"
      );

      // Candidate remains strictly BLOCKED
      expect(cand.status).toBe("BLOCKED");
      expect(checkVeto(cand).allowed).toBe(false);

      // 4. Calling manualUnblock on a non-blocked candidate throws
      const unblockedValid = manualUnblock(cand, "operator-1", "Valid unblock reason", "WATCH");
      expect(unblockedValid.status).toBe("WATCH");
      expect(checkVeto(unblockedValid).allowed).toBe(true);

      expect(() => manualUnblock(unblockedValid, "operator-1", "Double unblock")).toThrow(
        "Cannot unblock a candidate that is not BLOCKED (current status: WATCH)"
      );
    });
  });

  // =========================================================================
  // SUITE 3: BOUNDARY & EXTREME STRESS HARNESS
  // =========================================================================
  describe("Suite 3: Boundary & Extreme Stress Harness", () => {
    it("handles extreme weights and decays on BLOCKED candidate without memory or numerical corruption", () => {
      let cand = createInitialReputation("extreme-stress");
      cand = updateReputation(cand, "failure");
      cand = updateReputation(cand, "failure");
      expect(cand.status).toBe("BLOCKED");

      const extremeDecays = [1e6, 1e9, 0, -100];
      const extremeWeights = [1e6, 1e12, 0.00001];

      for (const d of extremeDecays) {
        for (const w of extremeWeights) {
          const res = updateReputation(cand, "success", {
            weight: w,
            decayTimeSteps: d,
          });
          expect(res.status).toBe("BLOCKED");
          expect(checkVeto(res).allowed).toBe(false);
          expect(res.overallReliability).toBe(cand.overallReliability);
          expect(res.confidence).toBe(cand.confidence);
        }
      }
    });

    it("verifies concurrent async operations on BLOCKED candidate preserve immutability and Hard Veto", async () => {
      let cand = createInitialReputation("async-race-cand");
      cand = updateReputation(cand, "failure");
      cand = updateReputation(cand, "failure");
      expect(cand.status).toBe("BLOCKED");

      const asyncOps = Array.from({ length: 200 }, async (_, idx) => {
        if (idx % 3 === 0) {
          return updateReputation(cand, "success", { weight: 10 });
        } else if (idx % 3 === 1) {
          return applyTimeDecay(cand, 20, 0.95);
        } else {
          try {
            return manualArchive(cand);
          } catch {
            return cand;
          }
        }
      });

      const results = await Promise.all(asyncOps);

      for (const r of results) {
        expect(r.status).toBe("BLOCKED");
        expect(checkVeto(r).allowed).toBe(false);
        expect(r.alpha).toBe(cand.alpha);
        expect(r.beta).toBe(cand.beta);
      }
    });
  });
});

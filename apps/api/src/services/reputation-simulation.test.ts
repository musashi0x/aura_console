import { describe, expect, it } from "vitest";

import type { CommandExecutor } from "./cli-runner.js";
import {
  createWorktreeSession,
  runCli,
  withWorktree,
} from "./cli-runner.js";
import type {
  CandidateReputation,
  RelationshipStatus,
} from "./reputation-fsm.js";
import {
  ALPHA_0,
  BETA_0,
  applyTimeDecay,
  checkVeto,
  createInitialReputation,
  formatEpisodeForSibyl,
  formatForSibyl,
  manualUnblock,
  updateReputation,
} from "./reputation-fsm.js";
import type { SibylCounterparty, SibylEpisode } from "./sibyl.js";
import { VerifierAgent, verifyWorktree } from "./verifier-agent.js";

describe("Bayesian Reputation Simulation Suite & Pipeline Integration (R3)", () => {
  describe("Candidate Alpha: Failing Trajectory & Hard Veto Invariant", () => {
    it("starts NEW with unobserved prior parameters, neutral reliability ~0.5, and confidence < 0.1", () => {
      const alpha = createInitialReputation("candidate-alpha");

      expect(alpha.candidateId).toBe("candidate-alpha");
      expect(alpha.alpha).toBe(ALPHA_0);
      expect(alpha.beta).toBe(BETA_0);
      expect(alpha.overallReliability).toBe(0.5);
      expect(alpha.confidence).toBe(0.0);
      expect(alpha.confidence).toBeLessThan(0.1);
      expect(alpha.status).toBe("NEW");
      expect(alpha.consecutiveFailures).toBe(0);
      expect(alpha.totalMissions).toBe(0);
      expect(alpha.blockedReason).toBeUndefined();
      expect(alpha.unblockedAt).toBeUndefined();
      expect(alpha.unblockedBy).toBeUndefined();

      // Prior candidate passes veto check
      const initialVeto = checkVeto(alpha);
      expect(initialVeto.allowed).toBe(true);
      expect(initialVeto.reason).toBeUndefined();
    });

    it("transitions NEW -> WATCH on 1st failing mission outcome with consecutiveFailures = 1", () => {
      const initial = createInitialReputation("candidate-alpha");
      const round1 = updateReputation(initial, "failure");

      expect(round1.status).toBe("WATCH");
      expect(round1.consecutiveFailures).toBe(1);
      expect(round1.totalMissions).toBe(1);
      expect(round1.alpha).toBe(ALPHA_0);
      expect(round1.beta).toBe(BETA_0 + 1.0); // 2.0
      expect(round1.overallReliability).toBeCloseTo(1 / 3, 4); // ~0.3333
      expect(round1.confidence).toBeCloseTo(1 / 6, 4); // 1 / (1 + 5) ~ 0.1667

      // In WATCH with 1 failure, candidate is watched but not yet vetoed
      const veto = checkVeto(round1);
      expect(veto.allowed).toBe(true);
      expect(veto.reason).toBeUndefined();
    });

    it("transitions WATCH -> BLOCKED on 2nd consecutive failing outcome in WATCH", () => {
      const initial = createInitialReputation("candidate-alpha");
      const round1 = updateReputation(initial, "failure"); // -> WATCH (consecutiveFailures = 1)
      expect(round1.status).toBe("WATCH");

      const round2 = updateReputation(round1, "failure"); // -> BLOCKED (consecutiveFailures = 2)
      expect(round2.status).toBe("BLOCKED");
      expect(round2.consecutiveFailures).toBe(2);
      expect(round2.totalMissions).toBe(2);
      expect(round2.alpha).toBe(ALPHA_0);
      expect(round2.beta).toBe(BETA_0 + 2.0); // 3.0
      expect(round2.overallReliability).toBeCloseTo(1 / 4, 4); // 0.25
      expect(round2.confidence).toBeCloseTo(2 / 7, 4); // 2 / (2 + 5) ~ 0.2857
      expect(round2.blockedReason).toContain("2 consecutive failures in WATCH state");
    });

    it("enforces Hard Veto Invariant: Candidate Alpha is completely excluded from ranking with allowed: false and explicit reason", () => {
      let alpha = createInitialReputation("candidate-alpha");
      alpha = updateReputation(alpha, "failure");
      alpha = updateReputation(alpha, "failure");
      expect(alpha.status).toBe("BLOCKED");

      const vetoResult = checkVeto(alpha);
      expect(vetoResult.allowed).toBe(false);
      expect(vetoResult.reason).toBeDefined();
      expect(vetoResult.reason).toContain("BLOCKED");
      expect(vetoResult.reason).toContain("2 consecutive failures in WATCH state");

      // Verify that candidate selection filter excludes Alpha
      const candidates: CandidateReputation[] = [
        alpha,
        createInitialReputation("candidate-other"),
      ];
      const rankedCandidates = candidates.filter((c) => checkVeto(c).allowed);
      expect(rankedCandidates).toHaveLength(1);
      expect(rankedCandidates[0]?.candidateId).toBe("candidate-other");
      expect(rankedCandidates.some((c) => c.candidateId === "candidate-alpha")).toBe(false);
    });

    it("cannot be auto-promoted even if given positive scores or successes while BLOCKED", () => {
      let alpha = createInitialReputation("candidate-alpha");
      alpha = updateReputation(alpha, "failure");
      alpha = updateReputation(alpha, "failure");
      expect(alpha.status).toBe("BLOCKED");

      const alphaAtBlock = alpha.alpha;
      const betaAtBlock = alpha.beta;
      const relAtBlock = alpha.overallReliability;
      const confAtBlock = alpha.confidence;
      const missionsAtBlock = alpha.totalMissions;

      // Simulate 10 mission success attempts
      for (let i = 0; i < 10; i++) {
        alpha = updateReputation(alpha, "success");
        expect(alpha.status).toBe("BLOCKED");
        expect(alpha.alpha).toBe(alphaAtBlock);
        expect(alpha.beta).toBe(betaAtBlock);
        expect(alpha.overallReliability).toBe(relAtBlock);
        expect(alpha.confidence).toBe(confAtBlock);
        expect(alpha.totalMissions).toBe(missionsAtBlock);

        // Veto remains active
        expect(checkVeto(alpha).allowed).toBe(false);
      }
    });

    it("verifies explicit operator manual intervention (manualUnblock) successfully unblocks Alpha back to WATCH with operatorId, reason, and unblockedAt timestamp", () => {
      let alpha = createInitialReputation("candidate-alpha");
      alpha = updateReputation(alpha, "failure");
      alpha = updateReputation(alpha, "failure");
      expect(alpha.status).toBe("BLOCKED");

      const fixedTime = new Date("2026-09-07T12:00:00.000Z");
      const unblockedAlpha = manualUnblock(
        alpha,
        "operator-alex",
        "Hardware misconfiguration in test node resolved; candidate approved for supervised probation.",
        "WATCH",
        fixedTime,
      );

      expect(unblockedAlpha.status).toBe("WATCH");
      expect(unblockedAlpha.consecutiveFailures).toBe(0);
      expect(unblockedAlpha.unblockedBy).toBe("operator-alex");
      expect(unblockedAlpha.unblockedAt).toBe("2026-09-07T12:00:00.000Z");
      expect(unblockedAlpha.blockedReason).toBeUndefined();

      // Post-unblock: checkVeto allows Alpha back into candidate ranking
      const vetoAfterUnblock = checkVeto(unblockedAlpha);
      expect(vetoAfterUnblock.allowed).toBe(true);
      expect(vetoAfterUnblock.reason).toBeUndefined();
    });

    it("verifies unblocked Alpha can earn reputation again and recover to KNOWN upon subsequent successes", () => {
      let alpha = createInitialReputation("candidate-alpha");
      alpha = updateReputation(alpha, "failure");
      alpha = updateReputation(alpha, "failure");
      expect(alpha.status).toBe("BLOCKED");

      // Operator unblocks to WATCH
      let activeAlpha = manualUnblock(
        alpha,
        "operator-sarah",
        "Manual approval after root cause remediation",
      );

      // Current alpha = 1, beta = 3. Reliability = 1/4 = 0.25 < 0.50 (watchRecoveryThreshold)
      // 1st success after unblock: alpha = 2, beta = 3, rel = 2/5 = 0.40 < 0.50 -> remains WATCH
      activeAlpha = updateReputation(activeAlpha, "success");
      expect(activeAlpha.status).toBe("WATCH");
      expect(activeAlpha.consecutiveFailures).toBe(0);
      expect(activeAlpha.overallReliability).toBe(0.4);

      // 2nd success after unblock: alpha = 3, beta = 3, rel = 3/6 = 0.50 >= 0.50 -> transitions to KNOWN!
      activeAlpha = updateReputation(activeAlpha, "success");
      expect(activeAlpha.status).toBe("KNOWN");
      expect(activeAlpha.consecutiveFailures).toBe(0);
      expect(activeAlpha.overallReliability).toBe(0.5);
    });

    it("verifies operator unblocking directly to KNOWN with operator justification", () => {
      let alpha = createInitialReputation("candidate-alpha");
      alpha = updateReputation(alpha, "failure");
      alpha = updateReputation(alpha, "failure");
      expect(alpha.status).toBe("BLOCKED");

      const unblocked = manualUnblock(
        alpha,
        "operator-lead",
        "Senior operator review: verified false-positive network timeout.",
        "KNOWN",
      );

      expect(unblocked.status).toBe("KNOWN");
      expect(unblocked.consecutiveFailures).toBe(0);
      expect(unblocked.unblockedBy).toBe("operator-lead");
      expect(checkVeto(unblocked).allowed).toBe(true);
    });
  });

  describe("Candidate Beta: Success Trajectory & Monotonic Promotion", () => {
    it("starts NEW and transitions to KNOWN on 1st successful mission outcome", () => {
      const beta = createInitialReputation("candidate-beta");
      expect(beta.status).toBe("NEW");
      expect(beta.overallReliability).toBe(0.5);
      expect(beta.confidence).toBe(0.0);

      const round1 = updateReputation(beta, "success");
      expect(round1.status).toBe("KNOWN");
      expect(round1.consecutiveFailures).toBe(0);
      expect(round1.totalMissions).toBe(1);
      expect(round1.alpha).toBe(ALPHA_0 + 1.0); // 2.0
      expect(round1.beta).toBe(BETA_0); // 1.0
      expect(round1.overallReliability).toBeCloseTo(2 / 3, 4); // ~0.6667
      expect(round1.confidence).toBeCloseTo(1 / 6, 4); // 1 / (1 + 5) ~ 0.1667
    });

    it("subsequent successful runs monotonically increase overallReliability and drive confidence towards 1.0", () => {
      let beta = createInitialReputation("candidate-beta");
      let prevReliability = beta.overallReliability;
      let prevConfidence = beta.confidence;

      const trajectory: Array<{
        mission: number;
        reliability: number;
        confidence: number;
        status: RelationshipStatus;
      }> = [];

      for (let m = 1; m <= 10; m++) {
        beta = updateReputation(beta, "success");

        // Strict monotonicity check on each step
        expect(beta.overallReliability).toBeGreaterThan(prevReliability);
        expect(beta.confidence).toBeGreaterThan(prevConfidence);
        expect(beta.consecutiveFailures).toBe(0);
        expect(beta.totalMissions).toBe(m);

        trajectory.push({
          mission: m,
          reliability: beta.overallReliability,
          confidence: beta.confidence,
          status: beta.status,
        });

        prevReliability = beta.overallReliability;
        prevConfidence = beta.confidence;
      }

      // Verify trajectory milestones
      // Mission 1: alpha=2, beta=1 -> rel=2/3 (0.667), conf=1/6 (0.167), status=KNOWN
      expect(trajectory[0]?.status).toBe("KNOWN");
      expect(trajectory[0]?.reliability).toBeCloseTo(2 / 3, 4);
      expect(trajectory[0]?.confidence).toBeCloseTo(1 / 6, 4);

      // Mission 3: alpha=4, beta=1 -> rel=4/5 (0.80), conf=3/8 (0.375)
      // reliability >= 0.80, but confidence 0.375 < 0.50 threshold, so still KNOWN
      expect(trajectory[2]?.status).toBe("KNOWN");
      expect(trajectory[2]?.reliability).toBe(0.8);
      expect(trajectory[2]?.confidence).toBe(0.375);

      // Mission 4: alpha=5, beta=1 -> rel=5/6 (0.833), conf=4/9 (0.444), still KNOWN
      expect(trajectory[3]?.status).toBe("KNOWN");

      // Mission 5: alpha=6, beta=1 -> rel=6/7 (~0.8571 >= 0.80), conf=5/10 (0.50 >= 0.50)
      // Thresholds met: promoted to PREFERRED!
      expect(trajectory[4]?.status).toBe("PREFERRED");
      expect(trajectory[4]?.reliability).toBeGreaterThanOrEqual(0.8);
      expect(trajectory[4]?.confidence).toBeGreaterThanOrEqual(0.5);

      // Missions 6 to 10 maintain PREFERRED
      for (let i = 5; i < 10; i++) {
        expect(trajectory[i]?.status).toBe("PREFERRED");
      }
    });

    it("promotes to PREFERRED once reliability >= 0.8 and confidence >= 0.5 with 0 consecutive failures", () => {
      let beta = createInitialReputation("candidate-beta");

      // Feed 4 successes: reliability reaches 5/6 (~0.833), but confidence is 4/9 (~0.444 < 0.5)
      for (let i = 0; i < 4; i++) {
        beta = updateReputation(beta, "success");
      }
      expect(beta.status).toBe("KNOWN");
      expect(beta.overallReliability).toBeGreaterThanOrEqual(0.8);
      expect(beta.confidence).toBeLessThan(0.5);

      // 5th success drives confidence to 5 / (5 + 5) = 0.50 -> immediate promotion to PREFERRED
      beta = updateReputation(beta, "success");
      expect(beta.status).toBe("PREFERRED");
      expect(beta.overallReliability).toBeCloseTo(6 / 7, 4);
      expect(beta.confidence).toBe(0.5);
      expect(beta.consecutiveFailures).toBe(0);

      // Retains PREFERRED status on subsequent successes
      beta = updateReputation(beta, "success");
      expect(beta.status).toBe("PREFERRED");
      expect(beta.consecutiveFailures).toBe(0);
    });

    it("drives confidence and reliability asymptotically towards 1.0 over extended mission horizon", () => {
      let beta = createInitialReputation("candidate-beta-extended");
      for (let i = 0; i < 50; i++) {
        beta = updateReputation(beta, "success");
      }

      // After 50 successes: alpha = 51, beta = 1
      // reliability = 51 / 52 ~ 0.9808
      // confidence = 50 / (50 + 5) = 50 / 55 ~ 0.9091
      expect(beta.overallReliability).toBeGreaterThan(0.98);
      expect(beta.confidence).toBeGreaterThan(0.9);
      expect(beta.status).toBe("PREFERRED");

      for (let i = 0; i < 50; i++) {
        beta = updateReputation(beta, "success");
      }

      // After 100 successes: alpha = 101, beta = 1
      // reliability = 101 / 102 ~ 0.9902
      // confidence = 100 / 105 ~ 0.9524
      expect(beta.overallReliability).toBeGreaterThan(0.99);
      expect(beta.confidence).toBeGreaterThan(0.95);
      expect(beta.status).toBe("PREFERRED");
      expect(checkVeto(beta).allowed).toBe(true);
    });
  });

  describe("Candidate Gamma: Time Decay & Inactivity Dynamics", () => {
    it("after high initial reputation, inactivity across time steps with decay lambda in [0.90, 0.98] regresses excess evidence smoothly toward neutral prior", () => {
      // Build high initial reputation for Candidate Gamma (10 successes)
      let gamma = createInitialReputation("candidate-gamma");
      for (let i = 0; i < 10; i++) {
        gamma = updateReputation(gamma, "success");
      }
      expect(gamma.alpha).toBe(11);
      expect(gamma.beta).toBe(1);
      expect(gamma.overallReliability).toBeCloseTo(11 / 12, 4); // ~0.9167
      expect(gamma.confidence).toBeCloseTo(10 / 15, 4); // ~0.6667
      expect(gamma.status).toBe("PREFERRED");

      // Test time decay with lambda = 0.95 across 1, 5, 10, 25, 50, 100 time steps
      const steps = [1, 5, 10, 25, 50, 100];
      let prevAlpha = gamma.alpha;
      let prevReliability = gamma.overallReliability;
      let prevConfidence = gamma.confidence;

      for (const t of steps) {
        const decayed = applyTimeDecay(gamma, t, 0.95);

        // Alpha strictly decreases toward prior (1.0)
        expect(decayed.alpha).toBeLessThan(prevAlpha);
        expect(decayed.alpha).toBeGreaterThanOrEqual(ALPHA_0);

        // Beta is unchanged from prior (1.0)
        expect(decayed.beta).toBe(BETA_0);

        // Reliability strictly decreases toward neutral baseline 0.50
        expect(decayed.overallReliability).toBeLessThan(prevReliability);
        expect(decayed.overallReliability).toBeGreaterThanOrEqual(0.5);

        // Confidence strictly decreases toward 0.0
        expect(decayed.confidence).toBeLessThan(prevConfidence);
        expect(decayed.confidence).toBeGreaterThanOrEqual(0.0);

        // Mathematical verification: alpha' = 1.0 + 10.0 * (0.95 ** t)
        const expectedAlpha = 1.0 + 10.0 * Math.pow(0.95, t);
        expect(decayed.alpha).toBeCloseTo(expectedAlpha, 5);

        prevAlpha = decayed.alpha;
        prevReliability = decayed.overallReliability;
        prevConfidence = decayed.confidence;
      }
    });

    it("strictly preserves valid Beta parameters (alpha, beta >= 1.0) even under extreme inactivity", () => {
      let gamma = createInitialReputation("candidate-gamma-floor");
      for (let i = 0; i < 5; i++) {
        gamma = updateReputation(gamma, "success");
      }
      gamma = updateReputation(gamma, "failure");

      // Apply 500 time steps of decay
      const heavilyDecayed = applyTimeDecay(gamma, 500, 0.90);

      expect(heavilyDecayed.alpha).toBeGreaterThanOrEqual(1.0);
      expect(heavilyDecayed.beta).toBeGreaterThanOrEqual(1.0);
      expect(heavilyDecayed.alpha).toBeCloseTo(1.0, 4);
      expect(heavilyDecayed.beta).toBeCloseTo(1.0, 4);
      expect(heavilyDecayed.overallReliability).toBeCloseTo(0.5, 3);
      expect(heavilyDecayed.confidence).toBeCloseTo(0.0, 3);
    });

    it("observes decay rate ordering across lambda in [0.90, 0.98]", () => {
      let base = createInitialReputation("gamma-rate-check");
      for (let i = 0; i < 10; i++) {
        base = updateReputation(base, "success");
      }

      const t = 10;
      const decay90 = applyTimeDecay(base, t, 0.90); // 0.90^10 ~ 0.3487
      const decay95 = applyTimeDecay(base, t, 0.95); // 0.95^10 ~ 0.5987
      const decay98 = applyTimeDecay(base, t, 0.98); // 0.98^10 ~ 0.8171

      // Fast decay (0.90) sheds excess evidence faster than medium (0.95) and slow (0.98)
      expect(decay90.alpha).toBeLessThan(decay95.alpha);
      expect(decay95.alpha).toBeLessThan(decay98.alpha);

      expect(decay90.overallReliability).toBeLessThan(decay95.overallReliability);
      expect(decay95.overallReliability).toBeLessThan(decay98.overallReliability);

      expect(decay90.confidence).toBeLessThan(decay95.confidence);
      expect(decay95.confidence).toBeLessThan(decay98.confidence);

      // All satisfy >= 1.0 constraint
      expect(decay90.alpha).toBeGreaterThan(1.0);
      expect(decay95.alpha).toBeGreaterThan(1.0);
      expect(decay98.alpha).toBeGreaterThan(1.0);
    });

    it("smoothly incorporates new evidence when decayed candidate is reactivated", () => {
      let gamma = createInitialReputation("gamma-reactivated");
      for (let i = 0; i < 10; i++) {
        gamma = updateReputation(gamma, "success");
      }

      // Decay over 15 time steps with lambda = 0.95
      // alphaExcess = 10 * (0.95^15) = 10 * 0.46329 ~ 4.6329 => alpha = 5.6329
      const decayed = applyTimeDecay(gamma, 15, 0.95);
      expect(decayed.alpha).toBeCloseTo(1.0 + 10 * Math.pow(0.95, 15), 4);

      // Reactivation with a new successful mission
      const reactivated = updateReputation(decayed, "success");
      expect(reactivated.alpha).toBeCloseTo(decayed.alpha + 1.0, 4);
      expect(reactivated.beta).toBe(decayed.beta);
      expect(reactivated.totalMissions).toBe(decayed.totalMissions + 1);
      expect(reactivated.overallReliability).toBeGreaterThan(decayed.overallReliability);
      expect(reactivated.confidence).toBeGreaterThan(decayed.confidence);
    });

    it("integrates time decay seamlessly via decayTimeSteps option in updateReputation", () => {
      let gamma = createInitialReputation("gamma-integrated-decay");
      gamma = updateReputation(gamma, "success"); // alpha=2, beta=1

      // 2nd update specifies 4 decay time steps with lambda 0.95 before observing success
      // excess alpha before update was 1.0; after 4 steps: 1.0 * (0.95^4) = 0.81450625
      // new alpha = 1.0 + 0.81450625 + 1.0 = 2.81450625
      const updated = updateReputation(gamma, "success", {
        decayTimeSteps: 4,
        config: { decayLambda: 0.95 },
      });

      expect(updated.alpha).toBeCloseTo(2.8145, 4);
      expect(updated.beta).toBe(1.0);
      expect(updated.totalMissions).toBe(2);
    });
  });

  describe("Multi-Candidate Cohort & Intermittent Flaky Candidate", () => {
    it("simulates flaky candidate alternating success and failure to verify recovery prevents premature BLOCKED state", () => {
      let flaky = createInitialReputation("candidate-flaky");
      flaky = updateReputation(flaky, "success"); // -> KNOWN
      expect(flaky.status).toBe("KNOWN");

      // Loop: Failure -> WATCH (fail 1) -> Success -> recovers to KNOWN (fail 0) -> Failure -> WATCH (fail 1)
      for (let round = 1; round <= 3; round++) {
        flaky = updateReputation(flaky, "failure");
        expect(flaky.status).toBe("WATCH");
        expect(flaky.consecutiveFailures).toBe(1);
        expect(checkVeto(flaky).allowed).toBe(true);

        flaky = updateReputation(flaky, "success");
        // Consecutive failures reset to 0; reliability allows recovery
        expect(flaky.consecutiveFailures).toBe(0);
        expect(checkVeto(flaky).allowed).toBe(true);
      }

      // But if 2 failures occur consecutively, candidate is immediately BLOCKED
      flaky = updateReputation(flaky, "failure");
      expect(flaky.status).toBe("WATCH");
      expect(flaky.consecutiveFailures).toBe(1);

      flaky = updateReputation(flaky, "failure");
      expect(flaky.status).toBe("BLOCKED");
      expect(flaky.consecutiveFailures).toBe(2);
      expect(checkVeto(flaky).allowed).toBe(false);
    });

    it("ranks candidates in a cohort strictly respecting Hard Veto and Bayesian reputation scores", () => {
      // Create a cohort of 4 candidates in various states:
      // 1. Alpha: BLOCKED (2 consecutive failures)
      let alpha = createInitialReputation("candidate-alpha");
      alpha = updateReputation(alpha, "failure");
      alpha = updateReputation(alpha, "failure");

      // 2. Beta: PREFERRED (6 consecutive successes)
      let beta = createInitialReputation("candidate-beta");
      for (let i = 0; i < 6; i++) {
        beta = updateReputation(beta, "success");
      }

      // 3. Gamma: KNOWN with moderate history (3 successes, 1 failure)
      let gamma = createInitialReputation("candidate-gamma");
      gamma = updateReputation(gamma, "success");
      gamma = updateReputation(gamma, "success");
      gamma = updateReputation(gamma, "failure");
      gamma = updateReputation(gamma, "success");

      // 4. Delta: Fresh unobserved NEW candidate
      const delta = createInitialReputation("candidate-delta");

      const cohort = [alpha, beta, gamma, delta];

      // Step 1: Veto filtering
      const eligible = cohort.filter((c) => checkVeto(c).allowed);
      expect(eligible).toHaveLength(3);
      expect(eligible.some((c) => c.candidateId === "candidate-alpha")).toBe(false);

      // Step 2: Ranking by composite expected value: overallReliability * confidence
      const score = (c: CandidateReputation) => c.overallReliability * c.confidence;
      const ranked = [...eligible].sort((a, b) => score(b) - score(a));

      expect(ranked[0]?.candidateId).toBe("candidate-beta"); // Top ranked PREFERRED
      expect(ranked[1]?.candidateId).toBe("candidate-gamma"); // Second KNOWN
      expect(ranked[2]?.candidateId).toBe("candidate-delta"); // Third unobserved NEW
    });
  });

  describe("End-to-End Pipeline Integration Demonstration", () => {
    it("demonstrates complete successful mission cycle: Selection -> CLI Run -> Verifier Agent -> Reputation Update -> Sibyl Write-back", async () => {
      // 1. Candidate Selection
      let candidateBeta = createInitialReputation("agent-beta");
      // Pre-warm Beta to KNOWN
      candidateBeta = updateReputation(candidateBeta, "success");
      expect(candidateBeta.status).toBe("KNOWN");

      const veto = checkVeto(candidateBeta);
      expect(veto.allowed).toBe(true);

      // 2. CLI Runner Execution (using deterministic mock executor)
      const mockWorktreePath = "/mock/worktrees/mission-run-001";
      const executedCommands: Array<{ command: string; args: string[]; cwd?: string }> = [];

      const mockExecutor: CommandExecutor = async (command, args, options) => {
        executedCommands.push({ command, args, cwd: options?.cwd });

        // AI CLI Execution (Claude Code)
        if (command === "claude") {
          return {
            exitCode: 0,
            stdout: "Claude Code: Refactored cache store and added integration test.",
            stderr: "",
            timedOut: false,
          };
        }

        // Verifier Agent inspecting git diff
        if (command === "git" && args[0] === "diff") {
          return {
            exitCode: 0,
            stdout: "diff --git a/cache.ts b/cache.ts\n+export class RedisCacheStore {}",
            stderr: "",
            timedOut: false,
          };
        }

        // Verifier Agent running deterministic test suite
        if (command === "pnpm" && args[0] === "test") {
          return {
            exitCode: 0,
            stdout: "PASS src/cache.test.ts (6 tests passed)",
            stderr: "",
            timedOut: false,
          };
        }

        throw new Error(`Unexpected command in test mock: ${command} ${args.join(" ")}`);
      };

      const cliResult = await runCli({
        prompt: "Refactor cache store to use Redis backend",
        worktreePath: mockWorktreePath,
        executor: mockExecutor,
      });

      expect(cliResult.success).toBe(true);
      expect(cliResult.cliUsed).toBe("claude");
      expect(cliResult.exitCode).toBe(0);
      expect(cliResult.stdout).toContain("Refactored cache store");

      // 3. Verifier Agent Inspection
      const verifier = new VerifierAgent({
        executor: mockExecutor,
        testCommand: "pnpm test",
      });

      const evaluation = await verifier.verify({
        worktreePath: mockWorktreePath,
      });

      expect(evaluation.tests_passed).toBe(true);
      expect(evaluation.score).toBe(1.0);
      expect(evaluation.summary).toContain("Tests passed successfully and changes verified.");
      expect(evaluation.diff).toContain("+export class RedisCacheStore {}");
      expect(evaluation.failure_reason).toBeUndefined();

      // 4. Reputation FSM Update
      const outcome = evaluation.tests_passed ? "success" : "failure";
      const preUpdateAlpha = candidateBeta.alpha;
      const updatedBeta = updateReputation(candidateBeta, outcome);

      expect(updatedBeta.alpha).toBe(preUpdateAlpha + 1.0);
      expect(updatedBeta.consecutiveFailures).toBe(0);
      expect(updatedBeta.overallReliability).toBeGreaterThan(candidateBeta.overallReliability);
      expect(updatedBeta.confidence).toBeGreaterThan(candidateBeta.confidence);

      // 5. Sibyl Episode Write-Back Formatting
      const runId = "run-20260907-001";
      const taskType = "refactor_cache";
      const timestamp = "2026-09-07T12:30:00.000Z";

      const episode: SibylEpisode = formatEpisodeForSibyl(
        runId,
        taskType,
        outcome,
        evaluation.summary,
        timestamp,
      );

      // Verify Sibyl episode schema matches { run, taskType, outcome, note, occurredAt }
      expect(episode).toEqual({
        run: "run-20260907-001",
        taskType: "refactor_cache",
        outcome: "accepted",
        note: "Tests passed successfully and changes verified.",
        occurredAt: "2026-09-07T12:30:00.000Z",
      });

      // Verify full Sibyl counterparty serialization
      const counterparty: SibylCounterparty = formatForSibyl(updatedBeta, {
        displayName: "Beta Agent (Production)",
        taskFit: 0.92,
        observedPriceUsdc: "15.00",
        episodes: [episode],
      });

      expect(counterparty.counterpartyKey).toBe("agent-beta");
      expect(counterparty.displayName).toBe("Beta Agent (Production)");
      expect(counterparty.hasProfile).toBe(true);
      expect(counterparty.isFixture).toBe(false);
      expect(counterparty.relationshipStatus).toBe(updatedBeta.status);
      expect(counterparty.overallReliability).toBe(updatedBeta.overallReliability);
      expect(counterparty.confidence).toBe(updatedBeta.confidence);
      expect(counterparty.taskFit).toBe(0.92);
      expect(counterparty.observedPriceUsdc).toBe("15.00");
      expect(counterparty.riskNote).toBeNull();
      expect(counterparty.episodes).toHaveLength(1);
      expect(counterparty.episodes[0]).toEqual(episode);
    });

    it("demonstrates complete failing mission cycle: Selection -> CLI Run -> Verifier Failure -> Reputation Demotion -> Sibyl Rejected Episode", async () => {
      // 1. Candidate Selection
      let candidateAlpha = createInitialReputation("agent-alpha");
      expect(candidateAlpha.status).toBe("NEW");

      // 2. CLI Runner Execution
      const mockWorktreePath = "/mock/worktrees/mission-run-002";

      const mockExecutor: CommandExecutor = async (command, args) => {
        if (command === "claude") {
          return {
            exitCode: 0,
            stdout: "Claude: Created buggy implementation.",
            stderr: "",
            timedOut: false,
          };
        }
        if (command === "git" && args[0] === "diff") {
          return {
            exitCode: 0,
            stdout: "diff --git a/buggy.ts b/buggy.ts\n+throw new Error('Unimplemented');",
            stderr: "",
            timedOut: false,
          };
        }
        if (command === "pnpm" && args[0] === "test") {
          return {
            exitCode: 1,
            stdout: "FAIL src/buggy.test.ts",
            stderr: "Error: Unimplemented at buggy.ts:2",
            timedOut: false,
          };
        }
        throw new Error(`Unexpected command: ${command}`);
      };

      const cliResult = await runCli({
        prompt: "Implement experimental algorithm",
        worktreePath: mockWorktreePath,
        executor: mockExecutor,
      });
      expect(cliResult.success).toBe(true);

      // 3. Verifier Agent Inspection
      const evaluation = await verifyWorktree({
        worktreePath: mockWorktreePath,
        executor: mockExecutor,
      });

      expect(evaluation.tests_passed).toBe(false);
      expect(evaluation.score).toBe(0.0);
      expect(evaluation.failure_reason).toContain("Error: Unimplemented");

      // 4. Reputation FSM Update
      const outcome = evaluation.tests_passed ? "success" : "failure";
      candidateAlpha = updateReputation(candidateAlpha, outcome);

      expect(candidateAlpha.status).toBe("WATCH");
      expect(candidateAlpha.consecutiveFailures).toBe(1);

      // 5. Sibyl Episode Write-Back Formatting
      const episode = formatEpisodeForSibyl(
        "run-fail-002",
        "experimental_algo",
        outcome,
        evaluation.failure_reason ?? "Verification failed",
        "2026-09-07T12:35:00.000Z",
      );

      expect(episode).toEqual({
        run: "run-fail-002",
        taskType: "experimental_algo",
        outcome: "rejected",
        note: expect.stringContaining("Error: Unimplemented"),
        occurredAt: "2026-09-07T12:35:00.000Z",
      });

      // Repeat second failure -> transitions to BLOCKED
      candidateAlpha = updateReputation(candidateAlpha, "failure");
      expect(candidateAlpha.status).toBe("BLOCKED");

      const blockedEpisode = formatEpisodeForSibyl(
        "run-fail-003",
        "experimental_algo",
        "failure",
        candidateAlpha.blockedReason ?? "Repeated failure",
      );
      expect(blockedEpisode.outcome).toBe("rejected");

      const blockedCounterparty = formatForSibyl(candidateAlpha, {
        episodes: [episode, blockedEpisode],
      });
      expect(blockedCounterparty.relationshipStatus).toBe("BLOCKED");
      expect(blockedCounterparty.riskNote).toContain("2 consecutive failures in WATCH state");
      expect(blockedCounterparty.episodes).toHaveLength(2);

      // Subsequent veto blocks candidate from future selection
      const nextSelectionVeto = checkVeto(candidateAlpha);
      expect(nextSelectionVeto.allowed).toBe(false);
    });

    it("demonstrates end-to-end Git worktree session lifecycle integration with mock executor", async () => {
      const gitOperations: Array<{ args: string[]; cwd?: string }> = [];

      const mockExecutor: CommandExecutor = async (command, args, options) => {
        if (command === "git") {
          gitOperations.push({ args, cwd: options?.cwd });
          if (args[0] === "worktree") {
            return { exitCode: 0, stdout: "", stderr: "", timedOut: false };
          }
          if (args[0] === "diff") {
            return {
              exitCode: 0,
              stdout: "diff --git a/index.ts b/index.ts\n+// completed",
              stderr: "",
              timedOut: false,
            };
          }
        }
        if (command === "claude") {
          return { exitCode: 0, stdout: "Completed task", stderr: "", timedOut: false };
        }
        if (command === "pnpm") {
          return { exitCode: 0, stdout: "Passed all tests", stderr: "", timedOut: false };
        }
        throw new Error(`Unexpected command: ${command}`);
      };

      const runId = "session-e2e-001";
      const session = await createWorktreeSession(runId, {
        repoRoot: "/mock/repo",
        executor: mockExecutor,
      });

      expect(session.worktreePath).toContain(".worktrees/mission-session-e2e-001");

      const missionResult = await session.execute(async (worktreePath) => {
        const runRes = await runCli({
          prompt: "Execute mission in session",
          worktreePath,
          executor: mockExecutor,
        });

        const verRes = await verifyWorktree({
          worktreePath,
          executor: mockExecutor,
        });

        return { runRes, verRes };
      });

      expect(missionResult.runRes.success).toBe(true);
      expect(missionResult.verRes.tests_passed).toBe(true);

      // Cleanup worktree session
      await session.cleanup();

      // Verify Git worktree operations executed
      expect(gitOperations).toHaveLength(3);
      expect(gitOperations[0]?.args).toEqual([
        "worktree",
        "add",
        "--detach",
        ".worktrees/mission-session-e2e-001",
        "HEAD",
      ]);
      expect(gitOperations[1]?.args).toEqual(["diff", "HEAD"]);
      expect(gitOperations[2]?.args).toEqual([
        "worktree",
        "remove",
        "--force",
        ".worktrees/mission-session-e2e-001",
      ]);
    });

    it("demonstrates withWorktree automatic lifecycle management enclosing execution and verification", async () => {
      const gitOperations: Array<{ args: string[]; cwd?: string }> = [];

      const mockExecutor: CommandExecutor = async (command, args, options) => {
        if (command === "git") {
          gitOperations.push({ args, cwd: options?.cwd });
          if (args[0] === "worktree") {
            return { exitCode: 0, stdout: "", stderr: "", timedOut: false };
          }
          if (args[0] === "diff") {
            return {
              exitCode: 0,
              stdout: "diff --git a/pkg.ts b/pkg.ts\n+const version = 2;",
              stderr: "",
              timedOut: false,
            };
          }
        }
        if (command === "claude") {
          return { exitCode: 0, stdout: "CLI finished work", stderr: "", timedOut: false };
        }
        if (command === "pnpm") {
          return { exitCode: 0, stdout: "All tests green", stderr: "", timedOut: false };
        }
        throw new Error(`Unexpected command: ${command}`);
      };

      const runId = "with-worktree-001";
      const result = await withWorktree(
        runId,
        { repoRoot: "/mock/repo", executor: mockExecutor },
        async (worktreePath) => {
          const runRes = await runCli({
            prompt: "Update package",
            worktreePath,
            executor: mockExecutor,
          });
          const verRes = await verifyWorktree({
            worktreePath,
            executor: mockExecutor,
          });
          return { runRes, verRes };
        },
      );

      expect(result.runRes.success).toBe(true);
      expect(result.verRes.tests_passed).toBe(true);

      // Verify withWorktree added and cleanly removed worktree with --force
      expect(gitOperations).toHaveLength(3);
      expect(gitOperations[0]?.args).toEqual([
        "worktree",
        "add",
        "--detach",
        ".worktrees/mission-with-worktree-001",
        "HEAD",
      ]);
      expect(gitOperations[1]?.args).toEqual(["diff", "HEAD"]);
      expect(gitOperations[2]?.args).toEqual([
        "worktree",
        "remove",
        "--force",
        ".worktrees/mission-with-worktree-001",
      ]);
    });
  });
});

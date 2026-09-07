import { describe, it, expect } from "vitest";

import {
  createInitialReputation,
  updateReputation,
  applyTimeDecay,
  checkVeto,
  manualUnblock,
  calculateReliability,
  calculateConfidence,
  formatEpisodeForSibyl,
  formatForSibyl,
  ALPHA_0,
  BETA_0,
} from "./reputation-fsm.js";
import type {
  CandidateReputation,
  RelationshipStatus,
  VetoCheckResult,
} from "./reputation-fsm.js";

import {
  runCli,
  withWorktree,
  createWorktreeSession,
} from "./cli-runner.js";
import type {
  CliRunnerOptions,
  CliRunResult,
  CommandExecutor,
  WorktreeOptions,
} from "./cli-runner.js";

import {
  verifyWorktree,
} from "./verifier-agent.js";
import type {
  VerifierOptions,
  VerifierEvaluation,
} from "./verifier-agent.js";

import type { SibylCounterparty, SibylEpisode } from "./sibyl.js";

describe("Reputation & Execution Harness E2E Test Suite", () => {
  // =========================================================================
  // TIER 1: FEATURE COVERAGE
  // =========================================================================
  describe("Tier 1: Feature Coverage", () => {
    it("T1.1: Beta-Binomial Prior & Update initialization and step updates", () => {
      // 1. Initial unobserved candidate
      const rep0 = createInitialReputation("candidate-alpha");
      expect(rep0.candidateId).toBe("candidate-alpha");
      expect(rep0.alpha).toBe(ALPHA_0);
      expect(rep0.beta).toBe(BETA_0);
      expect(rep0.overallReliability).toBe(0.5);
      expect(rep0.confidence).toBe(0.0);
      expect(rep0.confidence).toBeLessThan(0.1);
      expect(rep0.status).toBe("NEW");
      expect(rep0.consecutiveFailures).toBe(0);
      expect(rep0.totalMissions).toBe(0);

      // 2. First success update
      const rep1 = updateReputation(rep0, "success");
      expect(rep1.alpha).toBe(2.0);
      expect(rep1.beta).toBe(1.0);
      expect(rep1.overallReliability).toBeCloseTo(2.0 / 3.0, 5);
      expect(rep1.confidence).toBeGreaterThan(0.0);
      expect(rep1.status).toBe("KNOWN");
      expect(rep1.consecutiveFailures).toBe(0);
      expect(rep1.totalMissions).toBe(1);

      // 3. First failure update from initial
      const repFail = updateReputation(rep0, "failure");
      expect(repFail.alpha).toBe(1.0);
      expect(repFail.beta).toBe(2.0);
      expect(repFail.overallReliability).toBeCloseTo(1.0 / 3.0, 5);
      expect(repFail.status).toBe("WATCH");
      expect(repFail.consecutiveFailures).toBe(1);
      expect(repFail.totalMissions).toBe(1);
    });

    it("T1.2: Time Decay (lambda in [0.90, 0.98]) regresses evidence toward prior baseline", () => {
      // Candidate with accumulated evidence: 10 successes, 0 failures (alpha=11, beta=1)
      const matureCandidate: CandidateReputation = {
        candidateId: "decay-target",
        alpha: 11.0,
        beta: 1.0,
        overallReliability: 11.0 / 12.0,
        confidence: 10.0 / 15.0,
        status: "PREFERRED",
        consecutiveFailures: 0,
        totalMissions: 10,
        lastUpdatedAt: new Date().toISOString(),
      };

      const lambda = 0.95;
      const timeSteps = 10;
      const decayed = applyTimeDecay(matureCandidate, timeSteps, lambda);

      // Excess alpha is 10.0 -> decayed is 10.0 * (0.95^10) ~= 5.98737
      const expectedExcessAlpha = 10.0 * Math.pow(0.95, 10);
      expect(decayed.alpha).toBeCloseTo(1.0 + expectedExcessAlpha, 4);
      expect(decayed.beta).toBe(1.0); // beta was 1.0, excess was 0
      expect(decayed.alpha).toBeGreaterThanOrEqual(1.0);
      expect(decayed.beta).toBeGreaterThanOrEqual(1.0);

      // Overall reliability and confidence decreased toward neutral
      expect(decayed.overallReliability).toBeLessThan(matureCandidate.overallReliability);
      expect(decayed.confidence).toBeLessThan(matureCandidate.confidence);
    });

    it("T1.3: FSM State Transitions across full lifecycle", () => {
      // NEW -> KNOWN on success
      let candidate = createInitialReputation("fsm-lifecycle");
      expect(candidate.status).toBe("NEW");

      candidate = updateReputation(candidate, "success");
      expect(candidate.status).toBe("KNOWN");

      // Multiple successes promote KNOWN -> PREFERRED once thresholds (reliability >= 0.80, confidence >= 0.50) are met
      // With K=5.0, confidence >= 0.50 requires N_eff >= 5
      for (let i = 0; i < 5; i++) {
        candidate = updateReputation(candidate, "success");
      }
      expect(candidate.overallReliability).toBeGreaterThanOrEqual(0.8);
      expect(candidate.confidence).toBeGreaterThanOrEqual(0.5);
      expect(candidate.status).toBe("PREFERRED");

      // Failure while PREFERRED demotes to WATCH with consecutiveFailures = 1
      candidate = updateReputation(candidate, "failure");
      expect(candidate.status).toBe("WATCH");
      expect(candidate.consecutiveFailures).toBe(1);

      // Success while in WATCH resets consecutiveFailures to 0 and recovers status to KNOWN or PREFERRED
      candidate = updateReputation(candidate, "success");
      expect(candidate.consecutiveFailures).toBe(0);
      expect(["KNOWN", "PREFERRED"]).toContain(candidate.status);
    });

    it("T1.4: WATCH to BLOCKED Trigger immediately on 2 consecutive failures", () => {
      let candidate = createInitialReputation("watch-to-block");
      candidate = updateReputation(candidate, "success"); // KNOWN

      // Demote to WATCH on 1st failure
      candidate = updateReputation(candidate, "failure");
      expect(candidate.status).toBe("WATCH");
      expect(candidate.consecutiveFailures).toBe(1);

      // 2nd consecutive failure in WATCH triggers immediate transition to BLOCKED
      candidate = updateReputation(candidate, "failure");
      expect(candidate.status).toBe("BLOCKED");
      expect(candidate.consecutiveFailures).toBe(2);
      expect(candidate.blockedReason).toBeDefined();
      expect(candidate.blockedReason).toContain("2 consecutive failures in WATCH state");
    });

    it("T1.5: Hard Veto Invariant: BLOCKED excludes from ranking, blocks auto-promotion, requires manual unblock", () => {
      let candidate = createInitialReputation("veto-candidate");
      candidate = updateReputation(candidate, "failure"); // WATCH (failures=1)
      candidate = updateReputation(candidate, "failure"); // BLOCKED (failures=2)
      expect(candidate.status).toBe("BLOCKED");

      // 1. checkVeto returns false with explicit reason
      const vetoCheck: VetoCheckResult = checkVeto(candidate);
      expect(vetoCheck.allowed).toBe(false);
      expect(vetoCheck.reason).toContain("BLOCKED");

      // 2. Positive evaluation updates do NOT auto-promote
      const updated = updateReputation(candidate, "success");
      expect(updated.status).toBe("BLOCKED");
      expect(checkVeto(updated).allowed).toBe(false);

      // 3. Manual unblock restores candidate with operator audit metadata
      const operatorId = "op-admin-42";
      const unblockReason = "Root cause analyzed; candidate retry permitted under supervision";
      const unblocked = manualUnblock(candidate, operatorId, unblockReason, "WATCH");

      expect(unblocked.status).toBe("WATCH");
      expect(unblocked.consecutiveFailures).toBe(0);
      expect(unblocked.unblockedBy).toBe(operatorId);
      expect(unblocked.unblockedAt).toBeDefined();
      expect(unblocked.blockedReason).toBeUndefined();
      expect(checkVeto(unblocked).allowed).toBe(true);
    });

    it("T1.6: CLI Runner headless spawning with Claude Code and fallback to Gemini CLI", async () => {
      const executedCommands: string[] = [];

      // Mock executor where Claude fails (non-zero exit) and Gemini succeeds
      const mockExecutor: CommandExecutor = async (command: string, args: string[]) => {
        executedCommands.push(command);
        if (command === "claude") {
          expect(args).toContain("-p");
          expect(args).toContain("--dangerously-skip-permissions");
          return {
            exitCode: 1,
            stdout: "",
            stderr: "Claude process failed with error code 1",
            timedOut: false,
          };
        }
        if (command === "gemini") {
          expect(args).toContain("-p");
          return {
            exitCode: 0,
            stdout: "Gemini CLI execution succeeded",
            stderr: "",
            timedOut: false,
          };
        }
        return { exitCode: 0, stdout: "", stderr: "", timedOut: false };
      };

      const runnerOptions: CliRunnerOptions = {
        prompt: "Fix reputation decay edge case",
        worktreePath: "/tmp/mock-worktree",
        executor: mockExecutor,
      };

      const result: CliRunResult = await runCli(runnerOptions);
      expect(result.success).toBe(true);
      expect(result.cliUsed).toBe("gemini");
      expect(result.stdout).toContain("Gemini CLI execution succeeded");
      expect(executedCommands).toEqual(["claude", "gemini"]);
    });

    it("T1.7: Worktree lifecycle guarantees detached creation and forced removal", async () => {
      const gitCalls: Array<{ action: string; args: string[] }> = [];

      const mockExecutor: CommandExecutor = async (command: string, args: string[]) => {
        if (command === "git") {
          const action = args[1] ?? "";
          gitCalls.push({ action, args });
          return { exitCode: 0, stdout: "", stderr: "", timedOut: false };
        }
        return { exitCode: 0, stdout: "", stderr: "", timedOut: false };
      };

      const worktreeOptions: WorktreeOptions = {
        repoRoot: "/test-repo",
        executor: mockExecutor,
      };

      let executedInWorktree = false;
      await withWorktree(
        "run-101",
        async (worktreePath: string) => {
          executedInWorktree = true;
          expect(worktreePath).toContain("mission-run-101");
        },
        worktreeOptions,
      );

      expect(executedInWorktree).toBe(true);
      // Verify git worktree add with --detach was called
      const addCall = gitCalls.find((c) => c.args.includes("add") && c.args.includes("--detach"));
      expect(addCall).toBeDefined();

      // Verify git worktree remove with --force was called
      const removeCall = gitCalls.find(
        (c) => c.args.includes("remove") && c.args.includes("--force"),
      );
      expect(removeCall).toBeDefined();
    });

    it("T1.8: Verifier Agent test execution and structured report parsing", async () => {
      const mockExecutor: CommandExecutor = async (command: string, args: string[]) => {
        if (command === "git" && args[0] === "diff") {
          return {
            exitCode: 0,
            stdout: "diff --git a/services/reputation.ts b/services/reputation.ts\n+added fix",
            stderr: "",
            timedOut: false,
          };
        }
        if (command === "pnpm" && args.includes("test")) {
          return {
            exitCode: 0,
            stdout: "All 12 tests passed",
            stderr: "",
            timedOut: false,
          };
        }
        return { exitCode: 0, stdout: "", stderr: "", timedOut: false };
      };

      const verifierOptions: VerifierOptions = {
        worktreePath: "/tmp/mock-worktree-verifier",
        testCommand: "pnpm test",
        executor: mockExecutor,
      };

      const evaluation: VerifierEvaluation = await verifyWorktree(verifierOptions);
      expect(evaluation.score).toBe(1.0);
      expect(evaluation.tests_passed).toBe(true);
      expect(evaluation.summary).toContain("Tests passed successfully");
      expect(evaluation.diff).toContain("added fix");
      expect(evaluation.failure_reason).toBeUndefined();
    });

    it("T1.9: Multi-turn reputation simulation loop", () => {
      let candidate = createInitialReputation("sim-candidate");
      const outcomes: Array<"success" | "failure"> = [
        "success",
        "success",
        "failure",
        "success",
        "success",
      ];

      for (const outcome of outcomes) {
        candidate = updateReputation(candidate, outcome);
      }

      expect(candidate.totalMissions).toBe(5);
      expect(candidate.alpha).toBe(1.0 + 4); // 4 successes
      expect(candidate.beta).toBe(1.0 + 1); // 1 failure
      expect(candidate.consecutiveFailures).toBe(0);
      expect(candidate.overallReliability).toBeCloseTo(5.0 / 7.0, 4);
    });

    it("T1.10: Sibyl Write-back formatting adherence", () => {
      let candidate = createInitialReputation("agent-virtuals-99");
      candidate = updateReputation(candidate, "success");

      const episode: SibylEpisode = formatEpisodeForSibyl(
        "run-xyz-123",
        "benchmark_eval",
        "success",
        "Passed all unit and regression tests",
        "2026-09-07T12:00:00Z",
      );

      expect(episode.run).toBe("run-xyz-123");
      expect(episode.taskType).toBe("benchmark_eval");
      expect(episode.outcome).toBe("accepted");
      expect(episode.note).toContain("Passed all unit");
      expect(episode.occurredAt).toBe("2026-09-07T12:00:00Z");

      const counterparty: SibylCounterparty = formatForSibyl(candidate, {
        displayName: "Virtuals Agent Alpha",
        observedPriceUsdc: "15.50",
        taskFit: 0.85,
        episodes: [episode],
      });

      expect(counterparty.counterpartyKey).toBe("agent-virtuals-99");
      expect(counterparty.displayName).toBe("Virtuals Agent Alpha");
      expect(counterparty.hasProfile).toBe(true);
      expect(counterparty.relationshipStatus).toBe("KNOWN");
      expect(counterparty.overallReliability).toBe(candidate.overallReliability);
      expect(counterparty.confidence).toBe(candidate.confidence);
      expect(counterparty.observedPriceUsdc).toBe("15.50");
      expect(counterparty.taskFit).toBe(0.85);
      expect(counterparty.episodes).toHaveLength(1);
      expect(counterparty.episodes[0]?.run).toBe("run-xyz-123");
    });
  });

  // =========================================================================
  // TIER 2: BOUNDARY & CORNER CASES
  // =========================================================================
  describe("Tier 2: Boundary & Corner Cases", () => {
    it("T2.1: 0 samples / unobserved candidate starts with exact neutral values", () => {
      const rep = createInitialReputation("unobserved-01");
      expect(rep.alpha).toBe(1.0);
      expect(rep.beta).toBe(1.0);
      expect(rep.overallReliability).toBe(0.5);
      expect(rep.confidence).toBe(0.0);
      expect(rep.totalMissions).toBe(0);
      expect(rep.consecutiveFailures).toBe(0);
      expect(rep.status).toBe("NEW");
    });

    it("T2.2: 100% failure extreme sequence", () => {
      let rep = createInitialReputation("all-fail");
      for (let i = 0; i < 20; i++) {
        rep = updateReputation(rep, "failure");
      }
      // After 2 consecutive failures, it became BLOCKED and locked further updates
      expect(rep.status).toBe("BLOCKED");
      expect(rep.consecutiveFailures).toBe(2);
      expect(checkVeto(rep).allowed).toBe(false);
    });

    it("T2.3: 100% success extreme sequence approaches upper bounds", () => {
      let rep = createInitialReputation("all-success");
      for (let i = 0; i < 50; i++) {
        rep = updateReputation(rep, "success");
      }
      // alpha = 51, beta = 1
      expect(rep.alpha).toBe(51.0);
      expect(rep.beta).toBe(1.0);
      expect(rep.overallReliability).toBeCloseTo(51.0 / 52.0, 4); // > 0.98
      expect(rep.confidence).toBeCloseTo(50.0 / 55.0, 4); // > 0.90
      expect(rep.status).toBe("PREFERRED");
      expect(rep.consecutiveFailures).toBe(0);
    });

    it("T2.4: Infinite time decay asymptote regresses to neutral baseline", () => {
      const mature: CandidateReputation = {
        candidateId: "infinite-decay",
        alpha: 100.0,
        beta: 10.0,
        overallReliability: 100.0 / 110.0,
        confidence: 107.0 / 112.0,
        status: "PREFERRED",
        consecutiveFailures: 0,
        totalMissions: 100,
        lastUpdatedAt: new Date().toISOString(),
      };

      // Apply decay over 1,000 steps with lambda=0.95 (0.95^1000 ~ 0)
      const decayed = applyTimeDecay(mature, 1000, 0.95);
      expect(decayed.alpha).toBeCloseTo(1.0, 5);
      expect(decayed.beta).toBeCloseTo(1.0, 5);
      expect(decayed.overallReliability).toBeCloseTo(0.5, 5);
      expect(decayed.confidence).toBeCloseTo(0.0, 5);
    });

    it("T2.5: Zero time steps decay returns identical state", () => {
      const rep = createInitialReputation("zero-decay");
      const decayed = applyTimeDecay(rep, 0, 0.95);
      expect(decayed.alpha).toBe(rep.alpha);
      expect(decayed.beta).toBe(rep.beta);
      expect(decayed.overallReliability).toBe(rep.overallReliability);
      expect(decayed.confidence).toBe(rep.confidence);
    });

    it("T2.6: Timeout limits terminate runaway CLI execution", async () => {
      const mockExecutor: CommandExecutor = async () => {
        return {
          exitCode: null,
          stdout: "Partial progress before timeout",
          stderr: "",
          timedOut: true,
          error: new Error("Command timed out after 500ms"),
        };
      };

      const result = await runCli({
        prompt: "Run infinite task",
        worktreePath: "/tmp/mock-timeout",
        timeoutMs: 500,
        executor: mockExecutor,
      });

      expect(result.success).toBe(false);
      expect(result.timedOut).toBe(true);
      expect(result.error).toContain("timed out");
    });

    it("T2.7: Verifier Agent empty diff handling", async () => {
      const mockExecutor: CommandExecutor = async (command: string, args: string[]) => {
        if (command === "git" && args[0] === "diff") {
          return { exitCode: 0, stdout: "", stderr: "", timedOut: false }; // No diff
        }
        if (command === "git" && args[0] === "status") {
          return { exitCode: 0, stdout: "", stderr: "", timedOut: false }; // Clean working tree
        }
        if (command === "pnpm") {
          return { exitCode: 0, stdout: "Tests passed", stderr: "", timedOut: false };
        }
        return { exitCode: 0, stdout: "", stderr: "", timedOut: false };
      };

      const evaluation = await verifyWorktree({
        worktreePath: "/tmp/mock-clean-tree",
        testCommand: "pnpm test",
        executor: mockExecutor,
      });

      expect(evaluation.score).toBe(0.0);
      expect(evaluation.tests_passed).toBe(false);
      expect(evaluation.summary).toContain("No modifications detected");
      expect(evaluation.failure_reason).toContain("No changes made");
    });

    it("T2.8: Parameter validation and negative assertions", () => {
      // Empty or invalid candidate ID
      expect(() => createInitialReputation("")).toThrow("candidateId must be a non-empty string");
      expect(() => createInitialReputation("   ")).toThrow("candidateId must be a non-empty string");

      // Invalid alpha or beta
      expect(() => calculateReliability(0, 1)).toThrow("strictly positive");
      expect(() => calculateReliability(-1, 2)).toThrow("strictly positive");

      // Invalid saturation constant K
      expect(() => calculateConfidence(1, 1, 0)).toThrow("strictly positive");
      expect(() => calculateConfidence(1, 1, -5)).toThrow("strictly positive");

      // Invalid decay lambda
      const rep = createInitialReputation("test-param");
      expect(() => applyTimeDecay(rep, 5, 0)).toThrow("Decay lambda must be in (0, 1]");
      expect(() => applyTimeDecay(rep, 5, 1.5)).toThrow("Decay lambda must be in (0, 1]");

      // Unblocking a non-BLOCKED candidate
      expect(() => manualUnblock(rep, "admin", "reason")).toThrow("Cannot unblock a candidate that is not BLOCKED");

      // Unblocking with missing operatorId or reason
      let blockedCandidate = updateReputation(rep, "failure");
      blockedCandidate = updateReputation(blockedCandidate, "failure"); // BLOCKED
      expect(() => manualUnblock(blockedCandidate, "", "valid reason")).toThrow("operatorId is required");
      expect(() => manualUnblock(blockedCandidate, "admin", "")).toThrow("reason is required");
      expect(() => manualUnblock(blockedCandidate, "admin", "reason", "BLOCKED")).toThrow("targetStatus cannot be BLOCKED");
    });
  });

  // =========================================================================
  // TIER 3: CROSS-FEATURE INTERACTIONS
  // =========================================================================
  describe("Tier 3: Cross-Feature Interactions", () => {
    it("T3.1: Decay reduces confidence and affects subsequent state promotion thresholds", () => {
      // Build candidate up to PREFERRED (alpha=7, beta=1, confidence=6/11 > 0.5)
      let candidate = createInitialReputation("decay-transition");
      for (let i = 0; i < 6; i++) {
        candidate = updateReputation(candidate, "success");
      }
      expect(candidate.status).toBe("PREFERRED");

      // Apply decay: excess alpha (6) decays by lambda^10 ~= 6 * 0.5987 = 3.59
      const decayed = applyTimeDecay(candidate, 10, 0.95);
      expect(decayed.confidence).toBeLessThan(0.5); // confidence drops below PREFERRED threshold

      // If updated with decayTimeSteps option in updateReputation:
      const updatedAfterIdle = updateReputation(candidate, "success", { decayTimeSteps: 10 });
      // The update adds 1 success to the decayed evidence
      expect(updatedAfterIdle.totalMissions).toBe(7);
      expect(updatedAfterIdle.alpha).toBeCloseTo(decayed.alpha + 1, 3);
    });

    it("T3.2: CLI Fallback + Worktree cleanup resilience during command errors", async () => {
      let cleanupCalled = false;
      const executedCommands: string[] = [];

      const mockExecutor: CommandExecutor = async (command: string, args: string[]) => {
        executedCommands.push(command);
        if (command === "git") {
          if (args.includes("remove")) {
            cleanupCalled = true;
          }
          return { exitCode: 0, stdout: "", stderr: "", timedOut: false };
        }
        if (command === "claude") {
          // Claude fails with non-zero exit code
          return { exitCode: 127, stdout: "", stderr: "command not found: claude", timedOut: false };
        }
        if (command === "gemini") {
          // Gemini CLI takes over and succeeds
          return { exitCode: 0, stdout: "Synthesized solution diff", stderr: "", timedOut: false };
        }
        return { exitCode: 0, stdout: "", stderr: "", timedOut: false };
      };

      const session = await createWorktreeSession("mission-fallback-clean", {
        executor: mockExecutor,
      });

      const cliResult = await session.execute(async (worktreePath) => {
        return runCli({
          prompt: "Produce fix",
          worktreePath,
          executor: mockExecutor,
        });
      });

      await session.cleanup();

      expect(cliResult.success).toBe(true);
      expect(cliResult.cliUsed).toBe("gemini");
      expect(cleanupCalled).toBe(true);
      expect(executedCommands).toContain("claude");
      expect(executedCommands).toContain("gemini");
      expect(executedCommands).toContain("git");
    });

    it("T3.3: Verifier failures drive candidate through FSM from KNOWN to WATCH to BLOCKED", async () => {
      let candidate = createInitialReputation("pipeline-target");
      candidate = updateReputation(candidate, "success");
      expect(candidate.status).toBe("KNOWN");

      // Verifier mock simulating failing tests
      const failingVerifierExecutor: CommandExecutor = async (command: string, args: string[]) => {
        if (command === "git" && args[0] === "diff") {
          return { exitCode: 0, stdout: "+broken code", stderr: "", timedOut: false };
        }
        if (command === "pnpm") {
          return {
            exitCode: 1,
            stdout: "FAIL src/core.test.ts > assertion failed",
            stderr: "Error: assertion failed",
            timedOut: false,
          };
        }
        return { exitCode: 0, stdout: "", stderr: "", timedOut: false };
      };

      // Mission 1: Verification fails
      const eval1 = await verifyWorktree({
        worktreePath: "/tmp/mock-eval",
        executor: failingVerifierExecutor,
      });
      expect(eval1.tests_passed).toBe(false);

      candidate = updateReputation(candidate, eval1.tests_passed ? "success" : "failure");
      expect(candidate.status).toBe("WATCH");
      expect(candidate.consecutiveFailures).toBe(1);

      // Mission 2: Verification fails again
      const eval2 = await verifyWorktree({
        worktreePath: "/tmp/mock-eval",
        executor: failingVerifierExecutor,
      });
      expect(eval2.tests_passed).toBe(false);

      candidate = updateReputation(candidate, eval2.tests_passed ? "success" : "failure");
      expect(candidate.status).toBe("BLOCKED");
      expect(candidate.consecutiveFailures).toBe(2);
      expect(checkVeto(candidate).allowed).toBe(false);
    });

    it("T3.4: Hard Veto Ranking Exclusion: Blocked candidates are strictly filtered from selection", () => {
      // 3 candidate agents
      const candidateA = createInitialReputation("agent-alpha"); // Cheap but BLOCKED
      const candidateB = createInitialReputation("agent-beta"); // Moderate, KNOWN
      const candidateC = createInitialReputation("agent-gamma"); // High reliability PREFERRED

      // Block candidate A
      const blockedA = updateReputation(
        updateReputation(candidateA, "failure"),
        "failure",
      );
      expect(blockedA.status).toBe("BLOCKED");

      // Build B to KNOWN
      const knownB = updateReputation(candidateB, "success");

      // Build C to PREFERRED
      let preferredC = candidateC;
      for (let i = 0; i < 7; i++) {
        preferredC = updateReputation(preferredC, "success");
      }

      const candidatePool = [
        { rep: blockedA, quoteUsdc: 1.0 }, // Suspiciously cheap!
        { rep: knownB, quoteUsdc: 10.0 },
        { rep: preferredC, quoteUsdc: 15.0 },
      ];

      // Filter and rank: checkVeto MUST exclude blocked candidates regardless of price
      const eligible = candidatePool.filter((item) => checkVeto(item.rep).allowed);

      expect(eligible).toHaveLength(2);
      expect(eligible.some((item) => item.rep.candidateId === "agent-alpha")).toBe(false);

      // Sort eligible by overallReliability descending
      eligible.sort((a, b) => b.rep.overallReliability - a.rep.overallReliability);
      expect(eligible[0]?.rep.candidateId).toBe("agent-gamma");
      expect(eligible[1]?.rep.candidateId).toBe("agent-beta");
    });
  });

  // =========================================================================
  // TIER 4: REAL-WORLD SCENARIOS
  // =========================================================================
  describe("Tier 4: Real-World Scenarios", () => {
    it("T4.1: Simulated Full Multi-Round Mission Feedback Loop across 3 competing agents", () => {
      // Agent 1: "AgileBot" - Starts strong, degrades, gets blocked, manually salvaged
      // Agent 2: "SolidBot" - Consistently reliable, reaches PREFERRED and stays there
      // Agent 3: "IdleBot" - Completes one mission, then goes dormant and decays

      let agileBot = createInitialReputation("agile-bot");
      let solidBot = createInitialReputation("solid-bot");
      let idleBot = createInitialReputation("idle-bot");

      const historyLog: Array<{
        round: number;
        agileStatus: RelationshipStatus;
        solidStatus: RelationshipStatus;
      }> = [];

      // Round 1: All candidates complete their first mission
      agileBot = updateReputation(agileBot, "success");
      solidBot = updateReputation(solidBot, "success");
      idleBot = updateReputation(idleBot, "success");

      expect(agileBot.status).toBe("KNOWN");
      expect(solidBot.status).toBe("KNOWN");
      expect(idleBot.status).toBe("KNOWN");

      // Rounds 2-4: Both AgileBot and SolidBot perform well
      for (let r = 2; r <= 4; r++) {
        agileBot = updateReputation(agileBot, "success");
        solidBot = updateReputation(solidBot, "success");
        historyLog.push({
          round: r,
          agileStatus: agileBot.status,
          solidStatus: solidBot.status,
        });
      }
      expect(historyLog).toHaveLength(3);

      // Round 5: SolidBot reaches PREFERRED; AgileBot suffers a failure -> enters WATCH
      solidBot = updateReputation(solidBot, "success");
      agileBot = updateReputation(agileBot, "failure");
      expect(agileBot.status).toBe("WATCH");
      expect(agileBot.consecutiveFailures).toBe(1);

      // Round 6: AgileBot suffers second consecutive failure -> immediately BLOCKED
      agileBot = updateReputation(agileBot, "failure");
      expect(agileBot.status).toBe("BLOCKED");
      expect(agileBot.consecutiveFailures).toBe(2);
      expect(checkVeto(agileBot).allowed).toBe(false);

      // Round 7: IdleBot has had no missions for 15 steps; decays toward baseline
      const decayedIdle = applyTimeDecay(idleBot, 15, 0.95);
      expect(decayedIdle.confidence).toBeLessThan(idleBot.confidence);
      expect(decayedIdle.overallReliability).toBeLessThan(idleBot.overallReliability);

      // Round 8: Operator audits AgileBot, determines external issue, and manually unblocks
      const recoveredAgile = manualUnblock(
        agileBot,
        "operator-dan",
        "Investigated upstream API downtime; restored with warning",
        "WATCH",
      );
      expect(recoveredAgile.status).toBe("WATCH");
      expect(checkVeto(recoveredAgile).allowed).toBe(true);

      // Post-unblock mission outcome
      const finalAgile = updateReputation(recoveredAgile, "success");
      expect(finalAgile.status).toBe("KNOWN");
      expect(finalAgile.consecutiveFailures).toBe(0);
    });

    it("T4.2: End-to-End Sibyl Export Serialization conforms to canonical schema", () => {
      let agent = createInitialReputation("sibyl-export-agent");
      const episodeRecords: SibylEpisode[] = [];

      const missionScenarios: Array<{
        runId: string;
        taskType: string;
        outcome: "success" | "failure";
        note: string;
      }> = [
        {
          runId: "run-001",
          taskType: "code_refactor",
          outcome: "success",
          note: "Refactored module cleanly with all tests passing",
        },
        {
          runId: "run-002",
          taskType: "bug_fix",
          outcome: "success",
          note: "Resolved edge case without regressions",
        },
        {
          runId: "run-003",
          taskType: "stress_test",
          outcome: "failure",
          note: "Memory threshold exceeded under 10k concurrent requests",
        },
      ];

      for (const mission of missionScenarios) {
        agent = updateReputation(agent, mission.outcome);
        episodeRecords.push(
          formatEpisodeForSibyl(
            mission.runId,
            mission.taskType,
            mission.outcome,
            mission.note,
          ),
        );
      }

      const sibylPayload: SibylCounterparty = formatForSibyl(agent, {
        displayName: "High-Throughput Agent",
        taskFit: 0.92,
        observedPriceUsdc: "25.00",
        episodes: episodeRecords,
      });

      // Assert complete structural conformance with SibylCounterparty schema
      expect(sibylPayload.counterpartyKey).toBe("sibyl-export-agent");
      expect(sibylPayload.displayName).toBe("High-Throughput Agent");
      expect(sibylPayload.hasProfile).toBe(true);
      expect(sibylPayload.relationshipStatus).toBe("WATCH"); // Due to last failure
      expect(sibylPayload.memoryVersion).toBe(1);
      expect(sibylPayload.overallReliability).toBe(agent.overallReliability);
      expect(sibylPayload.confidence).toBe(agent.confidence);
      expect(sibylPayload.taskFit).toBe(0.92);
      expect(sibylPayload.observedPriceUsdc).toBe("25.00");
      expect(sibylPayload.episodes).toHaveLength(3);
      expect(sibylPayload.episodes[0]?.outcome).toBe("accepted");
      expect(sibylPayload.episodes[2]?.outcome).toBe("rejected");
      expect(sibylPayload.episodes[2]?.note).toContain("Memory threshold exceeded");
    });
  });
});

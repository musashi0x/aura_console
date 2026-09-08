import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { execSync } from "node:child_process";
import {
  createInitialReputation,
  updateReputation,
  applyTimeDecay,
  checkVeto,
  manualUnblock,
  manualArchive,
  calculateConfidence,
  type CandidateReputation,
  type RelationshipStatus,
} from "./reputation-fsm.js";
import {
  withWorktree,
  runCliInWorktree,
  type CommandExecutor,
} from "./cli-runner.js";

describe("Empirical Challenger Adversarial Suite", () => {
  describe("Challenge 1: Hard Veto Invariant & 100 Consecutive Successes", () => {
    it("confirms 100 consecutive successes cannot unblock or mutate a BLOCKED candidate", () => {
      let cand = createInitialReputation("blocked-agent-100");
      cand = updateReputation(cand, "failure");
      cand = updateReputation(cand, "failure");
      expect(cand.status).toBe("BLOCKED");
      expect(checkVeto(cand).allowed).toBe(false);

      const alphaBefore = cand.alpha;
      const betaBefore = cand.beta;
      const relBefore = cand.overallReliability;
      const confBefore = cand.confidence;
      const missionsBefore = cand.totalMissions;

      for (let i = 0; i < 100; i++) {
        cand = updateReputation(cand, "success");
        expect(cand.status).toBe("BLOCKED");
        expect(cand.alpha).toBe(alphaBefore);
        expect(cand.beta).toBe(betaBefore);
        expect(cand.overallReliability).toBe(relBefore);
        expect(cand.confidence).toBe(confBefore);
        expect(cand.totalMissions).toBe(missionsBefore);
        expect(checkVeto(cand).allowed).toBe(false);
      }
    });

    it("confirms 1000 consecutive successes with high weights and decay cannot unblock BLOCKED candidate", () => {
      let cand = createInitialReputation("blocked-agent-1000");
      cand = updateReputation(cand, "failure");
      cand = updateReputation(cand, "failure");
      expect(cand.status).toBe("BLOCKED");

      for (let i = 0; i < 1000; i++) {
        cand = updateReputation(cand, "success", {
          weight: 50.0,
          decayTimeSteps: 20,
        });
        expect(cand.status).toBe("BLOCKED");
        expect(checkVeto(cand).allowed).toBe(false);
      }
    });

    it("confirms applyTimeDecay preserves BLOCKED status and checkVeto rejects decayed candidate", () => {
      let cand = createInitialReputation("blocked-decay");
      cand = updateReputation(cand, "failure");
      cand = updateReputation(cand, "failure");
      expect(cand.status).toBe("BLOCKED");

      const decayed = applyTimeDecay(cand, 50, 0.95);
      expect(decayed.status).toBe("BLOCKED");
      expect(checkVeto(decayed).allowed).toBe(false);
    });

    it("confirms strict exclusion of BLOCKED candidates from ranking filters", () => {
      let blocked = createInitialReputation("blocked");
      blocked = updateReputation(blocked, "failure");
      blocked = updateReputation(blocked, "failure");

      let known = createInitialReputation("known");
      known = updateReputation(known, "success");

      let preferred = createInitialReputation("preferred");
      for (let i = 0; i < 10; i++) preferred = updateReputation(preferred, "success");

      const pool = [blocked, known, preferred];
      const ranked = pool.filter((c) => checkVeto(c).allowed);

      expect(ranked).toHaveLength(2);
      expect(ranked.map((c) => c.candidateId)).toEqual(["known", "preferred"]);
    });

    it("confirms manualArchive strictly throws on BLOCKED candidate, preventing checkVeto bypass", () => {
      let cand = createInitialReputation("candidate-archive-loophole");
      cand = updateReputation(cand, "failure");
      cand = updateReputation(cand, "failure");
      expect(cand.status).toBe("BLOCKED");
      expect(checkVeto(cand).allowed).toBe(false);

      // manualArchive strictly throws if candidate is BLOCKED
      expect(() => manualArchive(cand)).toThrow(
        "Cannot archive a candidate that is BLOCKED; candidate must be manually unblocked first."
      );

      // Candidate remains BLOCKED and vetoed
      expect(cand.status).toBe("BLOCKED");
      expect(checkVeto(cand).allowed).toBe(false);
    });
  });

  describe("Challenge 2: checkVeto Strictness", () => {
    it("strictly returns allowed: false with reason for all BLOCKED candidates", () => {
      const candNoReason: CandidateReputation = {
        ...createInitialReputation("b1"),
        status: "BLOCKED",
      };
      const res1 = checkVeto(candNoReason);
      expect(res1.allowed).toBe(false);
      expect(res1.reason).toBeDefined();
      expect(res1.reason).toContain("BLOCKED");

      const candWithReason: CandidateReputation = {
        ...createInitialReputation("b2"),
        status: "BLOCKED",
        blockedReason: "Repeated timeout failures in sandbox",
      };
      const res2 = checkVeto(candWithReason);
      expect(res2.allowed).toBe(false);
      expect(res2.reason).toContain("Repeated timeout failures in sandbox");
    });

    it("allows all non-blocked statuses (NEW, KNOWN, PREFERRED, WATCH, ARCHIVED)", () => {
      const statuses: RelationshipStatus[] = ["NEW", "KNOWN", "PREFERRED", "WATCH", "ARCHIVED"];
      for (const st of statuses) {
        const cand: CandidateReputation = {
          ...createInitialReputation(`cand-${st}`),
          status: st,
        };
        const res = checkVeto(cand);
        expect(res.allowed).toBe(true);
        expect(res.reason).toBeUndefined();
      }
    });

    it("strictly vetoes BLOCKED candidate regardless of perfect mathematical reliability (alpha=1000, beta=1)", () => {
      const cand: CandidateReputation = {
        ...createInitialReputation("hyper-reliable-blocked"),
        status: "BLOCKED",
        alpha: 1000,
        beta: 1,
        overallReliability: 1000 / 1001,
        confidence: 0.999,
      };
      expect(checkVeto(cand).allowed).toBe(false);
    });
  });

  describe("Challenge 3: 2 Consecutive Failures in WATCH State", () => {
    it("transitions immediately to BLOCKED on 2nd failure for candidate unblocked into WATCH (consecutiveFailures=0)", () => {
      let cand = createInitialReputation("unblocked-watch");
      cand = updateReputation(cand, "failure");
      cand = updateReputation(cand, "failure");
      cand = manualUnblock(cand, "admin-1", "Probationary restart", "WATCH");
      expect(cand.status).toBe("WATCH");
      expect(cand.consecutiveFailures).toBe(0);

      cand = updateReputation(cand, "failure");
      expect(cand.status).toBe("WATCH");
      expect(cand.consecutiveFailures).toBe(1);

      cand = updateReputation(cand, "failure");
      expect(cand.status).toBe("BLOCKED");
      expect(cand.consecutiveFailures).toBe(2);
      expect(cand.blockedReason).toContain("2 consecutive failures in WATCH state");
    });

    it("transitions to BLOCKED on next failure when entering WATCH from NEW", () => {
      let cand = createInitialReputation("new-cand");
      cand = updateReputation(cand, "failure"); // -> WATCH, consecutiveFailures = 1
      expect(cand.status).toBe("WATCH");
      expect(cand.consecutiveFailures).toBe(1);

      cand = updateReputation(cand, "failure"); // -> BLOCKED
      expect(cand.status).toBe("BLOCKED");
    });

    it("transitions to BLOCKED on next failure when entering WATCH from KNOWN", () => {
      let cand = createInitialReputation("known-cand");
      cand = updateReputation(cand, "success");
      expect(cand.status).toBe("KNOWN");

      cand = updateReputation(cand, "failure"); // -> WATCH, consecutiveFailures = 1
      expect(cand.status).toBe("WATCH");
      expect(cand.consecutiveFailures).toBe(1);

      cand = updateReputation(cand, "failure"); // -> BLOCKED
      expect(cand.status).toBe("BLOCKED");
    });

    it("transitions to BLOCKED on next failure when entering WATCH from PREFERRED", () => {
      let cand = createInitialReputation("pref-cand");
      for (let i = 0; i < 15; i++) cand = updateReputation(cand, "success");
      expect(cand.status).toBe("PREFERRED");

      cand = updateReputation(cand, "failure"); // -> WATCH, consecutiveFailures = 1
      expect(cand.status).toBe("WATCH");
      expect(cand.consecutiveFailures).toBe(1);

      cand = updateReputation(cand, "failure"); // -> BLOCKED
      expect(cand.status).toBe("BLOCKED");
    });

    it("fuzzing 500 randomized trials: candidate NEVER blocks unless 2 consecutive failures occur in WATCH", () => {
      for (let trial = 0; trial < 500; trial++) {
        let cand = createInitialReputation(`fuzz-${trial}`);
        cand = updateReputation(cand, "failure"); // -> WATCH (failures = 1)
        expect(cand.status).toBe("WATCH");

        let consecutive = 1;
        while (cand.status === "WATCH") {
          const isFailure = Math.random() < 0.35;
          if (isFailure) {
            consecutive++;
            cand = updateReputation(cand, "failure");
            if (consecutive >= 2) {
              expect(cand.status).toBe("BLOCKED");
              break;
            }
          } else {
            consecutive = 0;
            cand = updateReputation(cand, "success");
          }
        }
      }
    });
  });

  describe("Challenge 4: Time Decay Parameter Stability (lambda in [0.90, 0.98])", () => {
    it("sweeps lambda in [0.90, 0.98] and timeSteps: guarantees alpha >= 1.0, beta >= 1.0, and finite parameters", () => {
      const lambdas = [0.90, 0.91, 0.92, 0.93, 0.94, 0.95, 0.96, 0.97, 0.98];
      const timeStepValues = [1, 2, 5, 10, 30, 100, 365, 1000, 10000];
      const paramPairs = [
        { a: 1, b: 1 },
        { a: 2, b: 1 },
        { a: 10, b: 5 },
        { a: 100, b: 1 },
        { a: 1, b: 100 },
        { a: 500, b: 500 },
        { a: 10000, b: 10000 },
      ];

      for (const lambda of lambdas) {
        for (const t of timeStepValues) {
          for (const p of paramPairs) {
            const cand: CandidateReputation = {
              ...createInitialReputation("sweep"),
              alpha: p.a,
              beta: p.b,
              overallReliability: p.a / (p.a + p.b),
              confidence: calculateConfidence(p.a, p.b),
            };

            const decayed = applyTimeDecay(cand, t, lambda);

            expect(Number.isNaN(decayed.alpha)).toBe(false);
            expect(Number.isNaN(decayed.beta)).toBe(false);
            expect(Number.isFinite(decayed.alpha)).toBe(true);
            expect(Number.isFinite(decayed.beta)).toBe(true);
            expect(decayed.alpha).toBeGreaterThanOrEqual(1.0);
            expect(decayed.beta).toBeGreaterThanOrEqual(1.0);
            expect(decayed.overallReliability).toBeGreaterThanOrEqual(0.0);
            expect(decayed.overallReliability).toBeLessThanOrEqual(1.0);
            expect(decayed.confidence).toBeGreaterThanOrEqual(0.0);
            expect(decayed.confidence).toBeLessThanOrEqual(1.0);
          }
        }
      }
    });

    it("verifies boundary cases: t=0, negative t, prior parameters", () => {
      const cand = createInitialReputation("prior");
      const d0 = applyTimeDecay(cand, 0, 0.95);
      expect(d0.alpha).toBe(1.0);
      expect(d0.beta).toBe(1.0);

      const dNeg = applyTimeDecay(cand, -5, 0.95);
      expect(dNeg.alpha).toBe(1.0);
      expect(dNeg.beta).toBe(1.0);

      const d100 = applyTimeDecay(cand, 100, 0.95);
      expect(d100.alpha).toBe(1.0);
      expect(d100.beta).toBe(1.0);
    });

    it("rejects invalid lambda outside (0, 1]", () => {
      const cand = createInitialReputation("test");
      expect(() => applyTimeDecay(cand, 5, 0)).toThrow("Decay lambda must be in (0, 1]");
      expect(() => applyTimeDecay(cand, 5, -0.5)).toThrow("Decay lambda must be in (0, 1]");
      expect(() => applyTimeDecay(cand, 5, 1.1)).toThrow("Decay lambda must be in (0, 1]");
    });
  });

  describe("Challenge 5: CLI Runner Worktree Cleanup on Throw / Abnormal Exit / Timeout", () => {
    it("cleans up worktree on callback throw (mock)", async () => {
      const gitCalls: Array<string[]> = [];
      const mockExecutor: CommandExecutor = async (cmd, args) => {
        if (cmd === "git") gitCalls.push(args);
        return { exitCode: 0, stdout: "", stderr: "", timedOut: false };
      };

      await expect(
        withWorktree(
          "throw-mock",
          async () => {
            throw new Error("Worker catastrophic exception");
          },
          { executor: mockExecutor, repoRoot: "/mock/repo" }
        )
      ).rejects.toThrow("Worker catastrophic exception");

      expect(gitCalls).toHaveLength(2);
      expect(gitCalls[0]).toEqual(["worktree", "add", "--detach", ".worktrees/mission-throw-mock", "HEAD"]);
      expect(gitCalls[1]).toEqual(["worktree", "remove", "--force", ".worktrees/mission-throw-mock"]);
    });

    it("cleans up worktree on child process abnormal exit (mock exitCode 1)", async () => {
      const gitCalls: Array<string[]> = [];
      const mockExecutor: CommandExecutor = async (cmd, args) => {
        if (cmd === "git") {
          gitCalls.push(args);
          return { exitCode: 0, stdout: "", stderr: "", timedOut: false };
        }
        return { exitCode: 1, stdout: "", stderr: "Crash", timedOut: false };
      };

      const res = await runCliInWorktree("crash-mock", {
        prompt: "crash",
        executor: mockExecutor,
        worktreeOptions: { executor: mockExecutor, repoRoot: "/mock/repo" },
      });

      expect(res.result.success).toBe(false);
      expect(res.result.exitCode).toBe(1);
      expect(gitCalls.some((c) => c.includes("remove") && c.includes("--force"))).toBe(true);
    });

    it("cleans up worktree on timeout (mock)", async () => {
      const gitCalls: Array<string[]> = [];
      const mockExecutor: CommandExecutor = async (cmd, args) => {
        if (cmd === "git") {
          gitCalls.push(args);
          return { exitCode: 0, stdout: "", stderr: "", timedOut: false };
        }
        return { exitCode: null, stdout: "", stderr: "", timedOut: true, error: new Error("Timeout") };
      };

      const res = await runCliInWorktree("timeout-mock", {
        prompt: "timeout",
        timeoutMs: 100,
        executor: mockExecutor,
        worktreeOptions: { executor: mockExecutor, repoRoot: "/mock/repo" },
      });

      expect(res.result.timedOut).toBe(true);
      expect(gitCalls.some((c) => c.includes("remove") && c.includes("--force"))).toBe(true);
    });

    it("REAL Git: creates and removes ephemeral worktree on success", async () => {
      const runId = `real-success-${Date.now()}`;
      const expectedDir = path.resolve(process.cwd(), ".worktrees", `mission-${runId}`);

      await withWorktree(runId, async (wtPath) => {
        expect(fs.existsSync(wtPath)).toBe(true);
        const list = execSync("git worktree list", { encoding: "utf-8" });
        expect(list).toContain(`mission-${runId}`);
      });

      expect(fs.existsSync(expectedDir)).toBe(false);
      const listAfter = execSync("git worktree list", { encoding: "utf-8" });
      expect(listAfter).not.toContain(`mission-${runId}`);
    });

    it("REAL Git: removes worktree when callback throws", async () => {
      const runId = `real-throw-${Date.now()}`;
      const expectedDir = path.resolve(process.cwd(), ".worktrees", `mission-${runId}`);

      await expect(
        withWorktree(runId, async () => {
          throw new Error("Worker failed in real worktree!");
        })
      ).rejects.toThrow("Worker failed in real worktree!");

      expect(fs.existsSync(expectedDir)).toBe(false);
      const listAfter = execSync("git worktree list", { encoding: "utf-8" });
      expect(listAfter).not.toContain(`mission-${runId}`);
    });

    it("REAL Git: removes worktree with dirty and untracked files using --force", async () => {
      const runId = `real-dirty-${Date.now()}`;
      const expectedDir = path.resolve(process.cwd(), ".worktrees", `mission-${runId}`);

      await expect(
        withWorktree(runId, async (wtPath) => {
          fs.writeFileSync(path.join(wtPath, "dirty-file.txt"), "untracked dirty content");
          throw new Error("Worker failed leaving untracked files!");
        })
      ).rejects.toThrow("Worker failed leaving untracked files!");

      expect(fs.existsSync(expectedDir)).toBe(false);
      const listAfter = execSync("git worktree list", { encoding: "utf-8" });
      expect(listAfter).not.toContain(`mission-${runId}`);
    });
  });
});

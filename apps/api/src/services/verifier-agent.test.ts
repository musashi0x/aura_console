import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import type { CommandExecutor } from "./cli-runner.js";
import {
  VerifierAgent,
  verifyWorktree,
  validateCompetitorReport,
  verifyCompetitorReportDeliverable,
} from "./verifier-agent.js";

describe("Verifier Agent (verifier-agent)", () => {
  it("verifies successfully when tests pass and diff is present", async () => {
    const executedCommands: Array<{ command: string; args: string[]; cwd?: string }> = [];

    const mockExecutor: CommandExecutor = async (command, args, options) => {
      executedCommands.push({ command, args, cwd: options?.cwd });

      if (command === "git" && args[0] === "diff") {
        return {
          exitCode: 0,
          stdout: "diff --git a/src/index.ts b/src/index.ts\n+export const newFeature = true;",
          stderr: "",
          timedOut: false,
        };
      }

      if (command === "pnpm" && args[0] === "test") {
        return {
          exitCode: 0,
          stdout: "Test Files 1 passed (1)\nTests 10 passed (10)",
          stderr: "",
          timedOut: false,
        };
      }

      throw new Error(`Unexpected command: ${command} ${args.join(" ")}`);
    };

    const evaluation = await verifyWorktree({
      worktreePath: "/tmp/worktree-success",
      executor: mockExecutor,
    });

    expect(evaluation.tests_passed).toBe(true);
    expect(evaluation.score).toBe(1.0);
    expect(evaluation.summary).toContain("Tests passed successfully and changes verified.");
    expect(evaluation.failure_reason).toBeUndefined();
    expect(evaluation.diff).toContain("+export const newFeature = true;");
    expect(evaluation.stdout).toContain("Tests 10 passed");
    expect(evaluation.durationMs).toBeGreaterThanOrEqual(0);

    expect(executedCommands).toHaveLength(2);
    expect(executedCommands[0]).toEqual({
      command: "git",
      args: ["diff", "HEAD"],
      cwd: "/tmp/worktree-success",
    });
    expect(executedCommands[1]).toEqual({
      command: "pnpm",
      args: ["test"],
      cwd: "/tmp/worktree-success",
    });
  });

  it("fails verification when test command exits with non-zero code", async () => {
    const mockExecutor: CommandExecutor = async (command, _args) => {
      if (command === "git") {
        return {
          exitCode: 0,
          stdout: "diff --git a/src/index.ts b/src/index.ts\n+const broken = true;",
          stderr: "",
          timedOut: false,
        };
      }
      return {
        exitCode: 1,
        stdout: "FAIL src/index.test.ts",
        stderr: "AssertionError: expected true to be false\n    at src/index.test.ts:15:7",
        timedOut: false,
      };
    };

    const evaluation = await verifyWorktree({
      worktreePath: "/tmp/worktree-test-fail",
      executor: mockExecutor,
    });

    expect(evaluation.tests_passed).toBe(false);
    expect(evaluation.score).toBe(0.0);
    expect(evaluation.summary).toContain("Test execution failed with exit code 1");
    expect(evaluation.failure_reason).toContain("AssertionError: expected true to be false");
    expect(evaluation.diff).toContain("+const broken = true;");
    expect(evaluation.stderr).toContain("AssertionError");
  });

  it("handles empty diff cleanly by returning score 0.0 and tests_passed false", async () => {
    const executedCommands: Array<string> = [];

    const mockExecutor: CommandExecutor = async (command, args) => {
      executedCommands.push(`${command} ${args.join(" ")}`);
      if (command === "git" && args[0] === "diff") {
        return { exitCode: 0, stdout: "", stderr: "", timedOut: false };
      }
      if (command === "git" && args[0] === "status") {
        return { exitCode: 0, stdout: "", stderr: "", timedOut: false };
      }
      if (command === "pnpm" && args[0] === "test") {
        return { exitCode: 0, stdout: "All tests passed", stderr: "", timedOut: false };
      }
      throw new Error(`Unexpected command: ${command}`);
    };

    const evaluation = await verifyWorktree({
      worktreePath: "/tmp/worktree-empty-diff",
      executor: mockExecutor,
    });

    expect(evaluation.tests_passed).toBe(false);
    expect(evaluation.score).toBe(0.0);
    expect(evaluation.summary).toContain("No modifications detected in worktree");
    expect(evaluation.failure_reason).toBe("No changes made in worktree");
    expect(evaluation.diff).toBe("");
  });

  it("detects untracked files via git status --porcelain when git diff HEAD is empty", async () => {
    const mockExecutor: CommandExecutor = async (command, args) => {
      if (command === "git" && args[0] === "diff") {
        return { exitCode: 0, stdout: "", stderr: "", timedOut: false };
      }
      if (command === "git" && args[0] === "status") {
        return { exitCode: 0, stdout: "?? new-service.ts\n", stderr: "", timedOut: false };
      }
      return {
        exitCode: 0,
        stdout: "Passed all tests",
        stderr: "",
        timedOut: false,
      };
    };

    const evaluation = await verifyWorktree({
      worktreePath: "/tmp/worktree-untracked",
      executor: mockExecutor,
    });

    expect(evaluation.tests_passed).toBe(true);
    expect(evaluation.score).toBe(1.0);
    expect(evaluation.diff).toContain("?? new-service.ts");
    expect(evaluation.summary).toContain("Tests passed successfully");
  });

  it("handles git diff failure cleanly with zero score and failure reason", async () => {
    const mockExecutor: CommandExecutor = async (command) => {
      if (command === "git") {
        return {
          exitCode: 128,
          stdout: "",
          stderr: "fatal: not a git repository",
          timedOut: false,
        };
      }
      return { exitCode: 0, stdout: "", stderr: "", timedOut: false };
    };

    const evaluation = await verifyWorktree({
      worktreePath: "/tmp/not-a-git-repo",
      executor: mockExecutor,
    });

    expect(evaluation.tests_passed).toBe(false);
    expect(evaluation.score).toBe(0.0);
    expect(evaluation.summary).toContain("Failed to inspect git diff in worktree");
    expect(evaluation.failure_reason).toContain("fatal: not a git repository");
  });

  it("handles test command timeout with zero score and descriptive failure reason", async () => {
    const mockExecutor: CommandExecutor = async (command) => {
      if (command === "git") {
        return {
          exitCode: 0,
          stdout: "diff --git a/a.ts b/a.ts\n+1",
          stderr: "",
          timedOut: false,
        };
      }
      return {
        exitCode: null,
        stdout: "Running test suite...",
        stderr: "",
        timedOut: true,
      };
    };

    const evaluation = await verifyWorktree({
      worktreePath: "/tmp/worktree-timeout",
      timeoutMs: 5000,
      executor: mockExecutor,
    });

    expect(evaluation.tests_passed).toBe(false);
    expect(evaluation.score).toBe(0.0);
    expect(evaluation.failure_reason).toContain("Test execution timed out after 5000ms");
  });

  it("supports custom test command, args, and custom passingScore", async () => {
    const executedTestArgs: string[] = [];

    const mockExecutor: CommandExecutor = async (command, args) => {
      if (command === "git") {
        return { exitCode: 0, stdout: "diff --git a b", stderr: "", timedOut: false };
      }
      executedTestArgs.push(command, ...args);
      return { exitCode: 0, stdout: "Unit tests passed", stderr: "", timedOut: false };
    };

    const evaluation = await verifyWorktree({
      worktreePath: "/tmp/worktree-custom-cmd",
      testCommand: "npm run test:ci",
      passingScore: 0.95,
      executor: mockExecutor,
    });

    expect(evaluation.tests_passed).toBe(true);
    expect(evaluation.score).toBe(0.95);
    expect(executedTestArgs).toEqual(["npm", "run", "test:ci"]);
  });

  it("skips test execution when skipTestsIfNoDiff is enabled and no modifications exist", async () => {
    const executedCommands: string[] = [];

    const mockExecutor: CommandExecutor = async (command, _args) => {
      executedCommands.push(command);
      return { exitCode: 0, stdout: "", stderr: "", timedOut: false };
    };

    const evaluation = await verifyWorktree({
      worktreePath: "/tmp/worktree-skip",
      skipTestsIfNoDiff: true,
      executor: mockExecutor,
    });

    expect(evaluation.tests_passed).toBe(false);
    expect(evaluation.score).toBe(0.0);
    expect(evaluation.summary).toContain("No modifications detected");
    // Test command should not have been called
    expect(executedCommands).toEqual(["git", "git"]);
  });

  it("validates missing worktreePath argument", async () => {
    const evaluation = await verifyWorktree({
      worktreePath: "",
    });

    expect(evaluation.tests_passed).toBe(false);
    expect(evaluation.score).toBe(0.0);
    expect(evaluation.failure_reason).toBe("worktreePath is required");
  });

  it("supports VerifierAgent class wrapper", async () => {
    const mockExecutor: CommandExecutor = async (command) => {
      if (command === "git") {
        return { exitCode: 0, stdout: "diff --git a b", stderr: "", timedOut: false };
      }
      return { exitCode: 0, stdout: "Passed", stderr: "", timedOut: false };
    };

    const agent = new VerifierAgent({
      testCommand: "pnpm test",
      executor: mockExecutor,
    });

    const evaluation = await agent.verify({
      worktreePath: "/tmp/agent-worktree",
    });

    expect(evaluation.tests_passed).toBe(true);
    expect(evaluation.score).toBe(1.0);
  });

  describe("Competitor Research Deliverable Verification", () => {
    it("validates competitor report in memory via validateCompetitorReport", () => {
      const valid = {
        competitors: [
          { name: "C1", website: "https://c1.com", sources: ["https://s1.com"] },
          { name: "C2", website: "https://c2.com", sources: ["https://s2.com"] },
          { name: "C3", website: "https://c3.com", sources: ["https://s3.com"] },
        ],
      };
      const result = validateCompetitorReport(valid);
      expect(result.tests_passed).toBe(true);
      expect(result.score).toBe(1.0);
      expect(result.competitorsCount).toBe(3);

      const invalid = {
        competitors: [
          { name: "C1", website: "https://c1.com", sources: [] },
        ],
      };
      const invalidResult = validateCompetitorReport(invalid);
      expect(invalidResult.tests_passed).toBe(false);
      expect(invalidResult.score).toBe(0.0);
      expect(invalidResult.failure_reason).toBeDefined();
    });

    it("verifies deliverable file via verifyCompetitorReportDeliverable", async () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "va-test-"));
      try {
        fs.writeFileSync(
          path.join(tempDir, "competitor-report.json"),
          JSON.stringify({
            competitors: [
              { name: "C1", website: "https://c1.com", sources: ["https://s1.com"] },
              { name: "C2", website: "https://c2.com", sources: ["https://s2.com"] },
              { name: "C3", website: "https://c3.com", sources: ["https://s3.com"] },
            ],
          }),
        );

        const evaluation = await verifyCompetitorReportDeliverable(tempDir);
        expect(evaluation.tests_passed).toBe(true);
        expect(evaluation.score).toBe(1.0);
        expect(evaluation.competitorsCount).toBe(3);
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it("supports agent.verifyCompetitorReport method", async () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "va-test-agent-"));
      try {
        fs.writeFileSync(
          path.join(tempDir, "deliverable.json"),
          JSON.stringify({
            competitors: [
              { name: "C1", website: "https://c1.com", sources: ["https://s1.com"] },
              { name: "C2", website: "https://c2.com", sources: ["https://s2.com"] },
              { name: "C3", website: "https://c3.com", sources: ["https://s3.com"] },
            ],
          }),
        );

        const agent = new VerifierAgent();
        const evaluation = await agent.verifyCompetitorReport(tempDir);
        expect(evaluation.tests_passed).toBe(true);
        expect(evaluation.score).toBe(1.0);
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });
  });
});

import type { CommandExecutor } from "./cli-runner.js";
import { defaultCommandExecutor } from "./cli-runner.js";

export interface VerifierOptions {
  worktreePath: string;
  testCommand?: string;
  testArgs?: string[];
  diffRef?: string;
  timeoutMs?: number;
  passingScore?: number;
  skipTestsIfNoDiff?: boolean;
  executor?: CommandExecutor;
}

export interface VerifierEvaluation {
  score: number;
  tests_passed: boolean;
  summary: string;
  failure_reason?: string;
  diff?: string;
  stdout?: string;
  stderr?: string;
  durationMs?: number;
}

/**
 * Runs deterministic tests and inspects Git diffs in the target worktree.
 * Produces structured evaluation reports with score, tests_passed, and summary/failure_reason.
 */
export async function verifyWorktree(options: VerifierOptions): Promise<VerifierEvaluation> {
  if (!options.worktreePath || options.worktreePath.trim().length === 0) {
    return {
      score: 0.0,
      tests_passed: false,
      summary: "Missing target worktree path for verification.",
      failure_reason: "worktreePath is required",
    };
  }

  const executor = options.executor ?? defaultCommandExecutor;
  const diffRef = options.diffRef ?? "HEAD";

  // 1. Inspect git diff
  const diffResult = await executor("git", ["diff", diffRef], {
    cwd: options.worktreePath,
  });

  if (diffResult.exitCode !== 0 || diffResult.error) {
    return {
      score: 0.0,
      tests_passed: false,
      summary: "Failed to inspect git diff in worktree.",
      failure_reason:
        diffResult.stderr.trim() ||
        diffResult.error?.message ||
        `git diff failed with exit code ${diffResult.exitCode}`,
      diff: "",
    };
  }

  let diffOutput = diffResult.stdout;
  let hasModifications = diffOutput.trim().length > 0;

  // If working tree diff against diffRef is empty, check status for untracked or staged changes
  if (!hasModifications) {
    const statusResult = await executor("git", ["status", "--porcelain"], {
      cwd: options.worktreePath,
    });
    if (statusResult.exitCode === 0 && statusResult.stdout.trim().length > 0) {
      hasModifications = true;
      diffOutput = statusResult.stdout;
    }
  }

  // If configured to skip tests when no modifications exist
  if (options.skipTestsIfNoDiff && !hasModifications) {
    return {
      score: 0.0,
      tests_passed: false,
      summary: "No modifications detected in worktree: changes required to pass verification.",
      failure_reason: "No changes made in worktree",
      diff: "",
    };
  }

  // 2. Deterministic test execution
  const testCommandStr = options.testCommand ?? "pnpm test";
  let cmd: string;
  let args: string[];

  if (options.testArgs && options.testArgs.length > 0) {
    cmd = testCommandStr;
    args = options.testArgs;
  } else {
    const parts = testCommandStr.trim().split(/\s+/).filter(Boolean);
    cmd = parts[0] ?? "pnpm";
    args = parts.slice(1);
  }

  const startTime = Date.now();
  const testResult = await executor(cmd, args, {
    cwd: options.worktreePath,
    timeoutMs: options.timeoutMs ?? 60_000,
  });
  const durationMs = Date.now() - startTime;

  const testsFailed =
    testResult.exitCode !== 0 || testResult.timedOut || testResult.error !== undefined;

  if (testsFailed) {
    const failureReason = testResult.timedOut
      ? `Test execution timed out after ${options.timeoutMs ?? 60_000}ms`
      : testResult.stderr.trim() ||
        testResult.stdout.trim() ||
        testResult.error?.message ||
        `Tests failed with exit code ${testResult.exitCode}`;

    return {
      score: 0.0,
      tests_passed: false,
      summary: `Test execution failed with exit code ${testResult.exitCode ?? "null"}.`,
      failure_reason: failureReason,
      diff: diffOutput,
      stdout: testResult.stdout,
      stderr: testResult.stderr,
      durationMs,
    };
  }

  // 3. Tests passed: verify that modifications were actually made
  if (!hasModifications) {
    return {
      score: 0.0,
      tests_passed: false,
      summary: "No modifications detected in worktree: changes required to pass verification.",
      failure_reason: "No changes made in worktree",
      diff: "",
      stdout: testResult.stdout,
      stderr: testResult.stderr,
      durationMs,
    };
  }

  return {
    score: options.passingScore ?? 1.0,
    tests_passed: true,
    summary: "Tests passed successfully and changes verified.",
    diff: diffOutput,
    stdout: testResult.stdout,
    stderr: testResult.stderr,
    durationMs,
  };
}

/**
 * Agent class wrapper for deterministic test execution and diff verification.
 */
export class VerifierAgent {
  constructor(private defaultOptions: Partial<VerifierOptions> = {}) {}

  async verify(options: VerifierOptions): Promise<VerifierEvaluation> {
    return verifyWorktree({ ...this.defaultOptions, ...options });
  }
}

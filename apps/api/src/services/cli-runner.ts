import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

export interface CommandExecutionOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
  onStdout?: (data: string) => void;
  onStderr?: (data: string) => void;
}

export interface CommandExecutionResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  error?: Error;
}

export type CommandExecutor = (
  command: string,
  args: string[],
  options?: CommandExecutionOptions,
) => Promise<CommandExecutionResult>;

/**
 * Default child process spawner with streaming output and SIGTERM/SIGKILL termination on timeout.
 */
export const defaultCommandExecutor: CommandExecutor = async (
  command: string,
  args: string[],
  options?: CommandExecutionOptions,
): Promise<CommandExecutionResult> => {
  return new Promise<CommandExecutionResult>((resolve) => {
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let timer: NodeJS.Timeout | null = null;
    let killTimer: NodeJS.Timeout | null = null;
    let settled = false;

    const cleanupTimers = () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      if (killTimer) {
        clearTimeout(killTimer);
        killTimer = null;
      }
    };

    const finish = (result: CommandExecutionResult) => {
      if (settled) return;
      settled = true;
      cleanupTimers();
      resolve(result);
    };

    let child: ReturnType<typeof spawn>;
    try {
      child = spawn(command, args, {
        cwd: options?.cwd,
        env: options?.env ?? process.env,
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (err) {
      finish({
        exitCode: null,
        stdout: "",
        stderr: "",
        timedOut: false,
        error: err instanceof Error ? err : new Error(String(err)),
      });
      return;
    }

    if (options?.timeoutMs && options.timeoutMs > 0) {
      timer = setTimeout(() => {
        timedOut = true;
        try {
          child.kill("SIGTERM");
        } catch {
          // ignore
        }
        killTimer = setTimeout(() => {
          try {
            child.kill("SIGKILL");
          } catch {
            // ignore
          }
        }, 1000);
      }, options.timeoutMs);
    }

    child.stdout?.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      stdout += text;
      options?.onStdout?.(text);
    });

    child.stderr?.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      stderr += text;
      options?.onStderr?.(text);
    });

    child.on("error", (err: Error) => {
      finish({
        exitCode: null,
        stdout,
        stderr,
        timedOut,
        error: err,
      });
    });

    child.on("close", (code: number | null) => {
      finish({
        exitCode: code,
        stdout,
        stderr,
        timedOut,
        error: timedOut ? new Error(`Command timed out after ${options?.timeoutMs}ms`) : undefined,
      });
    });
  });
};

export interface CliRunnerOptions {
  prompt: string;
  worktreePath: string;
  timeoutMs?: number;
  preferGemini?: boolean;
  onStdout?: (data: string) => void;
  onStderr?: (data: string) => void;
  executor?: CommandExecutor;
  env?: NodeJS.ProcessEnv;
  claudeArgs?: string[];
  geminiArgs?: string[];
  fallback?: boolean;
}

export interface CliRunResult {
  success: boolean;
  cliUsed: "claude" | "gemini";
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
  error?: string;
}

export interface WorktreeOptions {
  repoRoot?: string;
  worktreeDir?: string;
  commitRef?: string;
  worktreePath?: string;
  executor?: CommandExecutor;
}

export interface WorktreeSession {
  runId: string;
  worktreePath: string;
  execute: <T>(fn: (worktreePath: string) => Promise<T>) => Promise<T>;
  cleanup: () => Promise<void>;
}

export interface CliWorktreeRunOptions extends Omit<CliRunnerOptions, "worktreePath"> {
  worktreeOptions?: WorktreeOptions;
}

/**
 * Spawns headless AI CLI (Claude Code or Gemini CLI) in the target worktree path.
 * Implements fallback: Claude Code -> Gemini CLI (or vice versa if preferGemini is true).
 */
export async function runCli(options: CliRunnerOptions): Promise<CliRunResult> {
  const timeoutMs = options.timeoutMs ?? 120_000;
  const executor = options.executor ?? defaultCommandExecutor;
  const fallbackEnabled = options.fallback !== false;

  type CliType = "claude" | "gemini";
  const primaryCli: CliType = options.preferGemini ? "gemini" : "claude";
  const secondaryCli: CliType = options.preferGemini ? "claude" : "gemini";

  const getCliSpec = (cli: CliType): { command: string; args: string[] } => {
    if (cli === "claude") {
      return {
        command: "claude",
        args: options.claudeArgs ?? ["-p", options.prompt, "--dangerously-skip-permissions"],
      };
    }
    return {
      command: "gemini",
      args: options.geminiArgs ?? ["-p", options.prompt],
    };
  };

  const primarySpec = getCliSpec(primaryCli);
  const primaryResult = await executor(primarySpec.command, primarySpec.args, {
    cwd: options.worktreePath,
    env: options.env,
    timeoutMs,
    onStdout: options.onStdout,
    onStderr: options.onStderr,
  });

  const primaryFailed =
    primaryResult.exitCode !== 0 || primaryResult.timedOut || primaryResult.error !== undefined;

  if (!primaryFailed) {
    return {
      success: true,
      cliUsed: primaryCli,
      stdout: primaryResult.stdout,
      stderr: primaryResult.stderr,
      exitCode: primaryResult.exitCode,
      timedOut: false,
    };
  }

  // If primary timed out or fallback is disabled, do not attempt fallback.
  if (primaryResult.timedOut || !fallbackEnabled) {
    return {
      success: false,
      cliUsed: primaryCli,
      stdout: primaryResult.stdout,
      stderr: primaryResult.stderr,
      exitCode: primaryResult.exitCode,
      timedOut: primaryResult.timedOut,
      error:
        primaryResult.error?.message ??
        (primaryResult.timedOut
          ? `Execution timed out after ${timeoutMs}ms`
          : `CLI ${primaryCli} failed with exit code ${primaryResult.exitCode}`),
    };
  }

  // Primary failed: attempt graceful fallback to secondary CLI.
  const secondarySpec = getCliSpec(secondaryCli);
  const secondaryResult = await executor(secondarySpec.command, secondarySpec.args, {
    cwd: options.worktreePath,
    env: options.env,
    timeoutMs,
    onStdout: options.onStdout,
    onStderr: options.onStderr,
  });

  const secondaryFailed =
    secondaryResult.exitCode !== 0 ||
    secondaryResult.timedOut ||
    secondaryResult.error !== undefined;

  if (!secondaryFailed) {
    return {
      success: true,
      cliUsed: secondaryCli,
      stdout: secondaryResult.stdout,
      stderr: secondaryResult.stderr,
      exitCode: secondaryResult.exitCode,
      timedOut: false,
    };
  }

  return {
    success: false,
    cliUsed: secondaryCli,
    stdout: secondaryResult.stdout || primaryResult.stdout,
    stderr: [primaryResult.stderr, secondaryResult.stderr].filter(Boolean).join("\n"),
    exitCode: secondaryResult.exitCode,
    timedOut: secondaryResult.timedOut,
    error:
      secondaryResult.error?.message ??
      primaryResult.error?.message ??
      `Both ${primaryCli} and ${secondaryCli} CLI runs failed`,
  };
}

export const executeLocalAiCli = runCli;

/**
 * Manages the lifecycle of an ephemeral detached Git worktree for a mission.
 * Guaranteed to run `git worktree remove --force` in a finally block.
 */
export async function withWorktree<T>(
  runId: string,
  arg2: WorktreeOptions | ((worktreePath: string) => Promise<T>),
  arg3?: WorktreeOptions | ((worktreePath: string) => Promise<T>),
): Promise<T> {
  const options: WorktreeOptions =
    typeof arg2 === "function" ? ((arg3 as WorktreeOptions) ?? {}) : arg2;
  const fn: (worktreePath: string) => Promise<T> =
    typeof arg2 === "function" ? arg2 : (arg3 as (worktreePath: string) => Promise<T>);

  if (typeof fn !== "function") {
    throw new Error("withWorktree requires an async callback function");
  }

  const executor = options.executor ?? defaultCommandExecutor;
  const repoRoot = options.repoRoot ?? process.cwd();
  const commitRef = options.commitRef ?? "HEAD";
  const sanitizedRunId = runId.replace(/[^a-zA-Z0-9_-]/g, "_");
  const relWorktreePath =
    options.worktreePath ?? path.posix.join(".worktrees", `mission-${sanitizedRunId}`);
  const resolvedWorktreePath = path.isAbsolute(relWorktreePath)
    ? relWorktreePath
    : path.resolve(repoRoot, relWorktreePath);

  try {
    await fs.promises.mkdir(path.dirname(resolvedWorktreePath), { recursive: true });
  } catch {
    // Ignore directory creation errors if already present
  }

  let worktreeCreated = false;
  try {
    const addResult = await executor(
      "git",
      ["worktree", "add", "--detach", relWorktreePath, commitRef],
      { cwd: repoRoot },
    );

    if (addResult.exitCode !== 0 || addResult.error) {
      throw new Error(
        `Failed to create git worktree at '${relWorktreePath}': ${addResult.stderr || addResult.error?.message || `exit code ${addResult.exitCode}`}`,
      );
    }

    worktreeCreated = true;
    return await fn(resolvedWorktreePath);
  } finally {
    if (worktreeCreated) {
      try {
        await executor("git", ["worktree", "remove", "--force", relWorktreePath], {
          cwd: repoRoot,
        });
      } catch {
        // Cleanup error logged or ignored to preserve main failure cause
      }
    }
  }
}

/**
 * Creates an active Git worktree session object with an explicit cleanup method.
 */
export async function createWorktreeSession(
  runId: string,
  options: WorktreeOptions = {},
): Promise<WorktreeSession> {
  const executor = options.executor ?? defaultCommandExecutor;
  const repoRoot = options.repoRoot ?? process.cwd();
  const commitRef = options.commitRef ?? "HEAD";
  const sanitizedRunId = runId.replace(/[^a-zA-Z0-9_-]/g, "_");
  const relWorktreePath =
    options.worktreePath ?? path.posix.join(".worktrees", `mission-${sanitizedRunId}`);
  const resolvedWorktreePath = path.isAbsolute(relWorktreePath)
    ? relWorktreePath
    : path.resolve(repoRoot, relWorktreePath);

  try {
    await fs.promises.mkdir(path.dirname(resolvedWorktreePath), { recursive: true });
  } catch {
    // ignore
  }

  const addResult = await executor(
    "git",
    ["worktree", "add", "--detach", relWorktreePath, commitRef],
    { cwd: repoRoot },
  );

  if (addResult.exitCode !== 0 || addResult.error) {
    throw new Error(
      `Failed to create git worktree at '${relWorktreePath}': ${addResult.stderr || addResult.error?.message || `exit code ${addResult.exitCode}`}`,
    );
  }

  let cleanedUp = false;
  const cleanup = async () => {
    if (cleanedUp) return;
    cleanedUp = true;
    await executor("git", ["worktree", "remove", "--force", relWorktreePath], {
      cwd: repoRoot,
    });
  };

  const execute = async <T>(fn: (worktreePath: string) => Promise<T>): Promise<T> => {
    return fn(resolvedWorktreePath);
  };

  return {
    runId,
    worktreePath: resolvedWorktreePath,
    execute,
    cleanup,
  };
}

/**
 * Class wrapper for worktree management.
 */
export class WorktreeManager {
  constructor(private defaultOptions: WorktreeOptions = {}) {}

  async withWorktree<T>(
    runId: string,
    fn: (worktreePath: string) => Promise<T>,
    options?: WorktreeOptions,
  ): Promise<T> {
    return withWorktree(runId, fn, { ...this.defaultOptions, ...options });
  }

  async createSession(runId: string, options?: WorktreeOptions): Promise<WorktreeSession> {
    return createWorktreeSession(runId, { ...this.defaultOptions, ...options });
  }
}

/**
 * Executes an AI CLI mission inside a dedicated ephemeral Git worktree.
 */
export async function runCliInWorktree(
  runId: string,
  options: CliWorktreeRunOptions,
): Promise<{
  worktreePath: string;
  result: CliRunResult;
}> {
  return withWorktree(runId, options.worktreeOptions ?? {}, async (worktreePath) => {
    const result = await runCli({
      ...options,
      worktreePath,
    });
    return { worktreePath, result };
  });
}

/**
 * Class wrapper for configuring and spawning AI CLI runs.
 */
export class CliRunner {
  constructor(
    private defaultOptions: Partial<CliRunnerOptions & WorktreeOptions> = {},
  ) {}

  async run(options: CliRunnerOptions): Promise<CliRunResult> {
    return runCli({ ...this.defaultOptions, ...options });
  }

  async runInWorktree(
    runId: string,
    prompt: string,
    options?: Partial<CliRunnerOptions & WorktreeOptions>,
  ): Promise<{ worktreePath: string; result: CliRunResult }> {
    const mergedOptions = { ...this.defaultOptions, ...options };
    return runCliInWorktree(runId, {
      prompt,
      ...mergedOptions,
      worktreeOptions: {
        repoRoot: mergedOptions.repoRoot,
        commitRef: mergedOptions.commitRef,
        executor: mergedOptions.executor,
        worktreePath: mergedOptions.worktreePath,
      },
    });
  }
}

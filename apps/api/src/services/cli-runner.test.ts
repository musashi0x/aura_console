import { describe, expect, it } from "vitest";

import type { CommandExecutionOptions, CommandExecutor } from "./cli-runner.js";
import {
  CliRunner,
  createWorktreeSession,
  defaultCommandExecutor,
  runCli,
  runCliInWorktree,
  withWorktree,
} from "./cli-runner.js";

describe("AI CLI Runner (cli-runner)", () => {
  it("runs successfully with Claude Code as default", async () => {
    const executedCalls: Array<{ command: string; args: string[]; options?: CommandExecutionOptions }> = [];

    const mockExecutor: CommandExecutor = async (command, args, options) => {
      executedCalls.push({ command, args, options });
      options?.onStdout?.("Claude starting mission...\n");
      options?.onStdout?.("Mission accomplished successfully.");
      return {
        exitCode: 0,
        stdout: "Claude starting mission...\nMission accomplished successfully.",
        stderr: "",
        timedOut: false,
      };
    };

    const stdoutChunks: string[] = [];
    const result = await runCli({
      prompt: "Implement feature X",
      worktreePath: "/tmp/worktree-1",
      executor: mockExecutor,
      onStdout: (chunk) => stdoutChunks.push(chunk),
    });

    expect(result.success).toBe(true);
    expect(result.cliUsed).toBe("claude");
    expect(result.exitCode).toBe(0);
    expect(result.timedOut).toBe(false);
    expect(result.stdout).toContain("Mission accomplished successfully.");
    expect(stdoutChunks.join("")).toContain("Mission accomplished successfully.");

    expect(executedCalls).toHaveLength(1);
    expect(executedCalls[0]?.command).toBe("claude");
    expect(executedCalls[0]?.args).toEqual([
      "-p",
      "Implement feature X",
      "--dangerously-skip-permissions",
    ]);
    expect(executedCalls[0]?.options?.cwd).toBe("/tmp/worktree-1");
  });

  it("gracefully falls back from Claude Code to Gemini CLI on non-zero exit code", async () => {
    const executedCommands: string[] = [];

    const mockExecutor: CommandExecutor = async (command, _args, options) => {
      executedCommands.push(command);
      if (command === "claude") {
        options?.onStderr?.("Claude encountered rate limit error");
        return {
          exitCode: 1,
          stdout: "",
          stderr: "Claude encountered rate limit error",
          timedOut: false,
        };
      }
      if (command === "gemini") {
        options?.onStdout?.("Gemini completed mission");
        return {
          exitCode: 0,
          stdout: "Gemini completed mission",
          stderr: "",
          timedOut: false,
        };
      }
      throw new Error(`Unexpected command: ${command}`);
    };

    const result = await runCli({
      prompt: "Refactor database service",
      worktreePath: "/tmp/worktree-fallback",
      executor: mockExecutor,
    });

    expect(result.success).toBe(true);
    expect(result.cliUsed).toBe("gemini");
    expect(result.exitCode).toBe(0);
    expect(result.timedOut).toBe(false);
    expect(result.stdout).toBe("Gemini completed mission");
    expect(executedCommands).toEqual(["claude", "gemini"]);
  });

  it("gracefully falls back from Claude Code to Gemini CLI on ENOENT error", async () => {
    const executedCommands: string[] = [];

    const mockExecutor: CommandExecutor = async (command) => {
      executedCommands.push(command);
      if (command === "claude") {
        const notFoundError = new Error("spawn claude ENOENT");
        return {
          exitCode: null,
          stdout: "",
          stderr: "claude: command not found",
          timedOut: false,
          error: notFoundError,
        };
      }
      return {
        exitCode: 0,
        stdout: "Gemini resolved prompt successfully",
        stderr: "",
        timedOut: false,
      };
    };

    const result = await runCli({
      prompt: "Fix test suite",
      worktreePath: "/tmp/worktree-enoent",
      executor: mockExecutor,
    });

    expect(result.success).toBe(true);
    expect(result.cliUsed).toBe("gemini");
    expect(result.stdout).toBe("Gemini resolved prompt successfully");
    expect(executedCommands).toEqual(["claude", "gemini"]);
  });

  it("reports failure when both Claude Code and Gemini CLI fail", async () => {
    const mockExecutor: CommandExecutor = async (command) => {
      if (command === "claude") {
        return {
          exitCode: 1,
          stdout: "",
          stderr: "Claude error",
          timedOut: false,
        };
      }
      return {
        exitCode: 2,
        stdout: "",
        stderr: "Gemini error",
        timedOut: false,
        error: new Error("Gemini internal failure"),
      };
    };

    const result = await runCli({
      prompt: "Impossible task",
      worktreePath: "/tmp/worktree-both-fail",
      executor: mockExecutor,
    });

    expect(result.success).toBe(false);
    expect(result.cliUsed).toBe("gemini");
    expect(result.exitCode).toBe(2);
    expect(result.error).toContain("Gemini internal failure");
    expect(result.stderr).toContain("Claude error");
    expect(result.stderr).toContain("Gemini error");
  });

  it("supports preferGemini option to invoke Gemini first", async () => {
    const executedCommands: string[] = [];

    const mockExecutor: CommandExecutor = async (command, args) => {
      executedCommands.push(command);
      expect(args).toEqual(["-p", "Preferred Gemini prompt"]);
      return {
        exitCode: 0,
        stdout: "Gemini direct response",
        stderr: "",
        timedOut: false,
      };
    };

    const result = await runCli({
      prompt: "Preferred Gemini prompt",
      worktreePath: "/tmp/worktree-prefer-gemini",
      preferGemini: true,
      executor: mockExecutor,
    });

    expect(result.success).toBe(true);
    expect(result.cliUsed).toBe("gemini");
    expect(result.stdout).toBe("Gemini direct response");
    expect(executedCommands).toEqual(["gemini"]);
  });

  it("creates worktree with --detach and cleans up with --force on normal completion", async () => {
    const gitCalls: Array<{ args: string[]; cwd?: string }> = [];

    const mockExecutor: CommandExecutor = async (command, args, options) => {
      expect(command).toBe("git");
      gitCalls.push({ args, cwd: options?.cwd });
      return {
        exitCode: 0,
        stdout: "",
        stderr: "",
        timedOut: false,
      };
    };

    let insideWorktreePath = "";
    const result = await withWorktree(
      "run-abc-123",
      async (worktreePath) => {
        insideWorktreePath = worktreePath;
        return { evaluated: true, path: worktreePath };
      },
      {
        executor: mockExecutor,
        repoRoot: "/mock/repo",
      },
    );

    expect(result.evaluated).toBe(true);
    expect(insideWorktreePath).toContain(".worktrees/mission-run-abc-123");

    expect(gitCalls).toHaveLength(2);
    expect(gitCalls[0]?.args).toEqual([
      "worktree",
      "add",
      "--detach",
      ".worktrees/mission-run-abc-123",
      "HEAD",
    ]);
    expect(gitCalls[0]?.cwd).toBe("/mock/repo");

    expect(gitCalls[1]?.args).toEqual([
      "worktree",
      "remove",
      "--force",
      ".worktrees/mission-run-abc-123",
    ]);
    expect(gitCalls[1]?.cwd).toBe("/mock/repo");
  });

  it("guarantees git worktree remove --force cleanup even when callback throws an exception", async () => {
    const gitCalls: Array<string[]> = [];

    const mockExecutor: CommandExecutor = async (command, args) => {
      expect(command).toBe("git");
      gitCalls.push(args);
      return {
        exitCode: 0,
        stdout: "",
        stderr: "",
        timedOut: false,
      };
    };

    await expect(
      withWorktree(
        "run-fail-456",
        { executor: mockExecutor, repoRoot: "/mock/repo" },
        async () => {
          throw new Error("Simulated catastrophic failure in worktree");
        },
      ),
    ).rejects.toThrow("Simulated catastrophic failure in worktree");

    expect(gitCalls).toHaveLength(2);
    expect(gitCalls[0]).toEqual([
      "worktree",
      "add",
      "--detach",
      ".worktrees/mission-run-fail-456",
      "HEAD",
    ]);
    expect(gitCalls[1]).toEqual([
      "worktree",
      "remove",
      "--force",
      ".worktrees/mission-run-fail-456",
    ]);
  });

  it("enforces execution timeout and terminates runaway process without falling back", async () => {
    const mockExecutor: CommandExecutor = async () => {
      return {
        exitCode: null,
        stdout: "Started long task...",
        stderr: "",
        timedOut: true,
        error: new Error("Command timed out after 500ms"),
      };
    };

    const result = await runCli({
      prompt: "Infinite loop task",
      worktreePath: "/tmp/worktree-timeout",
      timeoutMs: 500,
      executor: mockExecutor,
    });

    expect(result.success).toBe(false);
    expect(result.timedOut).toBe(true);
    expect(result.error).toContain("timed out after 500ms");
    expect(result.cliUsed).toBe("claude");
  });

  it("ensures worktree cleanup executes when runCliInWorktree times out", async () => {
    const gitCalls: Array<string[]> = [];

    const mockExecutor: CommandExecutor = async (command, args) => {
      if (command === "git") {
        gitCalls.push(args);
        return { exitCode: 0, stdout: "", stderr: "", timedOut: false };
      }
      return {
        exitCode: null,
        stdout: "",
        stderr: "Process terminated due to timeout",
        timedOut: true,
        error: new Error("Execution timed out"),
      };
    };

    const runPromise = runCliInWorktree("timeout-run", {
      prompt: "Timeout in worktree",
      timeoutMs: 1000,
      executor: mockExecutor,
      worktreeOptions: {
        repoRoot: "/mock/repo",
        executor: mockExecutor,
      },
    });

    const { result } = await runPromise;
    expect(result.timedOut).toBe(true);
    expect(result.success).toBe(false);

    expect(gitCalls).toEqual([
      ["worktree", "add", "--detach", ".worktrees/mission-timeout-run", "HEAD"],
      ["worktree", "remove", "--force", ".worktrees/mission-timeout-run"],
    ]);
  });

  it("streams stdout and stderr logs cleanly", async () => {
    const stdoutLog: string[] = [];
    const stderrLog: string[] = [];

    const mockExecutor: CommandExecutor = async (_cmd, _args, options) => {
      options?.onStdout?.("Line 1\n");
      options?.onStderr?.("Warn 1\n");
      options?.onStdout?.("Line 2\n");
      options?.onStderr?.("Warn 2\n");
      return {
        exitCode: 0,
        stdout: "Line 1\nLine 2\n",
        stderr: "Warn 1\nWarn 2\n",
        timedOut: false,
      };
    };

    const result = await runCli({
      prompt: "Streaming test",
      worktreePath: "/tmp/worktree-stream",
      executor: mockExecutor,
      onStdout: (chunk) => stdoutLog.push(chunk),
      onStderr: (chunk) => stderrLog.push(chunk),
    });

    expect(result.success).toBe(true);
    expect(stdoutLog).toEqual(["Line 1\n", "Line 2\n"]);
    expect(stderrLog).toEqual(["Warn 1\n", "Warn 2\n"]);
    expect(result.stdout).toBe("Line 1\nLine 2\n");
    expect(result.stderr).toBe("Warn 1\nWarn 2\n");
  });

  it("manages worktree session lifecycle through createWorktreeSession", async () => {
    const gitCalls: Array<string[]> = [];

    const mockExecutor: CommandExecutor = async (_command, args) => {
      gitCalls.push(args);
      return { exitCode: 0, stdout: "", stderr: "", timedOut: false };
    };

    const session = await createWorktreeSession("session-123", {
      executor: mockExecutor,
      repoRoot: "/mock/repo",
    });

    expect(session.runId).toBe("session-123");
    expect(session.worktreePath).toContain(".worktrees/mission-session-123");

    const execResult = await session.execute(async (path) => {
      return `Executed in ${path}`;
    });
    expect(execResult).toContain(".worktrees/mission-session-123");

    await session.cleanup();
    // Subsequent cleanup should be a no-op
    await session.cleanup();

    expect(gitCalls).toEqual([
      ["worktree", "add", "--detach", ".worktrees/mission-session-123", "HEAD"],
      ["worktree", "remove", "--force", ".worktrees/mission-session-123"],
    ]);
  });

  it("supports CliRunner class wrapper with default options", async () => {
    const mockExecutor: CommandExecutor = async () => ({
      exitCode: 0,
      stdout: "Class runner success",
      stderr: "",
      timedOut: false,
    });

    const runner = new CliRunner({
      executor: mockExecutor,
      timeoutMs: 60_000,
    });

    const result = await runner.run({
      prompt: "Class test",
      worktreePath: "/tmp/class-worktree",
    });

    expect(result.success).toBe(true);
    expect(result.stdout).toBe("Class runner success");
  });

  it("terminates runaway real child process with defaultCommandExecutor timeout", async () => {
    // Spawns a real Node process that loops indefinitely, testing real SIGTERM/SIGKILL termination
    const startTime = Date.now();
    const result = await defaultCommandExecutor(
      process.execPath,
      ["-e", "setInterval(() => {}, 1000);"],
      { timeoutMs: 250 },
    );
    const duration = Date.now() - startTime;

    expect(result.timedOut).toBe(true);
    expect(result.error).toBeDefined();
    expect(result.error?.message).toContain("Command timed out after 250ms");
    expect(duration).toBeLessThan(3500);
  });
});

import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";

import type { CommandExecutor } from "./cli-runner.js";
import { MissionExecutionService } from "./mission-execution.js";
import { RunStore } from "./run-store.js";

describe("MissionExecutionService (Post-Approval Loop)", () => {
  const store = new RunStore();
  const service = new MissionExecutionService(store);

  async function createRun(objective = "Test post-approval mission execution") {
    return store.createRun({
      objective,
      source: "AGENT",
      budgetUsdc: "50.000000",
    });
  }

  async function appendEvent(runId: string, type: string, data: Record<string, unknown>) {
    return store.appendEvent({
      runId,
      eventId: randomUUID(),
      type,
      eventTime: new Date(),
      data,
    });
  }

  it("successfully executes mission on approved run: resumes, funds, verifies, settles, and writes outcome", async () => {
    const run = await createRun("Purchase dataset from provider");
    const counterpartyKey = "virtuals:agent:beta";
    const ceilingUsdc = "18.500000";

    // 1. Setup requested and granted approval
    await appendEvent(run.id, "approval.requested", {
      action: "Fund the dataset delivery",
      counterparty_key: counterpartyKey,
      ceiling_usdc: ceilingUsdc,
    });

    await appendEvent(run.id, "approval.granted", {
      summary: "Operator approved dataset delivery",
      ceiling_usdc: ceilingUsdc,
      counterparty_key: counterpartyKey,
      granted_via: "console_operator_click",
    });

    // 2. Mock a passing verification
    const mockExecutor: CommandExecutor = async (command, args) => {
      if (command === "git" && args[0] === "diff") {
        return { exitCode: 0, stdout: "diff --git a/data.csv b/data.csv\n+val1,val2", stderr: "", timedOut: false };
      }
      if (command === "pnpm" || command === "echo") {
        return { exitCode: 0, stdout: "All 5 tests passed", stderr: "", timedOut: false };
      }
      return { exitCode: 0, stdout: "", stderr: "", timedOut: false };
    };

    const result = await service.execute({
      runId: run.id,
      executor: mockExecutor,
    });

    expect(result.status).toBe("COMPLETED");
    expect(result.counterpartyKey).toBe(counterpartyKey);
    expect(result.amountUsdc).toBe(ceilingUsdc);
    expect(result.evaluation.tests_passed).toBe(true);
    expect(result.reputation.totalMissions).toBeGreaterThanOrEqual(1);
    expect(result.reputation.overallReliability).toBeGreaterThan(0.5);

    // 3. Inspect event log order and data contracts
    const events = await store.listEvents(run.id);
    const eventTypes = events.map((e) => e.type);

    expect(eventTypes).toEqual([
      "run.created",
      "approval.requested",
      "approval.granted",
      "run.resumed",
      "acp.job.funded",
      "evaluation.completed",
      "commitment.settled",
      "outcome.recorded",
      "memory.commitment.confirmed",
      "memory.diff.published",
    ]);

    // Check acp.job.funded contract
    const fundedEvent = events.find((e) => e.type === "acp.job.funded")!;
    const fundedData = fundedEvent.data as Record<string, unknown>;
    expect(fundedData.counterparty_key).toBe(counterpartyKey);
    expect(fundedData.amount_usdc).toBe(ceilingUsdc);
    expect(fundedData.job_state).toBe("FUNDED");

    // Check evaluation.completed contract
    const evalEvent = events.find((e) => e.type === "evaluation.completed")!;
    const evalData = evalEvent.data as Record<string, unknown>;
    expect(evalData.result).toBe("ACCEPTED");
    expect(evalData.evaluated_by).toBe("verifier_agent");
    expect(evalData.score).toBeGreaterThan(0);

    // Check commitment.settled contract
    const settledEvent = events.find((e) => e.type === "commitment.settled")!;
    const settledData = settledEvent.data as Record<string, unknown>;
    expect(settledData.amount_usdc).toBe(ceilingUsdc);
    expect(settledData.network).toBe("base-sepolia");
    expect(String(settledData.tx_hash)).toMatch(/^0x[a-f0-9]{64}$/);

    // Check outcome.recorded contract
    const outcomeEvent = events.find((e) => e.type === "outcome.recorded")!;
    const outcomeData = outcomeEvent.data as Record<string, unknown>;
    expect(outcomeData.result).toBe("ACCEPTED");
    expect(outcomeData.outcome).toBe("accepted");
  });

  it("handles failed verification: funds job, records rejection, updates reputation, but NEVER settles commitment", async () => {
    const run = await createRun("Purchase failing deliverable");
    const counterpartyKey = "test:failing:agent";
    const ceilingUsdc = "10.000000";

    await appendEvent(run.id, "approval.requested", {
      action: "Fund the risky task",
      counterparty_key: counterpartyKey,
      ceiling_usdc: ceilingUsdc,
    });

    await appendEvent(run.id, "approval.granted", {
      summary: "Operator approved risky task",
      ceiling_usdc: ceilingUsdc,
      counterparty_key: counterpartyKey,
      granted_via: "console_operator_click",
    });

    // Run execution with failed verification
    const result = await service.execute({
      runId: run.id,
      evaluationOverride: {
        tests_passed: false,
        score: 0.0,
        summary: "Verifier found failing integration tests",
        failure_reason: "Exit code 1: TypeError on handler",
      },
    });

    expect(result.status).toBe("REJECTED");
    expect(result.evaluation.tests_passed).toBe(false);
    expect(result.evaluation.failure_reason).toBe("Exit code 1: TypeError on handler");

    const events = await store.listEvents(run.id);
    const eventTypes = events.map((e) => e.type);

    // CRUCIAL INVARIANT: commitment.settled is NOT emitted when verification fails
    expect(eventTypes).not.toContain("commitment.settled");
    expect(eventTypes).toContain("evaluation.completed");
    expect(eventTypes).toContain("outcome.recorded");

    const outcomeEvent = events.find((e) => e.type === "outcome.recorded")!;
    const outcomeData = outcomeEvent.data as Record<string, unknown>;
    expect(outcomeData.result).toBe("REJECTED");
    expect(outcomeData.outcome).toBe("rejected");
    expect(outcomeData.failure_reason).toBe("Exit code 1: TypeError on handler");
  });

  it("is idempotent: re-executing an already finalized run returns the existing outcome without appending duplicate events", async () => {
    const run = await createRun("Idempotency test run");
    const counterpartyKey = "virtuals:agent:alpha";

    await appendEvent(run.id, "approval.granted", {
      ceiling_usdc: "5.000000",
      counterparty_key: counterpartyKey,
    });

    const firstResult = await service.execute({
      runId: run.id,
      evaluationOverride: { tests_passed: true, score: 1.0, summary: "Initial execution" },
    });
    expect(firstResult.status).toBe("COMPLETED");

    const eventsCountAfterFirst = (await store.listEvents(run.id)).length;

    // Second execution on same run
    const secondResult = await service.execute({
      runId: run.id,
    });
    expect(secondResult.status).toBe("COMPLETED");

    const eventsCountAfterSecond = (await store.listEvents(run.id)).length;
    expect(eventsCountAfterSecond).toBe(eventsCountAfterFirst);
  });

  it("supports mode: CLI_WORKER, executing in isolated git worktree with local AI CLI and verifier", async () => {
    const run = await createRun("CLI Worker sandbox mission");
    const counterpartyKey = "virtuals:agent:beta";

    await appendEvent(run.id, "approval.granted", {
      ceiling_usdc: "20.000000",
      counterparty_key: counterpartyKey,
      mode: "CLI_WORKER",
    });

    const commandsRun: string[] = [];
    const mockExecutor: CommandExecutor = async (command, args) => {
      commandsRun.push(`${command} ${args.join(" ")}`);
      if (command === "git" && args[0] === "worktree") {
        return { exitCode: 0, stdout: "Preparing worktree", stderr: "", timedOut: false };
      }
      if (command === "claude" || command === "gemini") {
        return { exitCode: 0, stdout: "CLI completed task: wrote files", stderr: "", timedOut: false };
      }
      if (command === "git" && args[0] === "diff") {
        return { exitCode: 0, stdout: "diff --git a/work.ts b/work.ts\n+export const done = true;", stderr: "", timedOut: false };
      }
      if (command === "echo") {
        return { exitCode: 0, stdout: "tests passed", stderr: "", timedOut: false };
      }
      return { exitCode: 0, stdout: "", stderr: "", timedOut: false };
    };

    const result = await service.execute({
      runId: run.id,
      mode: "CLI_WORKER",
      executor: mockExecutor,
    });

    expect(result.status).toBe("COMPLETED");
    expect(result.evaluation.tests_passed).toBe(true);

    // Verify git worktree add and git worktree remove were both called
    expect(commandsRun.some((cmd) => cmd.includes("git worktree add"))).toBe(true);
    expect(commandsRun.some((cmd) => cmd.includes("git worktree remove"))).toBe(true);

    const events = await store.listEvents(run.id);
    expect(events.some((e) => e.type === "commitment.settled")).toBe(true);
    expect(events.some((e) => e.type === "outcome.recorded")).toBe(true);
  });

  it("refuses execution if approval has not been granted", async () => {
    const run = await createRun("Unapproved run");
    await expect(service.execute({ runId: run.id })).rejects.toThrow(
      /no approval has been granted/,
    );
  });

  it("refuses execution if run does not exist", async () => {
    const nonExistentId = randomUUID();
    await expect(service.execute({ runId: nonExistentId })).rejects.toThrow(
      /Run .* not found/,
    );
  });
});

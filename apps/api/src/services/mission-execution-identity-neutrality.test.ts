import { randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import type { CommandExecutor } from "./cli-runner.js";
import { MissionExecutionService } from "./mission-execution.js";
import { RunStore } from "./run-store.js";
import { retrieveFromSibyl } from "./sibyl.js";

describe("Empirical Challenge: Mission Execution Identity-Neutrality & Deliverable Verification", () => {
  const store = new RunStore();
  const service = new MissionExecutionService(store);

  async function createRun(objective = "Competitor research and market analysis") {
    return store.createRun({
      objective,
      source: "AGENT",
      budgetUsdc: "50.000000",
    });
  }

  async function grantApproval(runId: string, counterpartyKey: string, ceilingUsdc = "20.000000", mode?: string) {
    await store.appendEvent({
      runId,
      eventId: randomUUID(),
      type: "approval.requested",
      eventTime: new Date(),
      data: {
        action: "Fund the mission deliverable",
        counterparty_key: counterpartyKey,
        ceiling_usdc: ceilingUsdc,
      },
    });

    await store.appendEvent({
      runId,
      eventId: randomUUID(),
      type: "approval.granted",
      eventTime: new Date(),
      data: {
        summary: `Operator approved delivery for ${counterpartyKey}`,
        ceiling_usdc: ceilingUsdc,
        counterparty_key: counterpartyKey,
        granted_via: "console_operator_click",
        ...(mode ? { mode } : {}),
      },
    });
  }

  // --------------------------------------------------------------------------
  // Suite 1: Identity Neutrality for "alpha"
  // --------------------------------------------------------------------------
  describe("Suite 1: Identity Neutrality for 'alpha'", () => {
    it("allows provider named 'virtuals:agent:alpha' to PASS with score 1.0 when producing a valid 3-competitor deliverable", async () => {
      const run = await createRun("Competitor analysis for database solutions");
      const counterpartyKey = "virtuals:agent:alpha";
      await grantApproval(run.id, counterpartyKey);

      const worktreeDir = fs.mkdtempSync(path.join(os.tmpdir(), "aura-alpha-valid-"));
      try {
        const validReport = {
          competitors: [
            {
              name: "Acme Cloud DB",
              website: "https://acmedb.example.com",
              sources: ["https://acmedb.example.com/pricing", "https://techcrunch.com/acmedb"],
              description: "Distributed SQL engine",
            },
            {
              name: "Bravo Data Store",
              website: "https://bravodata.io",
              sources: ["https://bravodata.io/whitepaper.pdf"],
              description: "In-memory key-value cache",
            },
            {
              name: "Charlie Vector Labs",
              website: "https://charlievector.ai",
              sources: ["https://charlievector.ai/benchmarks"],
              description: "HNSW vector indexing service",
            },
          ],
          taskGoal: "Research database competitors",
          summary: "Identified 3 market leaders with verified endpoints",
        };

        fs.writeFileSync(
          path.join(worktreeDir, "competitor-report.json"),
          JSON.stringify(validReport, null, 2),
        );

        const result = await service.execute({
          runId: run.id,
          worktreePath: worktreeDir,
        });

        // 1. Result must be COMPLETED, tests_passed = true, score = 1.0
        expect(result.status).toBe("COMPLETED");
        expect(result.evaluation.tests_passed).toBe(true);
        expect(result.evaluation.score).toBe(1.0);
        expect(result.counterpartyKey).toBe(counterpartyKey);
        expect(result.evaluation.competitorsCount).toBe(3);

        // 2. Settlement MUST be emitted (proof that alpha is not blocked or failed)
        const events = await store.listEvents(run.id);
        const settledEvent = events.find((e) => e.type === "commitment.settled");
        expect(settledEvent).toBeDefined();
        const settledData = settledEvent?.data as Record<string, unknown>;
        expect(settledData?.amount_usdc).toBe("20.000000");

        // 3. Outcome recorded as ACCEPTED
        const outcomeEvent = events.find((e) => e.type === "outcome.recorded");
        expect(outcomeEvent).toBeDefined();
        const outcomeData = outcomeEvent?.data as Record<string, unknown>;
        expect(outcomeData?.result).toBe("ACCEPTED");
        expect(outcomeData?.outcome).toBe("accepted");
        expect(outcomeData?.score).toBe(1.0);

        // 4. Sibyl reputation state updated successfully
        const sibylRecord = await retrieveFromSibyl(counterpartyKey);
        expect(sibylRecord.status).toBe("AVAILABLE");
        if (sibylRecord.status === "AVAILABLE") {
          expect(sibylRecord.overallReliability).toBeGreaterThan(0.5);
        }
      } finally {
        fs.rmSync(worktreeDir, { recursive: true, force: true });
      }
    });

    it("allows provider named 'vendor:alpha' to PASS even when run objective explicitly contains 'alpha'", async () => {
      const run = await createRun("Alpha benchmarking: evaluate competitor products against alpha standards");
      const counterpartyKey = "vendor:alpha";
      await grantApproval(run.id, counterpartyKey);

      const worktreeDir = fs.mkdtempSync(path.join(os.tmpdir(), "aura-alpha-prompt-"));
      try {
        const validReport = {
          competitors: [
            { name: "Alpha Competitor 1", website: "https://c1.org", sources: ["https://c1.org/about"] },
            { name: "Alpha Competitor 2", website: "https://c2.org", sources: ["https://c2.org/about"] },
            { name: "Alpha Competitor 3", website: "https://c3.org", sources: ["https://c3.org/about"] },
          ],
        };

        fs.writeFileSync(
          path.join(worktreeDir, "deliverable.json"),
          JSON.stringify(validReport),
        );

        const result = await service.execute({
          runId: run.id,
          worktreePath: worktreeDir,
        });

        expect(result.status).toBe("COMPLETED");
        expect(result.evaluation.tests_passed).toBe(true);
        expect(result.evaluation.score).toBe(1.0);

        const events = await store.listEvents(run.id);
        expect(events.some((e) => e.type === "commitment.settled")).toBe(true);
      } finally {
        fs.rmSync(worktreeDir, { recursive: true, force: true });
      }
    });
  });

  // --------------------------------------------------------------------------
  // Suite 2: Content-Dependent Rejection for "beta", "gamma", etc.
  // --------------------------------------------------------------------------
  describe("Suite 2: Content-Dependent Rejection for Non-Alpha Providers", () => {
    it("rejects provider named 'virtuals:agent:beta' when deliverable has only 2 competitors (< 3)", async () => {
      const run = await createRun("Research competitors for API services");
      const counterpartyKey = "virtuals:agent:beta";
      await grantApproval(run.id, counterpartyKey);

      const worktreeDir = fs.mkdtempSync(path.join(os.tmpdir(), "aura-beta-defective-"));
      try {
        // Only 2 competitors (violates min: 3 requirement)
        const defectiveReport = {
          competitors: [
            { name: "Comp 1", website: "https://comp1.com", sources: ["https://comp1.com/src"] },
            { name: "Comp 2", website: "https://comp2.com", sources: ["https://comp2.com/src"] },
          ],
        };

        fs.writeFileSync(
          path.join(worktreeDir, "competitor-report.json"),
          JSON.stringify(defectiveReport),
        );

        const result = await service.execute({
          runId: run.id,
          worktreePath: worktreeDir,
        });

        // 1. Result must be REJECTED with score 0.0
        expect(result.status).toBe("REJECTED");
        expect(result.evaluation.tests_passed).toBe(false);
        expect(result.evaluation.score).toBe(0.0);
        expect(result.evaluation.failure_reason).toMatch(/Expected >= 3 competitors/i);
        expect(result.evaluation.errors).toBeDefined();
        expect(result.evaluation.errors?.some((e) => e.includes("Expected >= 3 competitors"))).toBe(true);

        // 2. CRITICAL FAIL-CLOSED INVARIANT: commitment.settled is NEVER emitted
        const events = await store.listEvents(run.id);
        expect(events.some((e) => e.type === "commitment.settled")).toBe(false);

        // 3. Outcome recorded as REJECTED with failure reason and errors
        const outcomeEvent = events.find((e) => e.type === "outcome.recorded");
        expect(outcomeEvent).toBeDefined();
        const outcomeData = outcomeEvent?.data as Record<string, unknown>;
        expect(outcomeData?.result).toBe("REJECTED");
        expect(outcomeData?.outcome).toBe("rejected");
        expect(outcomeData?.score).toBe(0.0);
        expect(outcomeData?.failure_reason).toMatch(/Expected >= 3 competitors/i);

        // 4. Evaluation event contains structured errors
        const evalEvent = events.find((e) => e.type === "evaluation.completed");
        expect(evalEvent).toBeDefined();
        const evalData = evalEvent?.data as Record<string, unknown>;
        expect(evalData?.result).toBe("REJECTED");
        expect(Array.isArray(evalData?.errors)).toBe(true);

        // 5. Sibyl record reflects failure transition to WATCH
        const sibylRecord = await retrieveFromSibyl(counterpartyKey);
        expect(sibylRecord.status).toBe("AVAILABLE");
        if (sibylRecord.status === "AVAILABLE") {
          expect(sibylRecord.relationshipStatus).toBe("WATCH");
        }
      } finally {
        fs.rmSync(worktreeDir, { recursive: true, force: true });
      }
    });

    it("rejects provider named 'vendor:gamma' when deliverable has 3 competitors but missing citation sources", async () => {
      const run = await createRun("Analyze competitor capabilities");
      const counterpartyKey = "vendor:gamma";
      await grantApproval(run.id, counterpartyKey);

      const worktreeDir = fs.mkdtempSync(path.join(os.tmpdir(), "aura-gamma-nosources-"));
      try {
        const defectiveReport = {
          competitors: [
            { name: "Comp 1", website: "https://c1.org", sources: ["https://c1.org/news"] },
            { name: "Comp 2", website: "https://c2.org", sources: [] }, // EMPTY sources!
            { name: "Comp 3", website: "https://c3.org", sources: ["https://c3.org/news"] },
          ],
        };

        fs.writeFileSync(
          path.join(worktreeDir, "competitors.json"),
          JSON.stringify(defectiveReport),
        );

        const result = await service.execute({
          runId: run.id,
          worktreePath: worktreeDir,
        });

        expect(result.status).toBe("REJECTED");
        expect(result.evaluation.tests_passed).toBe(false);
        expect(result.evaluation.score).toBe(0.0);
        expect(result.evaluation.failure_reason).toMatch(/sources/i);
        expect(result.evaluation.errors?.some((e) => e.includes("sources"))).toBe(true);

        const events = await store.listEvents(run.id);
        expect(events.some((e) => e.type === "commitment.settled")).toBe(false);
      } finally {
        fs.rmSync(worktreeDir, { recursive: true, force: true });
      }
    });

    it("rejects provider named 'vendor:delta' when deliverable contains non-http URL schemes", async () => {
      const run = await createRun("Competitor analysis with security audit");
      const counterpartyKey = "vendor:delta";
      await grantApproval(run.id, counterpartyKey);

      const worktreeDir = fs.mkdtempSync(path.join(os.tmpdir(), "aura-delta-scheme-"));
      try {
        const defectiveReport = {
          competitors: [
            { name: "Comp 1", website: "javascript:void(0)", sources: ["https://c1.org/src"] },
            { name: "Comp 2", website: "https://c2.org", sources: ["ftp://ftp.c2.org/file"] },
            { name: "Comp 3", website: "https://c3.org", sources: ["https://c3.org/src"] },
          ],
        };

        fs.writeFileSync(
          path.join(worktreeDir, "deliverable.json"),
          JSON.stringify(defectiveReport),
        );

        const result = await service.execute({
          runId: run.id,
          worktreePath: worktreeDir,
        });

        expect(result.status).toBe("REJECTED");
        expect(result.evaluation.tests_passed).toBe(false);
        expect(result.evaluation.score).toBe(0.0);
        expect(result.evaluation.failure_reason).toMatch(/URL/i);

        const events = await store.listEvents(run.id);
        expect(events.some((e) => e.type === "commitment.settled")).toBe(false);
      } finally {
        fs.rmSync(worktreeDir, { recursive: true, force: true });
      }
    });

    it("rejects provider when deliverable JSON is malformed syntax", async () => {
      const run = await createRun("Market review");
      const counterpartyKey = "vendor:epsilon";
      await grantApproval(run.id, counterpartyKey);

      const worktreeDir = fs.mkdtempSync(path.join(os.tmpdir(), "aura-epsilon-malformed-"));
      try {
        fs.writeFileSync(
          path.join(worktreeDir, "competitor-report.json"),
          '{ "competitors": [ { name: "broken json without closing',
        );

        const result = await service.execute({
          runId: run.id,
          worktreePath: worktreeDir,
        });

        expect(result.status).toBe("REJECTED");
        expect(result.evaluation.tests_passed).toBe(false);
        expect(result.evaluation.score).toBe(0.0);
        expect(result.evaluation.failure_reason).toMatch(/Invalid JSON format/i);

        const events = await store.listEvents(run.id);
        expect(events.some((e) => e.type === "commitment.settled")).toBe(false);
      } finally {
        fs.rmSync(worktreeDir, { recursive: true, force: true });
      }
    });

    it("rejects provider when deliverable file is empty (0 bytes)", async () => {
      const run = await createRun("Market review");
      const counterpartyKey = "vendor:zeta";
      await grantApproval(run.id, counterpartyKey);

      const worktreeDir = fs.mkdtempSync(path.join(os.tmpdir(), "aura-zeta-empty-"));
      try {
        fs.writeFileSync(path.join(worktreeDir, "report.json"), "");

        const result = await service.execute({
          runId: run.id,
          worktreePath: worktreeDir,
        });

        expect(result.status).toBe("REJECTED");
        expect(result.evaluation.tests_passed).toBe(false);
        expect(result.evaluation.score).toBe(0.0);
        expect(result.evaluation.failure_reason).toMatch(/empty/i);

        const events = await store.listEvents(run.id);
        expect(events.some((e) => e.type === "commitment.settled")).toBe(false);
      } finally {
        fs.rmSync(worktreeDir, { recursive: true, force: true });
      }
    });
  });

  // --------------------------------------------------------------------------
  // Suite 3: CLI Worker Mode & No Synthetic Overrides
  // --------------------------------------------------------------------------
  describe("Suite 3: CLI Worker Mode & No Synthetic Overrides", () => {
    it("does NOT convert CLI failure into a pass: retains score 0.0 and fail-closed state", async () => {
      const run = await createRun("Sandbox CLI mission that fails");
      const counterpartyKey = "vendor:failing-cli";
      await grantApproval(run.id, counterpartyKey, "25.000000", "CLI_WORKER");

      // Mock executor where local AI CLI process exits with non-zero code
      const mockFailingExecutor: CommandExecutor = async (command, args) => {
        if (command === "git" && args[0] === "worktree") {
          return { exitCode: 0, stdout: "worktree created", stderr: "", timedOut: false };
        }
        if (command === "claude" || command === "gemini") {
          return {
            exitCode: 1,
            stdout: "",
            stderr: "Error: AI CLI hit rate limit or execution timeout",
            timedOut: false,
            error: new Error("AI CLI process exited with code 1"),
          };
        }
        return { exitCode: 0, stdout: "", stderr: "", timedOut: false };
      };

      const result = await service.execute({
        runId: run.id,
        mode: "CLI_WORKER",
        executor: mockFailingExecutor,
      });

      // Verification MUST remain failed: NO mock override should convert this to 1.0
      expect(result.status).toBe("REJECTED");
      expect(result.evaluation.tests_passed).toBe(false);
      expect(result.evaluation.score).toBe(0.0);
      expect(result.evaluation.failure_reason).toMatch(/AI CLI|No changes/i);

      const events = await store.listEvents(run.id);
      expect(events.some((e) => e.type === "commitment.settled")).toBe(false);
      expect(events.some((e) => e.type === "outcome.recorded")).toBe(true);

      const outcomeEvent = events.find((e) => e.type === "outcome.recorded")!;
      const outcomeData = outcomeEvent.data as Record<string, unknown>;
      expect(outcomeData.result).toBe("REJECTED");
      expect(outcomeData.score).toBe(0.0);
    });

    it("verifies that missing executor in deterministic mode with failed tests does NOT get forced to pass", async () => {
      const run = await createRun("Code review task without deliverable file");
      const counterpartyKey = "vendor:test-failure";
      await grantApproval(run.id, counterpartyKey);

      const emptyWorktree = fs.mkdtempSync(path.join(os.tmpdir(), "aura-deterministic-fail-"));
      try {
        // Provide mock executor that fails tests
        const failingTestExecutor: CommandExecutor = async (command, _args) => {
          if (command === "git") {
            return { exitCode: 0, stdout: "diff --git a/file b/file\n+change", stderr: "", timedOut: false };
          }
          if (command === "pnpm") {
            return { exitCode: 1, stdout: "1 test failed", stderr: "FAIL src/test.ts", timedOut: false };
          }
          return { exitCode: 0, stdout: "", stderr: "", timedOut: false };
        };

        const result = await service.execute({
          runId: run.id,
          worktreePath: emptyWorktree,
          executor: failingTestExecutor,
          testCommand: "pnpm test",
        });

        expect(result.status).toBe("REJECTED");
        expect(result.evaluation.tests_passed).toBe(false);
        expect(result.evaluation.score).toBe(0.0);

        const events = await store.listEvents(run.id);
        expect(events.some((e) => e.type === "commitment.settled")).toBe(false);
      } finally {
        fs.rmSync(emptyWorktree, { recursive: true, force: true });
      }
    });
  });

  // --------------------------------------------------------------------------
  // Suite 4: ACP Outcome Recording Neutrality
  // --------------------------------------------------------------------------
  describe("Suite 4: ACP Outcome Recording Neutrality", () => {
    it("recordAcpOutcome accepts 'alpha' when action is 'complete' without substring-based inversion", async () => {
      const run = await createRun("Acquire alpha competitor data");
      const counterpartyKey = "virtuals:agent:alpha";

      const outcome = await service.recordAcpOutcome({
        runId: run.id,
        action: "complete",
        counterpartyKey,
      });

      expect(outcome.status).toBe("COMPLETED");
      expect(outcome.counterpartyKey).toBe(counterpartyKey);

      const events = await store.listEvents(run.id);
      const outcomeEvt = events.find((e) => e.type === "outcome.recorded");
      const outcomeData = outcomeEvt?.data as Record<string, unknown>;
      expect(outcomeData?.result).toBe("ACCEPTED");
      expect(outcomeData?.outcome).toBe("accepted");
    });

    it("recordAcpOutcome rejects 'beta' when action is 'reject' without substring-based inversion", async () => {
      const run = await createRun("Acquire beta competitor data");
      const counterpartyKey = "virtuals:agent:beta";

      const outcome = await service.recordAcpOutcome({
        runId: run.id,
        action: "reject",
        reason: "Operator determined report was inaccurate",
        counterpartyKey,
      });

      expect(outcome.status).toBe("REJECTED");
      expect(outcome.counterpartyKey).toBe(counterpartyKey);

      const events = await store.listEvents(run.id);
      const outcomeEvt = events.find((e) => e.type === "outcome.recorded");
      const outcomeData = outcomeEvt?.data as Record<string, unknown>;
      expect(outcomeData?.result).toBe("REJECTED");
      expect(outcomeData?.outcome).toBe("rejected");
      expect(outcomeData?.failure_reason).toBe("Operator determined report was inaccurate");
    });
  });

  // --------------------------------------------------------------------------
  // Suite 5: Static Code Security Audit
  // --------------------------------------------------------------------------
  describe("Suite 5: Static Code Security Audit of mission-execution.ts", () => {
    it("strictly confirms zero occurrences of echo 'tests passed', fake overrides, and identity substring branches", () => {
      const filePath = path.resolve(__dirname, "mission-execution.ts");
      const sourceCode = fs.readFileSync(filePath, "utf-8");

      // Invariant 1: No echo 'tests passed'
      expect(sourceCode).not.toContain("echo 'tests passed'");
      expect(sourceCode).not.toContain('echo "tests passed"');

      // Invariant 2: No identity substring checks on "alpha"
      expect(sourceCode).not.toContain('counterpartyKey.includes("alpha")');
      expect(sourceCode).not.toContain("counterpartyKey.includes('alpha')");
      expect(sourceCode).not.toContain('.includes("alpha")');
      expect(sourceCode).not.toContain(".includes('alpha')");

      // Invariant 3: No identity substring checks on "beta"
      expect(sourceCode).not.toContain('counterpartyKey.includes("beta")');
      expect(sourceCode).not.toContain("counterpartyKey.includes('beta')");
      expect(sourceCode).not.toContain('.includes("beta")');
      expect(sourceCode).not.toContain(".includes('beta')");

      // Invariant 4: No fake pass override when executor is missing
      expect(sourceCode).not.toContain("if (!evaluation.tests_passed && !options.executor)");
      expect(sourceCode).not.toContain("!evaluation.tests_passed && !options.executor");
    });
  });
});

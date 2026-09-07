import { describe, expect, it } from "vitest";

import { app } from "../app.js";
import { env } from "../env.js";
import { PolicyStore } from "../services/policy-store.js";
import { RunStore } from "../services/run-store.js";
import { missionProposeApprovalTool } from "./tools.js";

const runStore = new RunStore();
const policyStore = new PolicyStore();

async function createTestRun(objective = "Test spend proposal") {
  return runStore.createRun({
    objective,
    source: "CONSOLE",
    budgetUsdc: "100.000000",
  });
}

describe("Adversarial Challenge: mission_propose_approval", () => {
  describe("1. Malformed Inputs", () => {
    it("1.1 non-numeric string for amountUsdc is rejected by parameter schema", async () => {
      const run = await createTestRun();

      // REMEDIATED: Schema rejects non-numeric string like "not-a-number"
      const parseResult = missionProposeApprovalTool.parameters.safeParse({
        counterpartyKey: "virtuals:agent:alpha",
        amountUsdc: "not-a-number",
        reason: "Testing malformed amount",
        runId: run.id,
      });
      expect(parseResult.success).toBe(false);

      // HTTP endpoint refuses non-numeric amount with 400
      const httpRes = await app.request("/api/mcp/tools/mission_propose_approval", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          counterpartyKey: "virtuals:agent:alpha",
          amountUsdc: "not-a-number",
          reason: "Testing malformed amount",
          runId: run.id,
        }),
      });
      expect(httpRes.status).toBe(400);

      // Verifies no corrupt event was appended to the run log
      const events = await runStore.listEvents(run.id);
      expect(events.filter((e) => e.type === "approval.requested").length).toBe(0);
    });

    it("1.2 negative number and negative string amounts are rejected by parameter schema", async () => {
      const run = await createTestRun();

      // REMEDIATED: Schema rejects negative numbers
      const parseNumResult = missionProposeApprovalTool.parameters.safeParse({
        counterpartyKey: "virtuals:agent:alpha",
        amountUsdc: -50,
        reason: "Testing negative number",
        runId: run.id,
      });
      expect(parseNumResult.success).toBe(false);

      // REMEDIATED: Schema rejects negative strings
      const parseStrResult = missionProposeApprovalTool.parameters.safeParse({
        counterpartyKey: "virtuals:agent:alpha",
        amountUsdc: "-50.000000",
        reason: "Testing negative string",
        runId: run.id,
      });
      expect(parseStrResult.success).toBe(false);

      // HTTP endpoint refuses negative amounts with 400
      const httpRes = await app.request("/api/mcp/tools/mission_propose_approval", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          counterpartyKey: "virtuals:agent:alpha",
          amountUsdc: -50,
          reason: "Testing negative number",
          runId: run.id,
        }),
      });
      expect(httpRes.status).toBe(400);

      // No corrupt event appended
      const events = await runStore.listEvents(run.id);
      expect(events.filter((e) => e.type === "approval.requested").length).toBe(0);
    });

    it("1.3 empty and whitespace-only strings for reason and counterpartyKey are rejected", async () => {
      // Empty string is rejected by min(1)
      const parseEmptyReason = missionProposeApprovalTool.parameters.safeParse({
        counterpartyKey: "virtuals:agent:alpha",
        amountUsdc: 10,
        reason: "",
      });
      expect(parseEmptyReason.success).toBe(false);

      // REMEDIATED: Whitespace-only strings are rejected because trim().min(1) is applied
      const parseWhitespaceReason = missionProposeApprovalTool.parameters.safeParse({
        counterpartyKey: "virtuals:agent:alpha",
        amountUsdc: 10,
        reason: "    ",
      });
      expect(parseWhitespaceReason.success).toBe(false);

      const parseWhitespaceKey = missionProposeApprovalTool.parameters.safeParse({
        counterpartyKey: "   ",
        amountUsdc: 10,
        reason: "Valid reason",
      });
      expect(parseWhitespaceKey.success).toBe(false);
    });

    it("1.4 special characters in counterpartyKey (SQL injection, XSS, unicode)", async () => {
      const run = await createTestRun();

      const specialKeys = [
        "virtuals:agent:beta; DROP TABLE runs; --",
        "<script>alert('xss')</script>",
        "🤖🚀_agent_special",
      ];

      for (const key of specialKeys) {
        const res = await missionProposeApprovalTool.execute({
          counterpartyKey: key,
          amountUsdc: 10,
          reason: `Proposal for special key: ${key}`,
          runId: run.id,
        });
        expect(res.counterpartyKey).toBe(key);
        expect(res.proposed).toBe(true);
      }

      // Safe against SQL injection via parameterized queries in Drizzle
      const events = await runStore.listEvents(run.id);
      expect(events.length).toBe(4); // 1 run.created + 3 approval.requested
    });

    it("1.5 non-existent runId is handled cleanly without crashing into unhandled 500", async () => {
      const nonExistentId = "00000000-0000-0000-0000-000000000000";

      // REMEDIATED: Direct execute does not crash into unhandled exception; returns clean DENIED result
      const result = await missionProposeApprovalTool.execute({
        counterpartyKey: "virtuals:agent:alpha",
        amountUsdc: 10,
        reason: "Test non-existent run",
        runId: nonExistentId,
      });
      expect(result.proposed).toBe(false);
      expect(result.status).toBe("DENIED");
      expect(result.policyEvaluation.reason).toContain("not found");

      // In HTTP route /api/mcp/tools/:toolName, returns 200 with result indicating DENIED rather than 500 crash
      const httpRes = await app.request("/api/mcp/tools/mission_propose_approval", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          counterpartyKey: "virtuals:agent:alpha",
          amountUsdc: 10,
          reason: "Test non-existent run via HTTP",
          runId: nonExistentId,
        }),
      });
      expect(httpRes.status).toBe(200);
      const httpBody = (await httpRes.json()) as {
        ok: boolean;
        result: { proposed: boolean; status: string };
      };
      expect(httpBody.ok).toBe(true);
      expect(httpBody.result.proposed).toBe(false);
      expect(httpBody.result.status).toBe("DENIED");
    });
  });

  describe("2. Guardrail Limit Boundaries", () => {
    it("2.1 Absolute spend limit exceeded denies proposal without appending approval.requested", async () => {
      await policyStore.put(env.AGENT_ID, {
        auto_spend_limit_usdc: "10.000000",
        human_approval_above_usdc: "20.000000",
        absolute_spend_limit_usdc: "50.000000",
      });

      const run = await createTestRun("Absolute spend limit bypass test");

      // Propose 100 USDC (exceeds absolute limit of 50 USDC)
      const res = await missionProposeApprovalTool.execute({
        counterpartyKey: "virtuals:agent:alpha",
        amountUsdc: "100.000000",
        reason: "Spend 100 USDC exceeding absolute limit",
        runId: run.id,
      });

      // Policy evaluation marks mode: "DENY" and allowedByPolicy: false
      expect(res.policyEvaluation.mode).toBe("DENY");
      expect(res.policyEvaluation.allowedByPolicy).toBe(false);

      // REMEDIATED 1: Tool returns proposed: false and status: "DENIED"
      expect(res.proposed).toBe(false);
      expect(res.status).toBe("DENIED");

      // REMEDIATED 2: Tool does NOT append approval.requested event to RunStore
      const events = await runStore.listEvents(run.id);
      const reqEvent = events.find((e) => e.type === "approval.requested");
      expect(reqEvent).toBeUndefined();

      // REMEDIATED 3: Operator cannot approve the request because no pending request exists (409)
      const approveRes = await app.request(`/api/runs/${run.id}/approve`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ceiling_usdc: "100.000000" }),
      });
      expect(approveRes.status).toBe(409);
      const approveBody = (await approveRes.json()) as { error: { code: string } };
      expect(approveBody.error.code).toBe("no_pending_approval");
    });

    it("2.2 Accurate guardrail threshold reason text", async () => {
      await policyStore.put(env.AGENT_ID, {
        auto_spend_limit_usdc: "25.000000",
        human_approval_above_usdc: "15.000000",
        absolute_spend_limit_usdc: "50.000000",
      });

      // Propose 18 USDC: exceeds human_approval_above (15), does NOT exceed auto_spend_limit (25)
      // When memory is available with committed version, mode is "AUTO" before limit check
      // (Using alpha which has relationship history in fixtures)
      const res = await missionProposeApprovalTool.execute({
        counterpartyKey: "virtuals:agent:alpha",
        amountUsdc: "18.000000",
        reason: "Test message with 18 USDC",
      });

      // REMEDIATED: Threshold check accurately attributes to human approval threshold
      expect(res.policyEvaluation.reason).toContain("human approval threshold (15.000000 USDC)");
      expect(res.policyEvaluation.reason).not.toContain("exceeds auto-spend threshold (25.000000 USDC)");
    });
  });

  describe("3. Event Log Integrity", () => {
    it("3.1 Verifies completeness and integrity of approval.requested payload", async () => {
      const run = await createTestRun("Payload completeness run");
      const result = await missionProposeApprovalTool.execute({
        counterpartyKey: "virtuals:agent:alpha",
        amountUsdc: "15.500000",
        reason: "Comprehensive audit of payload integrity",
        runId: run.id,
      });
      expect(result.proposed).toBe(true);

      const events = await runStore.listEvents(run.id);
      const reqEvent = events.find((e) => e.type === "approval.requested");
      expect(reqEvent).toBeDefined();

      const data = reqEvent!.data as Record<string, unknown>;

      // Verify all required fields from Interface Contract #2 in PROJECT.md
      expect(data).toHaveProperty("action", "Spend 15.500000 USDC with virtuals:agent:alpha");
      expect(data).toHaveProperty("counterparty_key", "virtuals:agent:alpha");
      expect(data).toHaveProperty("amount_usdc", "15.500000");
      expect(data).toHaveProperty("ceiling_usdc", "15.500000");
      expect(data).toHaveProperty("reason", "Comprehensive audit of payload integrity");
      expect(data).toHaveProperty("summary", "Comprehensive audit of payload integrity");
      expect(data).toHaveProperty("counterfactual_rationale");
      expect(typeof data.counterfactual_rationale).toBe("string");
      expect((data.counterfactual_rationale as string).length).toBeGreaterThan(0);
    });

    it("3.2 Monotonicity under multiple proposals on the same run", async () => {
      const run = await createTestRun("Monotonic sequence run");

      for (let i = 1; i <= 5; i++) {
        await missionProposeApprovalTool.execute({
          counterpartyKey: "virtuals:agent:alpha",
          amountUsdc: i * 5,
          reason: `Proposal #${i}`,
          runId: run.id,
        });
      }

      const events = await runStore.listEvents(run.id);
      const sequences = events.map((e) => e.sequence);

      // Sequence numbers must be strictly monotonic starting at 0: [0, 1, 2, 3, 4, 5]
      expect(sequences).toEqual([0, 1, 2, 3, 4, 5]);
      for (let i = 1; i < sequences.length; i++) {
        expect(sequences[i]!).toBe(sequences[i - 1]! + 1);
      }
    });
  });
});

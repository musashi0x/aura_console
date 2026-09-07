import { describe, expect, it } from "vitest";

import { app } from "../app.js";
import { env } from "../env.js";
import { PolicyStore } from "../services/policy-store.js";
import {
  consoleGetMissionTool,
  consoleGetReadinessTool,
  consoleListMissionsTool,
  consoleNavigateTool,
  consoleToggleMemoryViewTool,
  guardrailsGetPoliciesTool,
  memoryRecallCounterpartyTool,
  missionProposeApprovalTool,
} from "./tools.js";

describe("MCP Console Tools", () => {
  it("executes console_navigate with valid destinations", async () => {
    const result = await consoleNavigateTool.execute({ destination: "/runs" });
    expect(result).toEqual({
      action: "navigate",
      destination: "/runs",
      message: "Navigated to /runs",
    });
  });

  it("executes console_toggle_memory_view", async () => {
    const result = await consoleToggleMemoryViewTool.execute({ enabled: false });
    expect(result.action).toBe("toggle_memory_view");
    expect(result.enabled).toBe(false);
  });

  it("executes console_get_readiness", async () => {
    const result = await consoleGetReadinessTool.execute({});
    expect(result).toHaveProperty("overallReady");
    expect(result).toHaveProperty("database");
    expect(result).toHaveProperty("sibyl");
    expect(result).toHaveProperty("agent");
  });

  it("recalls memory for fixture counterparty", async () => {
    const result = await memoryRecallCounterpartyTool.execute({
      counterpartyKey: "virtuals:agent:alpha",
    });
    expect(result.counterpartyKey).toBe("virtuals:agent:alpha");
    expect(result.retrieval).toBeDefined();
  });

  it("lists missions and inspects example mission", async () => {
    const list = await consoleListMissionsTool.execute({ limit: 5 });
    expect(list.count).toBeGreaterThanOrEqual(0);

    const example = await consoleGetMissionTool.execute({ runId: "example" });
    expect(example.id).toBe("example");
    expect(example.isDemo).toBe(true);
  });

  it("reads guardrails policies", async () => {
    const result = await guardrailsGetPoliciesTool.execute({});
    expect(result.policy).toBeDefined();
  });

  it("executes mission_propose_approval without runId", async () => {
    const result = await missionProposeApprovalTool.execute({
      counterpartyKey: "virtuals:agent:alpha",
      amountUsdc: "10.000000",
      reason: "Draft research proposal",
    });
    expect(result.proposed).toBe(true);
    expect(result.counterpartyKey).toBe("virtuals:agent:alpha");
    expect(result.amountUsdc).toBe("10.000000");
    expect(result.status).toBe("AWAITING_APPROVAL");
    expect(result.policyEvaluation).toBeDefined();
    expect(result.memoryRetrieval).toBeDefined();
    expect(typeof result.counterfactualRationale).toBe("string");
    expect(result.eventId).toBeUndefined();
  });

  it("executes mission_propose_approval with runId and appends approval.requested", async () => {
    const createRes = await app.request("/api/runs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ objective: "Evaluate counterparty spend", source: "FIXTURE" }),
    });
    const { run } = (await createRes.json()) as { run: { id: string } };

    const result = await missionProposeApprovalTool.execute({
      counterpartyKey: "virtuals:agent:alpha",
      amountUsdc: 15,
      reason: "Draft research task",
      runId: run.id,
    });
    expect(result.proposed).toBe(true);
    expect(result.runId).toBe(run.id);
    expect(result.amountUsdc).toBe("15.000000");
    expect(result.eventId).toBeDefined();

    const eventsRes = await app.request(`/api/runs/${run.id}/events`);
    const { events } = (await eventsRes.json()) as {
      events: { type: string; data: Record<string, unknown> }[];
    };
    const requested = events.find((e) => e.type === "approval.requested");
    expect(requested).toBeDefined();
    expect(requested?.data.counterparty_key).toBe("virtuals:agent:alpha");
    expect(requested?.data.amount_usdc).toBe("15.000000");
    expect(requested?.data.ceiling_usdc).toBe("15.000000");
    expect(requested?.data.reason).toBe("Draft research task");
    expect(requested?.data.action).toBe("Spend 15 USDC with virtuals:agent:alpha");
  });

  it("denies spend and does not append event when absolute spend limit is exceeded", async () => {
    const policyStore = new PolicyStore();
    await policyStore.put(env.AGENT_ID, {
      auto_spend_limit_usdc: "10.000000",
      human_approval_above_usdc: "20.000000",
      absolute_spend_limit_usdc: "50.000000",
    });

    const createRes = await app.request("/api/runs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ objective: "Evaluate excessive spend", source: "FIXTURE" }),
    });
    const { run } = (await createRes.json()) as { run: { id: string } };

    const result = await missionProposeApprovalTool.execute({
      counterpartyKey: "virtuals:agent:alpha",
      amountUsdc: "100.000000",
      reason: "Proposed excessive spend",
      runId: run.id,
    });

    expect(result.proposed).toBe(false);
    expect(result.status).toBe("DENIED");
    expect(result.policyEvaluation.mode).toBe("DENY");
    expect(result.policyEvaluation.allowedByPolicy).toBe(false);
    expect(result.policyEvaluation.reason).toContain("exceeds absolute spend limit");
    expect(result.eventId).toBeUndefined();

    const eventsRes = await app.request(`/api/runs/${run.id}/events`);
    const { events } = (await eventsRes.json()) as {
      events: { type: string }[];
    };
    const requested = events.find((e) => e.type === "approval.requested");
    expect(requested).toBeUndefined();
  });
});

describe("MCP HTTP Endpoints", () => {
  it("lists MCP tools at GET /api/mcp/tools", async () => {
    const res = await app.request("/api/mcp/tools");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; tools: { name: string }[] };
    expect(body.ok).toBe(true);
    expect(body.tools.some((t) => t.name === "console_navigate")).toBe(true);
    expect(body.tools.some((t) => t.name === "memory_recall_counterparty")).toBe(true);
    expect(body.tools.some((t) => t.name === "mission_propose_approval")).toBe(true);
  });

  it("invokes an MCP tool at POST /api/mcp/tools/:toolName", async () => {
    const res = await app.request("/api/mcp/tools/console_navigate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ destination: "/policies" }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; result: { destination: string } };
    expect(body.ok).toBe(true);
    expect(body.result.destination).toBe("/policies");
  });

  it("invokes mission_propose_approval at POST /api/mcp/tools/:toolName", async () => {
    const res = await app.request("/api/mcp/tools/mission_propose_approval", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        counterpartyKey: "virtuals:agent:alpha",
        amountUsdc: "10.000000",
        reason: "Purchase dataset",
      }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      ok: boolean;
      result: { proposed: boolean; status: string; amountUsdc: string };
    };
    expect(body.ok).toBe(true);
    expect(body.result.proposed).toBe(true);
    expect(body.result.status).toBe("AWAITING_APPROVAL");
    expect(body.result.amountUsdc).toBe("10.000000");
  });

  it("validates parameters for mission_propose_approval", async () => {
    const missingKey = await app.request("/api/mcp/tools/mission_propose_approval", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        amountUsdc: "10.000000",
        reason: "Purchase dataset",
      }),
    });
    expect(missingKey.status).toBe(400);

    const missingReason = await app.request("/api/mcp/tools/mission_propose_approval", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        counterpartyKey: "virtuals:agent:alpha",
        amountUsdc: "10.000000",
      }),
    });
    expect(missingReason.status).toBe(400);

    const invalidRun = await app.request("/api/mcp/tools/mission_propose_approval", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        counterpartyKey: "virtuals:agent:alpha",
        amountUsdc: "10.000000",
        reason: "Purchase dataset",
        runId: "not-a-uuid",
      }),
    });
    expect(invalidRun.status).toBe(400);

    const whitespaceKey = await app.request("/api/mcp/tools/mission_propose_approval", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        counterpartyKey: "    ",
        amountUsdc: "10.000000",
        reason: "Purchase dataset",
      }),
    });
    expect(whitespaceKey.status).toBe(400);

    const whitespaceReason = await app.request("/api/mcp/tools/mission_propose_approval", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        counterpartyKey: "virtuals:agent:alpha",
        amountUsdc: "10.000000",
        reason: "    ",
      }),
    });
    expect(whitespaceReason.status).toBe(400);

    const negativeAmount = await app.request("/api/mcp/tools/mission_propose_approval", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        counterpartyKey: "virtuals:agent:alpha",
        amountUsdc: -10,
        reason: "Negative spend",
      }),
    });
    expect(negativeAmount.status).toBe(400);

    const nonNumericAmount = await app.request("/api/mcp/tools/mission_propose_approval", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        counterpartyKey: "virtuals:agent:alpha",
        amountUsdc: "not-a-number",
        reason: "Invalid amount",
      }),
    });
    expect(nonNumericAmount.status).toBe(400);

    const zeroAmount = await app.request("/api/mcp/tools/mission_propose_approval", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        counterpartyKey: "virtuals:agent:alpha",
        amountUsdc: 0,
        reason: "Zero spend",
      }),
    });
    expect(zeroAmount.status).toBe(400);
  });

  it("handles unknown runId cleanly without crashing into unhandled 500", async () => {
    const res = await app.request("/api/mcp/tools/mission_propose_approval", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        counterpartyKey: "virtuals:agent:alpha",
        amountUsdc: "10.000000",
        reason: "Test unknown run",
        runId: "00000000-0000-0000-0000-000000000000",
      }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      ok: boolean;
      result: { proposed: boolean; status: string; policyEvaluation: { reason: string } };
    };
    expect(body.ok).toBe(true);
    expect(body.result.proposed).toBe(false);
    expect(body.result.status).toBe("DENIED");
    expect(body.result.policyEvaluation.reason).toContain("not found");
  });

  it("returns 404 for unknown MCP tool", async () => {
    const res = await app.request("/api/mcp/tools/unknown_tool", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(404);
  });
});

describe("Global Chat Route (/api/chat)", () => {
  it("rejects empty question with 400", async () => {
    const res = await app.request("/api/chat?q=");
    expect(res.status).toBe(400);
  });

  it("handles navigation tool query over SSE", async () => {
    const res = await app.request("/api/chat?q=go%20to%20missions");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    const text = await res.text();
    expect(text).toContain("console_navigate");
    expect(text).toContain("/runs");
  }, 15000);

  it("handles counterparty query with memory recall over SSE", async () => {
    const res = await app.request("/api/chat?q=Why%20was%20this%20counterparty%20chosen");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    const text = await res.text();
    expect(text).toContain("memory_recall_counterparty");
  }, 15000);
});

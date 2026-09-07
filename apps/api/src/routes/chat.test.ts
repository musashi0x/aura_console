import { afterEach, describe, expect, it, vi } from "vitest";

import { app } from "../app.js";
import type * as AdkAgent from "../services/adk-agent.js";
import { setGeminiAgentOverride } from "../services/gemini-agent.js";
import { RunStore } from "../services/run-store.js";

vi.mock("../services/adk-agent.js", async () => {
  const actual = await vi.importActual<typeof AdkAgent>("../services/adk-agent.js");
  return { ...actual, isAgentConfigured: vi.fn(() => false) };
});

const runs = new RunStore();

describe("Chat Routes (SSE Streaming & Gemini Function Calling)", () => {
  afterEach(() => {
    setGeminiAgentOverride(null);
  });

  describe("GET /api/chat (Global Chat)", () => {
    it("rejects empty question with HTTP 400", async () => {
      const res = await app.request("/api/chat?q=");
      expect(res.status).toBe(400);
      const json = (await res.json()) as { error: { code: string } };
      expect(json.error.code).toBe("invalid_question");
    });

    it("rejects missing question with HTTP 400", async () => {
      const res = await app.request("/api/chat");
      expect(res.status).toBe(400);
    });

    it("streams console_navigate tool call for navigation query", async () => {
      const res = await app.request("/api/chat?q=go%20to%20missions");
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("text/event-stream");

      const body = await res.text();
      expect(body).toContain("event: tool_call");
      expect(body).toContain('"name":"console_navigate"');
      expect(body).toContain('"/runs"');
      expect(body).toContain("event: token");
      expect(body).toContain("event: done");
    });

    it("streams memory_recall_counterparty tool call and citation", async () => {
      const res = await app.request("/api/chat?q=Why%20was%20this%20counterparty%20chosen");
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("text/event-stream");

      const body = await res.text();
      expect(body).toContain("event: tool_call");
      expect(body).toContain('"name":"memory_recall_counterparty"');
      expect(body).toContain("event: citation");
      expect(body).toContain("virtuals:agent:beta");
      expect(body).toContain("event: token");
      expect(body).toContain("event: done");
    });

    it("streams autonomous tool chaining for multi-step counterparty + spend query", async () => {
      const query = encodeURIComponent("Why should we hire Beta Labs and what would it cost to draft a 10 USDC spend?");
      const res = await app.request(`/api/chat?q=${query}`);
      expect(res.status).toBe(200);

      const body = await res.text();
      // Should invoke both memory_recall_counterparty and mission_propose_approval
      expect(body).toContain('"name":"memory_recall_counterparty"');
      expect(body).toContain('"name":"mission_propose_approval"');
      expect(body).toContain("event: citation");
      expect(body).toContain("event: token");
      expect(body).toContain("event: done");
    });

    it("supports POST /api/chat with JSON body", async () => {
      const res = await app.request("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: "go to missions" }),
      });
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("text/event-stream");

      const body = await res.text();
      expect(body).toContain("event: tool_call");
      expect(body).toContain('"name":"console_navigate"');
      expect(body).toContain("event: done");
    });
  });

  describe("GET /api/runs/:runId/chat (Run Context Chat)", () => {
    async function createTestRun() {
      const run = await runs.createRun({
        source: "CONSOLE",
        objective: "Autonomous procurement run",
        budgetUsdc: "100.000000",
      });
      return run.id;
    }

    it("rejects invalid run ID format with HTTP 400", async () => {
      const res = await app.request("/api/runs/not-a-uuid/chat?q=hello");
      expect(res.status).toBe(400);
      const json = (await res.json()) as { error: { code: string } };
      expect(json.error.code).toBe("invalid_run_id");
    });

    it("returns HTTP 503 agent_unavailable when no agent is configured", async () => {
      setGeminiAgentOverride(false);
      const runId = await createTestRun();
      const res = await app.request(`/api/runs/${runId}/chat?q=why%20beta`);
      expect(res.status).toBe(503);
      const json = (await res.json()) as { error: { code: string } };
      expect(json.error.code).toBe("agent_unavailable");
    });

    it("returns HTTP 404 when run does not exist", async () => {
      setGeminiAgentOverride(true);
      const nonExistentRunId = crypto.randomUUID();
      const res = await app.request(`/api/runs/${nonExistentRunId}/chat?q=hello`);
      expect(res.status).toBe(404);
      const json = (await res.json()) as { error: { code: string } };
      expect(json.error.code).toBe("run_not_found");
    });

    it("executes tool chaining and appends approval.requested to RunStore", async () => {
      setGeminiAgentOverride(true);
      const runId = await createTestRun();

      const query = encodeURIComponent("Why should we hire Beta Labs and what would it cost to draft a 10 USDC spend?");
      const res = await app.request(`/api/runs/${runId}/chat?q=${query}`);
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("text/event-stream");

      const body = await res.text();

      // Check SSE event ordering and contents
      expect(body).toContain("event: tool_call");
      expect(body).toContain('"name":"memory_recall_counterparty"');
      expect(body).toContain('"name":"mission_propose_approval"');
      expect(body).toContain("event: citation");
      expect(body).toContain("event: token");
      expect(body).toContain("event: done");

      // Verify RunStore has recorded approval.requested event with counterparty & amount
      const events = await runs.listEvents(runId);
      const approvalEvent = events.find((e) => e.type === "approval.requested");
      expect(approvalEvent).toBeDefined();
      expect(approvalEvent?.data).toMatchObject({
        counterparty_key: "virtuals:agent:beta",
        amount_usdc: "10.000000",
        ceiling_usdc: "10.000000",
      });

      // Verify memory.retrieved event was also recorded
      const memoryEvent = events.find((e) => e.type === "memory.retrieved");
      expect(memoryEvent).toBeDefined();
      expect(memoryEvent?.data).toMatchObject({
        counterparty_key: "virtuals:agent:beta",
        retrieval_status: "AVAILABLE",
      });
    });
  });
});

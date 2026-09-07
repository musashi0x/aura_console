import { describe, expect, it } from "vitest";

import { app } from "../app.js";
import {
  consoleGetMissionTool,
  consoleGetReadinessTool,
  consoleListMissionsTool,
  consoleNavigateTool,
  consoleToggleMemoryViewTool,
  guardrailsGetPoliciesTool,
  memoryRecallCounterpartyTool,
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
});

describe("MCP HTTP Endpoints", () => {
  it("lists MCP tools at GET /api/mcp/tools", async () => {
    const res = await app.request("/api/mcp/tools");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; tools: { name: string }[] };
    expect(body.ok).toBe(true);
    expect(body.tools.some((t) => t.name === "console_navigate")).toBe(true);
    expect(body.tools.some((t) => t.name === "memory_recall_counterparty")).toBe(true);
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
  });

  it("handles counterparty query with memory recall over SSE", async () => {
    const res = await app.request("/api/chat?q=Why%20was%20this%20counterparty%20chosen");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    const text = await res.text();
    expect(text).toContain("memory_recall_counterparty");
  });
});

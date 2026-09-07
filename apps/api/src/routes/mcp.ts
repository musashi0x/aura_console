import { Hono } from "hono";

import { httpError } from "../errors.js";
import { createAuraMcpServer } from "../mcp/server.js";
import { findMcpTool, MCP_TOOLS } from "../mcp/tools.js";

export const mcpRoute = new Hono();

// Instantiate MCP Server
export const auraMcpServer = createAuraMcpServer();

/**
 * Lists all available MCP tools in the Aura Console MCP Server.
 */
mcpRoute.get("/tools", (c) => {
  const toolList = MCP_TOOLS.map((tool) => ({
    name: tool.name,
    description: tool.description,
  }));
  return c.json({
    ok: true,
    server: "aura-console",
    version: "1.0.0",
    tools: toolList,
  });
});

/**
 * Execute an MCP tool directly via HTTP POST.
 */
mcpRoute.post("/tools/:toolName", async (c) => {
  const toolName = c.req.param("toolName");
  const tool = findMcpTool(toolName);
  if (!tool) {
    throw httpError(404, "tool_not_found", `MCP Tool '${toolName}' not found`);
  }

  let body: unknown = {};
  try {
    body = await c.req.json();
  } catch {
    body = {};
  }

  const parsed = tool.parameters.safeParse(body);
  if (!parsed.success) {
    throw httpError(400, "invalid_tool_arguments", parsed.error.message);
  }

  try {
    const result = await tool.execute(parsed.data);
    return c.json({ ok: true, tool: toolName, result });
  } catch (error) {
    console.error(`[mcp] tool ${toolName} failed`, error);
    return c.json(
      {
        ok: false,
        tool: toolName,
        error: error instanceof Error ? error.message : "tool_execution_failed",
      },
      500,
    );
  }
});

/**
 * Read MCP resources.
 */
mcpRoute.get("/resources", (c) => {
  return c.json({
    ok: true,
    resources: [
      { uri: "console://system/readiness", name: "system_readiness", mimeType: "application/json" },
      { uri: "console://guardrails", name: "guardrails", mimeType: "application/json" },
    ],
  });
});

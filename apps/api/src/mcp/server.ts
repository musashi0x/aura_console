import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import {
  CONSOLE_DESTINATIONS,
  consoleGetMissionTool,
  consoleGetReadinessTool,
  consoleListMissionsTool,
  consoleNavigateTool,
  consoleToggleMemoryViewTool,
  guardrailsGetPoliciesTool,
  memoryListCounterpartiesTool,
  memoryRecallCounterpartyTool,
} from "./tools.js";

/**
 * Creates and configures the standard Model Context Protocol (MCP) server for Aura Console.
 * Can be connected to stdio (CLI) or HTTP/SSE (Web/API) transports.
 */
export function createAuraMcpServer(): McpServer {
  const server = new McpServer({
    name: "aura-console",
    version: "1.0.0",
  });

  // Tools
  server.tool(
    "console_navigate",
    consoleNavigateTool.description,
    { destination: z.enum(CONSOLE_DESTINATIONS) },
    async ({ destination }) => {
      const result = await consoleNavigateTool.execute({ destination });
      return {
        content: [{ type: "text", text: JSON.stringify(result) }],
      };
    },
  );

  server.tool(
    "console_toggle_memory_view",
    consoleToggleMemoryViewTool.description,
    { enabled: z.boolean().optional() },
    async ({ enabled }) => {
      const result = await consoleToggleMemoryViewTool.execute({ enabled });
      return {
        content: [{ type: "text", text: JSON.stringify(result) }],
      };
    },
  );

  server.tool(
    "console_get_readiness",
    consoleGetReadinessTool.description,
    {},
    async () => {
      const result = await consoleGetReadinessTool.execute({});
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    },
  );

  server.tool(
    "memory_recall_counterparty",
    memoryRecallCounterpartyTool.description,
    { counterpartyKey: z.string().min(1) },
    async ({ counterpartyKey }) => {
      const result = await memoryRecallCounterpartyTool.execute({ counterpartyKey });
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    },
  );

  server.tool(
    "memory_list_counterparties",
    memoryListCounterpartiesTool.description,
    {},
    async () => {
      const result = await memoryListCounterpartiesTool.execute({});
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    },
  );

  server.tool(
    "console_list_missions",
    consoleListMissionsTool.description,
    { limit: z.number().int().min(1).max(50).optional() },
    async ({ limit }) => {
      const result = await consoleListMissionsTool.execute({ limit });
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    },
  );

  server.tool(
    "console_get_mission",
    consoleGetMissionTool.description,
    { runId: z.string() },
    async ({ runId }) => {
      const result = await consoleGetMissionTool.execute({ runId });
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    },
  );

  server.tool(
    "guardrails_get_policies",
    guardrailsGetPoliciesTool.description,
    {},
    async () => {
      const result = await guardrailsGetPoliciesTool.execute({});
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    },
  );

  // Resources
  server.resource("system_readiness", "console://system/readiness", async (uri) => {
    const result = await consoleGetReadinessTool.execute({});
    return {
      contents: [
        {
          uri: uri.href,
          text: JSON.stringify(result, null, 2),
          mimeType: "application/json",
        },
      ],
    };
  });

  server.resource("guardrails", "console://guardrails", async (uri) => {
    const result = await guardrailsGetPoliciesTool.execute({});
    return {
      contents: [
        {
          uri: uri.href,
          text: JSON.stringify(result, null, 2),
          mimeType: "application/json",
        },
      ],
    };
  });

  return server;
}

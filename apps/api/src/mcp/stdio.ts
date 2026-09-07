import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { createAuraMcpServer } from "./server.js";

/**
 * Standard stdio entrypoint for the Aura Console MCP Server.
 * Allows MCP clients (Claude Code, Cursor, Antigravity) to launch the server as a subprocess.
 */
async function main() {
  const server = createAuraMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("[mcp] stdio server fatal error", err);
  process.exit(1);
});

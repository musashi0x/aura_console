# Model Context Protocol (MCP) and Universal Agent Chat

## What

The Model Context Protocol (MCP) layer standardizes tool calling and resource inspection across Aura Console. It replaces manual string matching and prompt injection with formal tool contracts executed by the agent or dispatched by the server.

## Where

- `apps/api/src/mcp/tools.ts` — Standard tool definitions, Zod parameter schemas, and execution handlers:
  - `console_navigate` — Client-side navigation between console surfaces (`/runs`, `/runs/new`, `/runs/example`, `/system`, `/policies`, `/counterparties`).
  - `console_toggle_memory_view` — Toggles the causal spine memory view on/off.
  - `console_get_readiness` — Evaluates operational readiness of Postgres, Sibyl Memory store, and ADK agent.
  - `memory_recall_counterparty` — Recalls Sibyl relationship memory, reliability scores, and historical episodes for a given counterparty key.
  - `memory_list_counterparties` — Lists all counterparties known to Sibyl Memory.
  - `console_list_missions` — Lists recorded missions and budget ceilings.
  - `console_get_mission` — Fetches mission details, budget, and canonical event trace.
  - `guardrails_get_policies` — Reads active spending limits and approval requirements.
- `apps/api/src/mcp/server.ts` — `@modelcontextprotocol/sdk` `McpServer` exposing tools and system resources (`console://system/readiness`, `console://guardrails`).
- `apps/api/src/mcp/stdio.ts` — Stdio transport entrypoint for external IDE agents (Cursor, Claude Code, Antigravity).
- `apps/api/src/routes/mcp.ts` — HTTP routes for tool discovery (`GET /api/mcp/tools`) and execution (`POST /api/mcp/tools/:toolName`).
- `apps/api/src/routes/chat.ts` — Universal agent chat (`GET /api/chat?q=...`) and run-scoped chat (`GET /api/runs/:runId/chat?q=...`) streaming SSE tokens, citations, and `tool_call` events.
- `apps/web/src/features/console/components/console-chat.tsx` — Chat client routing queries without a `runId` to `/api/chat`, executing client actions (e.g. `router.push`), and rendering `🔧 [Tool Name]` badges.
- `.mcp.json` — Repo-level MCP client configuration for automated discovery.

## Invariants & Boundaries

1. **Honesty and Read-Only Boundary**: Chat and MCP tools navigate, inspect, and recall evidence, but cannot authorize or execute economic transactions without explicit operator approval in the UI.
2. **Universal Accessibility**: Chat functions on all console surfaces (including `/runs/new`, `/system`, `/policies`) rather than being restricted only to existing Runs.
3. **Structured Tool Feedback**: When a tool is executed during a chat session, an explicit `event: tool_call` is emitted over SSE before the natural language synthesis.

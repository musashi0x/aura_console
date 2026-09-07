import { getDb, sql } from "@aura/db";
import { z } from "zod";

import { env } from "../env.js";
import { getAgentStatus } from "../services/adk-agent.js";
import { MemoryStore } from "../services/memory-store.js";
import { PolicyStore } from "../services/policy-store.js";
import { RunStore } from "../services/run-store.js";
import {
  getSibylStatus,
  listCounterpartiesFromSibyl,
  retrieveFromSibyl,
} from "../services/sibyl.js";

const runs = new RunStore();
const memory = new MemoryStore();
const policies = new PolicyStore();

export const CONSOLE_DESTINATIONS = [
  "/runs",
  "/runs/new",
  "/runs/example",
  "/system",
  "/policies",
  "/counterparties",
] as const;

export type ConsoleDestination = (typeof CONSOLE_DESTINATIONS)[number];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface McpToolDefinition<TParams = any, TResult = any> {
  name: string;
  description: string;
  parameters: z.ZodType<TParams>;
  execute: (params: TParams) => Promise<TResult>;
}

export const consoleNavigateTool: McpToolDefinition<{ destination: ConsoleDestination }> = {
  name: "console_navigate",
  description:
    "Navigate the operator's view in Aura Console to one of the console surfaces: Missions (/runs), Start a Mission (/runs/new), Demo Mission (/runs/example), Network Readiness (/system), Guardrails (/policies), or Agents (/counterparties).",
  parameters: z.object({
    destination: z.enum(CONSOLE_DESTINATIONS).describe("The target route to open in the Console"),
  }),
  execute: async ({ destination }) => {
    return {
      action: "navigate",
      destination,
      message: `Navigated to ${destination}`,
    };
  },
};

export const consoleToggleMemoryViewTool: McpToolDefinition<{ enabled?: boolean }> = {
  name: "console_toggle_memory_view",
  description:
    "Toggle the Memory On/Off view on the causal spine. When off, memory-derived evidence is hidden; when on, all recalled records are shown.",
  parameters: z.object({
    enabled: z
      .boolean()
      .optional()
      .describe("Target state for memory view (true = on, false = off). If omitted, toggles."),
  }),
  execute: async ({ enabled }) => {
    return {
      action: "toggle_memory_view",
      enabled,
      message: `Toggled memory view${enabled !== undefined ? ` to ${enabled ? "On" : "Off"}` : ""}`,
    };
  },
};

export const consoleGetReadinessTool: McpToolDefinition<Record<string, never>> = {
  name: "console_get_readiness",
  description:
    "Check the operational health and readiness of Aura Console and its dependencies: Postgres database, Sibyl Memory store, and Google ADK Agent.",
  parameters: z.object({}),
  execute: async () => {
    let dbStatus: { reachable: boolean; latencyMs?: number; error?: string };
    const start = performance.now();
    try {
      await getDb().execute(sql`select 1`);
      dbStatus = { reachable: true, latencyMs: Math.round((performance.now() - start) * 100) / 100 };
    } catch (err) {
      dbStatus = { reachable: false, error: err instanceof Error ? err.message : String(err) };
    }

    const sibylStatus = await getSibylStatus();
    const agentStatus = await getAgentStatus();

    return {
      overallReady: dbStatus.reachable && sibylStatus.reachable && agentStatus.reachable,
      database: dbStatus,
      sibyl: sibylStatus,
      agent: agentStatus,
    };
  },
};

export const memoryRecallCounterpartyTool: McpToolDefinition<{ counterpartyKey: string }> = {
  name: "memory_recall_counterparty",
  description:
    "Recall first-party relationship memory for a specific counterparty/agent from Sibyl Memory, including reliability score, task fit, confidence, risk note, and recorded past episodes.",
  parameters: z.object({
    counterpartyKey: z
      .string()
      .min(1)
      .describe("The unique counterparty key (e.g. virtuals:agent:alpha, virtuals:agent:beta)"),
  }),
  execute: async ({ counterpartyKey }) => {
    const memoryResult = await retrieveFromSibyl(counterpartyKey);
    const projection = await memory.getCounterparty(counterpartyKey);
    const episodes = await memory.listEpisodes(counterpartyKey, env.AGENT_ID);

    return {
      counterpartyKey,
      displayName: memoryResult.status === "AVAILABLE" ? memoryResult.displayName : projection?.display.name ?? null,
      retrieval: memoryResult,
      projection: projection ?? null,
      episodes,
    };
  },
};

export const memoryListCounterpartiesTool: McpToolDefinition<Record<string, never>> = {
  name: "memory_list_counterparties",
  description:
    "List all agents and counterparties known to Sibyl Memory along with their relationship status, scores, and past interaction counts.",
  parameters: z.object({}),
  execute: async () => {
    const sibylListing = await listCounterpartiesFromSibyl();
    const stored = await memory.listCounterparties();
    return {
      fromSibyl: sibylListing,
      storedCounterparties: stored,
    };
  },
};

export const consoleListMissionsTool: McpToolDefinition<{ limit?: number }> = {
  name: "console_list_missions",
  description:
    "List recent missions (runs) recorded in Aura Console with their objective, status, budget ceiling, and creation timestamp.",
  parameters: z.object({
    limit: z.number().int().min(1).max(50).optional().describe("Maximum number of missions to list (default 10)"),
  }),
  execute: async ({ limit = 10 }) => {
    const runItems = await runs.listRuns(limit);
    return {
      count: runItems.length,
      missions: runItems.map((r) => ({
        id: r.id,
        objective: r.objective,
        budgetUsdc: r.budgetUsdc,
        source: r.source,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  },
};

export const consoleGetMissionTool: McpToolDefinition<{ runId: string }> = {
  name: "console_get_mission",
  description:
    "Inspect a mission's details, budget, and canonical event trace (evidence, decisions, approvals, outcomes).",
  parameters: z.object({
    runId: z.string().describe("The mission / run UUID or 'example'"),
  }),
  execute: async ({ runId }) => {
    if (runId === "example") {
      return {
        id: "example",
        isDemo: true,
        objective: "Buy one market research dataset under 25 USDC ceiling",
        budgetUsdc: "25.000000",
      };
    }
    const run = await runs.getRun(runId);
    if (!run) {
      return { found: false, runId, error: `Mission ${runId} not found` };
    }
    const events = await runs.listEvents(runId);
    return {
      found: true,
      run: {
        id: run.id,
        objective: run.objective,
        budgetUsdc: run.budgetUsdc,
        source: run.source,
        createdAt: run.createdAt.toISOString(),
      },
      eventCount: events.length,
      events: events.map((e) => ({
        sequence: e.sequence,
        type: e.type,
        eventTime: e.eventTime.toISOString(),
        data: e.data,
      })),
    };
  },
};

export const guardrailsGetPoliciesTool: McpToolDefinition<Record<string, never>> = {
  name: "guardrails_get_policies",
  description: "Get the active economic guardrails, spend limits, and approval policies for Aura.",
  parameters: z.object({}),
  execute: async () => {
    const policy = await policies.get(env.AGENT_ID);
    return {
      agentId: env.AGENT_ID,
      policy: policy ?? {
        auto_spend_limit_usdc: "25.000000",
        human_approval_above_usdc: "15.000000",
        blocked_counterparties: [],
      },
    };
  },
};

export const MCP_TOOLS: McpToolDefinition[] = [
  consoleNavigateTool,
  consoleToggleMemoryViewTool,
  consoleGetReadinessTool,
  memoryRecallCounterpartyTool,
  memoryListCounterpartiesTool,
  consoleListMissionsTool,
  consoleGetMissionTool,
  guardrailsGetPoliciesTool,
];

export function findMcpTool(name: string): McpToolDefinition | undefined {
  return MCP_TOOLS.find((t) => t.name === name);
}

import { randomUUID } from "node:crypto";

import { getDb, sql } from "@aura/db";
import { z } from "zod";

import { env } from "../env.js";
import { httpError } from "../errors.js";
import { getAgentStatus } from "../services/adk-agent.js";
import { authorizeFromRetrieval } from "../services/memory-authorization.js";
import { MemoryStore, type RetrievalResult } from "../services/memory-store.js";
import { PolicyStore } from "../services/policy-store.js";
import { RunStore } from "../services/run-store.js";
import {
  getSibylStatus,
  listCounterpartiesFromSibyl,
  readMemoryJournal,
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

export const memoryJournalTool: McpToolDefinition<{ counterpartyKey?: string; limit?: number }> = {
  name: "memory_journal",
  description:
    "Read the immutable Sibyl memory journal / episode log with provenance actors, optionally filtered by counterparty.",
  parameters: z.object({
    counterpartyKey: z
      .string()
      .optional()
      .describe("Optional counterparty key to filter journal episodes (e.g. virtuals:agent:alpha)"),
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .optional()
      .describe("Maximum number of journal entries to return (default 50)"),
  }),
  execute: async ({ counterpartyKey, limit }) => {
    const journal = await readMemoryJournal({ counterpartyKey, limit });
    return {
      ok: journal.ok,
      count: journal.count ?? journal.events?.length ?? 0,
      episodes: journal.episodes ?? journal.events ?? [],
      ...(journal.code ? { code: journal.code } : {}),
      ...(journal.detail ? { detail: journal.detail } : {}),
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

export const missionProposeApprovalTool: McpToolDefinition<{
  counterpartyKey: string;
  amountUsdc: string | number;
  reason: string;
  runId?: string;
}> = {
  name: "mission_propose_approval",
  description:
    "Proposes a mission spend or counterparty engagement under active guardrail limits, evaluating PolicyStore and Sibyl relationship memory and recording an approval.requested event.",
  parameters: z.object({
    counterpartyKey: z.string().trim().min(1, "counterpartyKey is required"),
    amountUsdc: z.union([
      z.number().positive("amountUsdc must be greater than 0"),
      z
        .string()
        .regex(/^\d+(\.\d{1,6})?$/, "amountUsdc must be a positive decimal amount")
        .refine((s) => parseFloat(s) > 0, "amountUsdc must be greater than 0"),
    ]),
    reason: z.string().trim().min(1, "reason is required"),
    runId: z.string().uuid().optional(),
  }),
  execute: async ({ counterpartyKey, amountUsdc, reason, runId }) => {
    const cleanCounterpartyKey = counterpartyKey.trim();
    const cleanReason = reason.trim();
    if (cleanCounterpartyKey.length === 0) {
      throw httpError(400, "invalid_counterparty_key", "counterpartyKey is required");
    }
    if (cleanReason.length === 0) {
      throw httpError(400, "invalid_reason", "reason is required");
    }

    const num = typeof amountUsdc === "number" ? amountUsdc : parseFloat(amountUsdc);
    if (Number.isNaN(num) || num <= 0) {
      throw httpError(400, "invalid_amount", "amountUsdc must be greater than 0");
    }
    if (typeof amountUsdc === "string" && !/^\d+(\.\d{1,6})?$/.test(amountUsdc)) {
      throw httpError(400, "invalid_amount", "amountUsdc must be a decimal amount with up to 6 decimal places");
    }
    const formattedAmount = num.toFixed(6);

    const policy = await policies.get(env.AGENT_ID);
    const memoryResult = await retrieveFromSibyl(cleanCounterpartyKey);

    const authOutcome = authorizeFromRetrieval(memoryResult as unknown as RetrievalResult, policy);
    const autoSpendLimit = policy?.auto_spend_limit_usdc ?? "25.000000";
    const humanApprovalAbove = policy?.human_approval_above_usdc ?? "15.000000";

    let mode: "AUTO" | "REQUIRE_APPROVAL" | "DENY" = authOutcome.approval;
    let evalReason = authOutcome.reason;
    let allowedByPolicy = mode !== "DENY";

    if (
      policy?.absolute_spend_limit_usdc &&
      num > parseFloat(policy.absolute_spend_limit_usdc)
    ) {
      mode = "DENY";
      allowedByPolicy = false;
      evalReason = `Proposed spend of ${formattedAmount} USDC exceeds absolute spend limit of ${policy.absolute_spend_limit_usdc} USDC.`;
    } else {
      const autoLimitNum = parseFloat(autoSpendLimit);
      const humanApprovalAboveNum = parseFloat(humanApprovalAbove);
      if (num > autoLimitNum) {
        mode = "REQUIRE_APPROVAL";
        evalReason = `Proposed spend of ${formattedAmount} USDC exceeds auto-spend threshold (${autoSpendLimit} USDC), requiring operator approval.`;
      } else if (num > humanApprovalAboveNum) {
        mode = "REQUIRE_APPROVAL";
        evalReason = `Proposed spend of ${formattedAmount} USDC exceeds human approval threshold (${humanApprovalAbove} USDC), requiring operator approval.`;
      }
    }

    let counterfactualRationale: string;
    if (memoryResult.status === "AVAILABLE") {
      const name = memoryResult.displayName ?? cleanCounterpartyKey;
      const relPct =
        memoryResult.overallReliability !== null
          ? memoryResult.overallReliability <= 1 && memoryResult.overallReliability > 0
            ? `${Math.round(memoryResult.overallReliability * 100)}%`
            : `${Math.round(memoryResult.overallReliability)}%`
          : null;
      const relText = relPct ? ` has ${relPct} reliability` : "";
      const epText =
        memoryResult.episodesUsed > 0
          ? ` across ${memoryResult.episodesUsed} recorded interaction${memoryResult.episodesUsed === 1 ? "" : "s"}`
          : "";
      const trackRecord = memoryResult.relationshipStatus
        ? ` with ${memoryResult.relationshipStatus} status`
        : "";
      counterfactualRationale = `Memory checked; ${name}${relText}${epText}${trackRecord}.`;
    } else if (memoryResult.status === "NO_HISTORY") {
      counterfactualRationale = `No prior relationship history found for ${cleanCounterpartyKey}. Initial interaction requires operator approval.`;
    } else {
      counterfactualRationale = `Relationship memory could not be retrieved for ${cleanCounterpartyKey}; proceeding under active guardrail limits.`;
    }

    if (runId) {
      const run = await runs.getRun(runId);
      if (!run) {
        return {
          proposed: false,
          runId,
          counterpartyKey: cleanCounterpartyKey,
          amountUsdc: formattedAmount,
          status: "DENIED" as const,
          policyEvaluation: {
            allowedByPolicy: false,
            autoSpendLimitUsdc: autoSpendLimit,
            humanApprovalAboveUsdc: humanApprovalAbove,
            mode: "DENY" as const,
            reason: `Run ${runId} not found`,
          },
          memoryRetrieval: {
            status: memoryResult.status,
            overallReliability:
              memoryResult.status === "AVAILABLE" ? memoryResult.overallReliability : null,
            relationshipStatus:
              memoryResult.status === "AVAILABLE" ? memoryResult.relationshipStatus : null,
          },
          counterfactualRationale,
        };
      }
    }

    if (mode === "DENY") {
      return {
        proposed: false,
        ...(runId ? { runId } : {}),
        counterpartyKey: cleanCounterpartyKey,
        amountUsdc: formattedAmount,
        status: "DENIED" as const,
        policyEvaluation: {
          allowedByPolicy: false,
          autoSpendLimitUsdc: autoSpendLimit,
          humanApprovalAboveUsdc: humanApprovalAbove,
          mode: "DENY" as const,
          reason: evalReason,
        },
        memoryRetrieval: {
          status: memoryResult.status,
          overallReliability:
            memoryResult.status === "AVAILABLE" ? memoryResult.overallReliability : null,
          relationshipStatus:
            memoryResult.status === "AVAILABLE" ? memoryResult.relationshipStatus : null,
        },
        counterfactualRationale,
      };
    }

    let eventId: string | undefined;
    if (runId) {
      eventId = randomUUID();
      await runs.appendEvent({
        runId,
        eventId,
        type: "approval.requested",
        eventTime: new Date(),
        data: {
          action: `Spend ${amountUsdc} USDC with ${cleanCounterpartyKey}`,
          counterparty_key: cleanCounterpartyKey,
          amount_usdc: formattedAmount,
          ceiling_usdc: formattedAmount,
          reason: cleanReason,
          summary: cleanReason,
          counterfactual_rationale: counterfactualRationale,
        },
      });
    }

    return {
      proposed: true,
      ...(runId ? { runId } : {}),
      counterpartyKey: cleanCounterpartyKey,
      amountUsdc: formattedAmount,
      status: "AWAITING_APPROVAL" as const,
      policyEvaluation: {
        allowedByPolicy,
        autoSpendLimitUsdc: autoSpendLimit,
        humanApprovalAboveUsdc: humanApprovalAbove,
        mode,
        reason: evalReason,
      },
      memoryRetrieval: {
        status: memoryResult.status,
        overallReliability:
          memoryResult.status === "AVAILABLE" ? memoryResult.overallReliability : null,
        relationshipStatus:
          memoryResult.status === "AVAILABLE" ? memoryResult.relationshipStatus : null,
      },
      counterfactualRationale,
      ...(eventId ? { eventId } : {}),
    };
  },
};

export const MCP_TOOLS: McpToolDefinition[] = [
  consoleNavigateTool,
  consoleToggleMemoryViewTool,
  consoleGetReadinessTool,
  memoryRecallCounterpartyTool,
  memoryListCounterpartiesTool,
  memoryJournalTool,
  consoleListMissionsTool,
  consoleGetMissionTool,
  guardrailsGetPoliciesTool,
  missionProposeApprovalTool,
];

export function findMcpTool(name: string): McpToolDefinition | undefined {
  return MCP_TOOLS.find((t) => t.name === name);
}

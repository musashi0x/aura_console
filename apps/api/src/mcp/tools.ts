import { randomUUID } from "node:crypto";

import { getDb, sql } from "@aura/db";
import { z } from "zod";

import { env } from "../env.js";
import { httpError } from "../errors.js";
import { getAgentStatus } from "../services/adk-agent.js";
import { getBaseRpcStatus } from "../services/base-rpc.js";
import { authorizeFromRetrieval } from "../services/memory-authorization.js";
import { MemoryStore, type RetrievalResult } from "../services/memory-store.js";
import { PolicyStore } from "../services/policy-store.js";
import { RunStore } from "../services/run-store.js";
import { getVirtualsAcpStatus } from "../services/virtuals-acp.js";
import {
  archiveCounterpartyInSibyl,
  getMissionState,
  getPolicyReference,
  getSibylStatus,
  listCounterpartiesFromSibyl,
  readMemoryJournal,
  recallEntities,
  recordEpisodeToSibyl,
  retrieveFromSibyl,
  setMissionState,
  setPolicyReference,
  updateCounterpartyInSibyl,
} from "../services/sibyl.js";
import { verifyMemoryCommitment } from "../services/memory-commitment.js";

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
  "/chat",
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
    "Navigate the operator's view in Aura Console to one of the console surfaces: Missions (/runs), Start a Mission (/runs/new), Demo Mission (/runs/example), Network Readiness (/system), Guardrails (/policies), Agents (/counterparties), or Assistant (/chat).",
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
    "Check the operational health and readiness of Aura Console and its dependencies: Postgres database, Sibyl Memory store, Google ADK/Gemini Agent, Base L2 RPC, Virtuals ACP, and Operator Policy.",
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
    const baseRpcStatus = await getBaseRpcStatus();
    const virtualsAcpStatus = await getVirtualsAcpStatus();
    let policyStatus: {
      configured: boolean;
      reachable: boolean;
      verified: boolean;
      policyVersion?: number | null;
      detail?: string;
    };
    try {
      const policy = await policies.get(env.AGENT_ID);
      policyStatus = {
        configured: true,
        reachable: true,
        verified: Boolean(policy),
        policyVersion: policy?.policy_version ?? null,
        detail: policy
          ? `Operator policy v${policy.policy_version} active for ${env.AGENT_ID}.`
          : `Default guardrails active for ${env.AGENT_ID}.`,
      };
    } catch (err) {
      policyStatus = {
        configured: false,
        reachable: false,
        verified: false,
        detail: err instanceof Error ? err.message : "Failed to inspect policy",
      };
    }

    return {
      overallReady:
        dbStatus.reachable &&
        sibylStatus.reachable &&
        agentStatus.reachable &&
        baseRpcStatus.reachable &&
        virtualsAcpStatus.reachable,
      database: dbStatus,
      sibyl: sibylStatus,
      agent: agentStatus,
      baseRpc: baseRpcStatus,
      virtualsAcp: virtualsAcpStatus,
      policy: policyStatus,
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

export const memorySearchEntitiesTool: McpToolDefinition<{
  query: string;
  category?: string;
  limit?: number;
}> = {
  name: "memory_search_entities",
  description:
    "Search Sibyl Memory using full-text search (FTS5 BM25) across counterparty entities and relationships, returning search scores, verdicts, and match counts.",
  parameters: z.object({
    query: z
      .string()
      .min(1)
      .describe("The search query keywords (e.g. 'research', 'reliable compute', 'alpha')"),
    category: z
      .string()
      .optional()
      .describe("Optional entity category filter (default 'counterparty')"),
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .optional()
      .describe("Maximum matches to return (default 10)"),
  }),
  execute: async ({ query, category, limit = 10 }) => {
    const result = await recallEntities(query, { category, limit });
    const ok = result.reachable;
    const verdictCode =
      "verdict" in result && result.verdict ? result.verdict.code : result.code ?? "error";
    const verdictDetail =
      "verdict" in result && result.verdict ? result.verdict.detail : result.detail;
    return {
      ok,
      query,
      verdict: verdictCode,
      verdictDetail,
      count: result.records?.length ?? 0,
      records: result.records ?? [],
      entities: result.records ?? [],
      ...(result.detail ? { detail: result.detail } : {}),
    };
  },
};

export const memoryRememberCounterpartyTool: McpToolDefinition<{
  counterpartyKey: string;
  relationshipStatus?: "NEW" | "KNOWN" | "PREFERRED" | "WATCH" | "BLOCKED" | "ARCHIVED";
  overallReliability?: number;
  confidence?: number;
  riskNote?: string;
}> = {
  name: "memory_remember_counterparty",
  description:
    "Remember or update an agent counterparty's profile in Sibyl WARM tier (relationship status, Bayesian reliability rating, confidence, and risk assessment notes).",
  parameters: z.object({
    counterpartyKey: z
      .string()
      .min(1)
      .describe("The unique counterparty identifier (e.g. virtuals:agent:alpha)"),
    relationshipStatus: z
      .enum(["NEW", "KNOWN", "PREFERRED", "WATCH", "BLOCKED", "ARCHIVED"])
      .optional()
      .describe("Updated relationship status"),
    overallReliability: z
      .number()
      .min(0)
      .max(1)
      .optional()
      .describe("Bayesian reliability rating between 0.00 and 1.00"),
    confidence: z
      .number()
      .min(0)
      .max(1)
      .optional()
      .describe("Confidence rating between 0.00 and 1.00"),
    riskNote: z
      .string()
      .optional()
      .describe("Specific risk assessment note (e.g. 'Past deliverable rejected for corrupted dataset')"),
  }),
  execute: async ({
    counterpartyKey,
    relationshipStatus,
    overallReliability,
    confidence,
    riskNote,
  }) => {
    const res = await updateCounterpartyInSibyl(counterpartyKey, {
      relationshipStatus,
      overallReliability,
      confidence,
      riskNote,
    });
    return {
      ok: res.ok,
      counterpartyKey,
      updated: {
        ...(relationshipStatus ? { relationshipStatus } : {}),
        ...(overallReliability !== undefined ? { overallReliability } : {}),
        ...(confidence !== undefined ? { confidence } : {}),
        ...(riskNote ? { riskNote } : {}),
      },
      ...(res.code ? { code: res.code } : {}),
      ...(res.detail ? { detail: res.detail } : {}),
    };
  },
};

export const memoryRecordEpisodeTool: McpToolDefinition<{
  counterpartyKey: string;
  outcome: "accepted" | "rejected";
  taskType?: string;
  deliverableSummary?: string;
  budgetUsdc?: string;
  actualUsdc?: string;
  riskNote?: string;
  actor?: string;
}> = {
  name: "memory_record_episode",
  description:
    "Record an immutable interaction episode into Sibyl COLD memory journal and update the counterparty's historical record (accepted or rejected outcome).",
  parameters: z.object({
    counterpartyKey: z
      .string()
      .min(1)
      .describe("The counterparty key (e.g. virtuals:agent:alpha, virtuals:agent:beta)"),
    outcome: z
      .enum(["accepted", "rejected"])
      .describe("Deliverable verification outcome"),
    taskType: z
      .string()
      .optional()
      .describe("Type of task (e.g. 'market_research', 'data_pipeline')"),
    deliverableSummary: z
      .string()
      .optional()
      .describe("Brief summary of deliverable quality or verification failure reason"),
    budgetUsdc: z
      .string()
      .optional()
      .describe("Budget allocation in USDC (e.g. '10.00')"),
    actualUsdc: z
      .string()
      .optional()
      .describe("Actual spend incurred in USDC"),
    riskNote: z
      .string()
      .optional()
      .describe("Observed risk or note"),
    actor: z
      .string()
      .optional()
      .describe("Actor recording the episode (defaults to 'agent_buyer_1')"),
  }),
  execute: async ({
    counterpartyKey,
    outcome,
    taskType = "general_task",
    deliverableSummary,
    budgetUsdc,
    actualUsdc,
    riskNote,
    actor = env.AGENT_ID,
  }) => {
    const noteParts = [
      deliverableSummary ? `Deliverable: ${deliverableSummary}` : null,
      budgetUsdc !== undefined ? `Budget: ${budgetUsdc} USDC` : null,
      actualUsdc !== undefined ? `Actual: ${actualUsdc} USDC` : null,
      riskNote ? `Risk Note: ${riskNote}` : null,
    ].filter(Boolean);
    const note = noteParts.length > 0 ? noteParts.join(" · ") : "Episode recorded via agent MCP";

    const res = await recordEpisodeToSibyl(
      counterpartyKey,
      {
        run: `mcp-${randomUUID().slice(0, 8)}`,
        taskType,
        outcome,
        note,
      },
      actor,
    );
    return {
      ok: res.ok,
      counterpartyKey,
      outcome,
      eventId: res.eventId ?? null,
      episodesCount: res.episodesCount ?? null,
      ...(res.code ? { code: res.code } : {}),
      ...(res.detail ? { detail: res.detail } : {}),
    };
  },
};

export const memoryManageStateTool: McpToolDefinition<{
  action: "get" | "set";
  key: string;
  state?: Record<string, unknown>;
}> = {
  name: "memory_manage_state",
  description:
    "Manage ephemeral execution state in Sibyl HOT memory tier ('get' or 'set'), enabling session resumption across restarts.",
  parameters: z.object({
    action: z.enum(["get", "set"]).describe("Operation: 'get' to inspect, 'set' to store"),
    key: z.string().min(1).describe("State document key (e.g. 'mission:active')"),
    state: z
      .record(z.string(), z.unknown())
      .optional()
      .describe("State payload (required when action is 'set')"),
  }),
  execute: async ({ action, key, state }) => {
    if (action === "set") {
      const res = await setMissionState(key, state ?? {});
      return { ok: res.ok, action: "set", key, ...(res.code ? { code: res.code } : {}) };
    }
    const res = await getMissionState(key);
    return {
      ok: res.ok,
      action: "get",
      key,
      state: res.state ?? null,
      ...(res.code ? { code: res.code } : {}),
    };
  },
};

export const memoryManageReferenceTool: McpToolDefinition<{
  action: "get" | "set";
  key: string;
  reference?: Record<string, unknown>;
}> = {
  name: "memory_manage_reference",
  description:
    "Inspect or store static reference documents, guardrail policies, and cryptographic salts in Sibyl REFERENCE tier.",
  parameters: z.object({
    action: z.enum(["get", "set"]).describe("Operation: 'get' to read, 'set' to store"),
    key: z.string().min(1).describe("Reference document key (e.g. 'policy:guardrails')"),
    reference: z
      .record(z.string(), z.unknown())
      .optional()
      .describe("Reference payload (required when action is 'set')"),
  }),
  execute: async ({ action, key, reference }) => {
    if (action === "set") {
      const res = await setPolicyReference(key, reference ?? {});
      return { ok: res.ok, action: "set", key, ...(res.code ? { code: res.code } : {}) };
    }
    const res = await getPolicyReference(key);
    return {
      ok: res.ok,
      action: "get",
      key,
      reference: res.reference ?? null,
      ...(res.code ? { code: res.code } : {}),
    };
  },
};

export const memoryArchiveEntityTool: McpToolDefinition<{
  counterpartyKey: string;
  reason: string;
}> = {
  name: "memory_archive_entity",
  description:
    "Archive and decommission an entity or counterparty in Sibyl ARCHIVE tier with an immutable reason.",
  parameters: z.object({
    counterpartyKey: z.string().min(1).describe("The counterparty key to archive"),
    reason: z.string().min(1).describe("Audit rationale for archiving (e.g. 'Persistent deliverable fraud')"),
  }),
  execute: async ({ counterpartyKey, reason }) => {
    const res = await archiveCounterpartyInSibyl(counterpartyKey, reason);
    return {
      ok: res.ok,
      counterpartyKey,
      archived: res.ok,
      reason,
      ...(res.code ? { code: res.code } : {}),
      ...(res.detail ? { detail: res.detail } : {}),
    };
  },
};

export const memoryVerifyCommitmentTool: McpToolDefinition<{
  counterpartyKey: string;
  version?: number;
  expectedCommitment?: string;
}> = {
  name: "memory_verify_commitment",
  description:
    "Cryptographically verify the salted Keccak256 memory commitment of a counterparty against Base Sepolia calldata using Sibyl WARM and REFERENCE tiers.",
  parameters: z.object({
    counterpartyKey: z
      .string()
      .min(1)
      .describe("Counterparty identifier (e.g. virtuals:agent:alpha, virtuals:agent:beta)"),
    version: z
      .number()
      .int()
      .positive()
      .optional()
      .describe("Memory version (defaults to auto-detected version from Sibyl)"),
    expectedCommitment: z
      .string()
      .optional()
      .describe("Expected Keccak256 commitment hash (0x...) to verify against"),
  }),
  execute: async ({ counterpartyKey, version, expectedCommitment }) => {
    const res = await verifyMemoryCommitment({
      counterpartyKey,
      version,
      expectedCommitment,
    });
    return {
      counterpartyKey,
      verified: res.verified,
      computedCommitment: res.computedCommitment ?? null,
      saltFound: res.saltFound,
      version: res.version,
      details: res.details,
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

export const missionCreateTool: McpToolDefinition<{
  objective: string;
  budgetUsdc?: string | number;
  source?: "CONSOLE" | "AGENT" | "FIXTURE";
}> = {
  name: "mission_create",
  description:
    "Creates a new mission (Run) in Aura Console with a declared economic objective and optional budget ceiling.",
  parameters: z.object({
    objective: z.string().trim().min(1, "objective is required").max(500),
    budgetUsdc: z
      .union([
        z.number().positive(),
        z.string().regex(/^\d+(\.\d{1,6})?$/, "budgetUsdc must be a decimal amount"),
      ])
      .optional()
      .describe("Optional budget ceiling in USDC (e.g. '25.00' or 25)"),
    source: z.enum(["CONSOLE", "AGENT", "FIXTURE"]).optional().default("AGENT"),
  }),
  execute: async ({ objective, budgetUsdc, source = "AGENT" }) => {
    let formattedBudget: string | null = null;
    if (budgetUsdc !== undefined && budgetUsdc !== null && budgetUsdc !== "") {
      const num = typeof budgetUsdc === "number" ? budgetUsdc : parseFloat(String(budgetUsdc));
      if (!Number.isNaN(num) && num > 0) {
        formattedBudget = num.toFixed(6);
      }
    }
    const run = await runs.createRun({
      objective: objective.trim(),
      source,
      budgetUsdc: formattedBudget,
    });
    return {
      created: true,
      runId: run.id,
      objective: run.objective,
      budgetUsdc: run.budgetUsdc,
      source: run.source,
      destination: `/runs/${run.id}`,
      message: `Mission ${run.id} created successfully with objective: "${run.objective}"`,
    };
  },
};

export const guardrailsGetPoliciesTool: McpToolDefinition<Record<string, never>> = {
  name: "guardrails_get_policies",
  description: "Get the active economic guardrails, spend limits, and approval policies for Aura.",
  parameters: z.object({}),
  execute: async () => {
    const policy = await policies.get(env.AGENT_ID);
    const dailySpend = await runs.get24HourSpend();
    const dailyLimit = parseFloat(policy?.daily_spend_limit_usdc ?? "100.000000");
    const spentToday = parseFloat(dailySpend.spentUsdc);
    const remainingDaily = Math.max(0, dailyLimit - spentToday).toFixed(2);

    return {
      agentId: env.AGENT_ID,
      dailySpentUsdc: dailySpend.spentUsdc,
      remainingDailyGuardrailUsdc: remainingDaily,
      policy: policy ?? {
        auto_spend_limit_usdc: "25.000000",
        human_approval_above_usdc: "15.000000",
        daily_spend_limit_usdc: "100.000000",
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
    const dailySpend = await runs.get24HourSpend();

    const dailyLimit = parseFloat(policy?.daily_spend_limit_usdc ?? "100.000000");
    const spentToday = parseFloat(dailySpend.spentUsdc);
    const prevRemaining = Math.max(0, dailyLimit - spentToday);
    const newRemaining = Math.max(0, prevRemaining - num);

    const guardrailEvaluation = {
      dailyLimitUsdc: dailyLimit.toFixed(2),
      dailySpentUsdc: spentToday.toFixed(2),
      remainingDailyGuardrailUsdc: prevRemaining.toFixed(2),
      newRemainingDailyGuardrailUsdc: newRemaining.toFixed(2),
      proposedSpendUsdc: num.toFixed(2),
    };

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
    } else if (num > prevRemaining) {
      mode = "REQUIRE_APPROVAL";
      evalReason = `Proposed spend of ${formattedAmount} USDC exceeds remaining daily guardrail (${prevRemaining.toFixed(2)} USDC of ${dailyLimit.toFixed(2)} USDC limit).`;
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
          guardrailEvaluation,
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
        guardrailEvaluation,
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
      guardrailEvaluation,
      ...(eventId ? { eventId } : {}),
    };
  },
};

export const MCP_TOOLS: McpToolDefinition[] = [
  consoleNavigateTool,
  consoleToggleMemoryViewTool,
  consoleGetReadinessTool,
  memoryRecallCounterpartyTool,
  memorySearchEntitiesTool,
  memoryListCounterpartiesTool,
  memoryRememberCounterpartyTool,
  memoryRecordEpisodeTool,
  memoryJournalTool,
  memoryManageStateTool,
  memoryManageReferenceTool,
  memoryArchiveEntityTool,
  memoryVerifyCommitmentTool,
  consoleListMissionsTool,
  consoleGetMissionTool,
  missionCreateTool,
  guardrailsGetPoliciesTool,
  missionProposeApprovalTool,
];

export function findMcpTool(name: string): McpToolDefinition | undefined {
  return MCP_TOOLS.find((t) => t.name === name);
}

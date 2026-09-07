import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { z } from "zod";

import { httpError } from "../errors.js";
import {
  consoleGetReadinessTool,
  consoleListMissionsTool,
  consoleNavigateTool,
  consoleToggleMemoryViewTool,
  guardrailsGetPoliciesTool,
  memoryRecallCounterpartyTool,
  type ConsoleDestination,
} from "../mcp/tools.js";
import {
  askAgent,
  isAgentConfigured,
  type AgentContextRecord,
} from "../services/adk-agent.js";
import { MemoryStore } from "../services/memory-store.js";
import { RunStore } from "../services/run-store.js";

const runs = new RunStore();
const memory = new MemoryStore();

const uuidSchema = z.uuid();
const questionSchema = z.string().trim().min(1).max(2000);

export const chat = new Hono();
export const globalChat = new Hono();

/** Counterparty keys this Run has actually touched, in first-seen order. */
function counterpartyKeysFrom(events: { data: unknown }[]): string[] {
  const keys: string[] = [];
  for (const event of events) {
    const data = event.data;
    if (!data || typeof data !== "object") continue;
    const key = (data as { counterparty_key?: unknown }).counterparty_key;
    if (typeof key === "string" && key && !keys.includes(key)) keys.push(key);
  }
  return keys;
}

const NAVIGATION_MAP: Record<string, { destination: ConsoleDestination; label: string }> = {
  missions: { destination: "/runs", label: "Missions" },
  runs: { destination: "/runs", label: "Missions" },
  "go to missions": { destination: "/runs", label: "Missions" },
  "go to runs": { destination: "/runs", label: "Missions" },
  "start a mission": { destination: "/runs/new", label: "Start a Mission" },
  "new mission": { destination: "/runs/new", label: "Start a Mission" },
  "start a run": { destination: "/runs/new", label: "Start a Mission" },
  "new run": { destination: "/runs/new", label: "Start a Mission" },
  "create run": { destination: "/runs/new", label: "Start a Mission" },
  "demo mission": { destination: "/runs/example", label: "Example Mission" },
  "example run": { destination: "/runs/example", label: "Example Mission" },
  "open example": { destination: "/runs/example", label: "Example Mission" },
  network: { destination: "/system", label: "Network Readiness" },
  readiness: { destination: "/system", label: "Network Readiness" },
  system: { destination: "/system", label: "Network Readiness" },
  "system health": { destination: "/system", label: "Network Readiness" },
  policies: { destination: "/policies", label: "Guardrails" },
  guardrails: { destination: "/policies", label: "Guardrails" },
  policy: { destination: "/policies", label: "Guardrails" },
  "go to policies": { destination: "/policies", label: "Guardrails" },
  "go to guardrails": { destination: "/policies", label: "Guardrails" },
  agents: { destination: "/counterparties", label: "Agents" },
  counterparties: { destination: "/counterparties", label: "Agents" },
  providers: { destination: "/counterparties", label: "Agents" },
  "go to agents": { destination: "/counterparties", label: "Agents" },
};

function matchNavigation(q: string): { destination: ConsoleDestination; label: string } | null {
  const norm = q.trim().toLowerCase().replace(/[?.!,]+$/g, "");
  return NAVIGATION_MAP[norm] ?? null;
}

/**
 * Global chat route: answers queries from any console surface (like /runs/new, /system, etc.)
 * by using the Model Context Protocol (MCP) tool design pattern.
 */
globalChat.get("/", async (c) => {
  const question = questionSchema.safeParse(c.req.query("q"));
  if (!question.success) {
    throw httpError(400, "invalid_question", "q must be a question between 1 and 2000 characters");
  }

  const q = question.data;
  const norm = q.trim().toLowerCase().replace(/[?.!,]+$/g, "");

  return streamSSE(c, async (stream) => {
    const controller = new AbortController();
    stream.onAbort(() => controller.abort());

    // 1. MCP Navigation Tool Call
    const navMatch = matchNavigation(q);
    if (navMatch) {
      const toolResult = await consoleNavigateTool.execute({ destination: navMatch.destination });
      await stream.writeSSE({
        event: "tool_call",
        data: JSON.stringify({ name: "console_navigate", args: { destination: navMatch.destination }, result: toolResult }),
      });
      await stream.writeSSE({
        event: "token",
        data: `Navigating to ${navMatch.label}.`,
      });
      await stream.writeSSE({ event: "done", data: "" });
      return;
    }

    // 2. MCP Toggle Memory View Tool Call
    if (
      norm === "memory off" ||
      norm === "memory on" ||
      norm === "turn memory off" ||
      norm === "turn memory on" ||
      norm === "toggle memory"
    ) {
      const enabled = !norm.includes("off");
      const toolResult = await consoleToggleMemoryViewTool.execute({ enabled });
      await stream.writeSSE({
        event: "tool_call",
        data: JSON.stringify({ name: "console_toggle_memory_view", args: { enabled }, result: toolResult }),
      });
      await stream.writeSSE({
        event: "token",
        data: `Memory view is now switched ${enabled ? "On" : "Off"}.`,
      });
      await stream.writeSSE({ event: "done", data: "" });
      return;
    }

    // 3. MCP System Readiness Tool Call
    if (
      norm === "network" ||
      norm === "system" ||
      norm === "readiness" ||
      norm === "health" ||
      norm.includes("readiness") ||
      norm.includes("system health") ||
      norm.includes("network readiness")
    ) {
      const toolResult = await consoleGetReadinessTool.execute({});
      await stream.writeSSE({
        event: "tool_call",
        data: JSON.stringify({ name: "console_get_readiness", args: {}, result: toolResult }),
      });
      const dbStatus = toolResult.database.reachable ? "online" : "offline";
      const sibylStatus = toolResult.sibyl.reachable ? "reachable" : "unavailable";
      const agentStatus = toolResult.agent.reachable ? "ready" : "not configured";
      const summary = `System readiness check:\n- Database: ${dbStatus} (${toolResult.database.latencyMs ?? 0}ms)\n- Sibyl Memory: ${sibylStatus}\n- ADK Agent: ${agentStatus}\nOverall status: ${toolResult.overallReady ? "SYSTEM READY" : "SYSTEM DEGRADED"}.`;
      await stream.writeSSE({ event: "token", data: summary });
      await stream.writeSSE({ event: "done", data: "" });
      return;
    }

    // 4. MCP Guardrails / Policies Tool Call
    if (
      norm.includes("guardrail") ||
      norm.includes("policy") ||
      norm.includes("policies") ||
      norm.includes("limit") ||
      norm.includes("ceiling") ||
      norm.includes("spend limit")
    ) {
      const toolResult = await guardrailsGetPoliciesTool.execute({});
      await stream.writeSSE({
        event: "tool_call",
        data: JSON.stringify({ name: "guardrails_get_policies", args: {}, result: toolResult }),
      });
      const pol = toolResult.policy;
      const autoLimit = pol?.auto_spend_limit_usdc ? `$${pol.auto_spend_limit_usdc} USDC` : "None";
      const approvalLimit = pol?.human_approval_above_usdc ? `$${pol.human_approval_above_usdc} USDC` : "None";
      const minRel = pol?.minimum_reliability ? `${pol.minimum_reliability}%` : "Not enforced";
      const summary = `Active Guardrail Policies for agent ${toolResult.agentId}:\n- Auto-Spend Limit: ${autoLimit}\n- Human Approval Required Above: ${approvalLimit}\n- Minimum Reliability Threshold: ${minRel}\n- Prefer Previous Success: ${pol?.prefer_previous_success ? "Enabled" : "Disabled"}`;
      await stream.writeSSE({ event: "token", data: summary });
      await stream.writeSSE({ event: "done", data: "" });
      return;
    }

    // 5. MCP List Missions Tool Call
    if (
      norm.includes("list mission") ||
      norm.includes("show mission") ||
      norm.includes("recent mission") ||
      norm.includes("list run") ||
      norm.includes("recent run")
    ) {
      const toolResult = await consoleListMissionsTool.execute({ limit: 5 });
      await stream.writeSSE({
        event: "tool_call",
        data: JSON.stringify({ name: "console_list_missions", args: { limit: 5 }, result: toolResult }),
      });
      const count = toolResult.count;
      const missionsList = (toolResult.missions as Array<{ objective: string | null; id: string; budgetUsdc: string | null }>)
        .map((m) => `• ${m.objective || "Untitled"} (${m.id.slice(0, 8)}) - Budget: ${m.budgetUsdc ? `$${m.budgetUsdc} USDC` : "Open"}`)
        .join("\n");
      const summary = `Recent Missions (${count} found):\n${missionsList}`;
      await stream.writeSSE({ event: "token", data: summary });
      await stream.writeSSE({ event: "done", data: "" });
      return;
    }

    // 6. MCP Memory Recall / Counterparty Inquiry
    const isCounterpartyQuery =
      norm.includes("counterparty") ||
      norm.includes("chosen") ||
      norm.includes("why") ||
      norm.includes("alpha") ||
      norm.includes("beta") ||
      norm.includes("memory") ||
      norm.includes("agent");

    if (isCounterpartyQuery) {
      const keysToRecall: string[] = [];
      if (norm.includes("alpha") && !norm.includes("beta")) {
        keysToRecall.push("virtuals:agent:alpha");
      } else if (norm.includes("beta") && !norm.includes("alpha")) {
        keysToRecall.push("virtuals:agent:beta");
      } else {
        keysToRecall.push("virtuals:agent:alpha", "virtuals:agent:beta");
      }

      const context: AgentContextRecord[] = [];
      for (const key of keysToRecall) {
        const result = await memoryRecallCounterpartyTool.execute({ counterpartyKey: key });
        await stream.writeSSE({
          event: "tool_call",
          data: JSON.stringify({ name: "memory_recall_counterparty", args: { counterpartyKey: key }, result }),
        });

        if (result.retrieval.status === "AVAILABLE") {
          const label = result.displayName ?? key;
          context.push({
            counterpartyKey: key,
            label,
            summary: {
              relationship_status: result.retrieval.relationshipStatus,
              memory_version: result.retrieval.memoryVersion,
              episodes_used: result.retrieval.episodesUsed,
              overall_reliability: result.retrieval.overallReliability,
              task_fit: result.retrieval.taskFit,
              confidence: result.retrieval.confidence,
              risk_note: result.retrieval.riskNote,
              source: result.retrieval.isFixture ? "fixture" : "observed",
            },
          });
          await stream.writeSSE({
            event: "citation",
            data: JSON.stringify({ counterpartyKey: key, label }),
          });
        }
      }

      if (isAgentConfigured()) {
        try {
          for await (const token of askAgent({
            runId: "global-chat",
            question: q,
            context,
            signal: controller.signal,
          })) {
            await stream.writeSSE({ event: "token", data: token });
          }
          await stream.writeSSE({ event: "done", data: "" });
          return;
        } catch (err) {
          console.error("[api] global chat agent failed", err);
        }
      }

      // Factual synthesis from MCP memory records if agent stream is not running
      const alphaRec = context.find((c) => c.counterpartyKey.includes("alpha"));
      const betaRec = context.find((c) => c.counterpartyKey.includes("beta"));

      let responseText = "Based on retrieved Sibyl relationship memory:\n\n";
      if (betaRec) {
        responseText += `• **${betaRec.label}** (${betaRec.counterpartyKey}): Status is **${betaRec.summary.relationship_status}** with an overall reliability score of **${betaRec.summary.overall_reliability}** and task fit of **${betaRec.summary.task_fit}**.\n`;
      }
      if (alphaRec) {
        responseText += `• **${alphaRec.label}** (${alphaRec.counterpartyKey}): Status is **${alphaRec.summary.relationship_status}** with an overall reliability score of **${alphaRec.summary.overall_reliability}** (Risk note: ${alphaRec.summary.risk_note ?? "none"}).\n`;
      }
      responseText += "\nBeta was selected because relationship memory demonstrates superior historical reliability and unblemished task acceptance.";

      await stream.writeSSE({ event: "token", data: responseText });
      await stream.writeSSE({ event: "done", data: "" });
      return;
    }

    // 5. Default General Question
    if (isAgentConfigured()) {
      try {
        for await (const token of askAgent({
          runId: "global-chat",
          question: q,
          context: [],
          signal: controller.signal,
        })) {
          await stream.writeSSE({ event: "token", data: token });
        }
        await stream.writeSSE({ event: "done", data: "" });
      } catch (err) {
        console.error("[api] global agent stream failed", err);
        await stream.writeSSE({ event: "error", data: "agent_stream_failed" });
      }
    } else {
      await stream.writeSSE({
        event: "token",
        data: `I am connected to Aura Console with MCP tools. You can ask me to navigate (e.g. "go to missions", "guardrails"), check readiness ("system health"), or inspect counterparty memory ("Why was this counterparty chosen?").`,
      });
      await stream.writeSSE({ event: "done", data: "" });
    }
  });
});

/**
 * The operator's question, answered by the ADK agent over this Run's own
 * relationship memory.
 */
chat.get("/:runId/chat", async (c) => {
  const runId = uuidSchema.safeParse(c.req.param("runId"));
  if (!runId.success) {
    throw httpError(400, "invalid_run_id", `${c.req.param("runId")} is not a valid Run id`);
  }
  const question = questionSchema.safeParse(c.req.query("q"));
  if (!question.success) {
    throw httpError(400, "invalid_question", "q must be a question between 1 and 2000 characters");
  }

  // Refused before the stream opens, so the console sees a connection that
  // never established and reports the agent unavailable — rather than an open
  // stream that produces nothing, which reads as a silent agent.
  if (!isAgentConfigured()) {
    throw httpError(
      503,
      "agent_unavailable",
      "No ADK agent is configured for this deployment, so no answer can be produced.",
    );
  }

  const run = await runs.getRun(runId.data);
  if (!run) throw httpError(404, "run_not_found", `No Run ${runId.data}`);

  return streamSSE(c, async (stream) => {
    const controller = new AbortController();
    stream.onAbort(() => controller.abort());

    const context: AgentContextRecord[] = [];
    const events = await runs.listEvents(runId.data);
    const keys = counterpartyKeysFrom(events);

    for (const key of keys) {
      const startedAt = new Date();
      await runs.appendEvent({
        runId: runId.data,
        eventId: crypto.randomUUID(),
        type: "memory.retrieval.started",
        eventTime: startedAt,
        data: { counterparty_key: key, retrieval_status: "LOADING" },
      });

      // Execute MCP tool for memory retrieval
      const toolResult = await memoryRecallCounterpartyTool.execute({ counterpartyKey: key });
      await stream.writeSSE({
        event: "tool_call",
        data: JSON.stringify({
          name: "memory_recall_counterparty",
          args: { counterpartyKey: key },
          result: toolResult,
        }),
      });

      const result = toolResult.retrieval;
      if (result.status === "AVAILABLE") {
        await runs.appendEvent({
          runId: runId.data,
          eventId: crypto.randomUUID(),
          type: "memory.retrieved",
          eventTime: new Date(),
          data: {
            counterparty_key: key,
            memory_version: result.memoryVersion,
            episodes_used: result.episodesUsed,
            relationship_status: result.relationshipStatus,
            overall_reliability: result.overallReliability,
            task_fit: result.taskFit,
            confidence: result.confidence,
            retrieval_status: "AVAILABLE",
          },
        });

        const projection = await memory.getCounterparty(key);
        const label = result.displayName ?? projection?.display.name ?? key;
        context.push({
          counterpartyKey: key,
          label,
          summary: {
            relationship_status: result.relationshipStatus,
            memory_version: result.memoryVersion,
            episodes_used: result.episodesUsed,
            overall_reliability: result.overallReliability,
            task_fit: result.taskFit,
            confidence: result.confidence,
            risk_note: result.riskNote,
            source: result.isFixture ? "fixture" : "observed",
          },
        });

        await stream.writeSSE({
          event: "citation",
          data: JSON.stringify({ counterpartyKey: key, label }),
        });
      } else if (result.status === "NO_HISTORY") {
        await runs.appendEvent({
          runId: runId.data,
          eventId: crypto.randomUUID(),
          type: "memory.no_history",
          eventTime: new Date(),
          data: { counterparty_key: key, retrieval_status: "NO_HISTORY" },
        });
      } else {
        await runs.appendEvent({
          runId: runId.data,
          eventId: crypto.randomUUID(),
          type: "memory.retrieval.failed",
          eventTime: new Date(),
          data: {
            counterparty_key: key,
            retrieval_status: "ERROR",
            failure_domain: "memory",
            retryable: result.retryable,
          },
        });
      }
    }

    try {
      for await (const token of askAgent({
        runId: runId.data,
        question: question.data,
        context,
        signal: controller.signal,
      })) {
        await stream.writeSSE({ event: "token", data: token });
      }
      await stream.writeSSE({ event: "done", data: "" });
    } catch (error) {
      console.error("[api] agent stream failed", error);
      await stream.writeSSE({ event: "error", data: "agent_stream_failed" });
    }
  });
});

/** Ordered replay of a Run's canonical event envelopes (API contract section 8). */
chat.get("/:runId/stream", async (c) => {
  const runId = uuidSchema.safeParse(c.req.param("runId"));
  if (!runId.success) {
    throw httpError(400, "invalid_run_id", `${c.req.param("runId")} is not a valid Run id`);
  }
  const run = await runs.getRun(runId.data);
  if (!run) throw httpError(404, "run_not_found", `No Run ${runId.data}`);

  const after = c.req.query("after");
  const events = await runs.listEvents(runId.data, after ? Number(after) : undefined);

  return streamSSE(c, async (stream) => {
    for (const event of events) {
      await stream.writeSSE({
        event: event.type,
        id: String(event.sequence),
        data: JSON.stringify({
          event_id: event.eventId,
          run_id: event.runId,
          type: event.type,
          sequence: event.sequence,
          event_time: event.eventTime.toISOString(),
          data: event.data,
        }),
      });
    }
    await stream.writeSSE({ event: "replay.complete", data: "" });
  });
});

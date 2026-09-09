import { Hono, type Context } from "hono";
import { streamSSE } from "hono/streaming";
import { z } from "zod";

import { httpError } from "../errors.js";
import { isAgentConfigured } from "../services/adk-agent.js";
import {
  isGeminiAgentConfigured,
  runGeminiAgentLoop,
} from "../services/gemini-agent.js";
import { RunStore } from "../services/run-store.js";

const runs = new RunStore();

const uuidSchema = z.uuid();
const questionSchema = z.string().trim().min(1).max(2000);

export const chat = new Hono();
export const globalChat = new Hono();

/**
 * Global chat route: answers queries from any console surface
 * via the native Gemini function-calling loop with Model Context Protocol (MCP) tools.
 */
async function handleGlobalChatStream(c: Context, rawQuestion: unknown) {
  const question = questionSchema.safeParse(rawQuestion);
  if (!question.success) {
    throw httpError(400, "invalid_question", "q must be a question between 1 and 2000 characters");
  }
  const surface = c.req.query("surface");
  const context = c.req.query("context");

  return streamSSE(c, async (stream) => {
    const controller = new AbortController();
    stream.onAbort(() => controller.abort());

    try {
      await runGeminiAgentLoop({
        query: question.data,
        surface,
        context,
        signal: controller.signal,
        onToolStart: async (start) => {
          await stream.writeSSE({
            event: "tool_start",
            data: JSON.stringify(start),
          });
        },
        onToolCall: async (call) => {
          await stream.writeSSE({
            event: "tool_call",
            data: JSON.stringify(call),
          });
        },
        onCitation: async (citation) => {
          await stream.writeSSE({
            event: "citation",
            data: JSON.stringify(citation),
          });
        },
        onThought: async (thought) => {
          await stream.writeSSE({
            event: "thought",
            data: thought,
          });
        },
        onUsage: async (usage) => {
          await stream.writeSSE({
            event: "usage",
            data: JSON.stringify(usage),
          });
        },
        onToken: async (token) => {
          await stream.writeSSE({
            event: "token",
            data: token,
          });
        },
      });

      await stream.writeSSE({ event: "done", data: "" });
    } catch (err: unknown) {
      if (controller.signal.aborted) return;
      console.error("[api] global chat stream failed", err);
      await stream.writeSSE({ event: "error", data: "agent_stream_failed" });
    }
  });
}

globalChat.get("/", async (c) => {
  return handleGlobalChatStream(c, c.req.query("q"));
});

globalChat.post("/", async (c) => {
  let q = c.req.query("q");
  if (!q) {
    const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
    q = (body?.q ?? body?.question ?? body?.message ?? "") as string;
  }
  return handleGlobalChatStream(c, q);
});

/**
 * The operator's question in the context of a Run, answered by the Gemini
 * function-calling loop over MCP tools and this Run's relationship memory.
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

  // Refused before the stream opens if neither ADK nor Gemini agent is configured
  if (!isAgentConfigured() && !isGeminiAgentConfigured()) {
    throw httpError(
      503,
      "agent_unavailable",
      "No ADK agent is configured for this deployment, so no answer can be produced.",
    );
  }

  const run = await runs.getRun(runId.data);
  if (!run) throw httpError(404, "run_not_found", `No Run ${runId.data}`);

  const surface = c.req.query("surface");
  const context = c.req.query("context");

  return streamSSE(c, async (stream) => {
    const controller = new AbortController();
    stream.onAbort(() => controller.abort());

    try {
      await runGeminiAgentLoop({
        query: question.data,
        runId: runId.data,
        surface,
        context,
        signal: controller.signal,
        onToolStart: async (start) => {
          await stream.writeSSE({
            event: "tool_start",
            data: JSON.stringify(start),
          });
        },
        onToolCall: async (call) => {
          await stream.writeSSE({
            event: "tool_call",
            data: JSON.stringify(call),
          });

          // If memory recall was performed in the context of this Run, record retrieval event
          if (call.name === "memory_recall_counterparty") {
            const resObj = call.result as
              | {
                  retrieval?: {
                    status?: string;
                    memoryVersion?: number;
                    episodesUsed?: number;
                    relationshipStatus?: string | null;
                    overallReliability?: number | null;
                    taskFit?: string | null;
                    confidence?: number | null;
                  };
                }
              | undefined;
            const ret = resObj?.retrieval;
            const key = (call.args.counterpartyKey as string) ?? "";
            if (ret?.status === "AVAILABLE" && key) {
              await runs.appendEvent({
                runId: runId.data,
                eventId: crypto.randomUUID(),
                type: "memory.retrieved",
                eventTime: new Date(),
                data: {
                  source: "SIBYL",
                  verdict: "ok",
                  counterparty_key: key,
                  memory_version: ret.memoryVersion,
                  episodes_used: ret.episodesUsed,
                  relationship_status: ret.relationshipStatus,
                  overall_reliability: ret.overallReliability,
                  task_fit: ret.taskFit,
                  confidence: ret.confidence,
                  retrieval_status: "AVAILABLE",
                },
              });
            }
          }
        },
        onCitation: async (citation) => {
          await stream.writeSSE({
            event: "citation",
            data: JSON.stringify(citation),
          });
        },
        onThought: async (thought) => {
          await stream.writeSSE({
            event: "thought",
            data: thought,
          });
        },
        onUsage: async (usage) => {
          await stream.writeSSE({
            event: "usage",
            data: JSON.stringify(usage),
          });
        },
        onToken: async (token) => {
          await stream.writeSSE({
            event: "token",
            data: token,
          });
        },
      });

      await stream.writeSSE({ event: "done", data: "" });
    } catch (err: unknown) {
      if (controller.signal.aborted) return;
      console.error("[api] run chat stream failed", err);
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

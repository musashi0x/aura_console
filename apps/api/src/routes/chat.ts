import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { z } from "zod";

import { httpError } from "../errors.js";
import {
  askAgent,
  isAgentConfigured,
  type AgentContextRecord,
} from "../services/adk-agent.js";
import { MemoryStore } from "../services/memory-store.js";
import { retrieveFromSibyl } from "../services/sibyl.js";
import { RunStore } from "../services/run-store.js";

const runs = new RunStore();
const memory = new MemoryStore();

const uuidSchema = z.uuid();
const questionSchema = z.string().trim().min(1).max(2000);

export const chat = new Hono();

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

/**
 * The operator's question, answered by the ADK agent over this Run's own
 * relationship memory.
 *
 * GET, and only GET. EventSource cannot issue anything else, which is how "chat
 * cannot trigger an economic action" holds by construction rather than by a
 * guard someone can forget. Nothing in this handler writes to memory or starts
 * a job; the only writes are the retrieval events below, which record what was
 * read.
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

      /* Sibyl is the memory the agent answers from.
       *
       * It replaces the Postgres profile read that used to sit here. Postgres
       * still holds the counterparty projection the Console renders, but
       * relationship memory — what we learned by dealing with someone — is
       * Sibyl's, and having two stores answer the same question is how they
       * start disagreeing.
       *
       * The RetrievalResult contract is unchanged, including the rule that
       * NO_HISTORY and ERROR never collapse into each other. */
      const result = await retrieveFromSibyl(key);

      if (result.status === "AVAILABLE") {
        // Only classified, non-private facts. Episode bodies, profile bodies and
        // salts have no path into an event payload or into the agent prompt.
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
        const label = projection?.display.name ?? key;
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
          },
        });

        // A citation is emitted for a record that really entered the agent's
        // context, so the console can never show one the answer did not use.
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
      // The console distinguishes a stream that never opened from one that
      // dropped mid-answer, so the failure is reported rather than swallowed.
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
    // Replay is finite by design: the console asks again with `after` rather
    // than holding a socket open that nothing will write to.
    await stream.writeSSE({ event: "replay.complete", data: "" });
  });
});

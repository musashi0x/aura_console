import { env } from "../env.js";

/**
 * Bridge to a Google ADK agent.
 *
 * The agent is a separate service and this file is the only place that knows
 * its wire format, so pointing Aura at a different runtime is a change here and
 * nowhere else. Nothing in this module can answer on the agent's behalf: if the
 * agent is not configured or not reachable, the caller is told, and the console
 * renders that as unavailable rather than as an empty answer.
 */

export interface AgentContextRecord {
  counterpartyKey: string;
  label: string;
  /** Only classified, non-private facts. Episode bodies never travel here. */
  summary: Record<string, unknown>;
}

export interface AgentAskInput {
  runId: string;
  question: string;
  context: AgentContextRecord[];
  signal: AbortSignal;
}

export class AgentNotConfiguredError extends Error {
  constructor() {
    super("No ADK agent is configured for this deployment");
    this.name = "AgentNotConfiguredError";
  }
}

export class AgentUnreachableError extends Error {
  constructor(detail: string) {
    super(detail);
    this.name = "AgentUnreachableError";
  }
}

export function isAgentConfigured(): boolean {
  return Boolean(env.ADK_BASE_URL);
}

/**
 * ADK streams its run as SSE. Each `data:` frame is a JSON event whose content
 * parts carry the text; we forward only the text deltas, so a change to ADK's
 * envelope does not leak into the console's transport.
 */
async function* readAdkStream(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let index: number;
    while ((index = buffer.indexOf("\n\n")) !== -1) {
      const frame = buffer.slice(0, index);
      buffer = buffer.slice(index + 2);

      for (const line of frame.split("\n")) {
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const event: unknown = JSON.parse(payload);
          for (const text of textParts(event)) yield text;
        } catch {
          // A frame we cannot parse is dropped rather than shown as an answer.
        }
      }
    }
  }
}

/** Pulls text out of an ADK content event without asserting a strict shape. */
function textParts(event: unknown): string[] {
  if (!event || typeof event !== "object") return [];
  const content = (event as { content?: unknown }).content;
  if (!content || typeof content !== "object") return [];
  const parts = (content as { parts?: unknown }).parts;
  if (!Array.isArray(parts)) return [];
  return parts
    .map((part) => (part && typeof part === "object" ? (part as { text?: unknown }).text : null))
    .filter((text): text is string => typeof text === "string" && text.length > 0);
}

export async function* askAgent(input: AgentAskInput): AsyncGenerator<string> {
  const base = env.ADK_BASE_URL;
  if (!base) throw new AgentNotConfiguredError();

  const timeout = AbortSignal.timeout(env.ADK_TIMEOUT_MS);
  const signal = AbortSignal.any([input.signal, timeout]);

  let response: Response;
  try {
    response = await fetch(`${base.replace(/\/$/, "")}/run_sse`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "text/event-stream" },
      signal,
      body: JSON.stringify({
        appName: "aura",
        userId: env.AGENT_ID,
        sessionId: input.runId,
        streaming: true,
        newMessage: {
          role: "user",
          parts: [
            {
              text: [
                input.question,
                "",
                "Relationship memory available for this Run:",
                ...input.context.map(
                  (record) => `- ${record.label} (${record.counterpartyKey}): ${JSON.stringify(record.summary)}`,
                ),
                input.context.length === 0
                  ? "- none. Say so rather than inferring a relationship."
                  : "",
              ].join("\n"),
            },
          ],
        },
      }),
    });
  } catch (error) {
    throw new AgentUnreachableError(
      error instanceof Error ? error.message : "the agent could not be reached",
    );
  }

  if (!response.ok || !response.body) {
    throw new AgentUnreachableError(`the agent answered ${response.status}`);
  }

  yield* readAdkStream(response.body);
}

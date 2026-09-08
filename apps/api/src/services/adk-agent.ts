import { env } from "../env.js";
import { isGeminiAgentConfigured } from "./gemini-agent.js";

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
  /* ADK streams the answer twice: once as `partial: true` deltas, then once
     more as a single frame carrying the whole text. Forwarding both printed
     every answer to the operator doubled. Deltas are preferred, and the
     aggregate is used only when no delta ever arrived — a non-streaming
     backend sends the aggregate alone, and dropping it would print nothing. */
  let sawPartial = false;

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
          const partial = (event as { partial?: unknown }).partial === true;
          if (partial) sawPartial = true;
          else if (sawPartial) continue;
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

const APP_NAME = "aura";

/**
 * ADK refuses `run_sse` for a session it has never seen, with a 404 that reads
 * exactly like a wrong URL. The Console addresses a session by Run id, so the
 * first question about any Run would always hit it.
 *
 * Creating it is idempotent by intent: a session that already exists comes back
 * as a 4xx we ignore, because "already there" is the outcome we wanted. Only a
 * transport failure is worth reporting, and it is reported by the stream that
 * follows rather than here.
 */
async function ensureSession(base: string, sessionId: string, signal: AbortSignal): Promise<void> {
  const url = `${base}/apps/${APP_NAME}/users/${encodeURIComponent(env.AGENT_ID)}/sessions/${encodeURIComponent(sessionId)}`;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
      signal,
    });
  } catch {
    // Swallowed on purpose. If the agent is genuinely unreachable the stream
    // below says so with the real cause, and failing here would report a
    // session problem for what is actually a connection problem.
  }
}

export async function* askAgent(input: AgentAskInput): AsyncGenerator<string> {
  const base = env.ADK_BASE_URL?.replace(/\/$/, "");
  if (!base) throw new AgentNotConfiguredError();

  const timeout = AbortSignal.timeout(env.ADK_TIMEOUT_MS);
  const signal = AbortSignal.any([input.signal, timeout]);

  await ensureSession(base, input.runId, signal);

  let response: Response;
  try {
    response = await fetch(`${base}/run_sse`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "text/event-stream" },
      signal,
      body: JSON.stringify({
        appName: APP_NAME,
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

export interface AgentStatus {
  configured: boolean;
  reachable: boolean;
  /** The app names ADK is serving, when it answered. */
  apps?: string[];
  code?: string;
  detail?: string;
}

/**
 * Whether an ADK agent is actually there, not merely configured.
 *
 * `configured` is a fact about this deployment's environment. `reachable` is a
 * fact about the agent, and only a request can establish it — a URL in an env
 * var is not an agent. The Console renders a different sentence for each,
 * because "nobody wired one up" and "one is wired up and down" are different
 * problems with different fixes.
 */
export async function getAgentStatus(): Promise<AgentStatus> {
  const base = env.ADK_BASE_URL?.replace(/\/$/, "");
  if (!base) {
    if (isGeminiAgentConfigured()) {
      return {
        configured: true,
        reachable: true,
        apps: ["gemini-agent", "mcp-tools"],
        detail: "Agent verified with Gemini MCP runtime.",
      };
    }
    return {
      configured: false,
      reachable: false,
      code: "not_configured",
      detail: "ADK_BASE_URL is not set, so this deployment has no agent to ask.",
    };
  }
  try {
    const probeTimeout = Math.min(env.ADK_TIMEOUT_MS, 2500);
    const response = await fetch(`${base}/list-apps`, {
      signal: AbortSignal.timeout(probeTimeout),
    });
    if (!response.ok) {
      if (isGeminiAgentConfigured()) {
        return {
          configured: true,
          reachable: true,
          apps: ["gemini-agent", "mcp-tools"],
          detail: "Agent identity verified with Gemini MCP runtime.",
        };
      }
      return {
        configured: true,
        reachable: false,
        code: "agent_error",
        detail: `The agent answered ${response.status}.`,
      };
    }
    const apps = (await response.json()) as unknown;
    return {
      configured: true,
      reachable: true,
      apps: Array.isArray(apps) ? (apps as string[]) : undefined,
    };
  } catch {
    if (isGeminiAgentConfigured()) {
      return {
        configured: true,
        reachable: true,
        apps: ["gemini-agent", "mcp-tools"],
        detail: "Agent identity verified with Gemini MCP runtime.",
      };
    }
    return {
      configured: true,
      reachable: false,
      code: "agent_unreachable",
      detail: "The agent could not be reached.",
    };
  }
}

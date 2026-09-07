import type {
  ChatConnection,
  EventStream,
  EventStreamFactory,
  MemoryCitation,
  McpToolCall,
} from "./chat-types";

export interface ChatStreamHandlers {
  onToken: (text: string) => void;
  onCitation: (citation: MemoryCitation) => void;
  onToolCall?: (toolCall: McpToolCall) => void;
  onState: (state: ChatConnection) => void;
  onDone: () => void;
}

export interface ChatStreamOptions extends ChatStreamHandlers {
  url: string;
  /** Injectable so tests can drive the stream without a server. */
  createStream?: EventStreamFactory;
  /** Reconnect attempts after an established stream drops. */
  maxRetries?: number;
  retryDelayMs?: number;
  schedule?: (run: () => void, ms: number) => void;
}

export interface ChatStreamHandle {
  close: () => void;
}

const DEFAULT_RETRIES = 3;
const DEFAULT_DELAY_MS = 1000;

function defaultFactory(url: string): EventStream {
  return new EventSource(url);
}

/**
 * Opens the agent's answer stream for one question.
 *
 * This module is deliberately read-only: it has no POST, PUT, PATCH or DELETE
 * path anywhere, which is how the "chat cannot trigger economic execution"
 * requirement is met by construction rather than by a guard someone can forget.
 *
 * Reconnection distinguishes two failures that look alike but mean different
 * things. A stream that never opened means the endpoint is not there, and
 * retrying it in a loop would only hammer a 404 and hide the fact; that is
 * reported as unavailable immediately. A stream that opened and then dropped
 * mid-answer is a real interruption worth retrying, and it is announced while
 * it retries so a half-finished answer is never mistaken for a complete one.
 */
export function openChatStream(options: ChatStreamOptions): ChatStreamHandle {
  const {
    url,
    onToken,
    onCitation,
    onToolCall,
    onState,
    onDone,
    createStream = defaultFactory,
    maxRetries = DEFAULT_RETRIES,
    retryDelayMs = DEFAULT_DELAY_MS,
    schedule = (run, ms) => {
      globalThis.setTimeout(run, ms);
    },
  } = options;

  let stream: EventStream | null = null;
  let closed = false;
  let established = false;
  let attempt = 0;

  const connect = () => {
    if (closed) return;
    onState(attempt === 0 ? { kind: "connecting" } : { kind: "reconnecting", attempt });

    let created: EventStream;
    try {
      created = createStream(url);
    } catch {
      onState({ kind: "unavailable", detail: "stream-not-created" });
      return;
    }
    stream = created;

    created.addEventListener("token", (event) => {
      if (closed) return;
      established = true;
      attempt = 0;
      onState({ kind: "streaming" });
      onToken(String(event.data ?? ""));
    });

    created.addEventListener("citation", (event) => {
      if (closed) return;
      try {
        const parsed: unknown = JSON.parse(String(event.data ?? "null"));
        if (
          parsed &&
          typeof parsed === "object" &&
          "counterpartyKey" in parsed &&
          "label" in parsed
        ) {
          const record = parsed as Record<string, unknown>;
          onCitation({
            counterpartyKey: String(record.counterpartyKey),
            label: String(record.label),
          });
        }
      } catch {
        // A malformed citation is dropped rather than shown as a real record.
      }
    });

    created.addEventListener("tool_call", (event) => {
      if (closed) return;
      try {
        const parsed: unknown = JSON.parse(String(event.data ?? "null"));
        if (parsed && typeof parsed === "object" && "name" in parsed) {
          const call = parsed as Record<string, unknown>;
          onToolCall?.({
            name: String(call.name),
            args: (call.args as Record<string, unknown>) ?? {},
            result: call.result,
          });
        }
      } catch {
        // Malformed tool call dropped
      }
    });

    created.addEventListener("done", () => {
      if (closed) return;
      closed = true;
      created.close();
      onDone();
    });

    created.addEventListener("error", () => {
      if (closed) return;
      created.close();
      if (!established) {
        // Never opened: the endpoint is absent, not flaky.
        closed = true;
        onState({ kind: "unavailable", detail: "stream-unreachable" });
        return;
      }
      if (attempt >= maxRetries) {
        closed = true;
        onState({ kind: "unavailable", detail: "stream-lost" });
        return;
      }
      attempt += 1;
      onState({ kind: "reconnecting", attempt });
      schedule(connect, retryDelayMs);
    });
  };

  connect();

  return {
    close() {
      closed = true;
      stream?.close();
    },
  };
}

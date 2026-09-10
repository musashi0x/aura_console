import type {
  ChatToolCallItem as AstryxChatToolCallItem,
  ChatToolCallStatus,
} from "@astryxdesign/core/Chat";

export interface ChatToolCallItem extends AstryxChatToolCallItem {
  id?: string;
  callId?: string;
  args?: Record<string, unknown>;
  result?: unknown;
}

export type { ChatToolCallStatus };

export type RelationshipStatus =
  | "PREFERRED"
  | "KNOWN"
  | "WATCH"
  | "BLOCKED"
  | "NEW"
  | "ARCHIVED";

export interface McpToolCall {
  id?: string;
  callId?: string;
  name: string;
  status?: ChatToolCallStatus;
  duration?: string;
  args?: Record<string, unknown>;
  result?: unknown;
}

export interface TokenUsage {
  promptTokens: number;
  candidateTokens: number;
  totalTokens: number;
}

export interface CounterpartyMemorySummary {
  counterpartyKey: string;
  displayName: string;
  status: RelationshipStatus;
  overallReliability: number;
  confidence: number;
  episodesUsed: number;
  latestOutcome?: string;
  timestamp?: string;
  riskLevel?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  reflectionCount?: number;
}

/** One turn in the thread. The agent never speaks unless a stream produced it. */
export interface ChatMessage {
  id: string;
  /**
   * `console` is the console reporting an action it performed — a navigation,
   * a view toggle. It is a separate role from `agent` on purpose: rendering
   * "Opened Policies." as if the agent said it would be the console speaking
   * in the agent's voice, which is the one thing this surface may never do.
   */
  role: "operator" | "agent" | "console";
  /** Text received so far. An agent message may be incomplete while streaming. */
  text: string;
  /** True once the stream for this message closed cleanly. */
  complete: boolean;
  /** Sibyl memory records the answer cited, from #32. Empty until that lands. */
  citations: MemoryCitation[];
  /**
   * Agent execution invocations (sandboxed CLI execution, Sibyl queries,
   * Base Sepolia transaction submissions). Displayed inline via Astryx ChatToolCalls.
   */
  toolCalls?: ChatToolCallItem[];
  /** Agent's internal Chain-of-Thought / reasoning narrative */
  thought?: string;
  /** Token usage statistics for this turn */
  usage?: TokenUsage;
}

/**
 * A reference to a real Sibyl memory record. The console renders citations only
 * from data the stream sent; it never derives one from the answer text.
 */
export interface MemoryCitation {
  counterpartyKey: string;
  label: string;
  summary?: CounterpartyMemorySummary;
}

export type ChatConnection =
  | { kind: "idle" }
  | { kind: "connecting" }
  | { kind: "streaming" }
  | { kind: "reconnecting"; attempt: number }
  /** Terminal for this question. `detail` is what the console observed. */
  | { kind: "unavailable"; detail: string };

/** The minimum of EventSource this transport uses, so tests can supply a fake. */
export interface EventStream {
  addEventListener(type: string, listener: (event: MessageEvent) => void): void;
  close(): void;
}

export type EventStreamFactory = (url: string) => EventStream;

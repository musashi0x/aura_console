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
}

/**
 * A reference to a real Sibyl memory record. The console renders citations only
 * from data the stream sent; it never derives one from the answer text.
 */
export interface MemoryCitation {
  counterpartyKey: string;
  label: string;
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

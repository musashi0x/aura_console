/**
 * Console view model. Everything here is derived from canonical events; the
 * Console never invents economic or terminal state.
 */

/** State machines section 2. Exactly these values. */
export type RunStatus =
  | "CREATED"
  | "STARTING"
  | "RUNNING"
  | "WAITING_APPROVAL"
  | "BLOCKED"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

/** State machines section 4. NO_HISTORY and ERROR are never mapped onto each other. */
export type RetrievalStatus =
  | "NOT_REQUESTED"
  | "LOADING"
  | "NO_HISTORY"
  | "AVAILABLE"
  | "ERROR";

/** UX spec, Timeline and replay. */
export type CanonicalStage =
  | "DISCOVER"
  | "MEMORY"
  | "SCORE"
  | "POLICY"
  | "DECIDE"
  | "FUND"
  | "DELIVER"
  | "EVALUATE"
  | "LEARN"
  | "COMMIT";

/**
 * The five-field redacted envelope (AD-02). The full frozen context lives in a
 * private artifact and never reaches the client.
 */
export interface ContextEnvelope {
  context_id: string;
  context_schema_version: string;
  context_hash: string;
  input_refs: string[];
  summary: string;
}

/** A canonical event as it arrives. Ordering is per Run via (run_id, sequence). */
export interface CanonicalEvent {
  event_id: string;
  run_id: string;
  sequence: number;
  type: string;
  event_time: string;
  data?: Record<string, unknown>;
}

export type EntrySupport = "SUPPORTED" | "UNSUPPORTED_TYPE";

export interface TimelineEntry {
  eventId: string;
  sequence: number;
  type: string;
  eventTime: string;
  stage: CanonicalStage | null;
  /** An unrecognised type is inspectable, never a crash and never dropped. */
  support: EntrySupport;
  summary: string;
}

export type RunAttention =
  | { kind: "NONE" }
  | { kind: "BLOCKED"; domain: string; retryable: boolean }
  | { kind: "AWAITING_APPROVAL"; reason: string }
  | { kind: "MEMORY_ERROR" };

export interface RunView {
  runId: string;
  objective: string;
  status: RunStatus;
  source: "CONSOLE" | "API" | "FIXTURE";
  environment: string;
  isMainnet: false;
  budgetUsdc: string | null;
  /** null means not yet projected. It is never silently rendered as zero. */
  spentUsdc: string | null;
  retrievalStatus: RetrievalStatus;
  contextEnvelope: ContextEnvelope | null;
  entries: TimelineEntry[];
  lastSequence: number | null;
  attention: RunAttention;
}

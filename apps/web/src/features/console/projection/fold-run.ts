import type {
  CanonicalEvent,
  ContextEnvelope,
  RetrievalStatus,
  RunAttention,
  RunStatus,
  RunView,
  TimelineEntry,
} from "../model/types";
import { dedupeEvents, orderEvents } from "./order-events";
import { stageFor } from "./stage-map";

export interface FoldSeed {
  runId: string;
  objective: string;
  source: "CONSOLE" | "API" | "FIXTURE";
  environment: string;
  budgetUsdc: string | null;
}

const RUN_STATUS_BY_TYPE: Record<string, RunStatus> = {
  "run.created": "CREATED",
  "run.started": "RUNNING",
  "run.blocked": "BLOCKED",
  "run.resumed": "RUNNING",
  "run.completed": "COMPLETED",
  "run.failed": "FAILED",
  "run.cancelled": "CANCELLED",
};

const RETRIEVAL_BY_TYPE: Record<string, RetrievalStatus> = {
  "memory.retrieval.started": "LOADING",
  "memory.retrieved": "AVAILABLE",
  "memory.no_history": "NO_HISTORY",
  "memory.retrieval.failed": "ERROR",
};

const str = (v: unknown): string | null => (typeof v === "string" ? v : null);

function envelopeFrom(data: Record<string, unknown> | undefined): ContextEnvelope | null {
  if (!data) return null;
  const id = str(data.context_id);
  const version = str(data.context_schema_version);
  const hash = str(data.context_hash);
  const summary = str(data.summary);
  if (!id || !version || !hash || summary === null) return null;
  const refs = Array.isArray(data.input_refs) ? data.input_refs.filter((r): r is string => typeof r === "string") : [];
  // Exactly the five envelope fields. Anything else on the event is ignored
  // rather than surfaced, because the Console must not render private payload.
  return { context_id: id, context_schema_version: version, context_hash: hash, input_refs: refs, summary };
}

/**
 * The single projection. Live is `foldRun(events, seed, null)`; replay is
 * `foldRun(events, seed, playhead)`. That is the entire difference, which is
 * what keeps replay from needing a second code path.
 */
export function foldRun(
  events: readonly CanonicalEvent[],
  seed: FoldSeed,
  upToSequence: number | null = null,
): RunView {
  const ordered = orderEvents(dedupeEvents(events));
  const visible =
    upToSequence === null ? ordered : ordered.filter((e) => e.sequence <= upToSequence);

  let status: RunStatus = "CREATED";
  let retrievalStatus: RetrievalStatus = "NOT_REQUESTED";
  let contextEnvelope: ContextEnvelope | null = null;
  let spentUsdc: string | null = null;
  let attention: RunAttention = { kind: "NONE" };

  const entries: TimelineEntry[] = visible.map((event) => {
    const mapped = RUN_STATUS_BY_TYPE[event.type];
    if (mapped) status = mapped;

    const retrieval = RETRIEVAL_BY_TYPE[event.type];
    if (retrieval) retrievalStatus = retrieval;

    if (event.type === "decision.context.built") {
      contextEnvelope = envelopeFrom(event.data);
    }

    // Money is copied from a projection-bearing event, never computed here.
    const amount = str(event.data?.spent_usdc);
    if (amount !== null) spentUsdc = amount;

    if (event.type === "memory.retrieval.failed") {
      attention = { kind: "MEMORY_ERROR" };
    } else if (event.type === "approval.requested") {
      attention = { kind: "AWAITING_APPROVAL", reason: str(event.data?.reason) ?? "Approval required" };
    } else if (event.type === "run.blocked") {
      attention = {
        kind: "BLOCKED",
        domain: str(event.data?.domain) ?? "unknown",
        retryable: event.data?.retryable === true,
      };
    } else if (event.type === "run.resumed" || event.type === "approval.granted") {
      attention = { kind: "NONE" };
    }

    const stage = stageFor(event.type);
    return {
      eventId: event.event_id,
      sequence: event.sequence,
      type: event.type,
      eventTime: event.event_time,
      stage,
      // A lifecycle type has no stage in the decision story, but the fold
      // reads it to derive status, so it is understood. Marking it
      // UNSUPPORTED_TYPE told the operator the Console did not recognise an
      // event it had just acted on.
      support:
        stage === null && RUN_STATUS_BY_TYPE[event.type] === undefined
          ? "UNSUPPORTED_TYPE"
          : "SUPPORTED",
      summary: str(event.data?.summary) ?? event.type,
    };
  });

  return {
    runId: seed.runId,
    objective: seed.objective,
    status,
    source: seed.source,
    environment: seed.environment,
    isMainnet: false,
    budgetUsdc: seed.budgetUsdc,
    spentUsdc,
    retrievalStatus,
    contextEnvelope,
    entries,
    lastSequence: entries.length > 0 ? entries[entries.length - 1]!.sequence : null,
    attention,
  };
}

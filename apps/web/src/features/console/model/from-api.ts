/**
 * The API's wire shape into the projection's input shape.
 *
 * This is the only place the two vocabularies meet. The API speaks camelCase
 * over HTTP; `foldRun` speaks the canonical event shape. Translating in one
 * function means a field rename shows up as one compile error rather than as a
 * silently empty timeline.
 *
 * Nothing is derived here. No status, no spend, no completion: the fold decides
 * those from events, and a second opinion computed during transport would be a
 * second answer that drifts.
 */
import type { RunEvent, RunSummary } from "@/lib/api-client";

import type { FoldSeed } from "../projection/fold-run";
import type { CanonicalEvent } from "./types";

export function seedFromRun(run: RunSummary): FoldSeed {
  return {
    runId: run.id,
    objective: run.objective,
    // Origin passes through UNCHANGED. An agent-created Run is not a
    // Console-created one and is not "the API" either: the API is the transport
    // that carried it, not the actor that started it. Renaming AGENT to API
    // loses the only field that says an agent, rather than an operator, opened
    // this Run.
    source: run.source,
    environment: run.environment,
    budgetUsdc: run.budgetUsdc,
  };
}

export function eventsFromApi(events: readonly RunEvent[]): CanonicalEvent[] {
  return events.map((event) => ({
    event_id: event.eventId,
    run_id: event.runId,
    sequence: event.sequence,
    type: event.type,
    event_time: event.eventTime,
    // The fold reads named fields out of `data` and marks anything it does not
    // recognise rather than dropping it, so an unexpected shape stays
    // inspectable instead of vanishing in transport.
    data: (event.data ?? {}) as Record<string, unknown>,
  }));
}

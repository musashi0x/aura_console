import type { CanonicalEvent } from "../model/types";

/**
 * Canonical order within a Run is (run_id, sequence), assigned inside the
 * appending transaction (AD-01). Arrival order is not economic order, so the
 * fold must sort rather than trust the stream.
 *
 * event_time and event_id are tiebreakers only, for display and for the
 * pathological case of a duplicated sequence.
 */
export function orderEvents(events: readonly CanonicalEvent[]): CanonicalEvent[] {
  return [...events].sort((a, b) => {
    if (a.sequence !== b.sequence) return a.sequence - b.sequence;
    if (a.event_time !== b.event_time) return a.event_time < b.event_time ? -1 : 1;
    return a.event_id < b.event_id ? -1 : 1;
  });
}

/**
 * Re-delivery is expected: at-least-once transport means the same event can
 * arrive twice. The first occurrence wins so a retry cannot duplicate a fact.
 */
export function dedupeEvents(events: readonly CanonicalEvent[]): CanonicalEvent[] {
  const seen = new Set<string>();
  const out: CanonicalEvent[] = [];
  for (const event of events) {
    if (seen.has(event.event_id)) continue;
    seen.add(event.event_id);
    out.push(event);
  }
  return out;
}

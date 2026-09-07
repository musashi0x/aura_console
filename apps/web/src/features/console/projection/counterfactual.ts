import type { TimelineEntry } from "../model/types";

/**
 * What the ranking would have been without private relationship memory.
 *
 * This is the fastest proof that memory is load-bearing, and therefore the
 * claim most tempting to fake. Three rules keep it honest, and all three are
 * structural rather than a matter of care:
 *
 * 1. **It is computed, never executed.** This module is a pure function over
 *    events already recorded. It cannot create a second economic action because
 *    it cannot act at all — there is no client, no fetch and no write in here.
 * 2. **It is computed from recorded evidence, never re-run.** The scores come
 *    from the `candidate.scored` event. Re-scoring would answer a question
 *    about today rather than about the decision that was actually taken.
 * 3. **Absent evidence is UNAVAILABLE, never "no change".** A Run whose scoring
 *    event carried no components cannot be compared, and saying "memory changed
 *    nothing" about it would be an assertion nobody measured.
 */

/** One candidate as the scoring event recorded it. */
export interface ScoredCandidate {
  key: string;
  /** The score the decision actually used, memory included. */
  score: number;
  /**
   * The part of `score` that came from private memory, signed.
   *
   * Removing memory means subtracting exactly this. Recomputing a score from
   * its parts instead would let this view disagree with the decision it is
   * explaining.
   */
  memoryAdjustment: number;
  /** Why memory moved this candidate, in the scoring event's own words. */
  memoryNote?: string;
}

export interface RankedCandidate {
  key: string;
  score: number;
}

export type Counterfactual =
  /** No scoring evidence, or none carrying a memory component. */
  | { status: "UNAVAILABLE"; reason: string }
  /** Memory was consulted and the choice held. A real result, not a missing one. */
  | {
      status: "NO_MATERIAL_CHANGE";
      withMemory: RankedCandidate[];
      withoutMemory: RankedCandidate[];
    }
  /** The one case that earns "Memory changed this decision". */
  | {
      status: "DECISION_CHANGED";
      withMemory: RankedCandidate[];
      withoutMemory: RankedCandidate[];
      /** The recorded reason the winner moved, never a sentence invented here. */
      explanation: string;
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * Reads the candidates a scoring event recorded.
 *
 * A candidate missing either field is dropped rather than defaulted: a missing
 * `memory_adjustment` read as 0 would silently claim memory did nothing to it,
 * which is the same lie in a smaller place.
 */
export function readScoredCandidates(entry: TimelineEntry): ScoredCandidate[] {
  const data = entry.data;
  if (!isRecord(data)) return [];
  const rows = data.candidates;
  if (!Array.isArray(rows)) return [];

  const out: ScoredCandidate[] = [];
  for (const row of rows) {
    if (!isRecord(row)) continue;
    const key = typeof row.key === "string" ? row.key : null;
    const score = num(row.score);
    const memoryAdjustment = num(row.memory_adjustment);
    if (key === null || score === null || memoryAdjustment === null) continue;
    out.push({
      key,
      score,
      memoryAdjustment,
      memoryNote: typeof row.memory_note === "string" ? row.memory_note : undefined,
    });
  }
  return out;
}

/** Highest score first; ties keep the order the event recorded. */
function rank(rows: readonly RankedCandidate[]): RankedCandidate[] {
  return [...rows].sort((a, b) => b.score - a.score);
}

/**
 * Folds the counterfactual out of a Mission's entries.
 *
 * Only `candidate.scored` is read. The decision event names the winner but not
 * what the runners-up scored, and a comparison needs the losers.
 */
export function foldCounterfactual(entries: readonly TimelineEntry[]): Counterfactual {
  const scoring = [...entries].reverse().find((e) => e.type === "candidate.scored");
  if (!scoring) {
    return {
      status: "UNAVAILABLE",
      reason: "No scoring event was recorded for this Mission, so there is nothing to compare.",
    };
  }

  const candidates = readScoredCandidates(scoring);
  if (candidates.length === 0) {
    return {
      status: "UNAVAILABLE",
      reason:
        "The scoring event recorded no per-candidate components, so what memory contributed cannot be separated from the rest.",
    };
  }

  const withMemory = rank(candidates.map((c) => ({ key: c.key, score: c.score })));
  const withoutMemory = rank(
    candidates.map((c) => ({ key: c.key, score: c.score - c.memoryAdjustment })),
  );

  const chosen = withMemory[0];
  const alternative = withoutMemory[0];
  if (!chosen || !alternative || chosen.key === alternative.key) {
    return { status: "NO_MATERIAL_CHANGE", withMemory, withoutMemory };
  }

  /* The explanation is the scoring event's own note about whichever candidate
     memory moved. When the event recorded no note the card says the winner
     changed and stops — naming a cause we were not told would be this view
     inventing the very thing it exists to evidence. */
  const mover =
    candidates.find((c) => c.key === chosen.key && c.memoryNote) ??
    candidates.find((c) => c.key === alternative.key && c.memoryNote);

  return {
    status: "DECISION_CHANGED",
    withMemory,
    withoutMemory,
    explanation:
      mover?.memoryNote ??
      "The scoring event did not record why memory moved this ranking, only that it did.",
  };
}

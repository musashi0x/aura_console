import type { SibylCounterparty } from "./sibyl.js";

/**
 * How a Mission ranks the counterparties it could hire.
 *
 * Split into its own module because it is the one part of the agent that must
 * be provable without a database, a bridge or a clock: every number the Console
 * later renders — the ranking, the counterfactual, the decision's reasons —
 * is read back out of what this function recorded.
 *
 * The split between `base` and `memoryAdjustment` is the load-bearing idea, and
 * it is not cosmetic. The Console's counterfactual answers "what would this
 * Mission have decided without private relationship memory?" by subtracting
 * `memoryAdjustment` from `score`. So the two must divide cleanly:
 *
 * - `base` may only use facts anyone quoting the same market would have. Here
 *   that is the quoted price and nothing else.
 * - `memoryAdjustment` may only use what WE learned by dealing with this
 *   counterparty: reliability, task fit, relationship status, and how sure the
 *   store is of them.
 *
 * Put a memory-derived term in `base` and the counterfactual silently
 * understates what memory did. Put a public term in `memoryAdjustment` and it
 * overstates it. Either way the product's central claim stops being measured
 * and starts being asserted.
 */

/** A counterparty that can actually be scored, with its price parsed once. */
interface Priced {
  counterparty: SibylCounterparty;
  priceUsdc: number;
}

export interface ScoredCandidate {
  key: string;
  /** The score the decision uses, memory included. */
  score: number;
  /** The signed part of `score` that came from private memory. */
  memory_adjustment: number;
  /** Sibyl's own note about this relationship, when it recorded one. */
  memory_note?: string;
}

/** A counterparty that was not ranked, and the reason it was not. */
export interface ExcludedCandidate {
  key: string;
  reason: string;
}

export interface Ranking {
  /** Highest score first. The decision is always this list's head. */
  ranked: ScoredCandidate[];
  /** Recorded so a veto is visible, never a silent disappearance. */
  excluded: ExcludedCandidate[];
}

/**
 * Relationship status, as a small signed nudge.
 *
 * BLOCKED is deliberately absent. It is a veto, not a nudge, and it is applied
 * by removing the candidate rather than by penalising it — see `scoreCandidates`.
 * Expressing a veto as points was tried and is wrong: a penalty large enough to
 * stop a blocked counterparty at one price is not large enough at another, so
 * "blocked" would quietly become "blocked unless cheap enough". On a product
 * that spends money that is not a rounding error, it is the whole guarantee.
 */
const STATUS_POINTS: Record<string, number> = {
  PREFERRED: 6,
  KNOWN: 0,
  NEW: 0,
  WATCH: -6,
  ARCHIVED: -10,
};

function parsePrice(value: string | null): number | null {
  if (value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/**
 * Price efficiency against the cheapest quote on the table.
 *
 * A ratio rather than a curve: the cheapest candidate scores 100, one that
 * costs twice as much scores 50, and the number means exactly that. Any
 * smoother function would need constants nobody measured, and this score is
 * shown to an operator deciding whether to send money.
 */
function baseScore(priceUsdc: number, cheapestUsdc: number): number {
  return Math.round((100 * cheapestUsdc) / priceUsdc);
}

/**
 * What private memory is worth for this counterparty, signed.
 *
 * Every term is centred on 0.5 — the point where the store holds no opinion —
 * so a counterparty Sibyl knows nothing useful about scores the same as one it
 * has never met. Memory that says nothing must move nothing, or the
 * counterfactual would credit memory for a difference it did not make.
 *
 * The whole sum is scaled by `confidence`: memory the store is unsure of moves
 * the ranking less than memory it is sure of. A missing confidence is treated
 * as no confidence rather than full confidence, because the failure that
 * matters here is over-trusting a thin record.
 */
function memoryAdjustment(counterparty: SibylCounterparty): number {
  const reliability = counterparty.overallReliability;
  const taskFit = counterparty.taskFit;
  const status = counterparty.relationshipStatus;

  const reliabilityPoints = reliability === null ? 0 : (reliability - 0.5) * 40;
  const taskFitPoints = taskFit === null ? 0 : (taskFit - 0.5) * 20;
  const statusPoints = status === null ? 0 : (STATUS_POINTS[status] ?? 0);

  const confidence = counterparty.confidence ?? 0;
  return Math.round(confidence * (reliabilityPoints + taskFitPoints + statusPoints));
}

/**
 * Ranks the counterparties that are both allowed and priced.
 *
 * Two things are kept out of the ranking, for different reasons, and both are
 * reported rather than dropped: a BLOCKED counterparty is vetoed, and one with
 * no observed price has nothing to compare on. A made-up price would otherwise
 * compete against real quotes on the same ranking with no way to tell them
 * apart.
 *
 * An empty `ranked` means there was nothing to choose between, which the caller
 * must report as such rather than treat as a decision.
 */
export function scoreCandidates(counterparties: readonly SibylCounterparty[]): Ranking {
  const excluded: ExcludedCandidate[] = [];
  const priced: Priced[] = [];

  for (const counterparty of counterparties) {
    /* The veto, applied before anything is scored. Removing the candidate is
       what makes "blocked" mean blocked: the ranking below is a comparison
       between options that are all actually allowed, so its winner can be
       taken as the decision without a second check nobody would remember to
       write. The exclusion is recorded on the event, so the operator can still
       see that this counterparty was considered and why it was not ranked. */
    if (counterparty.relationshipStatus === "BLOCKED") {
      excluded.push({
        key: counterparty.counterpartyKey,
        reason: "Relationship status on record is BLOCKED, so this counterparty was not ranked.",
      });
      continue;
    }

    const priceUsdc = parsePrice(counterparty.observedPriceUsdc);
    if (priceUsdc === null) {
      excluded.push({
        key: counterparty.counterpartyKey,
        reason: "No observed price on record, so there was nothing to compare on.",
      });
      continue;
    }
    priced.push({ counterparty, priceUsdc });
  }

  if (priced.length === 0) return { ranked: [], excluded };

  const cheapestUsdc = Math.min(...priced.map((row) => row.priceUsdc));

  const ranked = priced
    .map(({ counterparty, priceUsdc }): ScoredCandidate => {
      const adjustment = memoryAdjustment(counterparty);
      const row: ScoredCandidate = {
        key: counterparty.counterpartyKey,
        score: baseScore(priceUsdc, cheapestUsdc) + adjustment,
        memory_adjustment: adjustment,
      };
      /* Sibyl's own sentence, or none. The counterfactual renders this as the
         recorded reason memory moved the ranking, so a sentence composed here
         would be the Console explaining itself with evidence it authored. */
      if (counterparty.riskNote !== null) row.memory_note = counterparty.riskNote;
      return row;
    })
    .sort((a, b) => b.score - a.score);

  return { ranked, excluded };
}

/**
 * Why the winner won, in facts the memory store actually holds.
 *
 * Each line is a value read off the record. Nothing here characterises the
 * counterparty, promises an outcome, or explains the decision in the agent's
 * voice — the decision card renders these verbatim, and a persuasive sentence
 * on that card is the most damaging thing this file could produce.
 */
export function decisionReasons(winner: SibylCounterparty): string[] {
  const reasons: string[] = [];

  if (winner.relationshipStatus !== null) {
    reasons.push(`Relationship status on record is ${winner.relationshipStatus}.`);
  }
  if (winner.observedPriceUsdc !== null) {
    reasons.push(`Observed price is ${winner.observedPriceUsdc} USDC.`);
  }
  if (winner.riskNote !== null) {
    reasons.push(winner.riskNote);
  }
  if (winner.isFixture) {
    reasons.push("This record is seeded demonstration data, not a relationship this operator has had.");
  }
  return reasons;
}

import {
  recallEntities,
  type SibylRecord,
  type SibylVerdict,
  type SibylVerdictCode,
} from "./sibyl.js";

/**
 * Sibyl Memory as a retrieval source.
 *
 * `sibyl.ts` owns the process boundary and reports what Sibyl said. This file
 * owns the only question a decision can act on: does that amount to memory, to
 * an established absence of memory, or to not having looked. Those are the
 * three states the rest of the Console already speaks, and the fold happens
 * here so it happens once.
 *
 * Nothing below widens an answer. Sibyl declining to answer stays a failure to
 * look, a bridge that would not run stays a failure to look, and neither is
 * ever allowed to arrive somewhere as "there is nothing to know".
 */

/**
 * Every counterparty recall is filed under one category.
 *
 * `search_entities(category=...)` matches exactly, so the category is the axis
 * that decides what shares a corpus. One fixed literal keeps every counterparty
 * searchable against every other; putting the protocol here instead would shard
 * memory by protocol and make cross-protocol recall impossible.
 */
export const COUNTERPARTY_CATEGORY = "counterparty";

/** Sibyl's own ceiling on an identifier, mirrored so we reject before spawning. */
const MAX_IDENTIFIER_LENGTH = 1024;

/** How many records one recall asks for when the caller does not say. */
export const DEFAULT_RECALL_LIMIT = 20;

/** The ceiling a caller may ask for. Recall is a drawer, not an export. */
export const MAX_RECALL_LIMIT = 50;

/**
 * The bridge code that means we never asked.
 *
 * It is the one failure that is not a failure: with no interpreter configured
 * this deployment never claimed to consult Sibyl, so there is nothing to have
 * gone wrong. Every other code means we tried and could not look.
 */
const NOT_CONFIGURED_CODE = "not_configured";

/**
 * The failures a second attempt could plausibly resolve.
 *
 * Only the transport is here. A missing client, an absent database and a
 * rejected key are all decisions somebody has to make differently before the
 * answer can change, and an abstention meets the same gate on every retry — so
 * inviting a retry on any of them would spend an operator's time to be told the
 * same thing in the same words.
 */
const RETRYABLE_CAUSES: ReadonlySet<string> = new Set(["bridge_unreachable"]);

/**
 * Sibyl's verdict, folded to a retrieval state.
 *
 *   ok            -> AVAILABLE    Sibyl returned records.
 *   empty_store   -> NO_HISTORY   We looked; the store is genuinely empty.
 *   no_match      -> NO_HISTORY   We looked; nothing matched this counterparty.
 *   abstained_on  -> ERROR        Sibyl declined to answer.
 *   negation_abstain -> ERROR     Sibyl declined to answer.
 *   gated         -> ERROR        Sibyl's gate rejected the candidates.
 *
 * The three abstentions are ERROR because an abstention is a refusal, and a
 * refusal is "we could not look". Folded into NO_HISTORY it would reach an
 * operator as "no relationship history exists" — a clean bill of health nobody
 * issued — and would take the approval path meant for a genuinely new dealing.
 * As ERROR it cannot: `authorizeFromRetrieval` denies on ERROR unless a
 * versioned policy softens it to REQUIRE_APPROVAL, and AUTO stays unreachable.
 */
const VERDICT_OUTCOME: Record<SibylVerdictCode, "AVAILABLE" | "NO_HISTORY" | "ERROR"> = {
  ok: "AVAILABLE",
  empty_store: "NO_HISTORY",
  no_match: "NO_HISTORY",
  abstained_on: "ERROR",
  negation_abstain: "ERROR",
  gated: "ERROR",
};

/**
 * Why this recall concluded what it did.
 *
 * A verdict and a transport code are not interchangeable, so they are separate
 * fields rather than one string. `bridge_unreachable` is not a verdict; calling
 * it one would say Sibyl reached a conclusion when Sibyl was never asked.
 */
export interface SibylMemoryCause {
  /** Sibyl's own verdict, present only when Sibyl answered. */
  verdict: SibylVerdict | null;
  /** The bridge or configuration code, present only when it did not. */
  code: string | null;
  /** One sentence naming whichever of the two fired. Always renderable as-is. */
  detail: string;
}

/**
 * What Sibyl contributed to one retrieval.
 *
 * `records` is typed empty on every outcome but `AVAILABLE`, so a partial or
 * refused recall has no shape in which to carry rows that would read as memory.
 * `recordCount` separates zero from unknown for the same reason: "Sibyl holds
 * nothing for this counterparty" and "Sibyl never answered" are different
 * claims, and one field that renders both as 0 would merge them.
 */
export type SibylMemoryResult =
  | { outcome: "NOT_CONSULTED"; cause: SibylMemoryCause; records: []; recordCount: null }
  | { outcome: "AVAILABLE"; cause: SibylMemoryCause; records: SibylRecord[]; recordCount: number }
  | { outcome: "NO_HISTORY"; cause: SibylMemoryCause; records: []; recordCount: 0 }
  | {
      outcome: "ERROR";
      cause: SibylMemoryCause;
      records: [];
      recordCount: null;
      retryable: boolean;
    };

/**
 * Sibyl's own identifier rules, applied before a process is spawned.
 *
 * `validate_identifier` guards both the category and the name, and a key it
 * would reject can never be looked up — so this returns the reason rather than
 * a boolean, and the caller reports it as a failure to look. Colons are legal,
 * which is why a `protocol:agent:name` key crosses verbatim: any transform
 * would be a second identifier to keep in sync, and a collision would attach
 * one counterparty's memory to another.
 */
export function invalidIdentifierReason(value: string): string | null {
  if (value.length === 0) return "a counterparty key cannot be empty";
  if (value.length > MAX_IDENTIFIER_LENGTH) {
    return `a counterparty key cannot exceed ${MAX_IDENTIFIER_LENGTH} characters`;
  }
  if (value.includes("..")) return "a counterparty key cannot contain '..'";
  for (const character of value) {
    const point = character.codePointAt(0) ?? 0;
    if (point < 0x20 || point === 0x7f) {
      return "a counterparty key cannot contain control characters";
    }
    if (character === "<" || character === ">" || character === "|") {
      return "a counterparty key cannot contain '<', '>' or '|'";
    }
    if (character === ";" || character === '"' || character === "`") {
      return "a counterparty key cannot contain ';', '\"' or '`'";
    }
  }
  return null;
}

function errorResult(cause: SibylMemoryCause, retryable: boolean): SibylMemoryResult {
  return { outcome: "ERROR", cause, records: [], recordCount: null, retryable };
}

/**
 * One recall for one counterparty.
 *
 * The key crosses verbatim as the entity name under the single counterparty
 * category. A key Sibyl could not accept is an `ERROR` and never a miss: we did
 * not look, so we have not learned that there is nothing.
 *
 * Known gap, named rather than hidden: the bridge constructs its client without
 * a tenant, so every read runs as Sibyl's default tenant instead of this
 * operator's `AGENT_ID`. Tenant is Sibyl's isolation boundary, so until the
 * bridge takes one, a second deployment sharing the same database file would
 * read the same recall. That is a bridge change and is not made here.
 */
export async function recallCounterparty(
  counterpartyKey: string,
  opts: { limit?: number; query?: string } = {},
): Promise<SibylMemoryResult> {
  const rejection = invalidIdentifierReason(counterpartyKey);
  if (rejection) {
    return errorResult(
      {
        verdict: null,
        code: "invalid_counterparty_key",
        detail: `Sibyl was not asked, because ${rejection}.`,
      },
      false,
    );
  }

  const recall = await recallEntities(opts.query ?? counterpartyKey, {
    category: COUNTERPARTY_CATEGORY,
    limit: opts.limit ?? DEFAULT_RECALL_LIMIT,
  });

  if (!recall.reachable) {
    const code = recall.code ?? "sibyl_unreachable";
    const detail = recall.detail ?? "Sibyl Memory could not be reached.";
    if (code === NOT_CONFIGURED_CODE) {
      // Not an error, because we never claimed to look. The same distinction
      // the product already draws between NOT_REQUESTED and NO_HISTORY.
      return { outcome: "NOT_CONSULTED", cause: { verdict: null, code, detail }, records: [], recordCount: null };
    }
    return errorResult({ verdict: null, code, detail }, RETRYABLE_CAUSES.has(code));
  }

  const verdict = recall.verdict;
  if (!verdict) {
    // Reachable with nothing to report is a broken contract, not a small
    // answer. With no verdict we hold no cause, which is the same position as
    // never having asked — and that is a failure, not an absence.
    return errorResult(
      {
        verdict: null,
        code: "bridge_contract",
        detail: "Sibyl answered without a verdict, so nothing here names what it concluded.",
      },
      false,
    );
  }

  // A lookup miss is impossible while `sibyl.ts` closes the verdict union, and
  // if that union ever opens the miss must land on ERROR: a code we do not
  // understand is not a clean bill of health.
  const outcome = VERDICT_OUTCOME[verdict.code] ?? "ERROR";
  const cause: SibylMemoryCause = { verdict, code: null, detail: verdict.detail };

  if (outcome === "ERROR") {
    // The same gate refuses the same query, so a retry buys the operator
    // nothing but the identical refusal.
    return errorResult(cause, false);
  }

  if (outcome === "NO_HISTORY") {
    return { outcome: "NO_HISTORY", cause, records: [], recordCount: 0 };
  }

  if (recall.records.length === 0) {
    // Sibyl is explicit that `ok` is the only verdict accompanying a non-empty
    // result. An `ok` with no records is therefore a contract we cannot read,
    // and reading it as an empty store would invent the one cause Sibyl did
    // not name.
    return errorResult(
      {
        verdict,
        code: "bridge_contract",
        detail: "Sibyl reported a match and returned no records, so what it holds is unknown.",
      },
      false,
    );
  }

  return {
    outcome: "AVAILABLE",
    cause,
    records: recall.records,
    recordCount: recall.records.length,
  };
}

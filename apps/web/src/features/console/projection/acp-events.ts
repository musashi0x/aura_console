import type { CanonicalEvent, CanonicalStage, RunAttention, RunStatus } from "../model/types";

/**
 * Everything the Console knows about ACP, in one file.
 *
 * The `acp.` namespace is right for storage — it says where a fact came from —
 * but it is not a second vocabulary for the operator. An ACP job is a Run like
 * any other, so its events are translated into the same statuses, stages and
 * attention the rest of the Console already uses. There is no ACP branch in the
 * view, and no ACP-shaped component.
 */

/** Lifecycle. Which of these move a Run, and where to. */
export const ACP_RUN_STATUS: Record<string, RunStatus> = {
  "acp.job.created": "RUNNING",
  // The provider has named a price. Nothing moves until a person authorizes it,
  // which is exactly what WAITING_APPROVAL already means everywhere else.
  "acp.budget.set": "WAITING_APPROVAL",
  "acp.fund.authorized": "RUNNING",
  "acp.job.funded": "RUNNING",
  "acp.job.submitted": "RUNNING",
  "acp.job.completed": "COMPLETED",
  "acp.job.rejected": "FAILED",
  "acp.job.expired": "FAILED",
  "acp.fund.failed": "BLOCKED",
};

/**
 * Stage prefixes, most specific first. Ordering matters: the lookup takes the
 * first match, so `acp.job.submitted` must be seen before a bare `acp.job`.
 */
export const ACP_STAGE_PREFIXES: [string, CanonicalStage][] = [
  ["acp.job.submitted", "DELIVER"],
  ["acp.job.completed", "EVALUATE"],
  ["acp.job.rejected", "EVALUATE"],
  ["acp.job.funded", "FUND"],
  ["acp.job.created", "COMMIT"],
  ["acp.job.described", "COMMIT"],
  ["acp.budget.set", "FUND"],
  ["acp.fund.", "FUND"],
];

/**
 * Types the Console understands but which belong to no stage in the decision
 * story. They are still SUPPORTED: telling an operator the Console does not
 * recognise an event it just rendered is worse than saying nothing.
 *
 * `acp.job.expired` is here rather than in a stage because expiry is the story
 * ending, not a step in it.
 */
export const ACP_STAGELESS_TYPES: ReadonlySet<string> = new Set([
  "acp.message",
  "acp.job.expired",
]);

const str = (value: unknown): string | null => (typeof value === "string" ? value : null);

/**
 * Spend, and only from the chain's own account of it.
 *
 * `acp.budget.set` is a proposal, `acp.fund.authorized` is a decision, and
 * `acp.fund.submitted` is our claim that we sent it. None of those is money
 * that left. `acp.job.funded` is the observed fact, so it is the only one that
 * moves this number.
 */
export function acpSpentUsdc(event: CanonicalEvent): string | null {
  if (event.type !== "acp.job.funded") return null;
  return str(event.data?.amount_usdc);
}

/**
 * What the Run is waiting on, in the vocabulary the Console already has.
 * Returns null when this event says nothing about attention, so the caller
 * leaves the current value alone.
 */
export function acpAttention(event: CanonicalEvent): RunAttention | null {
  switch (event.type) {
    case "acp.budget.set": {
      const amount = str(event.data?.amount_usdc);
      return {
        kind: "AWAITING_APPROVAL",
        reason: amount
          ? `Provider proposed ${amount} USDC. Funding requires authorization.`
          : "Provider proposed a price. Funding requires authorization.",
      };
    }
    case "acp.fund.authorized":
    case "acp.job.funded":
      return { kind: "NONE" };
    case "acp.fund.failed":
      return {
        kind: "BLOCKED",
        domain: "funding",
        // The runtime already exhausted its retries before recording this.
        retryable: false,
      };
    default:
      return null;
  }
}

/** A one-line summary for the timeline, when the event carries no `summary`. */
export function acpSummary(event: CanonicalEvent): string | null {
  const amount = str(event.data?.amount_usdc);

  switch (event.type) {
    case "acp.job.described":
      return str(event.data?.description);
    case "acp.budget.set":
      return amount ? `Provider proposed ${amount} USDC` : null;
    case "acp.fund.authorized":
      return amount ? `Operator authorized ${amount} USDC` : null;
    case "acp.fund.submitted":
      return amount ? `Funding submitted: ${amount} USDC` : null;
    case "acp.fund.failed":
      return str(event.data?.reason);
    case "acp.job.funded":
      return amount ? `Escrow funded: ${amount} USDC` : null;
    case "acp.job.completed":
    case "acp.job.rejected":
      return str(event.data?.reason);
    case "acp.message":
      return str(event.data?.content);
    default:
      return null;
  }
}

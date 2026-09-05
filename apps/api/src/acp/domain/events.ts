import type { JobRoomEntry } from "@virtuals-protocol/acp-node-v2";

import { derivedEventId } from "./ids.js";
import { usdcString } from "./usdc.js";

/**
 * Every `run_events` row this module can produce, and the Run seed an ACP job
 * gets. One file so the whole vocabulary is reviewable at once.
 *
 * Two kinds of event live here and the difference matters. Observed events are
 * translated from the stream and describe what the network did. Authored events
 * are written by this system and describe what it or its operator did. Both are
 * `acp.`-namespaced because both are facts about the ACP job; neither is
 * allowed to be mistaken for the other in the data.
 */

export const ACP_ENVIRONMENTS: Record<number, string> = {
  84_532: "base-sepolia",
};

export function environmentForChain(chainId: number): string {
  return ACP_ENVIRONMENTS[chainId] ?? `evm-${chainId}`;
}

export type TranslatedEvent = {
  eventId: string;
  type: string;
  eventTime: Date;
  data: Record<string, unknown>;
};

// ---------------------------------------------------------------------------
// Observed: translated from a stream entry
// ---------------------------------------------------------------------------

function fundIntentData(intent: {
  amount: number;
  tokenAddress: string;
  symbol: string;
  recipient: string;
}): Record<string, unknown> {
  return {
    amount_usdc: usdcString(intent.amount),
    token_address: intent.tokenAddress,
    symbol: intent.symbol,
    recipient: intent.recipient,
  };
}

function systemEventData(event: Extract<JobRoomEntry, { kind: "system" }>["event"]) {
  switch (event.type) {
    case "job.created":
      return {
        client: event.client,
        provider: event.provider,
        evaluator: event.evaluator,
        expired_at: event.expiredAt,
        hook: event.hook,
      };
    case "budget.set":
      return {
        amount_usdc: usdcString(event.amount),
        ...(event.fundRequest ? { fund_request: fundIntentData(event.fundRequest) } : {}),
      };
    case "job.funded":
      return { client: event.client, amount_usdc: usdcString(event.amount) };
    case "job.submitted":
      return {
        provider: event.provider,
        deliverable_hash: event.deliverableHash,
        deliverable: event.deliverable,
        ...(event.fundTransfer ? { fund_transfer: fundIntentData(event.fundTransfer) } : {}),
      };
    case "job.completed":
      return { evaluator: event.evaluator, reason: event.reason };
    case "job.rejected":
      return { rejector: event.rejector, reason: event.reason };
    case "job.expired":
      return {};
  }
}

/**
 * One stream entry to one `run_events` row.
 *
 * The SDK exposes no per-entry identifier, so `eventId` is derived from the
 * canonicalised entry. A duplicate delivery therefore collapses onto the same
 * id and appends nothing, which is the point, while a genuine repeat of a
 * byte-identical message inside the same millisecond is lost. That trade is
 * recorded in docs/ai/api/acp.md rather than hidden here.
 */
export function translateEntry(entry: JobRoomEntry): TranslatedEvent {
  const base = {
    chain_id: entry.chainId,
    job_id: entry.onChainJobId,
  };

  const { type, data } =
    entry.kind === "system"
      ? {
          type: `acp.${entry.event.type}`,
          data: { ...base, ...systemEventData(entry.event) },
        }
      : {
          type: "acp.message",
          data: {
            ...base,
            from: entry.from,
            content_type: entry.contentType,
            content: entry.content,
            ...(entry.packageId === undefined ? {} : { package_id: entry.packageId }),
          },
        };

  return {
    eventId: derivedEventId({ type, timestamp: entry.timestamp, data }),
    type,
    // Producer domain time, never arrival time.
    eventTime: new Date(entry.timestamp),
    data,
  };
}

// ---------------------------------------------------------------------------
// The Run an ACP job gets
// ---------------------------------------------------------------------------

export type AcpRunSeed = {
  objective: string;
  source: "AGENT";
  environment: string;
  budgetUsdc: null;
};

/**
 * The seed is derived from the entry alone, with no network call.
 *
 * A client-side `job.created` entry carries addresses and an expiry, not a
 * description, so an off-chain fetch is the only way to get one. Putting that
 * fetch in front of Run creation would let a slow or rate-limited ACP host lose
 * the entry that triggered it. The objective is therefore always this
 * deterministic label, and the description arrives later as its own event.
 */
export function runSeedForJob(input: { chainId: number; jobId: string }): AcpRunSeed {
  return {
    objective: `ACP job ${input.jobId} on ${environmentForChain(input.chainId)}`,
    source: "AGENT",
    environment: environmentForChain(input.chainId),
    budgetUsdc: null,
  };
}

// ---------------------------------------------------------------------------
// Authored: what this system and its operator did
// ---------------------------------------------------------------------------

/**
 * The job description as an event rather than a seed field.
 *
 * It is a fact that arrived, at a time, from a fetch that may fail or return
 * something different later, which is exactly what an event is for and exactly
 * what an immutable seed is not. `observedAt` is the domain time of the entry
 * that prompted the fetch, so the claim is "as of this entry, the description
 * was this".
 *
 * Re-fetching an unchanged description derives the same id and appends nothing.
 */
export function describedEvent(input: {
  chainId: number;
  jobId: string;
  description: string;
  observedAt: Date;
}): TranslatedEvent {
  const data = {
    chain_id: input.chainId,
    job_id: input.jobId,
    description: input.description,
  };

  return {
    eventId: derivedEventId({ type: "acp.job.described", data }),
    type: "acp.job.described",
    eventTime: input.observedAt,
    data,
  };
}

/**
 * The operator's decision to spend, as history.
 *
 * This event records that someone authorized a fund. It does not cause one:
 * the instruction the runtime acts on is the `acp_spend_intents` row written
 * in the same transaction. An authorization event appended through the generic
 * events route therefore appears in history and buys nothing, which is the
 * property that keeps "the runtime never decides to spend" true.
 *
 * Its id is supplied by the caller, not derived, because the operator owns the
 * idempotency key for their own decision.
 */
export function fundAuthorizedEvent(input: {
  eventId: string;
  chainId: number;
  jobId: string;
  amountUsdc: string;
  authorizedAt: Date;
}): TranslatedEvent {
  return {
    eventId: input.eventId,
    type: "acp.fund.authorized",
    eventTime: input.authorizedAt,
    data: {
      chain_id: input.chainId,
      job_id: input.jobId,
      amount_usdc: input.amountUsdc,
    },
  };
}

/**
 * We called `fund` and it returned. Not "the chain agrees": that claim arrives
 * separately as an observed `acp.job.funded` entry, carrying the chain's own
 * account of it. Two different facts, both recorded.
 *
 * The SDK's `fund` resolves to void, so there is no transaction hash to store.
 * A `tx_hash: null` would be a field that can never be filled, so there is
 * none.
 */
export function fundSubmittedEvent(input: {
  authorizationEventId: string;
  chainId: number;
  jobId: string;
  amountUsdc: string;
  submittedAt: Date;
}): TranslatedEvent {
  const data = {
    chain_id: input.chainId,
    job_id: input.jobId,
    amount_usdc: input.amountUsdc,
    authorization_event_id: input.authorizationEventId,
  };

  return {
    eventId: derivedEventId({ type: "acp.fund.submitted", data }),
    type: "acp.fund.submitted",
    eventTime: input.submittedAt,
    data,
  };
}

/** Recorded once, when the runtime stops retrying. Retries stay on the row. */
export function fundFailedEvent(input: {
  authorizationEventId: string;
  chainId: number;
  jobId: string;
  amountUsdc: string;
  reason: string;
  attempts: number;
  failedAt: Date;
}): TranslatedEvent {
  const data = {
    chain_id: input.chainId,
    job_id: input.jobId,
    amount_usdc: input.amountUsdc,
    authorization_event_id: input.authorizationEventId,
    reason: input.reason,
    attempts: input.attempts,
  };

  return {
    eventId: derivedEventId({ type: "acp.fund.failed", data }),
    type: "acp.fund.failed",
    eventTime: input.failedAt,
    data,
  };
}

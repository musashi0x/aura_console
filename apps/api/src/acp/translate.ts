import { createHash } from "node:crypto";

import type { JobRoomEntry } from "@virtuals-protocol/acp-node-v2";

/**
 * Fixed namespace for ACP-derived event ids. Changing it renames every id and
 * would re-append the whole history, so it is a constant, never configuration.
 */
const ACP_UUID_NAMESPACE = "6f1d0b6e-6f1a-5c2e-9a3b-0d1e2f3a4b5c";

const USDC_DECIMALS = 6;

export const ACP_ENVIRONMENTS: Record<number, string> = {
  84_532: "base-sepolia",
};

export function environmentForChain(chainId: number): string {
  return ACP_ENVIRONMENTS[chainId] ?? `evm-${chainId}`;
}

/**
 * Sorts keys recursively so an id cannot change with key order. Only used for
 * hashing, never for storage.
 */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`);

  return `{${entries.join(",")}}`;
}

/** RFC 4122 name-based UUID, version 5. */
export function uuidV5(name: string, namespace: string = ACP_UUID_NAMESPACE): string {
  const namespaceBytes = Buffer.from(namespace.replace(/-/g, ""), "hex");
  const hash = createHash("sha1").update(namespaceBytes).update(Buffer.from(name, "utf8")).digest();

  const bytes = Buffer.from(hash.subarray(0, 16));
  bytes[6] = ((bytes[6] as number) & 0x0f) | 0x50;
  bytes[8] = ((bytes[8] as number) & 0x3f) | 0x80;

  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * The SDK types these amounts as `number`, so the float has already happened
 * before we see the value. Converting once, here, stops the loss compounding
 * across every later read; it does not restore precision we never received.
 * Prefer an exact source (a job's `budget` string, an AssetToken raw bigint)
 * wherever one exists.
 */
export function usdcString(amount: number): string {
  if (!Number.isFinite(amount)) {
    throw new Error(`Refusing to record a non-finite USDC amount: ${amount}`);
  }
  return amount.toFixed(USDC_DECIMALS);
}

/** Raw on-chain integer to a six-decimal string, with no float in between. */
export function usdcStringFromRaw(rawAmount: bigint): string {
  const negative = rawAmount < 0n;
  const digits = (negative ? -rawAmount : rawAmount).toString().padStart(USDC_DECIMALS + 1, "0");
  const whole = digits.slice(0, -USDC_DECIMALS);
  const fraction = digits.slice(-USDC_DECIMALS);
  return `${negative ? "-" : ""}${whole}.${fraction}`;
}

/**
 * Decimal string to raw on-chain integer, by integer arithmetic only.
 *
 * `Number(amount) * 1e6` would put the value through a double on the way to
 * the chain, which is the one place this repository's string rule is actually
 * protecting something: the SDK's own `AssetToken.usdc` takes a `number`, so
 * the exact path is to build the bigint ourselves and use `usdcFromRaw`.
 */
export function usdcRawFromString(amount: string): bigint {
  const match = /^(\d+)(?:\.(\d{1,6}))?$/.exec(amount.trim());
  if (!match) {
    throw new Error(`Not a USDC decimal amount: ${amount}`);
  }
  const [, whole = "0", fraction = ""] = match;
  return BigInt(whole) * 10n ** BigInt(USDC_DECIMALS) + BigInt(fraction.padEnd(USDC_DECIMALS, "0"));
}

export type TranslatedEvent = {
  eventId: string;
  type: string;
  eventTime: Date;
  data: Record<string, unknown>;
};

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
 * The SDK exposes no per-entry identifier, so `eventId` is a uuidv5 over the
 * canonicalised entry. A duplicate delivery therefore collapses onto the same
 * id and appends nothing — which is the point — while a genuine repeat of a
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
    eventId: uuidV5(canonicalJson({ type, timestamp: entry.timestamp, data })),
    type,
    // Producer domain time, never arrival time.
    eventTime: new Date(entry.timestamp),
    data,
  };
}

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

/**
 * The job description as an event rather than a seed field.
 *
 * It is a fact that arrived — at a time, from a fetch that may fail or return
 * something different later — which is exactly what an event is for and exactly
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
    eventId: uuidV5(canonicalJson({ type: "acp.job.described", data })),
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
 * We called `fund` and it returned. Not "the chain agrees" — that claim
 * arrives separately as an observed `acp.job.funded` entry, carrying the
 * chain's own account of it. Two different facts, both recorded.
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
    eventId: uuidV5(canonicalJson({ type: "acp.fund.submitted", data })),
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
    eventId: uuidV5(canonicalJson({ type: "acp.fund.failed", data })),
    type: "acp.fund.failed",
    eventTime: input.failedAt,
    data,
  };
}

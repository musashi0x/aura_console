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
 * A client-side `job.created` entry carries addresses and an expiry — no
 * description and no offering name — so the objective comes from the job
 * fetched off-chain. That description is nullable, and the fallback is a
 * deterministic label rather than an invented sentence.
 */
export function runSeedForJob(input: {
  chainId: number;
  jobId: string;
  description: string | null;
}): AcpRunSeed {
  const description = input.description?.trim();

  return {
    objective:
      description && description.length > 0
        ? description
        : `ACP job ${input.jobId} on ${environmentForChain(input.chainId)}`,
    source: "AGENT",
    environment: environmentForChain(input.chainId),
    budgetUsdc: null,
  };
}

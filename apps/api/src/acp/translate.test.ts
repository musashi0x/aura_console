import type { JobRoomEntry } from "@virtuals-protocol/acp-node-v2";
import { describe, expect, it } from "vitest";

import {
  canonicalJson,
  describedEvent,
  environmentForChain,
  runSeedForJob,
  translateEntry,
  usdcString,
  usdcStringFromRaw,
  uuidV5,
} from "./translate.js";

const CHAIN_ID = 84_532;
const JOB_ID = "42";
const TIMESTAMP = 1_767_225_600_000;

function systemEntry(event: Extract<JobRoomEntry, { kind: "system" }>["event"]): JobRoomEntry {
  return {
    kind: "system",
    onChainJobId: JOB_ID,
    chainId: CHAIN_ID,
    event,
    timestamp: TIMESTAMP,
  };
}

function messageEntry(
  contentType: Extract<JobRoomEntry, { kind: "message" }>["contentType"],
): JobRoomEntry {
  return {
    kind: "message",
    onChainJobId: JOB_ID,
    chainId: CHAIN_ID,
    from: "0x1111111111111111111111111111111111111111",
    contentType,
    content: `body:${contentType}`,
    timestamp: TIMESTAMP,
  };
}

const systemEvents = [
  {
    type: "job.created",
    jobId: JOB_ID,
    client: "0xc",
    provider: "0xp",
    evaluator: "0xe",
    expiredAt: "1767312000",
    hook: "0xh",
  },
  { type: "budget.set", jobId: JOB_ID, amount: 1.5 },
  { type: "job.funded", jobId: JOB_ID, client: "0xc", amount: 1.5 },
  {
    type: "job.submitted",
    jobId: JOB_ID,
    provider: "0xp",
    deliverableHash: "0xhash",
    deliverable: "result",
  },
  { type: "job.completed", jobId: JOB_ID, evaluator: "0xe", reason: "ok" },
  { type: "job.rejected", jobId: JOB_ID, rejector: "0xe", reason: "no" },
  { type: "job.expired", jobId: JOB_ID },
] as const satisfies readonly Extract<JobRoomEntry, { kind: "system" }>["event"][];

describe("canonicalJson", () => {
  it("is stable under key reordering", () => {
    expect(canonicalJson({ b: 1, a: { d: 2, c: 3 } })).toBe(canonicalJson({ a: { c: 3, d: 2 }, b: 1 }));
  });

  it("does not conflate an omitted key with a null one", () => {
    expect(canonicalJson({ a: 1 })).not.toBe(canonicalJson({ a: 1, b: null }));
  });
});

describe("uuidV5", () => {
  it("produces a stable version 5 uuid", () => {
    const id = uuidV5("acp");

    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(uuidV5("acp")).toBe(id);
    expect(uuidV5("acp!")).not.toBe(id);
  });
});

describe("usdc formatting", () => {
  it("renders six decimals", () => {
    expect(usdcString(1.5)).toBe("1.500000");
    expect(usdcString(0)).toBe("0.000000");
  });

  it("refuses a non-finite amount rather than storing NaN", () => {
    expect(() => usdcString(Number.NaN)).toThrow(/non-finite/);
  });

  it("converts a raw integer without going through a float", () => {
    expect(usdcStringFromRaw(1_500_000n)).toBe("1.500000");
    expect(usdcStringFromRaw(1n)).toBe("0.000001");
    expect(usdcStringFromRaw(0n)).toBe("0.000000");
    // Beyond Number.MAX_SAFE_INTEGER: a float round-trip would lose this.
    expect(usdcStringFromRaw(9_007_199_254_740_993_000_000n)).toBe("9007199254740993.000000");
  });
});

describe("translateEntry", () => {
  it.each(systemEvents.map((event) => [event.type, event] as const))(
    "namespaces %s under acp.",
    (type, event) => {
      const translated = translateEntry(systemEntry(event));

      expect(translated.type).toBe(`acp.${type}`);
      expect(translated.data).toMatchObject({ chain_id: CHAIN_ID, job_id: JOB_ID });
      expect(translated.eventTime.getTime()).toBe(TIMESTAMP);
    },
  );

  it.each(["text", "proposal", "deliverable", "structured", "requirement"] as const)(
    "carries a %s message with its sender and content type",
    (contentType) => {
      const translated = translateEntry(messageEntry(contentType));

      expect(translated.type).toBe("acp.message");
      expect(translated.data).toMatchObject({
        content_type: contentType,
        content: `body:${contentType}`,
        from: "0x1111111111111111111111111111111111111111",
      });
    },
  );

  it("stores amounts as six-decimal strings, never numbers", () => {
    const funded = translateEntry(
      systemEntry({ type: "job.funded", jobId: JOB_ID, client: "0xc", amount: 2.5 }),
    );

    expect(funded.data.amount_usdc).toBe("2.500000");

    for (const event of systemEvents) {
      const { data } = translateEntry(systemEntry(event));
      for (const [key, value] of Object.entries(data)) {
        if (key === "chain_id") continue;
        expect(typeof value).not.toBe("number");
      }
    }
  });

  it("carries a fund request as strings too", () => {
    const translated = translateEntry(
      systemEntry({
        type: "budget.set",
        jobId: JOB_ID,
        amount: 1,
        fundRequest: {
          amount: 0.25,
          tokenAddress: "0xusdc",
          symbol: "USDC",
          recipient: "0xr",
        },
      }),
    );

    expect(translated.data.fund_request).toMatchObject({ amount_usdc: "0.250000" });
  });

  it("gives the same entry the same event id, and a different one a different id", () => {
    const entry = systemEntry(systemEvents[1]);

    expect(translateEntry(entry).eventId).toBe(translateEntry(entry).eventId);
    expect(translateEntry(entry).eventId).not.toBe(
      translateEntry({ ...entry, timestamp: TIMESTAMP + 1 }).eventId,
    );
    expect(translateEntry(entry).eventId).not.toBe(
      translateEntry({ ...entry, chainId: 97 }).eventId,
    );
  });

  it("separates two different system events at the same instant", () => {
    const a = translateEntry(systemEntry(systemEvents[5]));
    const b = translateEntry(systemEntry(systemEvents[6]));

    expect(a.eventId).not.toBe(b.eventId);
  });
});

describe("runSeedForJob", () => {
  it("derives everything from the entry, with no description and no fetch", () => {
    expect(runSeedForJob({ chainId: CHAIN_ID, jobId: JOB_ID })).toEqual({
      objective: "ACP job 42 on base-sepolia",
      source: "AGENT",
      environment: "base-sepolia",
      budgetUsdc: null,
    });
  });

  it("names an unmapped chain rather than guessing one", () => {
    expect(environmentForChain(999)).toBe("evm-999");
  });
});

describe("describedEvent", () => {
  const observedAt = new Date(TIMESTAMP);

  it("records the description as an event with the observing entry's time", () => {
    const event = describedEvent({
      chainId: CHAIN_ID,
      jobId: JOB_ID,
      description: "Generate a meme",
      observedAt,
    });

    expect(event.type).toBe("acp.job.described");
    expect(event.eventTime.getTime()).toBe(TIMESTAMP);
    expect(event.data).toEqual({
      chain_id: CHAIN_ID,
      job_id: JOB_ID,
      description: "Generate a meme",
    });
  });

  it("is idempotent for an unchanged description, regardless of when it was observed", () => {
    const first = describedEvent({ chainId: CHAIN_ID, jobId: JOB_ID, description: "same", observedAt });
    const later = describedEvent({
      chainId: CHAIN_ID,
      jobId: JOB_ID,
      description: "same",
      observedAt: new Date(TIMESTAMP + 60_000),
    });

    expect(later.eventId).toBe(first.eventId);
  });

  it("records a changed description as a new event", () => {
    const first = describedEvent({ chainId: CHAIN_ID, jobId: JOB_ID, description: "before", observedAt });
    const changed = describedEvent({ chainId: CHAIN_ID, jobId: JOB_ID, description: "after", observedAt });

    expect(changed.eventId).not.toBe(first.eventId);
  });
});

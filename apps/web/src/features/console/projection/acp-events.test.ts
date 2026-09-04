import { beforeEach, describe, expect, it } from "vitest";

import type { CanonicalEvent } from "../model/types";
import { foldRun, type FoldSeed } from "./fold-run";
import { stageFor } from "./stage-map";

const seed: FoldSeed = {
  runId: "run-1",
  objective: "ACP job 42 on base-sepolia",
  source: "AGENT",
  environment: "base-sepolia",
  budgetUsdc: null,
};

let sequence = 0;

function event(type: string, data: Record<string, unknown> = {}): CanonicalEvent {
  sequence += 1;
  return {
    event_id: `e${sequence}`,
    run_id: "run-1",
    sequence,
    type,
    event_time: new Date(1_767_225_600_000 + sequence).toISOString(),
    data: { chain_id: 84_532, job_id: "42", ...data },
  };
}

const fold = (events: CanonicalEvent[]) => foldRun(events, seed);

beforeEach(() => {
  sequence = 0;
});

describe("ACP events in the fold", () => {
  it("moves an ACP Run through the Console's own statuses", () => {
    expect(fold([event("acp.job.created")]).status).toBe("RUNNING");
    expect(fold([event("acp.job.completed")]).status).toBe("COMPLETED");
    expect(fold([event("acp.job.rejected")]).status).toBe("FAILED");
    expect(fold([event("acp.job.expired")]).status).toBe("FAILED");
  });

  it("waits for approval when a provider proposes a price", () => {
    const view = fold([
      event("acp.job.created"),
      event("acp.budget.set", { amount_usdc: "1.250000" }),
    ]);

    expect(view.status).toBe("WAITING_APPROVAL");
    expect(view.attention).toEqual({
      kind: "AWAITING_APPROVAL",
      reason: "Provider proposed 1.250000 USDC. Funding requires authorization.",
    });
  });

  it("clears attention once an operator authorizes", () => {
    const view = fold([
      event("acp.budget.set", { amount_usdc: "1.250000" }),
      event("acp.fund.authorized", { amount_usdc: "1.250000" }),
    ]);

    expect(view.status).toBe("RUNNING");
    expect(view.attention).toEqual({ kind: "NONE" });
  });

  it("blocks the Run when funding gave up", () => {
    const view = fold([
      event("acp.budget.set", { amount_usdc: "1.000000" }),
      event("acp.fund.failed", { reason: "insufficient allowance", attempts: 3 }),
    ]);

    expect(view.status).toBe("BLOCKED");
    expect(view.attention).toEqual({ kind: "BLOCKED", domain: "funding", retryable: false });
  });

  it("counts spend only from the chain's own account of it", () => {
    // A proposal, a decision and our own claim are not money that left.
    expect(fold([event("acp.budget.set", { amount_usdc: "9.000000" })]).spentUsdc).toBeNull();
    expect(fold([event("acp.fund.authorized", { amount_usdc: "9.000000" })]).spentUsdc).toBeNull();
    expect(fold([event("acp.fund.submitted", { amount_usdc: "9.000000" })]).spentUsdc).toBeNull();

    expect(fold([event("acp.job.funded", { amount_usdc: "1.250000" })]).spentUsdc).toBe("1.250000");
  });

  it("never derives a total from several amounts", () => {
    const view = fold([
      event("acp.job.funded", { amount_usdc: "1.000000" }),
      event("acp.job.funded", { amount_usdc: "2.000000" }),
    ]);

    // The last projection-bearing event wins. Nothing is summed here.
    expect(view.spentUsdc).toBe("2.000000");
  });

  it("places ACP events on the canonical stages", () => {
    expect(stageFor("acp.job.created")).toBe("COMMIT");
    expect(stageFor("acp.job.described")).toBe("COMMIT");
    expect(stageFor("acp.budget.set")).toBe("FUND");
    expect(stageFor("acp.fund.authorized")).toBe("FUND");
    expect(stageFor("acp.fund.submitted")).toBe("FUND");
    expect(stageFor("acp.job.funded")).toBe("FUND");
    expect(stageFor("acp.job.submitted")).toBe("DELIVER");
    expect(stageFor("acp.job.completed")).toBe("EVALUATE");
    expect(stageFor("acp.job.rejected")).toBe("EVALUATE");
  });

  it("marks understood but stageless types supported, not unrecognised", () => {
    const view = fold([
      event("acp.message", { content: "on it", content_type: "text", from: "0xp" }),
      event("acp.job.expired"),
    ]);

    expect(view.entries.map((entry) => entry.support)).toEqual(["SUPPORTED", "SUPPORTED"]);
    expect(view.entries.map((entry) => entry.stage)).toEqual([null, null]);
  });

  it("still flags a genuinely unknown type", () => {
    const [entry] = fold([event("acp.something.new")]).entries;

    expect(entry?.support).toBe("UNSUPPORTED_TYPE");
  });

  it("summarises an entry without inventing one", () => {
    const view = fold([
      event("acp.job.described", { description: "Generate a meme" }),
      event("acp.job.funded", { amount_usdc: "1.250000" }),
      event("acp.job.expired"),
    ]);

    expect(view.entries.map((entry) => entry.summary)).toEqual([
      "Generate a meme",
      "Escrow funded: 1.250000 USDC",
      // No summary to give, so the type stands rather than a made-up sentence.
      "acp.job.expired",
    ]);
  });

  it("prefers an explicit summary on the event over a derived one", () => {
    const [entry] = fold([
      event("acp.job.funded", { amount_usdc: "1.000000", summary: "written by the producer" }),
    ]).entries;

    expect(entry?.summary).toBe("written by the producer");
  });

  it("replays an ACP Run through the same fold, with a playhead", () => {
    const events = [
      event("acp.job.created"),
      event("acp.budget.set", { amount_usdc: "1.250000" }),
      event("acp.job.funded", { amount_usdc: "1.250000" }),
    ];

    const midway = foldRun(events, seed, 2);

    expect(midway.status).toBe("WAITING_APPROVAL");
    expect(midway.spentUsdc).toBeNull();
    expect(midway.entries).toHaveLength(2);
  });
});

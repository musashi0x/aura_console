import { describe, expect, it } from "vitest";

import type { CanonicalEvent } from "../model/types";
import { foldRun, type FoldSeed } from "./fold-run";

const seed: FoldSeed = {
  runId: "run_42",
  objective: "Research three competitors",
  source: "CONSOLE",
  environment: "base-sepolia-demo",
  budgetUsdc: "1.00",
};

const ev = (sequence: number, type: string, data?: Record<string, unknown>): CanonicalEvent => ({
  event_id: `evt_${sequence}`,
  run_id: "run_42",
  sequence,
  type,
  event_time: `2026-08-29T10:00:${String(sequence).padStart(2, "0")}Z`,
  data,
});

const base = [
  ev(1, "run.created"),
  ev(2, "run.started"),
  ev(3, "provider.discovered"),
  ev(4, "memory.no_history"),
  ev(5, "decision.context.built", {
    context_id: "ctx_1",
    context_schema_version: "1",
    context_hash: "sha256:abc",
    input_refs: ["memory_version:12"],
    summary: "Two eligible providers.",
  }),
  ev(6, "decision.created"),
  ev(7, "run.completed"),
];

describe("ordering", () => {
  it("renders out-of-order arrival in canonical order", () => {
    const shuffled = [base[4]!, base[0]!, base[6]!, base[2]!, base[1]!, base[5]!, base[3]!];
    const view = foldRun(shuffled, seed);
    expect(view.entries.map((e) => e.sequence)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("produces an identical view whatever the arrival order", () => {
    const a = foldRun(base, seed);
    const b = foldRun([...base].reverse(), seed);
    expect(b).toEqual(a);
  });
});

describe("idempotency", () => {
  it("does not duplicate a re-delivered event", () => {
    const view = foldRun([...base, base[3]!, base[3]!], seed);
    expect(view.entries).toHaveLength(base.length);
    expect(view.entries.filter((e) => e.eventId === "evt_4")).toHaveLength(1);
  });
});

describe("replay", () => {
  it("shows only facts available at the playhead", () => {
    const atFour = foldRun(base, seed, 4);
    expect(atFour.entries).toHaveLength(4);
    // The decision has not happened yet at this playhead.
    expect(atFour.contextEnvelope).toBeNull();
    expect(atFour.status).toBe("RUNNING");
  });

  it("live and full replay agree", () => {
    const live = foldRun(base, seed, null);
    const replay = foldRun(base, seed, 7);
    expect(replay).toEqual(live);
  });
});

describe("honest state", () => {
  it("keeps NO_HISTORY distinct from ERROR", () => {
    expect(foldRun(base, seed).retrievalStatus).toBe("NO_HISTORY");
    const failed = foldRun([...base.slice(0, 3), ev(4, "memory.retrieval.failed")], seed);
    expect(failed.retrievalStatus).toBe("ERROR");
    expect(failed.attention.kind).toBe("MEMORY_ERROR");
  });

  it("leaves spend null until a projection reports it, never zero", () => {
    expect(foldRun(base, seed).spentUsdc).toBeNull();
    const funded = foldRun([...base, ev(8, "acp.job.funded", { spent_usdc: "0.12" })], seed);
    expect(funded.spentUsdc).toBe("0.12");
  });

  it("never infers completion from the absence of events", () => {
    const stalled = foldRun(base.slice(0, 3), seed);
    expect(stalled.status).toBe("RUNNING");
  });

  it("carries only the five envelope fields", () => {
    const leaky = foldRun(
      [
        ev(5, "decision.context.built", {
          context_id: "ctx_1",
          context_schema_version: "1",
          context_hash: "sha256:abc",
          input_refs: [],
          summary: "ok",
          private_episodes: ["should never reach the client"],
        }),
      ],
      seed,
    );
    expect(Object.keys(leaky.contextEnvelope ?? {}).sort()).toEqual([
      "context_hash",
      "context_id",
      "context_schema_version",
      "input_refs",
      "summary",
    ]);
  });

  it("keeps an unrecognised event inspectable rather than dropping it", () => {
    const view = foldRun([...base, ev(8, "some.future.event")], seed);
    const entry = view.entries.find((e) => e.type === "some.future.event");
    expect(entry?.support).toBe("UNSUPPORTED_TYPE");
    expect(view.entries).toHaveLength(base.length + 1);
  });

  it("never reports mainnet", () => {
    expect(foldRun(base, seed).isMainnet).toBe(false);
  });
});

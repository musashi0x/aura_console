import { describe, expect, it } from "vitest";

import type { CanonicalEvent } from "../model/types";
import { foldRun, type FoldSeed } from "./fold-run";
import { buildSpine, SPINE_ORDER, spineStageFor } from "./spine";
import type { CanonicalStage } from "../model/types";

const seed: FoldSeed = {
  runId: "run_7",
  objective: "Buy one dataset",
  source: "CONSOLE",
  environment: "base-sepolia-demo",
  budgetUsdc: "5.00",
};

const ev = (sequence: number, type: string, data?: Record<string, unknown>): CanonicalEvent => ({
  event_id: `evt_${sequence}`,
  run_id: "run_7",
  sequence,
  type,
  event_time: `2026-09-01T09:00:${String(sequence).padStart(2, "0")}Z`,
  data,
});

const full = [
  ev(1, "run.created"),
  ev(2, "provider.discovered", { summary: "Three providers" }),
  ev(3, "memory.retrieved", { summary: "Prior dealings found" }),
  ev(4, "candidate.scored", { summary: "Ranked" }),
  ev(5, "policy.evaluated", { summary: "Within budget" }),
  ev(6, "decision.made", { summary: "Chose provider B" }),
  ev(7, "acp.job.funded", { summary: "Escrow funded", spent_usdc: "2.50" }),
  ev(8, "outcome.delivered", { summary: "Dataset delivered" }),
  ev(9, "memory.episode.written", { summary: "Episode recorded" }),
  ev(10, "run.completed"),
];

const spineOf = (events: CanonicalEvent[], upTo: number | null = null, hideMemory = false) =>
  buildSpine(foldRun(events, seed, upTo).entries, { hideMemory });

describe("causal spine", () => {
  it("maps every technical stage into exactly one of the five", () => {
    const all: CanonicalStage[] = [
      "DISCOVER", "MEMORY", "SCORE", "POLICY", "DECIDE",
      "FUND", "COMMIT", "DELIVER", "EVALUATE", "LEARN",
    ];
    for (const stage of all) expect(SPINE_ORDER).toContain(spineStageFor(stage));
  });

  it("always renders the five stages in canonical order, reached or not", () => {
    const spine = spineOf([ev(1, "run.created")]);
    expect(spine.nodes.map((n) => n.stage)).toEqual([
      "EVIDENCE", "DECISION", "ECONOMIC_ACTION", "OUTCOME", "MEMORY_DIFF",
    ]);
    expect(spine.nodes.every((n) => n.state === "NOT_REACHED")).toBe(true);
  });

  it("marks a stage REACHED only once an event lands in it", () => {
    const spine = spineOf(full);
    expect(spine.nodes.map((n) => n.state)).toEqual([
      "REACHED", "REACHED", "REACHED", "REACHED", "REACHED",
    ]);
    expect(spine.nodes[0]!.entries.map((e) => e.type)).toEqual([
      "provider.discovered", "memory.retrieved", "candidate.scored",
    ]);
  });

  it("carries the time a stage was first reached so a node can label itself", () => {
    const evidence = spineOf(full).nodes[0]!;
    expect(evidence.firstTime).toBe("2026-09-01T09:00:02Z");
    expect(evidence.lastTime).toBe("2026-09-01T09:00:04Z");
    expect(evidence.firstSequence).toBe(2);
  });

  it("does not reach later stages when the playhead has not got there", () => {
    const spine = spineOf(full, 4);
    expect(spine.nodes[0]!.state).toBe("REACHED");
    expect(spine.nodes.slice(1).every((n) => n.state === "NOT_REACHED")).toBe(true);
  });

  it("keeps lifecycle events instead of dropping them off the spine", () => {
    const spine = spineOf(full);
    expect(spine.offSpine.map((e) => e.type)).toEqual(["run.created", "run.completed"]);
  });

  it("replay and live agree: the same events fold to the same spine", () => {
    const live = spineOf(full, null);
    const replay = spineOf(full, 10);
    expect(replay).toEqual(live);
  });
});

describe("Memory Off is a view, not a re-run", () => {
  it("hides memory evidence and says how much it hid", () => {
    const spine = spineOf(full, null, true);
    expect(spine.hiddenByMemoryOff).toBe(1);
    expect(spine.nodes[0]!.hiddenByMemoryOff).toBe(1);
    expect(spine.nodes[0]!.entries.map((e) => e.type)).toEqual([
      "provider.discovered", "candidate.scored",
    ]);
  });

  it("leaves the decision and the economic action exactly as they happened", () => {
    const on = spineOf(full);
    const off = spineOf(full, null, true);
    // The counterfactual must not rewrite history: only the evidence view
    // changes, because nothing was re-decided and nothing was re-executed.
    expect(off.nodes[1]).toEqual(on.nodes[1]);
    expect(off.nodes[2]).toEqual(on.nodes[2]);
  });

  it("does not call a stage reached when only hidden events remain", () => {
    const memoryOnly = [ev(1, "run.created"), ev(2, "memory.retrieved", { summary: "Found" })];
    const off = spineOf(memoryOnly, null, true);
    expect(off.nodes[0]!.state).toBe("NOT_REACHED");
    expect(off.nodes[0]!.hiddenByMemoryOff).toBe(1);
  });
});

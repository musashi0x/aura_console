import { describe, expect, it } from "vitest";

import type { TimelineEntry } from "../model/types";
import { foldCounterfactual } from "./counterfactual";

/**
 * The counterfactual is the product's most persuasive claim and therefore the
 * one most worth pinning. "Memory changed this decision" may only appear when
 * the winner actually moves; everything else has to read as either a real
 * unchanged result or an honest absence.
 */

function entry(type: string, data?: Record<string, unknown>, sequence = 1): TimelineEntry {
  return {
    eventId: `evt_${sequence}`,
    sequence,
    type,
    eventTime: "2026-09-07T00:00:00.000Z",
    stage: null,
    support: "SUPPORTED",
    summary: type,
    data,
  };
}

/** Alpha leads on merit; a recorded failure drags it below Beta. */
const MEMORY_FLIPS_IT = entry("candidate.scored", {
  candidates: [
    { key: "alpha", score: 72, memory_adjustment: -24, memory_note: "A previous Alpha failure applied a 24 point risk penalty." },
    { key: "beta", score: 91, memory_adjustment: 0 },
  ],
});

describe("the counterfactual", () => {
  it("reports a changed decision only when the winner actually moves", () => {
    const result = foldCounterfactual([MEMORY_FLIPS_IT]);
    expect(result.status).toBe("DECISION_CHANGED");
    if (result.status !== "DECISION_CHANGED") throw new Error("unreachable");

    // With memory Beta wins on 91; without it Alpha's 96 leads again.
    expect(result.withMemory[0]?.key).toBe("beta");
    expect(result.withoutMemory[0]?.key).toBe("alpha");
    expect(result.withoutMemory[0]?.score).toBe(96);
  });

  it("quotes the recorded reason rather than composing one", () => {
    const result = foldCounterfactual([MEMORY_FLIPS_IT]);
    if (result.status !== "DECISION_CHANGED") throw new Error("unreachable");
    expect(result.explanation).toBe(
      "A previous Alpha failure applied a 24 point risk penalty.",
    );
  });

  it("says the winner moved without naming a cause the event never recorded", () => {
    const result = foldCounterfactual([
      entry("candidate.scored", {
        candidates: [
          { key: "alpha", score: 72, memory_adjustment: -24 },
          { key: "beta", score: 91, memory_adjustment: 0 },
        ],
      }),
    ]);
    if (result.status !== "DECISION_CHANGED") throw new Error("unreachable");
    expect(result.explanation).toMatch(/did not record why/i);
  });

  it("treats memory that held the same choice as a real result, not a missing one", () => {
    // Memory moved a score but not the ranking. That is worth saying plainly.
    const result = foldCounterfactual([
      entry("candidate.scored", {
        candidates: [
          { key: "beta", score: 91, memory_adjustment: 5 },
          { key: "alpha", score: 60, memory_adjustment: -10 },
        ],
      }),
    ]);
    expect(result.status).toBe("NO_MATERIAL_CHANGE");
  });

  it("is unavailable when nothing was scored, rather than claiming no change", () => {
    const result = foldCounterfactual([entry("run.created")]);
    expect(result.status).toBe("UNAVAILABLE");
  });

  it("is unavailable when scoring recorded no memory component", () => {
    // The old fixture shape: a scoring event with only a summary. It cannot
    // separate what memory contributed, and "no change" would be a measurement
    // nobody took.
    const result = foldCounterfactual([
      entry("candidate.scored", { summary: "Counterparties ranked" }),
    ]);
    expect(result.status).toBe("UNAVAILABLE");
  });

  it("drops a candidate missing its memory component instead of reading it as zero", () => {
    // Zero would assert memory did nothing to that candidate.
    const result = foldCounterfactual([
      entry("candidate.scored", {
        candidates: [
          { key: "alpha", score: 72 },
          { key: "beta", score: 91, memory_adjustment: 0 },
        ],
      }),
    ]);
    if (result.status === "UNAVAILABLE") throw new Error("beta alone is still comparable");
    expect(result.withMemory).toHaveLength(1);
    expect(result.withMemory[0]?.key).toBe("beta");
  });

  it("reads the latest scoring event when a Mission scored more than once", () => {
    const result = foldCounterfactual([
      entry("candidate.scored", { candidates: [{ key: "old", score: 10, memory_adjustment: 0 }] }, 1),
      entry("candidate.scored", { candidates: [{ key: "new", score: 20, memory_adjustment: 0 }] }, 2),
    ]);
    if (result.status === "UNAVAILABLE") throw new Error("unreachable");
    expect(result.withMemory[0]?.key).toBe("new");
  });
});

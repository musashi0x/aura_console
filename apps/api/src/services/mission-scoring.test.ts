import { describe, expect, it } from "vitest";

import { decisionReasons, scoreCandidates } from "./mission-scoring.js";
import type { SibylCounterparty } from "./sibyl.js";

/**
 * A counterparty with nothing on it. Each test names only the fields it is
 * about, so a default drifting later cannot quietly become the thing under
 * test.
 */
function counterparty(over: Partial<SibylCounterparty>): SibylCounterparty {
  return {
    counterpartyKey: "virtuals:agent:x",
    displayName: null,
    hasProfile: true,
    isFixture: false,
    relationshipStatus: null,
    memoryVersion: null,
    overallReliability: null,
    taskFit: null,
    confidence: null,
    observedPriceUsdc: null,
    riskNote: null,
    episodes: [],
    updatedAt: null,
    ...over,
  };
}

/** The two records the seeded store actually holds, by their real numbers. */
const ALPHA = counterparty({
  counterpartyKey: "virtuals:agent:alpha",
  relationshipStatus: "WATCH",
  overallReliability: 0.42,
  taskFit: 0.71,
  confidence: 0.88,
  observedPriceUsdc: "9.00",
  riskNote: "One acceptance failure inside the last 30 days applies a risk penalty.",
});

const BETA = counterparty({
  counterpartyKey: "virtuals:agent:beta",
  relationshipStatus: "PREFERRED",
  overallReliability: 0.91,
  taskFit: 0.83,
  confidence: 0.9,
  observedPriceUsdc: "12.00",
  riskNote: "No acceptance failures on record.",
});

describe("scoreCandidates", () => {
  it("lets memory outrank a cheaper counterparty with a worse record", () => {
    const { ranked } = scoreCandidates([ALPHA, BETA]);
    const [first, second] = ranked;
    expect(first?.key).toBe("virtuals:agent:beta");
    expect(second?.key).toBe("virtuals:agent:alpha");
  });

  /* The counterfactual subtracts `memory_adjustment` from `score` and expects
     what remains to be the ranking price alone would have produced. If these
     two ever stop agreeing, the Console's "memory changed this decision" claim
     becomes an assertion about a number nobody measured. */
  it("records a memory component that, removed, restores the price order", () => {
    const { ranked } = scoreCandidates([ALPHA, BETA]);
    const withoutMemory = [...ranked]
      .map((row) => ({ key: row.key, base: row.score - row.memory_adjustment }))
      .sort((a, b) => b.base - a.base);

    expect(withoutMemory[0]?.key).toBe("virtuals:agent:alpha");
    // The cheapest quote is the reference, so it scores exactly 100.
    expect(withoutMemory[0]?.base).toBe(100);
    expect(withoutMemory[1]?.base).toBe(75);
  });

  it("excludes a counterparty that quoted no price rather than inventing one", () => {
    const noQuote = counterparty({ counterpartyKey: "virtuals:agent:silent", confidence: 1 });
    const { ranked, excluded } = scoreCandidates([ALPHA, BETA, noQuote]);
    expect(ranked.map((row) => row.key)).not.toContain("virtuals:agent:silent");
    expect(ranked).toHaveLength(2);
    // Reported, not silently dropped.
    expect(excluded).toEqual([
      {
        key: "virtuals:agent:silent",
        reason: "No observed price on record, so there was nothing to compare on.",
      },
    ]);
  });

  it("moves nothing when the store holds no opinion", () => {
    const unknown = counterparty({ counterpartyKey: "a", observedPriceUsdc: "10.00" });
    const [only] = scoreCandidates([unknown]).ranked;
    expect(only?.memory_adjustment).toBe(0);
    expect(only?.score).toBe(100);
  });

  /* Neutral scores are the point where the store knows the counterparty but has
     learned nothing that separates it. They must not move the ranking either,
     or "we have no signal" would read as a verdict. */
  it("moves nothing when every signal sits at neutral", () => {
    const neutral = counterparty({
      observedPriceUsdc: "10.00",
      overallReliability: 0.5,
      taskFit: 0.5,
      confidence: 1,
      relationshipStatus: "KNOWN",
    });
    expect(scoreCandidates([neutral]).ranked[0]?.memory_adjustment).toBe(0);
  });

  it("lets low confidence damp what memory is worth", () => {
    const sure = counterparty({ observedPriceUsdc: "10.00", overallReliability: 0.9, confidence: 1 });
    const unsure = counterparty({ observedPriceUsdc: "10.00", overallReliability: 0.9, confidence: 0.1 });
    const [a] = scoreCandidates([sure]).ranked;
    const [b] = scoreCandidates([unsure]).ranked;
    expect(a!.memory_adjustment).toBeGreaterThan(b!.memory_adjustment);
  });

  /* The veto, at the price where a penalty would have failed. A blocked
     counterparty quoting a twelfth of the alternative is exactly the case a
     points-based penalty lets through, so this is the regression that pins
     "blocked" to mean blocked rather than "blocked unless cheap enough". */
  it("never ranks a blocked counterparty, however cheap it is", () => {
    const blocked = counterparty({
      counterpartyKey: "virtuals:agent:blocked",
      observedPriceUsdc: "1.00",
      relationshipStatus: "BLOCKED",
      confidence: 1,
    });
    const { ranked, excluded } = scoreCandidates([blocked, BETA]);
    expect(ranked.map((row) => row.key)).toEqual(["virtuals:agent:beta"]);
    expect(excluded).toEqual([
      {
        key: "virtuals:agent:blocked",
        reason: "Relationship status on record is BLOCKED, so this counterparty was not ranked.",
      },
    ]);
  });

  it("reports nothing to rank when every counterparty is excluded", () => {
    const blocked = counterparty({ observedPriceUsdc: "1.00", relationshipStatus: "BLOCKED" });
    const { ranked, excluded } = scoreCandidates([blocked]);
    expect(ranked).toEqual([]);
    expect(excluded).toHaveLength(1);
  });

  it("carries the store's own note and never one of its own", () => {
    const [beta] = scoreCandidates([BETA]).ranked;
    expect(beta?.memory_note).toBe("No acceptance failures on record.");
    const [silent] = scoreCandidates([counterparty({ observedPriceUsdc: "5.00" })]).ranked;
    expect(silent).not.toHaveProperty("memory_note");
  });
});

describe("decisionReasons", () => {
  it("reads reasons off the record and adds nothing", () => {
    expect(decisionReasons(BETA)).toEqual([
      "Relationship status on record is PREFERRED.",
      "Observed price is 12.00 USDC.",
      "No acceptance failures on record.",
    ]);
  });

  it("says so when the record it chose from is fixture data", () => {
    const reasons = decisionReasons(counterparty({ isFixture: true }));
    expect(reasons).toContain(
      "This record is seeded demonstration data, not a relationship this operator has had.",
    );
  });

  it("returns nothing when the record says nothing", () => {
    expect(decisionReasons(counterparty({}))).toEqual([]);
  });
});

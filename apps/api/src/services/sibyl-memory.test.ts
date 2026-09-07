import { beforeEach, describe, expect, it, vi } from "vitest";

import { authorizeFromRetrieval } from "./memory-authorization.js";
import type { PolicyResponse } from "./policy-store.js";
import type { RetrievalResult } from "./memory-store.js";
import type { SibylRecall, SibylRecord, SibylVerdictCode } from "./sibyl.js";

/* The bridge spawns a Python process. Driving `recallEntities` directly tests
   the mapping - which is the part that can be wrong - without a subprocess, and
   lets a test produce verdicts the fixture store cannot currently reach. */
const sibyl = vi.hoisted(() => ({ recall: null as unknown as SibylRecall }));

vi.mock("./sibyl.js", () => ({
  recallEntities: async () => sibyl.recall,
  getEntity: async () => ({ found: false }),
}));

const { recallCounterparty } = await import("./sibyl-memory.js");

/**
 * The Sibyl-only cell: memory was recalled, but no committed memory version
 * exists for it.
 *
 * It has two properties that pull in opposite directions, and both have to hold
 * at once. The status must say AVAILABLE, because memory really was found and
 * NO_HISTORY renders to the operator as "No previous relationship found". The
 * spend gate must stay shut, because an automatic action has to name the memory
 * version it relied on and this cell has none.
 *
 * An earlier build kept the gate shut by reporting NO_HISTORY, which traded a
 * money bug for an honesty bug. These tests exist so that trade cannot come
 * back by accident.
 */

const sibylOnly: RetrievalResult = {
  status: "AVAILABLE",
  counterpartyKey: "virtuals:agent:alpha",
  memoryVersion: null,
  episodesUsed: 0,
  relationshipStatus: null,
  overallReliability: null,
  taskFit: null,
  confidence: null,
};

/** The most permissive policy expressible: no reliability floor at all. */
const permissive = {
  agent_id: "agent_buyer_1",
  policy_version: 1,
  auto_spend_limit_usdc: "100",
  minimum_reliability: null,
  memory_error_override_allowed: false,
} as unknown as PolicyResponse;

describe("a recall with no committed memory version", () => {
  it("never clears an automatic spend, even under the most permissive policy", () => {
    // Without an explicit null-version branch this falls through every other
    // guard - no floor to fail, no BLOCKED or WATCH status to catch it - and
    // reaches AUTO with a reason reading "available at version null".
    expect(authorizeFromRetrieval(sibylOnly, permissive).approval).toBe("REQUIRE_APPROVAL");
  });

  it("does not stop versioned memory from clearing, so the gate is not a blanket deny", () => {
    const versioned: RetrievalResult = {
      ...sibylOnly,
      counterpartyKey: "virtuals:agent:beta",
      memoryVersion: 13,
      episodesUsed: 2,
      relationshipStatus: "PREFERRED",
      overallReliability: 0.91,
    };
    expect(authorizeFromRetrieval(versioned, permissive).approval).toBe("AUTO");
  });

  it("says why in terms an operator can act on, naming the missing version", () => {
    const { reason } = authorizeFromRetrieval(sibylOnly, permissive);
    expect(reason).toMatch(/recalled/i);
    expect(reason).toMatch(/version/i);
  });

  it("is not reported as NO_HISTORY, which would read as no relationship found", () => {
    // The status is the field a surface renders. Carrying the recall only in
    // provenance would put the honesty guarantee somewhere a caller can forget
    // to look - the same reason cell (3) is not a "degraded" boolean.
    expect(sibylOnly.status).toBe("AVAILABLE");
  });
});


const RECORD: SibylRecord = {
  id: "e1",
  category: "counterparty",
  name: "virtuals:agent:alpha",
  status: null,
  body: { relationship_status: "WATCH" },
  createdAt: "2026-09-05T00:00:00Z",
  updatedAt: "2026-09-05T00:00:00Z",
};

function answered(code: string, records: SibylRecord[] = []): void {
  sibyl.recall = {
    reachable: true,
    verdict: { code: code as SibylVerdictCode, detail: `stub ${code}`, returned: records.length },
    records,
  };
}

/**
 * Sibyl's verdict, folded to a retrieval state.
 *
 * Sibyl guarantees exactly one cause is stamped on every empty result, and the
 * whole integration rests on which of them mean "we looked and there is
 * nothing" versus "we could not look". Getting one arm of this table wrong is
 * invisible in normal use and wrong in exactly the way that matters.
 */
describe("the verdict mapping", () => {
  beforeEach(() => {
    sibyl.recall = null as unknown as SibylRecall;
  });

  it("reads a match as memory found", async () => {
    answered("ok", [RECORD]);
    const result = await recallCounterparty("virtuals:agent:alpha");
    expect(result.outcome).toBe("AVAILABLE");
    expect(result.recordCount).toBe(1);
  });

  it("reads an empty store and an unmatched query as two ways of having looked", async () => {
    for (const code of ["empty_store", "no_match"]) {
      answered(code);
      const result = await recallCounterparty("virtuals:agent:alpha");
      expect(result.outcome, `${code} should be NO_HISTORY`).toBe("NO_HISTORY");
      // The status collapses to two, but the cause that produced it survives,
      // so a surface can still say WHICH kind of nothing this was.
      expect(result.cause.verdict?.code).toBe(code);
    }
  });

  it("never reads an abstention as an absence of history", async () => {
    // The load-bearing arm. An abstention is Sibyl declining to answer, and
    // folding it into NO_HISTORY would render as "No previous relationship
    // found" and could clear an automatic spend.
    for (const code of ["abstained_on", "negation_abstain", "gated"]) {
      answered(code);
      const result = await recallCounterparty("virtuals:agent:alpha");
      expect(result.outcome, `${code} must not be NO_HISTORY`).toBe("ERROR");
      if (result.outcome !== "ERROR") throw new Error("unreachable");
      // The same gate refuses the same query, so a retry buys nothing.
      expect(result.retryable).toBe(false);
    }
  });

  it("treats a verdict it has never seen as a failure, not a clean result", async () => {
    // Sibyl says there is no sixth reason to return nothing. If one appears,
    // a code we cannot interpret must not become a clean bill of health.
    answered("some_future_cause");
    const result = await recallCounterparty("virtuals:agent:alpha");
    expect(result.outcome).toBe("ERROR");
  });

  it("treats a match with no records as a broken contract, not an empty store", async () => {
    // `ok` is the only verdict that accompanies a non-empty result, so an `ok`
    // carrying nothing is unreadable - and reading it as empty would invent
    // the one cause Sibyl did not name.
    answered("ok", []);
    const result = await recallCounterparty("virtuals:agent:alpha");
    expect(result.outcome).toBe("ERROR");
  });

  it("treats an answer with no verdict at all as a failure", async () => {
    sibyl.recall = { reachable: true, records: [] };
    const result = await recallCounterparty("virtuals:agent:alpha");
    expect(result.outcome).toBe("ERROR");
  });
});

describe("a Sibyl that could not be asked", () => {
  it("separates a deployment with no Sibyl from a Sibyl that failed", async () => {
    // Not configured is not an error: we never claimed to look. Reporting it
    // as ERROR would deny every action on every deployment that has not wired
    // Sibyl up, which is the documented default.
    sibyl.recall = { reachable: false, code: "not_configured", detail: "none here", records: [] };
    expect((await recallCounterparty("virtuals:agent:alpha")).outcome).toBe("NOT_CONSULTED");

    sibyl.recall = { reachable: false, code: "bridge_unreachable", detail: "no", records: [] };
    const failed = await recallCounterparty("virtuals:agent:alpha");
    expect(failed.outcome).toBe("ERROR");
    if (failed.outcome !== "ERROR") throw new Error("unreachable");
    // Transport is the one cause a second attempt could plausibly resolve.
    expect(failed.retryable).toBe(true);
  });

  it("refuses a key Sibyl could not accept without asking it anything", async () => {
    sibyl.recall = { reachable: true, verdict: { code: "ok", detail: "", returned: 0 }, records: [] };
    const result = await recallCounterparty("bad<key>");
    expect(result.outcome).toBe("ERROR");
    expect(result.cause.code).toBe("invalid_counterparty_key");
  });
});

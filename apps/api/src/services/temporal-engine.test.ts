import { beforeEach, describe, expect, it } from "vitest";
import {
  recordEpisodeToNativeSibyl,
  resetNativeSibylStorage,
  updateNativeCounterpartyInSibyl,
} from "./native-sibyl.js";
import { reconstructCounterpartyStateAt } from "./temporal-engine.js";

describe("TemporalEngine", () => {
  beforeEach(() => {
    resetNativeSibylStorage();
  });

  it("returns null for non-existent counterparty", () => {
    const result = reconstructCounterpartyStateAt("virtuals:agent:unknown", "2026-09-01T00:00:00Z");
    expect(result).toBeNull();
  });

  it("reconstructs past state at episode index 0 (unobserved prior)", () => {
    const key = "virtuals:agent:alpha";
    updateNativeCounterpartyInSibyl(key, {
      relationshipStatus: "WATCH",
      overallReliability: 0.3333,
      confidence: 0.1667,
      consecutiveFailures: 1,
      totalMissions: 1,
    });
    recordEpisodeToNativeSibyl(key, {
      run: "run-1",
      outcome: "rejected",
      note: "Failed verification",
      occurredAt: "2026-09-02T12:00:00Z",
    });

    const atZero = reconstructCounterpartyStateAt(key, 0);
    expect(atZero).not.toBeNull();
    expect(atZero?.asOfType).toBe("episode_index");
    expect(atZero?.historicalState.relationshipStatus).toBe("NEW");
    expect(atZero?.historicalState.overallReliability).toBe(0.5);
    expect(atZero?.historicalState.confidence).toBe(0.0);
    expect(atZero?.historicalState.episodesCount).toBe(0);

    expect(atZero?.currentState.relationshipStatus).toBe("WATCH");
    expect(atZero?.delta.statusChanged).toBe(true);
    expect(atZero?.delta.pastStatus).toBe("NEW");
    expect(atZero?.delta.currentStatus).toBe("WATCH");
  });

  it("reconstructs progressive transitions NEW -> WATCH -> BLOCKED at timestamps and indices", () => {
    const key = "virtuals:agent:timeline";

    const t0 = "2026-09-01T00:00:00Z";
    const t1 = "2026-09-02T00:00:00Z";
    const t2 = "2026-09-03T00:00:00Z";

    // Episode 1: Failure at t1
    recordEpisodeToNativeSibyl(key, {
      run: "run-1",
      outcome: "rejected",
      note: "Citation error",
      occurredAt: t1,
    });

    // Episode 2: 2nd consecutive failure at t2
    recordEpisodeToNativeSibyl(key, {
      run: "run-2",
      outcome: "rejected",
      note: "Citation error again",
      occurredAt: t2,
    });

    // At t0: before any mission occurred
    const stateAtT0 = reconstructCounterpartyStateAt(key, t0);
    expect(stateAtT0?.historicalState.relationshipStatus).toBe("NEW");
    expect(stateAtT0?.historicalState.episodesCount).toBe(0);

    // At index 1 (after 1st failure): status should be WATCH
    const stateAtEp1 = reconstructCounterpartyStateAt(key, 1);
    expect(stateAtEp1?.historicalState.relationshipStatus).toBe("WATCH");
    expect(stateAtEp1?.historicalState.consecutiveFailures).toBe(1);
    expect(stateAtEp1?.historicalState.episodesCount).toBe(1);

    // At index 2 (after 2nd failure in WATCH): status transitions to BLOCKED
    const stateAtEp2 = reconstructCounterpartyStateAt(key, 2);
    expect(stateAtEp2?.historicalState.relationshipStatus).toBe("BLOCKED");
    expect(stateAtEp2?.historicalState.consecutiveFailures).toBe(2);
    expect(stateAtEp2?.historicalState.episodesCount).toBe(2);

    // Comparing ep 1 against ep 2
    expect(stateAtEp1?.delta.pastStatus).toBe("WATCH");
    expect(stateAtEp1?.delta.currentStatus).toBe("BLOCKED");
    expect(stateAtEp1?.delta.statusChanged).toBe(true);
  });

  it("handles numeric epoch timestamps and rejects invalid date strings", () => {
    const key = "virtuals:agent:epoch";
    const nowEpoch = 1788259200000; // 2026-09-01T10:40:00.000Z
    recordEpisodeToNativeSibyl(key, {
      run: "run-99",
      outcome: "accepted",
      occurredAt: new Date(nowEpoch).toISOString(),
    });

    const result = reconstructCounterpartyStateAt(key, nowEpoch + 1000);
    expect(result).not.toBeNull();
    expect(result?.asOfType).toBe("timestamp");
    expect(result?.historicalState.relationshipStatus).toBe("KNOWN");

    expect(() => reconstructCounterpartyStateAt(key, "not-a-date")).toThrow(
      /Invalid asOf temporal parameter/,
    );
  });
});

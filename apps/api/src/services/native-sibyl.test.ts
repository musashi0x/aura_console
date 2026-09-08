import { describe, expect, it } from "vitest";

import {
  getNativeEntity,
  getNativeSibylStatus,
  listNativeCounterpartiesFromSibyl,
  recallNativeEntities,
  recordEpisodeToNativeSibyl,
  retrieveNativeFromSibyl,
  updateNativeCounterpartyInSibyl,
} from "./native-sibyl.js";

describe("embedded native Sibyl memory store", () => {
  it("reports healthy status with embedded tier and schema version 4", () => {
    const status = getNativeSibylStatus();
    expect(status.configured).toBe(true);
    expect(status.reachable).toBe(true);
    expect(status.tier).toBe("embedded");
    expect(status.schemaVersion).toBe(4);
    expect(status.entityCount).toBeGreaterThanOrEqual(2);
  });

  it("retrieves native entity by category and name", () => {
    const lookup = getNativeEntity("counterparty", "virtuals:agent:alpha");
    expect(lookup.reachable).toBe(true);
    expect(lookup.record?.name).toBe("virtuals:agent:alpha");
  });

  it("retrieves Alpha Research fixture with correct reliability and watch status", () => {
    const alpha = retrieveNativeFromSibyl("virtuals:agent:alpha");
    expect(alpha.status).toBe("AVAILABLE");
    if (alpha.status === "AVAILABLE") {
      expect(alpha.displayName).toBe("Alpha Research");
      expect(alpha.relationshipStatus).toBe("WATCH");
      expect(alpha.overallReliability).toBe(0.42);
      expect(alpha.taskFit).toBe(0.71);
      expect(alpha.confidence).toBe(0.88);
      expect(alpha.episodesUsed).toBe(2);
      expect(alpha.isFixture).toBe(true);
    }
  });

  it("retrieves Beta Labs fixture with correct reliability and preferred status", () => {
    const beta = retrieveNativeFromSibyl("virtuals:agent:beta");
    expect(beta.status).toBe("AVAILABLE");
    if (beta.status === "AVAILABLE") {
      expect(beta.displayName).toBe("Beta Labs");
      expect(beta.relationshipStatus).toBe("PREFERRED");
      expect(beta.overallReliability).toBe(0.91);
      expect(beta.taskFit).toBe(0.83);
      expect(beta.confidence).toBe(0.90);
      expect(beta.episodesUsed).toBe(2);
      expect(beta.isFixture).toBe(true);
    }
  });

  it("returns NO_HISTORY for an unknown counterparty", () => {
    const unknown = retrieveNativeFromSibyl("virtuals:agent:unregistered-agent");
    expect(unknown.status).toBe("NO_HISTORY");
  });

  it("lists all counterparties with metrics and episodes", () => {
    const listing = listNativeCounterpartiesFromSibyl();
    expect(listing.ok).toBe(true);
    if (listing.ok) {
      expect(listing.items.length).toBeGreaterThanOrEqual(2);
      const keys = listing.items.map((i) => i.counterpartyKey);
      expect(keys).toContain("virtuals:agent:alpha");
      expect(keys).toContain("virtuals:agent:beta");
    }
  });

  it("recalls matching entities by keyword with ok verdict", () => {
    const recall = recallNativeEntities("Alpha");
    expect(recall.reachable).toBe(true);
    expect(recall.verdict?.code).toBe("ok");
    expect(recall.records.length).toBeGreaterThanOrEqual(1);
    expect(recall.records[0]?.name).toBe("virtuals:agent:alpha");
  });

  it("returns no_match verdict for queries with zero matches", () => {
    const recall = recallNativeEntities("nonexistent-arbitrary-token-xyz-12345");
    expect(recall.reachable).toBe(true);
    expect(recall.verdict?.code).toBe("no_match");
    expect(recall.records).toHaveLength(0);
  });

  it("records an episode and retrieves updated count", () => {
    const res = recordEpisodeToNativeSibyl("virtuals:agent:alpha", {
      run: "run_test_001",
      taskType: "market-research",
      outcome: "accepted",
      note: "Delivered smoothly in test run.",
    });
    expect(res.ok).toBe(true);
    expect(res.eventId).toBeDefined();
    expect(res.episodesCount).toBeGreaterThanOrEqual(3);

    const updated = retrieveNativeFromSibyl("virtuals:agent:alpha");
    expect(updated.status).toBe("AVAILABLE");
    if (updated.status === "AVAILABLE") {
      expect(updated.episodesUsed).toBe(res.episodesCount);
    }
  });

  it("updates relationship status and reliability scores", () => {
    const updateRes = updateNativeCounterpartyInSibyl("virtuals:agent:alpha", {
      relationshipStatus: "KNOWN",
      overallReliability: 0.65,
    });
    expect(updateRes.ok).toBe(true);

    const updated = retrieveNativeFromSibyl("virtuals:agent:alpha");
    expect(updated.status).toBe("AVAILABLE");
    if (updated.status === "AVAILABLE") {
      expect(updated.relationshipStatus).toBe("KNOWN");
      expect(updated.overallReliability).toBe(0.65);
    }
  });
});

import { beforeEach, describe, expect, it } from "vitest";

import {
  archiveNativeCounterpartyInSibyl,
  closeNativeSibylDatabase,
  getNativeEntity,
  getNativeMissionState,
  getNativePolicyReference,
  getNativeSibylStatus,
  listNativeCounterpartiesFromSibyl,
  readNativeMemoryJournal,
  recallNativeEntities,
  recordEpisodeToNativeSibyl,
  resetNativeSibylStorage,
  retrieveNativeFromSibyl,
  setNativeMissionState,
  setNativePolicyReference,
  updateNativeCounterpartyInSibyl,
} from "./native-sibyl.js";

describe("embedded native Sibyl memory store", () => {
  beforeEach(() => {
    resetNativeSibylStorage({ seedFixtures: true });
  });

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

  it("stores and retrieves mission state", () => {
    const setRes = setNativeMissionState("mission_001", { step: "routing", counterparty: "beta" });
    expect(setRes.ok).toBe(true);

    const getRes = getNativeMissionState("mission_001");
    expect(getRes.ok).toBe(true);
    expect(getRes.state).toEqual({ step: "routing", counterparty: "beta" });
  });

  it("stores and retrieves policy references", () => {
    const setRes = setNativePolicyReference("policy_ref_001", { maxSpend: "50", allowed: true });
    expect(setRes.ok).toBe(true);

    const getRes = getNativePolicyReference("policy_ref_001");
    expect(getRes.ok).toBe(true);
    expect(getRes.reference).toEqual({ maxSpend: "50", allowed: true });
  });

  it("archives counterparty and updates its status", () => {
    const archiveRes = archiveNativeCounterpartyInSibyl("virtuals:agent:alpha", "test_archive_reason");
    expect(archiveRes.ok).toBe(true);
    const lookup = getNativeEntity("counterparty", "virtuals:agent:alpha");
    expect(lookup.record?.status).toBe("ARCHIVED");
  });

  it("reads memory journal returning events and episodes", () => {
    const journal = readNativeMemoryJournal(10);
    expect(journal.ok).toBe(true);
    expect(journal.count).toBeGreaterThanOrEqual(1);
    expect(journal.events.length).toBeGreaterThanOrEqual(1);
  });

  it("persists state across database connection close and reopen", () => {
    updateNativeCounterpartyInSibyl("virtuals:agent:alpha", {
      relationshipStatus: "PREFERRED",
      overallReliability: 0.95,
    });
    closeNativeSibylDatabase();

    const reloaded = retrieveNativeFromSibyl("virtuals:agent:alpha");
    expect(reloaded.status).toBe("AVAILABLE");
    if (reloaded.status === "AVAILABLE") {
      expect(reloaded.relationshipStatus).toBe("PREFERRED");
      expect(reloaded.overallReliability).toBe(0.95);
    }
  });

  it("persists and rehydrates extended Bayesian reputation state", () => {
    const updateRes = updateNativeCounterpartyInSibyl("virtuals:agent:alpha", {
      alpha: 7.5,
      beta: 2.5,
      consecutiveFailures: 3,
      totalMissions: 10,
      blockedReason: "Repeated verification timeouts",
    });
    expect(updateRes.ok).toBe(true);

    const reloaded = retrieveNativeFromSibyl("virtuals:agent:alpha");
    expect(reloaded.status).toBe("AVAILABLE");
    if (reloaded.status === "AVAILABLE") {
      expect(reloaded.alpha).toBe(7.5);
      expect(reloaded.beta).toBe(2.5);
      expect(reloaded.consecutiveFailures).toBe(3);
      expect(reloaded.totalMissions).toBe(10);
      expect(reloaded.blockedReason).toBe("Repeated verification timeouts");
    }

    const listed = listNativeCounterpartiesFromSibyl();
    expect(listed.ok).toBe(true);
    if (listed.ok) {
      const alphaItem = listed.items.find((i) => i.counterpartyKey === "virtuals:agent:alpha");
      expect(alphaItem?.alpha).toBe(7.5);
      expect(alphaItem?.beta).toBe(2.5);
      expect(alphaItem?.consecutiveFailures).toBe(3);
      expect(alphaItem?.totalMissions).toBe(10);
      expect(alphaItem?.blockedReason).toBe("Repeated verification timeouts");
    }
  });

  it("returns NO_HISTORY when store is reset with seedFixtures: false", () => {
    const resetRes = resetNativeSibylStorage({ seedFixtures: false });
    expect(resetRes.ok).toBe(true);
    expect(resetRes.entityCount).toBe(0);

    const retrieval = retrieveNativeFromSibyl("virtuals:agent:alpha");
    expect(retrieval.status).toBe("NO_HISTORY");
    if (retrieval.status === "NO_HISTORY") {
      expect(retrieval.counterpartyKey).toBe("virtuals:agent:alpha");
      expect(retrieval.overallReliability).toBe(0.5);
      expect(retrieval.confidence).toBe(0.0);
      expect(retrieval.episodesUsed).toBe(0);
    }
  });
});

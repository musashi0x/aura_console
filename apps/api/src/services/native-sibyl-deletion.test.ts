import { existsSync, unlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  DEFAULT_UNOBSERVED_PRIORS,
  closeNativeSibylDatabase,
  getNativeSibylStatus,
  listNativeCounterpartiesFromSibyl,
  recallNativeEntities,
  recordEpisodeToNativeSibyl,
  resetNativeSibylStorage,
  retrieveNativeFromSibyl,
} from "./native-sibyl.js";

describe("Native Sibyl Storage Deletion & Reset Semantics", () => {
  let customDbPath: string;

  beforeEach(() => {
    customDbPath = path.join(os.tmpdir(), `aura-deletion-test-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
    process.env.AURA_NATIVE_STORAGE_PATH = customDbPath;
    resetNativeSibylStorage({ seedFixtures: true });
  });

  afterEach(() => {
    resetNativeSibylStorage({ seedFixtures: false });
    closeNativeSibylDatabase();
    delete process.env.AURA_NATIVE_STORAGE_PATH;
    for (const ext of ["", "-wal", "-shm", "-journal"]) {
      const p = customDbPath + ext;
      if (existsSync(p)) {
        try {
          unlinkSync(p);
        } catch {
          // ignore
        }
      }
    }
  });

  it("resets store cleanly to 0 entities when seedFixtures is false", () => {
    const resetResult = resetNativeSibylStorage({ seedFixtures: false });
    expect(resetResult.ok).toBe(true);
    expect(resetResult.entityCount).toBe(0);

    const status = getNativeSibylStatus();
    expect(status.entityCount).toBe(0);

    const counterparties = listNativeCounterpartiesFromSibyl();
    expect(counterparties.ok).toBe(true);
    if (counterparties.ok) {
      expect(counterparties.items).toHaveLength(0);
    }

    const recall = recallNativeEntities("Alpha");
    expect(recall.reachable).toBe(true);
    expect(recall.verdict?.code).toBe("empty_store");
    expect(recall.records).toHaveLength(0);
  });

  it("returns NO_HISTORY with default priors (0.5 reliability, 0.0 confidence, 0 episodes) for unobserved/reset entity", () => {
    resetNativeSibylStorage({ seedFixtures: false });

    const retrieval = retrieveNativeFromSibyl("virtuals:agent:alpha");
    expect(retrieval.status).toBe("NO_HISTORY");
    if (retrieval.status === "NO_HISTORY") {
      expect(retrieval.counterpartyKey).toBe("virtuals:agent:alpha");
      expect(retrieval.overallReliability).toBe(DEFAULT_UNOBSERVED_PRIORS.overallReliability);
      expect(retrieval.overallReliability).toBe(0.5);
      expect(retrieval.confidence).toBe(DEFAULT_UNOBSERVED_PRIORS.confidence);
      expect(retrieval.confidence).toBe(0.0);
      expect(retrieval.episodesUsed).toBe(0);
    }
  });

  it("handles hot unlinking on disk while process is running without throwing unhandled exceptions", () => {
    expect(existsSync(customDbPath)).toBe(true);

    // Unlink the file from disk while service is running
    unlinkSync(customDbPath);
    expect(existsSync(customDbPath)).toBe(false);

    // Queries must succeed cleanly and report NO_HISTORY without throwing
    expect(() => getNativeSibylStatus()).not.toThrow();
    expect(getNativeSibylStatus().entityCount).toBe(0);

    expect(() => retrieveNativeFromSibyl("virtuals:agent:alpha")).not.toThrow();
    const retrieval = retrieveNativeFromSibyl("virtuals:agent:alpha");
    expect(retrieval.status).toBe("NO_HISTORY");
    if (retrieval.status === "NO_HISTORY") {
      expect(retrieval.overallReliability).toBe(0.5);
      expect(retrieval.confidence).toBe(0.0);
      expect(retrieval.episodesUsed).toBe(0);
    }

    expect(() => listNativeCounterpartiesFromSibyl()).not.toThrow();
    const listing = listNativeCounterpartiesFromSibyl();
    expect(listing.ok).toBe(true);
    if (listing.ok) {
      expect(listing.items).toHaveLength(0);
    }

    // Read must not resurrect the file on disk
    expect(existsSync(customDbPath)).toBe(false);
  });

  it("automatically recovers and recreates database on write after hot unlinking", () => {
    unlinkSync(customDbPath);
    expect(existsSync(customDbPath)).toBe(false);

    const recordResult = recordEpisodeToNativeSibyl("virtuals:agent:gamma", {
      run: "run_recreated_001",
      outcome: "accepted",
      note: "Auto-recreated write test",
    });

    expect(recordResult.ok).toBe(true);
    expect(recordResult.episodesCount).toBe(1);
    expect(existsSync(customDbPath)).toBe(true);

    const gamma = retrieveNativeFromSibyl("virtuals:agent:gamma");
    expect(gamma.status).toBe("AVAILABLE");
    if (gamma.status === "AVAILABLE") {
      expect(gamma.episodesUsed).toBe(1);
    }
  });

  it("safely handles corrupted database file without throwing unhandled exceptions", () => {
    closeNativeSibylDatabase();
    writeFileSync(customDbPath, "CORRUPTED_BINARY_JUNK_NOT_SQLITE");

    expect(() => getNativeSibylStatus()).not.toThrow();
    expect(getNativeSibylStatus().entityCount).toBe(0);

    expect(() => retrieveNativeFromSibyl("virtuals:agent:alpha")).not.toThrow();
    expect(retrieveNativeFromSibyl("virtuals:agent:alpha").status).toBe("NO_HISTORY");

    // Clean reset must be able to recover from a corrupted file
    const reset = resetNativeSibylStorage({ seedFixtures: true });
    expect(reset.ok).toBe(true);
    expect(reset.entityCount).toBe(2);
  });
});

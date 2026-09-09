import { existsSync, unlinkSync, writeFileSync } from "node:fs";
import crypto from "node:crypto";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  DEFAULT_UNOBSERVED_PRIORS,
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
import { RunStore } from "./run-store.js";
import { MissionAgent } from "./mission-agent.js";

describe("Adversarial Stress Verification — Storage Deletion, Hot Unlinking & Corruption", () => {
  let customDbPath: string;

  beforeEach(() => {
    customDbPath = path.join(
      os.tmpdir(),
      `aura-adversarial-${Date.now()}-${Math.random().toString(36).slice(2)}.db`,
    );
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

  describe("1. Rapid Interleaved Reads/Writes with Mid-Flight Hot Unlinking", () => {
    it("survives rapid interleaved reads and writes when the db file is abruptly unlinked", () => {
      // Seed initial data
      for (let i = 0; i < 20; i++) {
        recordEpisodeToNativeSibyl(`agent_${i % 5}`, {
          run: `run_seed_${i}`,
          outcome: i % 2 === 0 ? "accepted" : "rejected",
          note: `Seed event ${i}`,
        });
      }

      const initialStatus = getNativeSibylStatus();
      expect(initialStatus.entityCount).toBeGreaterThanOrEqual(2);

      let unlinked = false;
      const readErrors: Error[] = [];
      const writeErrors: Error[] = [];

      // Interleaved stress loop
      for (let i = 0; i < 100; i++) {
        // Trigger hot unlinking halfway through
        if (i === 50) {
          try {
            unlinkSync(customDbPath);
            unlinked = true;
          } catch {
            // Already unlinked
          }
        }

        // Concurrent reads across all query types
        try {
          retrieveNativeFromSibyl(`agent_${i % 5}`);
          getNativeSibylStatus();
          listNativeCounterpartiesFromSibyl();
          recallNativeEntities("agent");
          getNativeMissionState(`state_${i}`);
          getNativePolicyReference(`policy_${i}`);
          readNativeMemoryJournal(10);
        } catch (err) {
          readErrors.push(err as Error);
        }

        // Concurrent writes across all mutation types
        try {
          recordEpisodeToNativeSibyl(`agent_${i % 5}`, {
            run: `run_stress_${i}`,
            outcome: "accepted",
            note: `Interleaved stress ${i}`,
          });

          updateNativeCounterpartyInSibyl(`agent_${i % 5}`, {
            overallReliability: 0.85,
            confidence: 0.9,
          });
          setNativeMissionState(`state_${i}`, { step: i });
          setNativePolicyReference(`policy_${i}`, { rule: "always_verify" });
        } catch (err) {
          writeErrors.push(err as Error);
        }
      }

      // Assertions:
      // Zero unhandled exceptions thrown across 100 rapid operations
      expect(readErrors).toHaveLength(0);
      expect(writeErrors).toHaveLength(0);
      expect(unlinked).toBe(true);

      // Subsequent writes after unlinking cleanly re-created the db
      expect(existsSync(customDbPath)).toBe(true);

      // Database is fully functional and queryable
      const finalStatus = getNativeSibylStatus();
      expect(finalStatus.reachable).toBe(true);
      expect(finalStatus.entityCount).toBeGreaterThan(0);
    });

    it("ensures reads immediately after unlinking return NO_HISTORY with uninformative priors without resurrecting the db file", () => {
      expect(existsSync(customDbPath)).toBe(true);

      const initialAlpha = retrieveNativeFromSibyl("virtuals:agent:alpha");
      expect(initialAlpha.status).toBe("AVAILABLE");

      // Unlink the SQLite file
      unlinkSync(customDbPath);
      expect(existsSync(customDbPath)).toBe(false);

      // Perform multiple read operations
      const alphaAfter = retrieveNativeFromSibyl("virtuals:agent:alpha");
      expect(alphaAfter.status).toBe("NO_HISTORY");
      if (alphaAfter.status === "NO_HISTORY") {
        expect(alphaAfter.overallReliability).toBe(DEFAULT_UNOBSERVED_PRIORS.overallReliability);
        expect(alphaAfter.overallReliability).toBe(0.5);
        expect(alphaAfter.confidence).toBe(DEFAULT_UNOBSERVED_PRIORS.confidence);
        expect(alphaAfter.confidence).toBe(0.0);
        expect(alphaAfter.episodesUsed).toBe(0);
      }

      const betaAfter = retrieveNativeFromSibyl("virtuals:agent:beta");
      expect(betaAfter.status).toBe("NO_HISTORY");
      if (betaAfter.status === "NO_HISTORY") {
        expect(betaAfter.overallReliability).toBe(0.5);
      }

      const lookup = getNativeEntity("counterparty", "virtuals:agent:alpha");
      expect(lookup.code).toBe("entity_absent");

      const journal = readNativeMemoryJournal();
      expect(journal.count).toBe(0);
      expect(journal.events).toHaveLength(0);

      const counterparties = listNativeCounterpartiesFromSibyl();
      expect(counterparties.ok).toBe(true);
      if (counterparties.ok) {
        expect(counterparties.items).toHaveLength(0);
      }

      // CRITICAL INVARIANT: pure read operations must NEVER resurrect the deleted file on disk
      expect(existsSync(customDbPath)).toBe(false);
    });

    it("ensures subsequent writes after hot unlinking cleanly recreate schema without readonly errors and allow full read-back", () => {
      unlinkSync(customDbPath);
      expect(existsSync(customDbPath)).toBe(false);

      // Perform a write
      const writeResult = recordEpisodeToNativeSibyl("virtuals:agent:reborn", {
        run: "run_phoenix_001",
        outcome: "accepted",
        note: "Phoenix resurrection test",
      });

      expect(writeResult.ok).toBe(true);
      expect(existsSync(customDbPath)).toBe(true);

      // Verify schema is intact and we can read it back immediately
      const reborn = retrieveNativeFromSibyl("virtuals:agent:reborn");
      expect(reborn.status).toBe("AVAILABLE");
      if (reborn.status === "AVAILABLE") {
        expect(reborn.episodesUsed).toBe(1);
      }

      // Update counterparty
      const updateResult = updateNativeCounterpartyInSibyl("virtuals:agent:reborn", {
        relationshipStatus: "PREFERRED",
        overallReliability: 0.95,
        confidence: 0.99,
        consecutiveFailures: 0,
        totalMissions: 1,
      });
      expect(updateResult.ok).toBe(true);

      const rebornUpdated = retrieveNativeFromSibyl("virtuals:agent:reborn");
      expect(rebornUpdated.status).toBe("AVAILABLE");
      if (rebornUpdated.status === "AVAILABLE") {
        expect(rebornUpdated.relationshipStatus).toBe("PREFERRED");
        expect(rebornUpdated.overallReliability).toBe(0.95);
        expect(rebornUpdated.confidence).toBe(0.99);
        expect(rebornUpdated.consecutiveFailures).toBe(0);
        expect(rebornUpdated.totalMissions).toBe(1);
      }
    });
  });

  describe("2. Orphan WAL / SHM Resilience", () => {
    it("handles deletion of the main .db file while leaving stale -wal and -shm files intact", () => {
      // Write data to ensure WAL exists
      for (let i = 0; i < 10; i++) {
        recordEpisodeToNativeSibyl(`wal_agent_${i}`, {
          run: `run_wal_${i}`,
          outcome: "accepted",
          note: "WAL check",
        });
      }

      closeNativeSibylDatabase();

      // Only delete the .db file, leaving -wal and -shm if they exist
      if (existsSync(customDbPath)) {
        unlinkSync(customDbPath);
      }
      expect(existsSync(customDbPath)).toBe(false);

      // Reads should return NO_HISTORY without crashing
      const readRes = retrieveNativeFromSibyl("wal_agent_0");
      expect(readRes.status).toBe("NO_HISTORY");
      if (readRes.status === "NO_HISTORY") {
        expect(readRes.overallReliability).toBe(0.5);
      }

      // Writes should recreate the database without throwing WAL mismatch errors
      const writeRes = recordEpisodeToNativeSibyl("wal_new_agent", {
        run: "run_wal_new",
        outcome: "accepted",
        note: "Post-orphan-WAL write",
      });
      expect(writeRes.ok).toBe(true);

      const verifyRes = retrieveNativeFromSibyl("wal_new_agent");
      expect(verifyRes.status).toBe("AVAILABLE");
      if (verifyRes.status === "AVAILABLE") {
        expect(verifyRes.episodesUsed).toBe(1);
      }
    });
  });

  describe("3. Binary Garbage & Data Corruption Recovery", () => {
    it("safely handles arbitrary binary noise without unhandled process termination", () => {
      closeNativeSibylDatabase();

      // Overwrite db file with 8KB of purely random cryptographic binary garbage
      const randomGarbage = crypto.randomBytes(8192);
      writeFileSync(customDbPath, randomGarbage);

      // 1. Status query returns storage error or inactive without crashing
      expect(() => getNativeSibylStatus()).not.toThrow();
      const status = getNativeSibylStatus();
      expect(status.entityCount).toBe(0);

      // 2. Read queries catch corruption and return NO_HISTORY
      expect(() => retrieveNativeFromSibyl("virtuals:agent:alpha")).not.toThrow();
      const alpha = retrieveNativeFromSibyl("virtuals:agent:alpha");
      expect(alpha.status).toBe("NO_HISTORY");
      if (alpha.status === "NO_HISTORY") {
        expect(alpha.overallReliability).toBe(0.5);
      }

      expect(() => listNativeCounterpartiesFromSibyl()).not.toThrow();
      const listing = listNativeCounterpartiesFromSibyl();
      expect(listing.ok).toBe(true);
      if (listing.ok) {
        expect(listing.items).toHaveLength(0);
      }

      expect(() => recallNativeEntities("alpha")).not.toThrow();
      const recall = recallNativeEntities("alpha");
      expect(recall.records).toHaveLength(0);

      expect(() => getNativeMissionState("foo")).not.toThrow();
      const missionState = getNativeMissionState("foo");
      expect(missionState.ok).toBe(true);
      expect(missionState.state).toBeUndefined();

      expect(() => getNativePolicyReference("bar")).not.toThrow();
      const policy = getNativePolicyReference("bar");
      expect(policy.ok).toBe(true);
      expect(policy.reference).toBeNull();

      expect(() => readNativeMemoryJournal()).not.toThrow();
      const journal = readNativeMemoryJournal();
      expect(journal.count).toBe(0);

      // 3. Write operations fail gracefully with storage_unavailable instead of throwing uncaught exceptions
      expect(() =>
        recordEpisodeToNativeSibyl("virtuals:agent:alpha", {
          run: "corrupt_write",
          outcome: "accepted",
        }),
      ).not.toThrow();
      const writeOutcome = recordEpisodeToNativeSibyl("virtuals:agent:alpha", {
        run: "corrupt_write",
        outcome: "accepted",
      });
      expect(writeOutcome.ok).toBe(false);
      expect(writeOutcome.code).toBe("storage_unavailable");

      // 4. resetNativeSibylStorage successfully recovers the store
      const reset = resetNativeSibylStorage({ seedFixtures: true });
      expect(reset.ok).toBe(true);
      expect(reset.entityCount).toBeGreaterThanOrEqual(2);

      const recoveredAlpha = retrieveNativeFromSibyl("virtuals:agent:alpha");
      expect(recoveredAlpha.status).toBe("AVAILABLE");
      if (recoveredAlpha.status === "AVAILABLE") {
        expect(recoveredAlpha.overallReliability).toBe(0.42);
      }
    });

    it("safely handles truncated SQLite header (16 bytes) and zero-length file", () => {
      closeNativeSibylDatabase();

      // Case A: Truncated SQLite header (corrupted file)
      writeFileSync(customDbPath, "SQLite format 3\0");
      expect(() => retrieveNativeFromSibyl("virtuals:agent:alpha")).not.toThrow();
      expect(retrieveNativeFromSibyl("virtuals:agent:alpha").status).toBe("NO_HISTORY");

      // Case B: Zero-length file with auto-seed disabled
      closeNativeSibylDatabase();
      process.env.SIBYL_SEED_FIXTURES = "false";
      writeFileSync(customDbPath, "");
      expect(() => retrieveNativeFromSibyl("virtuals:agent:alpha")).not.toThrow();
      expect(retrieveNativeFromSibyl("virtuals:agent:alpha").status).toBe("NO_HISTORY");

      delete process.env.SIBYL_SEED_FIXTURES;

      // Reset recovery
      const reset = resetNativeSibylStorage({ seedFixtures: true });
      expect(reset.ok).toBe(true);
      expect(retrieveNativeFromSibyl("virtuals:agent:alpha").status).toBe("AVAILABLE");
    });
  });

  describe("4. Multi-Process Child Process Hot Unlinking Stress Test", () => {
    it("handles hot unlinking of the database file while a child process is actively executing", async () => {
      const modulePath = path.resolve(__dirname, "native-sibyl.js");
      const runnerCode = `
        import { retrieveNativeFromSibyl, recordEpisodeToNativeSibyl } from ${JSON.stringify(modulePath)};
        for (let i = 0; i < 60; i++) {
          try {
            retrieveNativeFromSibyl("virtuals:agent:alpha");
            recordEpisodeToNativeSibyl("child_agent", { run: "child_" + i, outcome: "accepted" });
          } catch (e) {
            console.error(e);
            process.exit(2);
          }
        }
        process.exit(0);
      `;

      const tsxBin = path.resolve(process.cwd(), "node_modules/.bin/tsx");
      const tmpChildFile = path.join(os.tmpdir(), `child-stress-${Date.now()}.ts`);
      writeFileSync(tmpChildFile, runnerCode);

      try {
        const proc = spawn(tsxBin, [tmpChildFile], {
          cwd: process.cwd(),
          env: {
            ...process.env,
            AURA_NATIVE_STORAGE_PATH: customDbPath,
          },
          stdio: "pipe",
        });

        let childStderr = "";
        proc.stderr.on("data", (d) => {
          childStderr += d.toString();
        });

        // While child is running, unlink the database file after 20ms
        await new Promise((resolve) => setTimeout(resolve, 20));
        if (existsSync(customDbPath)) {
          try {
            unlinkSync(customDbPath);
          } catch {
            // Already unlinked
          }
        }

        const exitCode = await new Promise<number | null>((resolve) => {
          proc.on("exit", (code) => resolve(code));
        });

        if (exitCode !== 0) {
          console.error("Child process stderr:", childStderr);
        }

        // Child process must exit cleanly (code 0) without throwing unhandled exceptions
        expect(exitCode).toBe(0);
      } finally {
        if (existsSync(tmpChildFile)) {
          try {
            unlinkSync(tmpChildFile);
          } catch {
            // ignore
          }
        }
      }
    });
  });

    it("archives counterparty and sets archive reason cleanly", () => {
      const archiveResult = archiveNativeCounterpartyInSibyl("virtuals:agent:alpha", "manual_operator_ban");
      expect(archiveResult.ok).toBe(true);

      const entity = getNativeEntity("counterparty", "virtuals:agent:alpha");
      expect(entity.record?.status).toBe("ARCHIVED");
    });

  describe("5. Fail-Closed Invariant & Deletion Test Behavior", () => {
    it("strictly blocks mission execution when memory is disabled (fail-closed invariant)", async () => {
      const store = new RunStore();
      const agent = new MissionAgent(store);

      process.env.SIBYL_PYTHON = "";
      process.env.SIBYL_DISABLE_NATIVE = "true";

      const run = await store.createRun({
        objective: "Adversarial Deletion Test (Memory Disabled)",
        source: "CONSOLE",
        budgetUsdc: "10.000000",
      });

      const result = await agent.openMission({
        runId: run.id,
        budgetUsdc: run.budgetUsdc,
      });

      expect(result.status).toBe("BLOCKED");

      const events = await store.listEvents(run.id);
      const isBlocked = events.some((e) => e.type === "run.blocked");
      const hasScored = events.some((e) => e.type === "candidate.scored");

      expect(isBlocked).toBe(true);
      expect(hasScored).toBe(false);

      // Clean up env
      delete process.env.SIBYL_DISABLE_NATIVE;
    });

    it("proceeds with candidate scoring and approval request when memory is enabled", async () => {
      delete process.env.SIBYL_DISABLE_NATIVE;
      delete process.env.SIBYL_PYTHON; // uses native durable

      const store = new RunStore();
      const agent = new MissionAgent(store);

      const run = await store.createRun({
        objective: "Adversarial Deletion Test (Memory Active)",
        source: "CONSOLE",
        budgetUsdc: "10.000000",
      });

      const result = await agent.openMission({
        runId: run.id,
        budgetUsdc: run.budgetUsdc,
      });

      expect(result.status).toBe("SCORED");

      const events = await store.listEvents(run.id);
      const hasRetrieved = events.some((e) => e.type === "memory.retrieved");
      const hasScored = events.some((e) => e.type === "candidate.scored");
      const hasApproval = events.some((e) => e.type === "approval.requested");
      const isBlocked = events.some((e) => e.type === "run.blocked");

      expect(hasRetrieved).toBe(true);
      expect(hasScored).toBe(true);
      expect(hasApproval).toBe(true);
      expect(isBlocked).toBe(false);
    });
  });
});

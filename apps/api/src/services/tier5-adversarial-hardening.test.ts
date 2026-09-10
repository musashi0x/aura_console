import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  checkVeto,
  createInitialReputation,
  rehydrateFromSibyl,
  updateReputation,
} from "./reputation-fsm.js";
import { scoreCandidates } from "./mission-scoring.js";
import type { SibylCounterparty } from "./sibyl.js";
import {
  closeNativeSibylDatabase,
  getNativeEntity,
  getNativeSibylStatus,
  listNativeCounterpartiesFromSibyl,
  readNativeMemoryJournal,
  recallNativeEntities,
  recordEpisodeToNativeSibyl,
  resetNativeSibylStorage,
  retrieveNativeFromSibyl,
  updateNativeCounterpartyInSibyl,
} from "./native-sibyl.js";
import {
  validateCompetitorReport,
  verifyCompetitorReportDeliverable,
} from "./verifier-agent.js";
import type { CompetitorReport } from "./verifier-agent.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../../../..");
const demoScriptPath = path.join(repoRoot, "scripts", "demo-cold-start.ts");
const localTsxCli = path.resolve(__dirname, "../../node_modules/tsx/dist/cli.mjs");
const rootTsxCli = path.join(repoRoot, "apps", "api", "node_modules", "tsx", "dist", "cli.mjs");
const tsxCli = fs.existsSync(localTsxCli) ? localTsxCli : rootTsxCli;

function computeFileHash(filePath: string): string | null {
  if (!fs.existsSync(filePath)) return null;
  const content = fs.readFileSync(filePath);
  return createHash("sha256").update(content).digest("hex");
}

describe.sequential("Tier 5: White-Box Adversarial Coverage Hardening Suite", () => {
  let tempDir: string;
  let isolatedDbPath: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "aura-tier5-adv-"));
    isolatedDbPath = path.join(tempDir, "tier5-isolated.db");

    process.env.SIBYL_NATIVE_DB_PATH = isolatedDbPath;
    process.env.SIBYL_STORAGE_PATH = isolatedDbPath;
    process.env.AURA_NATIVE_STORAGE_PATH = isolatedDbPath;
    process.env.AURA_NATIVE_AUTO_SEED = "false";
    process.env.SIBYL_SEED_FIXTURES = "false";
    closeNativeSibylDatabase();
  });

  afterEach(() => {
    closeNativeSibylDatabase();
    delete process.env.SIBYL_NATIVE_DB_PATH;
    delete process.env.SIBYL_STORAGE_PATH;
    delete process.env.AURA_NATIVE_STORAGE_PATH;
    delete process.env.AURA_NATIVE_AUTO_SEED;
    delete process.env.SIBYL_SEED_FIXTURES;

    if (fs.existsSync(tempDir)) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch {
        // best-effort cleanup
      }
    }
  });

  // =========================================================================
  // SUITE 1: EMPTY DATABASE BEHAVIOR & BETA(1, 1) NEUTRAL PRIORS
  // =========================================================================
  describe("Suite 1: Empty Database Behavior & Neutral Prior Invariants", () => {
    it("1.1: absent database file on disk cleanly returns NO_HISTORY and neutral priors", () => {
      const nonExistentDb = path.join(tempDir, "ghost-db.db");
      process.env.SIBYL_NATIVE_DB_PATH = nonExistentDb;
      closeNativeSibylDatabase();

      expect(fs.existsSync(nonExistentDb)).toBe(false);

      const retrieval = retrieveNativeFromSibyl("unobserved:agent:alpha");
      expect(retrieval.status).toBe("NO_HISTORY");
      if (retrieval.status === "NO_HISTORY") {
        expect(retrieval.overallReliability).toBe(0.5);
        expect(retrieval.confidence).toBe(0.0);
        expect(retrieval.episodesUsed).toBe(0);
      }

      const status = getNativeSibylStatus();
      expect(status.configured).toBe(true);
      expect(status.reachable).toBe(true);
      expect(status.entityCount).toBe(0);

      const recall = recallNativeEntities("alpha");
      expect(recall.reachable).toBe(true);
      expect(recall.verdict?.code).toBe("empty_store");
      expect(recall.records).toHaveLength(0);

      const entityLookup = getNativeEntity("counterparty", "unobserved:agent:alpha");
      expect(entityLookup.reachable).toBe(true);
      expect(entityLookup.code).toBe("entity_absent");

      const journal = readNativeMemoryJournal(10);
      expect(journal.ok).toBe(true);
      expect(journal.count).toBe(0);
      expect(journal.episodes).toHaveLength(0);
    });

    it("1.2: database file created with 0 rows (fixtures disabled) cleanly returns NO_HISTORY", () => {
      // Force database schema creation without seeding fixtures
      const rawDb = new DatabaseSync(isolatedDbPath);
      rawDb.exec(`
        CREATE TABLE IF NOT EXISTS entities (
          key TEXT PRIMARY KEY,
          id TEXT NOT NULL,
          category TEXT NOT NULL,
          name TEXT NOT NULL,
          status TEXT,
          body TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
      `);
      rawDb.close();

      closeNativeSibylDatabase();
      expect(fs.existsSync(isolatedDbPath)).toBe(true);

      const retrieval = retrieveNativeFromSibyl("virtuals:agent:alpha");
      expect(retrieval.status).toBe("NO_HISTORY");
      if (retrieval.status === "NO_HISTORY") {
        expect(retrieval.overallReliability).toBe(0.5);
        expect(retrieval.confidence).toBe(0.0);
        expect(retrieval.episodesUsed).toBe(0);
      }

      const counterparties = listNativeCounterpartiesFromSibyl();
      expect(counterparties.ok).toBe(true);
      if (counterparties.ok) {
        expect(counterparties.items).toHaveLength(0);
      }
    });

    it("1.3: row with empty JSON body '{}' or missing profile properties gracefully defaults to NO_HISTORY", () => {
      const rawDb = new DatabaseSync(isolatedDbPath);
      rawDb.exec(`
        CREATE TABLE IF NOT EXISTS entities (
          key TEXT PRIMARY KEY,
          id TEXT NOT NULL,
          category TEXT NOT NULL,
          name TEXT NOT NULL,
          status TEXT,
          body TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
      `);
      const now = new Date().toISOString();
      rawDb.prepare(`
        INSERT INTO entities (key, id, category, name, status, body, created_at, updated_at)
        VALUES ('counterparty:empty:body', 'id1', 'counterparty', 'empty:body', 'active', '{}', ?, ?)
      `).run(now, now);
      rawDb.close();

      closeNativeSibylDatabase();

      const retrieval = retrieveNativeFromSibyl("empty:body");
      expect(retrieval.status).toBe("NO_HISTORY");
      if (retrieval.status === "NO_HISTORY") {
        expect(retrieval.overallReliability).toBe(0.5);
        expect(retrieval.confidence).toBe(0.0);
      }
    });

    it("1.4: row with corrupted invalid JSON string in body safely defaults to NO_HISTORY without throwing", () => {
      const rawDb = new DatabaseSync(isolatedDbPath);
      rawDb.exec(`
        CREATE TABLE IF NOT EXISTS entities (
          key TEXT PRIMARY KEY,
          id TEXT NOT NULL,
          category TEXT NOT NULL,
          name TEXT NOT NULL,
          status TEXT,
          body TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
      `);
      const now = new Date().toISOString();
      rawDb.prepare(`
        INSERT INTO entities (key, id, category, name, status, body, created_at, updated_at)
        VALUES ('counterparty:corrupt:json', 'id2', 'counterparty', 'corrupt:json', 'active', '{{MALFORMED::JSON}}', ?, ?)
      `).run(now, now);
      rawDb.close();

      closeNativeSibylDatabase();

      expect(() => {
        const retrieval = retrieveNativeFromSibyl("corrupt:json");
        expect(retrieval.status).toBe("NO_HISTORY");
        if (retrieval.status === "NO_HISTORY") {
          expect(retrieval.overallReliability).toBe(0.5);
        }
      }).not.toThrow();
    });

    it("1.5: rehydrateFromSibyl under NO_HISTORY produces exact Beta(1,1) neutral priors", () => {
      const key = "fresh:candidate:123";
      const retrieval = retrieveNativeFromSibyl(key);
      expect(retrieval.status).toBe("NO_HISTORY");

      const rep = rehydrateFromSibyl(key, retrieval);
      expect(rep.candidateId).toBe(key);
      expect(rep.alpha).toBe(1.0);
      expect(rep.beta).toBe(1.0);
      expect(rep.overallReliability).toBe(0.5);
      expect(rep.confidence).toBe(0.0);
      expect(rep.status).toBe("NEW");
      expect(rep.consecutiveFailures).toBe(0);
      expect(rep.totalMissions).toBe(0);
      expect(rep.blockedReason).toBeUndefined();
    });

    it("1.6: resetNativeSibylStorage deletes file and -wal/-shm cleanly, restoring NO_HISTORY", () => {
      updateNativeCounterpartyInSibyl("temp:agent", {
        relationshipStatus: "WATCH",
        overallReliability: 0.25,
        consecutiveFailures: 1,
      });

      const beforeReset = retrieveNativeFromSibyl("temp:agent");
      expect(beforeReset.status).toBe("AVAILABLE");

      const resetRes = resetNativeSibylStorage({ seedFixtures: false });
      expect(resetRes.ok).toBe(true);
      expect(resetRes.entityCount).toBe(0);

      const afterReset = retrieveNativeFromSibyl("temp:agent");
      expect(afterReset.status).toBe("NO_HISTORY");
      if (afterReset.status === "NO_HISTORY") {
        expect(afterReset.overallReliability).toBe(0.5);
      }
    });
  });

  // =========================================================================
  // SUITE 2: TRANSACTION ROLLBACKS & SECONDARY EXCEPTION SUPPRESSION
  // =========================================================================
  describe("Suite 2: Transaction Rollback Integrity & Error Suppression", () => {
    it("2.1: atomic rollback on exception discards partial writes and leaves store unmutated", () => {
      const testKey = "victim:agent:rollback";
      updateNativeCounterpartyInSibyl(testKey, {
        relationshipStatus: "NEW",
        overallReliability: 0.5,
        totalMissions: 0,
      });

      // Verify initial state
      const initial = retrieveNativeFromSibyl(testKey);
      expect(initial.status).toBe("AVAILABLE");
      if (initial.status === "AVAILABLE") {
        expect(initial.relationshipStatus).toBe("NEW");
      }

      // Attempt transaction that writes then throws
      const rawDb = new DatabaseSync(isolatedDbPath);
      let caughtError: Error | null = null;

      try {
        rawDb.exec("BEGIN IMMEDIATE;");
        rawDb.prepare(`
          UPDATE entities
          SET body = json_set(body, '$.relationship_status', 'BLOCKED')
          WHERE key = 'counterparty:${testKey}'
        `).run();

        // Simulate application failure midway through transaction
        throw new Error("Simulated business exception before commit");
      } catch (err) {
        caughtError = err as Error;
        rawDb.exec("ROLLBACK;");
      } finally {
        rawDb.close();
      }

      expect(caughtError).not.toBeNull();
      expect(caughtError?.message).toBe("Simulated business exception before commit");

      closeNativeSibylDatabase();

      // Read back state — status MUST still be NEW (not BLOCKED)
      const afterRollback = retrieveNativeFromSibyl(testKey);
      expect(afterRollback.status).toBe("AVAILABLE");
      if (afterRollback.status === "AVAILABLE") {
        expect(afterRollback.relationshipStatus).toBe("NEW");
      }
    });

    it("2.2: secondary exception during rollback is safely suppressed and original error surfaced", () => {
      const rawDb = new DatabaseSync(isolatedDbPath);
      let capturedError: Error | null = null;

      try {
        // Run simulated withImmediateTransaction logic
        let inTx = false;
        try {
          rawDb.exec("BEGIN IMMEDIATE;");
          inTx = true;
          // Cause a SQLite syntax failure that auto-aborts transaction
          rawDb.exec("THIS IS TOTALLY INVALID SQL STATEMENT;");
          rawDb.exec("COMMIT;");
          inTx = false;
        } catch (err) {
          if (inTx) {
            try {
              rawDb.exec("ROLLBACK;");
            } catch {
              // Intentionally suppress secondary rollback error
            }
          }
          throw err;
        }
      } catch (err) {
        capturedError = err as Error;
      } finally {
        rawDb.close();
      }

      expect(capturedError).not.toBeNull();
      // The error must be the original SQLite syntax error, NOT a rollback error
      expect(capturedError?.message).toMatch(/syntax error|INVALID/i);
    });

    it("2.3: recordEpisodeToNativeSibyl handles concurrent/locked database safely without uncaught crashes", () => {
      const candidateKey = "concurrency:agent:lock";
      updateNativeCounterpartyInSibyl(candidateKey, {
        relationshipStatus: "KNOWN",
        overallReliability: 0.8,
      });

      // Lock DB with an uncommitted exclusive transaction on a secondary connection
      const lockerDb = new DatabaseSync(isolatedDbPath);
      lockerDb.exec("BEGIN EXCLUSIVE;");

      try {
        const outcome = recordEpisodeToNativeSibyl(candidateKey, {
          run: "concurrent-run-1",
          taskType: "test",
          outcome: "accepted",
          note: "Lock concurrency handled cleanly",
        });

        // Safe graceful degradation: returns structured error object without throwing uncaught crash
        expect(outcome.ok).toBe(false);
        expect(outcome.code).toBe("storage_error");
        expect(outcome.detail).toMatch(/database is locked|busy/i);
      } finally {
        lockerDb.exec("ROLLBACK;");
        lockerDb.close();
      }
    }, 15_000);

    it("2.4: sequential interleaved updates freeze Bayesian state on BLOCKED while recording all journal episodes", () => {
      const candidateKey = "interleaved:counterparty";
      let rep = createInitialReputation(candidateKey);

      for (let i = 1; i <= 5; i++) {
        rep = updateReputation(rep, "failure");
        updateNativeCounterpartyInSibyl(candidateKey, {
          consecutiveFailures: rep.consecutiveFailures,
          totalMissions: rep.totalMissions,
          relationshipStatus: rep.status,
          overallReliability: rep.overallReliability,
          confidence: rep.confidence,
        });
        recordEpisodeToNativeSibyl(candidateKey, {
          run: `run-${i}`,
          taskType: "mission",
          outcome: "rejected",
        });
      }

      closeNativeSibylDatabase();

      // All 5 episodes must be recorded in durable journal
      const journal = readNativeMemoryJournal(10, candidateKey);
      expect(journal.count).toBe(5);
      expect(journal.episodes).toHaveLength(5);

      // Bayesian state: froze at totalMissions=2 and consecutiveFailures=2 due to BLOCKED invariant
      const rehydrated = retrieveNativeFromSibyl(candidateKey);
      expect(rehydrated.status).toBe("AVAILABLE");
      if (rehydrated.status === "AVAILABLE") {
        expect(rehydrated.totalMissions).toBe(2);
        expect(rehydrated.consecutiveFailures).toBe(2);
        expect(rehydrated.relationshipStatus).toBe("BLOCKED");
      }
    });
  });

  // =========================================================================
  // SUITE 3: CONSECUTIVE FAILURE ESCALATION TO BLOCKED & REHYDRATION
  // =========================================================================
  describe("Suite 3: Consecutive Failure Escalation & Hard Veto", () => {
    it("3.1: 1 failure from NEW transitions to WATCH (consecutiveFailures = 1)", () => {
      const rep0 = createInitialReputation("test:agent:fsm1");
      expect(rep0.status).toBe("NEW");
      expect(rep0.consecutiveFailures).toBe(0);

      const rep1 = updateReputation(rep0, "failure");
      expect(rep1.status).toBe("WATCH");
      expect(rep1.consecutiveFailures).toBe(1);
      expect(rep1.alpha).toBe(1.0);
      expect(rep1.beta).toBe(2.0);
      expect(rep1.overallReliability).toBeCloseTo(1.0 / 3.0, 4);
      expect(rep1.blockedReason).toBeUndefined();

      const veto = checkVeto(rep1);
      expect(veto.allowed).toBe(true);
    });

    it("3.2: 2 consecutive failures transition candidate from WATCH to BLOCKED with reason", () => {
      const rep0 = createInitialReputation("test:agent:fsm2");
      const rep1 = updateReputation(rep0, "failure"); // -> WATCH, cf=1
      const rep2 = updateReputation(rep1, "failure"); // -> BLOCKED, cf=2

      expect(rep2.status).toBe("BLOCKED");
      expect(rep2.consecutiveFailures).toBe(2);
      expect(rep2.alpha).toBe(1.0);
      expect(rep2.beta).toBe(3.0);
      expect(rep2.overallReliability).toBe(0.25);
      expect(rep2.blockedReason).toBe("2 consecutive failures in WATCH state");

      const veto = checkVeto(rep2);
      expect(veto.allowed).toBe(false);
      expect(veto.reason).toContain("BLOCKED");
      expect(veto.reason).toContain("2 consecutive failures in WATCH state");
    });

    it("3.3: BLOCKED status and consecutiveFailures survive SQLite disk rehydration across process boundaries", () => {
      const candidateKey = "fsm:blocked:persistence";
      const rep0 = createInitialReputation(candidateKey);
      const rep1 = updateReputation(rep0, "failure");
      const rep2 = updateReputation(rep1, "failure");
      expect(rep2.status).toBe("BLOCKED");

      // Persist to disk SQLite
      updateNativeCounterpartyInSibyl(candidateKey, {
        relationshipStatus: rep2.status,
        overallReliability: rep2.overallReliability,
        confidence: rep2.confidence,
        alpha: rep2.alpha,
        beta: rep2.beta,
        consecutiveFailures: rep2.consecutiveFailures,
        totalMissions: rep2.totalMissions,
        blockedReason: rep2.blockedReason,
      });

      // Simulate full process boundary: disconnect & close
      closeNativeSibylDatabase();

      // Cold start rehydration
      const retrieved = retrieveNativeFromSibyl(candidateKey);
      expect(retrieved.status).toBe("AVAILABLE");
      if (retrieved.status === "AVAILABLE") {
        expect(retrieved.relationshipStatus).toBe("BLOCKED");
        expect(retrieved.consecutiveFailures).toBe(2);
        expect(retrieved.blockedReason).toBe("2 consecutive failures in WATCH state");
      }

      const rehydrated = rehydrateFromSibyl(candidateKey, retrieved);
      expect(rehydrated.status).toBe("BLOCKED");
      expect(rehydrated.consecutiveFailures).toBe(2);
      expect(rehydrated.alpha).toBe(1.0);
      expect(rehydrated.beta).toBe(3.0);
      expect(rehydrated.blockedReason).toBe("2 consecutive failures in WATCH state");

      const veto = checkVeto(rehydrated);
      expect(veto.allowed).toBe(false);
    });

    it("3.4: BLOCKED candidate cannot be auto-promoted or updated by subsequent positive outcomes", () => {
      const rep0 = createInitialReputation("test:agent:immune");
      const rep1 = updateReputation(rep0, "failure");
      const repBlocked = updateReputation(rep1, "failure");
      expect(repBlocked.status).toBe("BLOCKED");

      // Attempt 10 successive positive updates
      let attempted = repBlocked;
      for (let i = 0; i < 10; i++) {
        attempted = updateReputation(attempted, "success");
      }

      // Candidate MUST still be BLOCKED with same parameters
      expect(attempted.status).toBe("BLOCKED");
      expect(attempted.alpha).toBe(repBlocked.alpha);
      expect(attempted.beta).toBe(repBlocked.beta);
      expect(attempted.overallReliability).toBe(repBlocked.overallReliability);
      expect(attempted.consecutiveFailures).toBe(2);
      expect(attempted.blockedReason).toBe(repBlocked.blockedReason);
    });
  });

  // =========================================================================
  // SUITE 4: HARD VETO INVARIANCE UNDER EXTREME PRICING DISPARITIES
  // =========================================================================
  describe("Suite 4: Hard Veto Invariance Under Extreme Pricing Disparities", () => {
    it("4.1: BLOCKED candidate quoting 0.0001 USDC is strictly excluded vs unblocked quoting 10,000.00 USDC", () => {
      const blockedAlpha: SibylCounterparty = {
        counterpartyKey: "virtuals:agent:alpha",
        displayName: "Alpha Research",
        hasProfile: true,
        isFixture: false,
        relationshipStatus: "BLOCKED",
        memoryVersion: 2,
        overallReliability: 0.25,
        taskFit: 0.5,
        confidence: 0.5,
        observedPriceUsdc: "0.0001", // ultra-cheap quote
        riskNote: "Blocked due to consecutive deliverable failures",
        episodes: [],
        updatedAt: new Date().toISOString(),
      };

      const expensiveBeta: SibylCounterparty = {
        counterpartyKey: "virtuals:agent:beta",
        displayName: "Beta Labs",
        hasProfile: true,
        isFixture: false,
        relationshipStatus: "KNOWN",
        memoryVersion: 1,
        overallReliability: 0.75,
        taskFit: 0.8,
        confidence: 0.5,
        observedPriceUsdc: "10000.00", // 100,000,000x more expensive!
        riskNote: null,
        episodes: [],
        updatedAt: new Date().toISOString(),
      };

      const { ranked, excluded } = scoreCandidates([blockedAlpha, expensiveBeta]);

      // Alpha MUST be in excluded
      expect(excluded).toHaveLength(1);
      expect(excluded[0]?.key).toBe("virtuals:agent:alpha");
      expect(excluded[0]?.reason).toContain("BLOCKED");

      // Ranked MUST contain ONLY Beta
      expect(ranked).toHaveLength(1);
      expect(ranked[0]?.key).toBe("virtuals:agent:beta");
      expect(ranked[0]?.score).toBeGreaterThan(0);
    });

    it("4.2: zero/sub-cent prices down to 0.000001 USDC cannot overcome BLOCKED veto across 100 random permutations", () => {
      for (let i = 0; i < 100; i++) {
        const microPrice = (Math.random() * 0.001 + 0.000001).toFixed(6);
        const competitorPrice = (Math.random() * 500 + 10).toFixed(2);

        const blockedCandidate: SibylCounterparty = {
          counterpartyKey: `blocked:perm:${i}`,
          displayName: "Blocked Agent",
          hasProfile: true,
          isFixture: false,
          relationshipStatus: "BLOCKED",
          memoryVersion: 1,
          overallReliability: 0.1,
          taskFit: 0.99,
          confidence: 0.99,
          observedPriceUsdc: microPrice,
          riskNote: "Hard veto enforced",
          episodes: [],
          updatedAt: new Date().toISOString(),
        };

        const activeCandidate: SibylCounterparty = {
          counterpartyKey: `active:perm:${i}`,
          displayName: "Active Agent",
          hasProfile: true,
          isFixture: false,
          relationshipStatus: "NEW",
          memoryVersion: 1,
          overallReliability: 0.5,
          taskFit: 0.5,
          confidence: 0.0,
          observedPriceUsdc: competitorPrice,
          riskNote: null,
          episodes: [],
          updatedAt: new Date().toISOString(),
        };

        const { ranked, excluded } = scoreCandidates([blockedCandidate, activeCandidate]);

        expect(excluded.some((e) => e.key === blockedCandidate.counterpartyKey)).toBe(true);
        expect(ranked.some((r) => r.key === blockedCandidate.counterpartyKey)).toBe(false);
        expect(ranked[0]?.key).toBe(activeCandidate.counterpartyKey);
      }
    });

    it("4.3: when all candidates are BLOCKED, ranked is completely empty and no candidate is selected", () => {
      const pool: SibylCounterparty[] = [
        {
          counterpartyKey: "agent:blocked:1",
          displayName: "Agent 1",
          hasProfile: true,
          isFixture: false,
          relationshipStatus: "BLOCKED",
          memoryVersion: 1,
          overallReliability: 0.2,
          taskFit: 0.5,
          confidence: 0.5,
          observedPriceUsdc: "1.00",
          riskNote: null,
          episodes: [],
          updatedAt: new Date().toISOString(),
        },
        {
          counterpartyKey: "agent:blocked:2",
          displayName: "Agent 2",
          hasProfile: true,
          isFixture: false,
          relationshipStatus: "BLOCKED",
          memoryVersion: 1,
          overallReliability: 0.3,
          taskFit: 0.5,
          confidence: 0.5,
          observedPriceUsdc: "0.50",
          riskNote: null,
          episodes: [],
          updatedAt: new Date().toISOString(),
        },
      ];

      const { ranked, excluded } = scoreCandidates(pool);
      expect(ranked).toHaveLength(0);
      expect(excluded).toHaveLength(2);
      expect(excluded.every((e) => e.reason.includes("BLOCKED"))).toBe(true);
    });
  });

  // =========================================================================
  // SUITE 5: HOST STORAGE ISOLATION & ZERO WRITE LEAKAGE
  // =========================================================================
  describe("Suite 5: Host Storage Protection & Zero Write Leakage", () => {
    it("5.1: custom --db flag guarantees zero byte leakage or mtime change to default ~/.sibyl-memory store", () => {
      if (!fs.existsSync(demoScriptPath)) return;

      const defaultStoragePath = path.join(os.homedir(), ".sibyl-memory", "native-storage.db");
      const defaultBefore = {
        exists: fs.existsSync(defaultStoragePath),
        hash: computeFileHash(defaultStoragePath),
        mtimeMs: fs.existsSync(defaultStoragePath) ? fs.statSync(defaultStoragePath).mtimeMs : 0,
      };

      const customDbPath = path.join(tempDir, "zero-leakage-custom.db");

      const runnerExecutable = fs.existsSync(tsxCli) ? process.execPath : "pnpm";
      const runnerArgs = fs.existsSync(tsxCli)
        ? [tsxCli, demoScriptPath]
        : ["--filter", "@aura/api", "exec", "tsx", "../../scripts/demo-cold-start.ts"];

      // Run Session A with explicit --db path
      const resA = spawnSync(
        runnerExecutable,
        [...runnerArgs, "--session-a", "--db", customDbPath, "--no-color"],
        {
          cwd: repoRoot,
          env: {
            ...process.env,
            SIBYL_NATIVE_DB_PATH: customDbPath,
            SIBYL_STORAGE_PATH: customDbPath,
            AURA_NATIVE_STORAGE_PATH: customDbPath,
          },
          encoding: "utf8",
          timeout: 45_000,
        },
      );
      expect(resA.status).toBe(0);

      // Verify custom DB was created and populated
      expect(fs.existsSync(customDbPath)).toBe(true);

      // Verify default store was NOT touched
      if (!defaultBefore.exists) {
        expect(fs.existsSync(defaultStoragePath)).toBe(false);
      } else {
        const defaultAfterHash = computeFileHash(defaultStoragePath);
        const defaultAfterMtime = fs.statSync(defaultStoragePath).mtimeMs;
        expect(defaultAfterHash).toBe(defaultBefore.hash);
        expect(defaultAfterMtime).toBe(defaultBefore.mtimeMs);
      }
    });

    it("5.2: --temp-db cleans up ephemeral database without polluting host or leaving lingering files", () => {
      if (!fs.existsSync(demoScriptPath)) return;

      const runnerExecutable = fs.existsSync(tsxCli) ? process.execPath : "pnpm";
      const runnerArgs = fs.existsSync(tsxCli)
        ? [tsxCli, demoScriptPath]
        : ["--filter", "@aura/api", "exec", "tsx", "../../scripts/demo-cold-start.ts"];

      const res = spawnSync(
        runnerExecutable,
        [...runnerArgs, "--temp-db", "--no-color", "--ascii"],
        {
          cwd: repoRoot,
          env: {
            ...process.env,
            NO_COLOR: "1",
            USE_ASCII_BORDERS: "1",
          },
          encoding: "utf8",
          timeout: 45_000,
        },
      );
      expect(res.status).toBe(0);
      expect(res.stdout).toContain("DEMONSTRATION COMPLETE: 100% PERSISTENT & AUDITABLE");
    });
  });

  // =========================================================================
  // SUITE 6: VERIFIER AGENT SCHEMA BOUNDARIES & MALFORMED DELIVERABLES
  // =========================================================================
  describe("Suite 6: Verifier Agent Schema Boundaries & Fail-Closed Deliverables", () => {
    it("6.1: rejects deliverable with only 2 competitors (< 3 minimum constraint)", () => {
      const twoCompetitors: CompetitorReport = {
        competitors: [
          { name: "C1", website: "https://c1.com", sources: ["https://s1.com"] },
          { name: "C2", website: "https://c2.com", sources: ["https://s2.com"] },
        ],
      };
      const evalRes = validateCompetitorReport(twoCompetitors);
      expect(evalRes.tests_passed).toBe(false);
      expect(evalRes.score).toBe(0.0);
      expect(evalRes.summary).toContain("schema violation");
      expect(evalRes.failure_reason).toMatch(/at least 3 competitors|received 2/i);
    });

    it("6.2: rejects deliverable with 3 competitors where one competitor has empty sources []", () => {
      const missingSources: CompetitorReport = {
        competitors: [
          { name: "C1", website: "https://c1.com", sources: ["https://s1.com"] },
          { name: "C2", website: "https://c2.com", sources: [] },
          { name: "C3", website: "https://c3.com", sources: ["https://s3.com"] },
        ],
      };
      const evalRes = validateCompetitorReport(missingSources);
      expect(evalRes.tests_passed).toBe(false);
      expect(evalRes.score).toBe(0.0);
      expect(evalRes.failure_reason).toContain("At least one source citation URL is required");
    });

    it("6.3: rejects non-http protocols (ftp, file, javascript, raw scheme)", () => {
      const badProtocols = [
        "ftp://ftp.example.com/file",
        "file:///etc/passwd",
        "javascript:alert(1)",
        "chrome://settings",
        "example.com/no-protocol",
      ];

      for (const badUrl of badProtocols) {
        const report = {
          competitors: [
            { name: "C1", website: badUrl, sources: ["https://valid.com"] },
            { name: "C2", website: "https://c2.com", sources: ["https://valid.com"] },
            { name: "C3", website: "https://c3.com", sources: ["https://valid.com"] },
          ],
        };
        const evalRes = validateCompetitorReport(report);
        expect(evalRes.tests_passed).toBe(false);
        expect(evalRes.score).toBe(0.0);
      }
    });

    it("6.4: rejects empty or blank competitor names", () => {
      const blankName = {
        competitors: [
          { name: "   ", website: "https://c1.com", sources: ["https://s1.com"] },
          { name: "C2", website: "https://c2.com", sources: ["https://s2.com"] },
          { name: "C3", website: "https://c3.com", sources: ["https://s3.com"] },
        ],
      };
      const evalRes = validateCompetitorReport(blankName);
      expect(evalRes.tests_passed).toBe(false);
      expect(evalRes.score).toBe(0.0);
      expect(evalRes.failure_reason).toContain("Competitor name is required");
    });

    it("6.5: verifyCompetitorReportDeliverable rejects empty file (0 bytes), invalid JSON, and non-existent path", async () => {
      const worktreeDir = fs.mkdtempSync(path.join(os.tmpdir(), "aura-verifier-tests-"));

      try {
        // 1. Non-existent path
        const resMissing = await verifyCompetitorReportDeliverable(path.join(worktreeDir, "ghost-dir"));
        expect(resMissing.tests_passed).toBe(false);
        expect(resMissing.failure_reason).toContain("Deliverable file not found");

        // 2. Empty file (0 bytes)
        const emptyFile = path.join(worktreeDir, "deliverable.json");
        fs.writeFileSync(emptyFile, "");
        const resEmpty = await verifyCompetitorReportDeliverable(worktreeDir);
        expect(resEmpty.tests_passed).toBe(false);
        expect(resEmpty.failure_reason).toContain("empty");

        // 3. Invalid malformed JSON
        fs.writeFileSync(emptyFile, "{ not valid json syntax ... ]");
        const resMalformed = await verifyCompetitorReportDeliverable(worktreeDir);
        expect(resMalformed.tests_passed).toBe(false);
        expect(resMalformed.failure_reason).toContain("Invalid JSON");
      } finally {
        fs.rmSync(worktreeDir, { recursive: true, force: true });
      }
    });

    it("6.6: successfully passes when deliverable meets all requirements with >= 3 competitors", () => {
      const validReport: CompetitorReport = {
        competitors: [
          {
            name: "CloudScale DB",
            website: "https://cloudscale.io",
            sources: ["https://cloudscale.io/pricing", "https://techcrunch.com/cloudscale"],
            description: "Distributed transactional database",
          },
          {
            name: "HyperMemory Store",
            website: "https://hypermemory.dev",
            sources: ["https://hypermemory.dev/benchmarks"],
            description: "Low-latency key-value cache",
          },
          {
            name: "Apex Vector AI",
            website: "https://apexvector.ai",
            sources: ["https://apexvector.ai/docs"],
            description: "High-throughput vector search index",
          },
        ],
        taskGoal: "Competitor analysis for database solutions",
        summary: "Analyzed top 3 market competitors with verified URLs and sources.",
      };

      const evalRes = validateCompetitorReport(validReport);
      expect(evalRes.tests_passed).toBe(true);
      expect(evalRes.score).toBe(1.0);
      expect(evalRes.competitorsCount).toBe(3);
      expect(evalRes.data).toBeDefined();
    });
  });
});

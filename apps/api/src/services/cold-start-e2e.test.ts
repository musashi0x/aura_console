import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { stripVTControlCharacters } from "node:util";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  checkVeto,
  createInitialReputation,
  updateReputation,
} from "./reputation-fsm.js";
import { scoreCandidates } from "./mission-scoring.js";
import {
  closeNativeSibylDatabase,
  listNativeCounterpartiesFromSibyl,
  recordEpisodeToNativeSibyl,
  resetNativeSibylStorage,
  retrieveNativeFromSibyl,
  updateNativeCounterpartyInSibyl,
} from "./native-sibyl.js";
import { validateCompetitorReport } from "./verifier-agent.js";
import type { CompetitorReport } from "./verifier-agent.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../../../..");
const demoScriptPath = path.join(repoRoot, "scripts", "demo-cold-start.ts");
const localTsxCli = path.resolve(__dirname, "../../node_modules/tsx/dist/cli.mjs");
const rootTsxCli = path.join(repoRoot, "apps", "api", "node_modules", "tsx", "dist", "cli.mjs");
const tsxCli = fs.existsSync(localTsxCli) ? localTsxCli : rootTsxCli;

describe.sequential("Milestone 4: Cold-Start Demonstration & Reputation Lifecycle E2E Suite", () => {
  let tempDir: string;
  let isolatedDbPath: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "aura-cold-start-vitest-"));
    isolatedDbPath = path.join(tempDir, "isolated-test.db");
    process.env.SIBYL_NATIVE_DB_PATH = isolatedDbPath;
    process.env.SIBYL_STORAGE_PATH = isolatedDbPath;
    process.env.AURA_NATIVE_STORAGE_PATH = isolatedDbPath;
    process.env.AURA_NATIVE_AUTO_SEED = "false";
    process.env.SIBYL_SEED_FIXTURES = "false";
    resetNativeSibylStorage({ seedFixtures: false });
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
  // TIER 1: FEATURE COVERAGE
  // =========================================================================
  describe("Tier 1: Feature Coverage", () => {
    it("T1.1: Session 1 deliverable verification failure triggers WATCH state and disk persistence", () => {
      // 1. Initial unobserved candidate setup
      const candidateKey = "virtuals:agent:alpha";
      updateNativeCounterpartyInSibyl(candidateKey, {
        relationshipStatus: "NEW",
        overallReliability: 0.5,
        confidence: 0.0,
      });

      // 2. Deliverable validation: defective report lacking sources
      const defectiveReport: CompetitorReport = {
        competitors: [
          { name: "C1", website: "https://c1.com", sources: [] },
          { name: "C2", website: "https://c2.com", sources: ["https://s2.com"] },
          { name: "C3", website: "https://c3.com", sources: ["https://s3.com"] },
        ],
      };
      const evalResult = validateCompetitorReport(defectiveReport);
      expect(evalResult.tests_passed).toBe(false);
      expect(evalResult.score).toBe(0.0);

      // 3. Apply Bayesian failure update
      const initialRep = createInitialReputation(candidateKey);
      const updatedRep = updateReputation(initialRep, "failure");

      expect(updatedRep.status).toBe("WATCH");
      expect(updatedRep.consecutiveFailures).toBe(1);
      expect(updatedRep.alpha).toBe(1.0);
      expect(updatedRep.beta).toBe(2.0);
      expect(updatedRep.overallReliability).toBeCloseTo(1.0 / 3.0, 4);

      // 4. Persist to disk
      updateNativeCounterpartyInSibyl(candidateKey, {
        relationshipStatus: updatedRep.status,
        overallReliability: updatedRep.overallReliability,
        confidence: updatedRep.confidence,
        alpha: updatedRep.alpha,
        beta: updatedRep.beta,
        consecutiveFailures: updatedRep.consecutiveFailures,
        totalMissions: updatedRep.totalMissions,
      });
      recordEpisodeToNativeSibyl(candidateKey, {
        run: "run-m4-test-1",
        taskType: "mission",
        outcome: "rejected",
        note: evalResult.failure_reason,
      });

      closeNativeSibylDatabase();

      // 5. Verify disk persistence across closed connection
      const rehydrated = retrieveNativeFromSibyl(candidateKey);
      expect(rehydrated.status).toBe("AVAILABLE");
      if (rehydrated.status !== "AVAILABLE") throw new Error("Expected AVAILABLE");
      expect(rehydrated.relationshipStatus).toBe("WATCH");
      expect(rehydrated.consecutiveFailures).toBe(1);
      expect(rehydrated.episodesUsed).toBe(1);
    });

    it("T1.2: Session 2 cold-start rehydrates cumulative reputation and penalizes Alpha under price parity", () => {
      const alphaKey = "virtuals:agent:alpha";
      const betaKey = "virtuals:agent:beta";

      // Seed Alpha as post-failure (WATCH, reliability 0.33, consecutiveFailures 1)
      updateNativeCounterpartyInSibyl(alphaKey, {
        relationshipStatus: "WATCH",
        overallReliability: 0.333,
        confidence: 0.167,
        alpha: 1.0,
        beta: 2.0,
        consecutiveFailures: 1,
        totalMissions: 1,
        riskNote: "One acceptance failure inside the last 30 days applies a risk penalty.",
      });

      // Seed Beta as clean/preferred
      updateNativeCounterpartyInSibyl(betaKey, {
        relationshipStatus: "PREFERRED",
        overallReliability: 0.90,
        taskFit: 0.85,
        confidence: 0.85,
        alpha: 9.0,
        beta: 1.0,
        consecutiveFailures: 0,
        totalMissions: 5,
      });

      closeNativeSibylDatabase();

      // Cold start recall
      const memory = listNativeCounterpartiesFromSibyl();
      expect(memory.ok).toBe(true);
      if (!memory.ok) throw new Error("Expected memory.ok");
      const counterparties = memory.items.map((item) => ({
        ...item,
        observedPriceUsdc: item.counterpartyKey === alphaKey ? "9.00" : "12.00",
      }));

      const { ranked, excluded } = scoreCandidates(counterparties);
      expect(excluded).toHaveLength(0);
      expect(ranked).toHaveLength(2);

      // Beta should win despite higher price (12 USDC vs 9 USDC) due to Alpha penalty and Beta quality
      const winner = ranked[0];
      expect(winner?.key).toBe(betaKey);
    });
  });

  // =========================================================================
  // TIER 2: BOUNDARY VALUE ANALYSIS & ERROR HANDLING
  // =========================================================================
  describe("Tier 2: Boundary Value Analysis", () => {
    it("T2.1: absent SQLite database file returns NO_HISTORY with Beta(1,1) neutral priors", () => {
      const nonExistentDb = path.join(tempDir, "does-not-exist.db");
      process.env.SIBYL_NATIVE_DB_PATH = nonExistentDb;
      closeNativeSibylDatabase();

      const retrieval = retrieveNativeFromSibyl("unobserved:agent");
      expect(retrieval.status).toBe("NO_HISTORY");
      if (retrieval.status !== "NO_HISTORY") throw new Error("Expected NO_HISTORY");
      expect(retrieval.overallReliability).toBe(0.5);
      expect(retrieval.confidence).toBe(0.0);
      expect(retrieval.episodesUsed).toBe(0);
    });

    it("T2.2: second consecutive failure in Session 2 triggers transition to BLOCKED and hard veto", () => {
      const candidateKey = "failing:agent:coldstart";
      const initialRep = createInitialReputation(candidateKey);

      // First failure
      const rep1 = updateReputation(initialRep, "failure");
      expect(rep1.status).toBe("WATCH");
      expect(rep1.consecutiveFailures).toBe(1);

      // Second consecutive failure
      const rep2 = updateReputation(rep1, "failure");
      expect(rep2.status).toBe("BLOCKED");
      expect(rep2.consecutiveFailures).toBe(2);
      expect(rep2.blockedReason).toBeDefined();

      // Hard veto check
      const veto = checkVeto(rep2);
      expect(veto.allowed).toBe(false);
      expect(veto.reason).toContain("BLOCKED");
    });

    it("T2.3: price parity auction selects Beta when Alpha is in WATCH", () => {
      const alphaKey = "parity:alpha";
      const betaKey = "parity:beta";

      // Both quoted at exactly 10.00 USDC
      const counterparties = [
        {
          counterpartyKey: alphaKey,
          displayName: "Alpha",
          hasProfile: true,
          isFixture: false,
          relationshipStatus: "WATCH" as const,
          memoryVersion: 1,
          overallReliability: 0.33,
          taskFit: 0.5,
          confidence: 0.2,
          observedPriceUsdc: "10.00",
          riskNote: "Penalized",
          episodes: [],
          updatedAt: new Date().toISOString(),
        },
        {
          counterpartyKey: betaKey,
          displayName: "Beta",
          hasProfile: true,
          isFixture: false,
          relationshipStatus: "NEW" as const,
          memoryVersion: 1,
          overallReliability: 0.5,
          taskFit: 0.5,
          confidence: 0.0,
          observedPriceUsdc: "10.00",
          riskNote: null,
          episodes: [],
          updatedAt: new Date().toISOString(),
        },
      ];

      const { ranked } = scoreCandidates(counterparties);
      expect(ranked[0]?.key).toBe(betaKey);
      expect(ranked[1]?.key).toBe(alphaKey);
      expect(ranked[1]?.memory_adjustment).toBeLessThan(0);
    });
  });

  // =========================================================================
  // TIER 3: PAIRWISE / CROSS-CUTTING COMBINATIONS
  // =========================================================================
  describe("Tier 3: Pairwise & Cross-Cutting Integration", () => {
    it("T3.1: storage reset restores unobserved neutral priors without crashing caller", () => {
      const testKey = "test:reset:agent";
      updateNativeCounterpartyInSibyl(testKey, {
        relationshipStatus: "WATCH",
        overallReliability: 0.2,
      });

      const beforeReset = retrieveNativeFromSibyl(testKey);
      expect(beforeReset.status).toBe("AVAILABLE");

      resetNativeSibylStorage({ seedFixtures: false });

      const afterReset = retrieveNativeFromSibyl(testKey);
      expect(afterReset.status).toBe("NO_HISTORY");
      if (afterReset.status !== "NO_HISTORY") throw new Error("Expected NO_HISTORY");
      expect(afterReset.overallReliability).toBe(0.5);
    });
  });

  // =========================================================================
  // TIER 4: HARD OS CHILD PROCESS REAL-WORLD WORKLOAD
  // =========================================================================
  describe("Tier 4: Subprocess Cold-Start Real-World Execution", () => {
    it("T4.1: executes demo-cold-start.ts end-to-end across OS child processes", () => {
      if (!fs.existsSync(demoScriptPath)) {
        console.warn(`[Skip T4.1] ${demoScriptPath} does not exist.`);
        return;
      }

      const env: NodeJS.ProcessEnv = {
        ...process.env,
        HOME: tempDir,
        SIBYL_NATIVE_DB_PATH: isolatedDbPath,
        SIBYL_STORAGE_PATH: isolatedDbPath,
        AURA_NATIVE_STORAGE_PATH: isolatedDbPath,
        AURA_NATIVE_AUTO_SEED: "false",
        SIBYL_SEED_FIXTURES: "false",
        SIBYL_DISABLE_NATIVE: "false",
        NO_COLOR: "1",
      };

      const runnerExecutable = fs.existsSync(tsxCli) ? process.execPath : "pnpm";
      const runnerArgs = fs.existsSync(tsxCli)
        ? [tsxCli, demoScriptPath]
        : ["--filter", "@aura/api", "exec", "tsx", "../../scripts/demo-cold-start.ts"];

      // Spawning Process A
      const procA = spawnSync(
        runnerExecutable,
        [...runnerArgs, "--session-a", "--db", isolatedDbPath],
        {
          cwd: repoRoot,
          env,
          encoding: "utf8",
          timeout: 45_000,
        },
      );
      if (procA.status !== 0) {
        console.error("ProcA failed:", procA.stderr, procA.stdout);
      }
      expect(procA.status).toBe(0);

      // Verify SQLite on disk
      closeNativeSibylDatabase();
      const afterA = retrieveNativeFromSibyl("virtuals:agent:alpha");
      expect(afterA.status).toBe("AVAILABLE");
      if (afterA.status !== "AVAILABLE") throw new Error("Expected AVAILABLE");
      expect(afterA.relationshipStatus).toBe("WATCH");
      expect(afterA.consecutiveFailures).toBe(1);

      // Spawning Process B (Cold Start)
      const procB = spawnSync(
        runnerExecutable,
        [...runnerArgs, "--session-b", "--db", isolatedDbPath],
        {
          cwd: repoRoot,
          env,
          encoding: "utf8",
          timeout: 45_000,
        },
      );
      if (procB.status !== 0) {
        console.error("ProcB failed:", procB.stderr, procB.stdout);
      }
      expect(procB.status).toBe(0);

      const stdoutClean = stripVTControlCharacters(procB.stdout);
      expect(stdoutClean).toMatch(/PRICE-ONLY|Price-Only|Amnesia/i);
      expect(stdoutClean).toMatch(/HISTORY-AWARE|History-Aware|Memory[- ]Protected/i);

      // Authentic mathematical scoring assertions from scoreCandidates
      expect(stdoutClean).toMatch(
        /(Selected|Winner|Winning).*?(Beta|virtuals:agent:beta)|(Beta).*?(selected|won|winner)/i,
      );
      // Authentic mathematical margin: 100 vs 98
      expect(stdoutClean).toMatch(/100\s+vs\s+98/);
      // Authentic Alpha memory adjustment / penalty: -2
      expect(stdoutClean).toMatch(/(?:Pen|Mem|adjustment|penalty):\s*-2/i);
      // Authentic final scores: Beta 100, Alpha 98
      expect(stdoutClean).toMatch(/(?:Final|Score):\s*100/i);
      expect(stdoutClean).toMatch(/(?:Final|Score):\s*98/i);

      // Strict Anti-Cheat: Ensure fabricated static literals are eliminated
      expect(stdoutClean).not.toContain("-32");
      expect(stdoutClean).not.toMatch(/75\s+vs\s+68/);
    });

    it("T4.2: standalone CLI execution without ambient SIBYL_NATIVE_DB_PATH preserves storage isolation", () => {
      if (!fs.existsSync(demoScriptPath)) {
        console.warn(`[Skip T4.2] ${demoScriptPath} does not exist.`);
        return;
      }

      const standaloneDbPath = path.join(tempDir, "standalone-e2e.db");
      const defaultStoragePath = path.join(os.homedir(), ".sibyl-memory", "native-storage.db");
      const defaultStorageBefore = {
        exists: fs.existsSync(defaultStoragePath),
        mtimeMs: fs.existsSync(defaultStoragePath) ? fs.statSync(defaultStoragePath).mtimeMs : 0,
        size: fs.existsSync(defaultStoragePath) ? fs.statSync(defaultStoragePath).size : 0,
      };

      // Clean environment: explicitly remove all ambient SIBYL/AURA storage variables
      const cleanEnv: NodeJS.ProcessEnv = { ...process.env };
      delete cleanEnv.SIBYL_NATIVE_DB_PATH;
      delete cleanEnv.SIBYL_STORAGE_PATH;
      delete cleanEnv.AURA_NATIVE_STORAGE_PATH;
      delete cleanEnv.AURA_NATIVE_AUTO_SEED;
      delete cleanEnv.SIBYL_SEED_FIXTURES;
      delete cleanEnv.SIBYL_DISABLE_NATIVE;
      cleanEnv.NO_COLOR = "1";

      const runnerExecutable = fs.existsSync(tsxCli) ? process.execPath : "pnpm";
      const runnerArgs = fs.existsSync(tsxCli)
        ? [tsxCli, demoScriptPath]
        : ["--filter", "@aura/api", "exec", "tsx", "../../scripts/demo-cold-start.ts"];

      // 1. Standalone Session A invocation in clean environment
      const procA = spawnSync(
        runnerExecutable,
        [...runnerArgs, "--session-a", "--db", standaloneDbPath],
        {
          cwd: repoRoot,
          env: cleanEnv,
          encoding: "utf8",
          timeout: 45_000,
        },
      );
      expect(procA.status).toBe(0);

      // 2. Verify default storage was NOT touched (zero leaked writes)
      if (!defaultStorageBefore.exists) {
        expect(fs.existsSync(defaultStoragePath)).toBe(false);
      } else {
        const afterStat = fs.statSync(defaultStoragePath);
        expect(afterStat.mtimeMs).toBe(defaultStorageBefore.mtimeMs);
        expect(afterStat.size).toBe(defaultStorageBefore.size);
      }

      // 3. Verify custom standalone DB directly on disk
      const db = new DatabaseSync(standaloneDbPath);
      try {
        const row = db
          .prepare("SELECT body FROM entities WHERE key = ?")
          .get("counterparty:virtuals:agent:alpha") as { body: string } | undefined;
        expect(row).toBeDefined();
        const body = JSON.parse(row!.body);
        expect(body.relationship_status ?? body.relationshipStatus).toBe("WATCH");
        expect(body.consecutive_failures ?? body.consecutiveFailures).toBe(1);
        expect(body.episodes?.length).toBeGreaterThanOrEqual(1);
        expect(body.episodes[body.episodes.length - 1].outcome).toBe("rejected");
      } finally {
        db.close();
      }

      // 4. Standalone Session B invocation in clean environment
      const procB = spawnSync(
        runnerExecutable,
        [...runnerArgs, "--session-b", "--db", standaloneDbPath],
        {
          cwd: repoRoot,
          env: cleanEnv,
          encoding: "utf8",
          timeout: 45_000,
        },
      );
      expect(procB.status).toBe(0);

      const stdoutClean = stripVTControlCharacters(procB.stdout);
      expect(stdoutClean).toMatch(
        /(Selected|Winner|Winning).*?(Beta|virtuals:agent:beta)|(Beta).*?(selected|won|winner)/i,
      );
      expect(stdoutClean).toMatch(/100\s+vs\s+98/);
      expect(stdoutClean).toMatch(/(?:Pen|Mem|adjustment|penalty):\s*-2/i);
      expect(stdoutClean).toMatch(/(?:Final|Score):\s*100/i);
      expect(stdoutClean).toMatch(/(?:Final|Score):\s*98/i);
      expect(stdoutClean).not.toContain("-32");
      expect(stdoutClean).not.toMatch(/75\s+vs\s+68/);
    });
  });
});

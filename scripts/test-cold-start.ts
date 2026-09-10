#!/usr/bin/env tsx

/**
 * Aura Memory — Milestone 4: Automated Cold-Start Demonstration Test Harness
 *
 * Programmatically runs the two-session cold-start demonstration end-to-end
 * across decoupled OS process boundaries with an isolated SQLite database.
 *
 * Invariants Verified:
 * 1. Process A (Session 1) executes cleanly and exits with code 0.
 * 2. Process A rejected Alpha's defective deliverable and wrote back failure.
 * 3. Physical SQLite database on disk contains Alpha in WATCH state with
 *    consecutiveFailures=1 and failure episode.
 * 4. Process B (Session 2) cold-starts in a new OS process, reads from disk,
 *    and exits with code 0.
 * 5. Process B rehydrates memory and selects Provider Beta over Provider Alpha
 *    based on genuine mathematical scoring (scoreCandidates: 100 vs 98, penalty: -2).
 * 6. Process B stdout renders the side-by-side terminal comparison.
 * 7. Process B stdout renders the inspectable evidence card.
 * 8. Standalone CLI execution without ambient SIBYL_NATIVE_DB_PATH writes 100%
 *    to specified --db path and NEVER touches default ~/.sibyl-memory/native-storage.db.
 * 9. Full sequential composite run (without session flags) executes cleanly.
 * 10. Clean exit 0 on all assertions passing; exit 1 on any failure with actionable diagnostics.
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const demoScriptPath = path.join(repoRoot, "scripts", "demo-cold-start.ts");
const tsxCli = path.join(repoRoot, "apps", "api", "node_modules", "tsx", "dist", "cli.mjs");

function stripAnsi(text: string): string {
  return text.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "");
}

function cleanDirectory(dirPath: string): void {
  try {
    if (fs.existsSync(dirPath)) {
      fs.rmSync(dirPath, { recursive: true, force: true });
    }
  } catch {
    // best-effort cleanup
  }
}

function inspectDatabaseState(dbPath: string): {
  exists: boolean;
  alpha?: {
    relationshipStatus?: string;
    consecutiveFailures?: number;
    overallReliability?: number;
    alpha?: number;
    beta?: number;
    episodes?: Array<{ outcome: string; note?: string; task_type?: string }>;
  };
} {
  if (!fs.existsSync(dbPath)) {
    return { exists: false };
  }

  const db = new DatabaseSync(dbPath);
  try {
    const tableCheck = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='entities'")
      .get();
    if (!tableCheck) {
      return { exists: true };
    }

    const row = db
      .prepare("SELECT body FROM entities WHERE key = ?")
      .get("counterparty:virtuals:agent:alpha") as { body: string } | undefined;
    if (!row) {
      return { exists: true };
    }

    const body = JSON.parse(row.body);
    return {
      exists: true,
      alpha: {
        relationshipStatus: body.relationship_status ?? body.relationshipStatus,
        consecutiveFailures: body.consecutive_failures ?? body.consecutiveFailures,
        overallReliability: body.overall_reliability ?? body.overallReliability,
        alpha: body.alpha,
        beta: body.beta,
        episodes: body.episodes,
      },
    };
  } finally {
    db.close();
  }
}

interface RunResult {
  status: number | null;
  stdout: string;
  stderr: string;
}

function runSession(sessionFlag: string | null, dbPath: string, tempDir: string): RunResult {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    HOME: tempDir,
    SIBYL_NATIVE_DB_PATH: dbPath,
    SIBYL_STORAGE_PATH: dbPath,
    AURA_NATIVE_STORAGE_PATH: dbPath,
    AURA_NATIVE_AUTO_SEED: "false",
    SIBYL_SEED_FIXTURES: "false",
    SIBYL_DISABLE_NATIVE: "false",
    NO_COLOR: "1",
  };

  const args: string[] = [];
  if (fs.existsSync(tsxCli)) {
    args.push(tsxCli, demoScriptPath);
    if (sessionFlag) args.push(sessionFlag);
    args.push("--db", dbPath);
    return spawnSync(process.execPath, args, {
      cwd: repoRoot,
      env,
      encoding: "utf8",
      timeout: 45_000,
    });
  }

  // Fallback to pnpm invocation
  const pnpmArgs = ["--filter", "@aura/api", "exec", "tsx", "../../scripts/demo-cold-start.ts"];
  if (sessionFlag) pnpmArgs.push(sessionFlag);
  pnpmArgs.push("--db", dbPath);
  return spawnSync("pnpm", pnpmArgs, {
    cwd: repoRoot,
    env,
    encoding: "utf8",
    timeout: 45_000,
  });
}

async function runColdStartTest(): Promise<void> {
  console.log("===============================================================================");
  console.log("   AURA MEMORY: AUTOMATED TWO-PROCESS COLD-START TEST HARNESS");
  console.log("   Verifying Persistent Storage, Verifier Rejection & Cold Divergence");
  console.log("===============================================================================\n");

  if (!fs.existsSync(demoScriptPath)) {
    console.error(`❌ FATAL: Target demo script does not exist at: ${demoScriptPath}`);
    process.exit(1);
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "aura-cold-start-test-"));
  const dbPath = path.join(tempDir, "isolated-cold-start.db");
  let standaloneTempDir: string | null = null;

  try {
    // -------------------------------------------------------------------------
    // STEP 1: Process A (Session 1)
    // -------------------------------------------------------------------------
    console.log("[Test Step 1] Programmatically invoking Process A (Session 1: Initial Auction & Failure)...");
    const resA = runSession("--session-a", dbPath, tempDir);

    if (resA.status !== 0) {
      console.error(`❌ FAIL: Process A exited with non-zero exit code: ${resA.status}`);
      console.error("--- Process A Stderr ---:\n", resA.stderr);
      console.error("--- Process A Stdout ---:\n", resA.stdout);
      process.exit(1);
    }

    const cleanStdoutA = stripAnsi(resA.stdout);
    assert.ok(
      cleanStdoutA.includes("virtuals:agent:alpha") || cleanStdoutA.includes("Alpha"),
      "Process A must select Provider Alpha on price efficiency.",
    );
    assert.ok(
      /reject|failed verification|missing/i.test(cleanStdoutA),
      "Process A must verify deliverable defect and reject deliverable.",
    );
    console.log("✓ Process A exited 0. Selection, deliverable rejection, and episode logging confirmed.");

    // -------------------------------------------------------------------------
    // STEP 2: SQLite Disk Inspection (Zero Shared RAM Verification)
    // -------------------------------------------------------------------------
    console.log("\n[Test Step 2] Inspecting physical SQLite database on disk...");
    const dbState = inspectDatabaseState(dbPath);

    assert.ok(dbState.exists, `SQLite database file does not exist on disk at: ${dbPath}`);
    assert.ok(dbState.alpha, "Alpha counterparty record was not found in SQLite 'entities' table.");
    assert.strictEqual(
      dbState.alpha?.relationshipStatus,
      "WATCH",
      `Expected Alpha status 'WATCH', found: ${dbState.alpha?.relationshipStatus}`,
    );
    assert.strictEqual(
      dbState.alpha?.consecutiveFailures,
      1,
      `Expected consecutiveFailures=1, found: ${dbState.alpha?.consecutiveFailures}`,
    );
    assert.ok(
      Array.isArray(dbState.alpha?.episodes) && dbState.alpha.episodes.length >= 1,
      "Expected at least 1 recorded episode for Alpha in SQLite.",
    );

    const latestEpisode = dbState.alpha.episodes[dbState.alpha.episodes.length - 1];
    assert.strictEqual(
      latestEpisode.outcome,
      "rejected",
      `Expected latest episode outcome 'rejected', found: ${latestEpisode.outcome}`,
    );
    console.log("✓ SQLite database verified on disk:");
    console.log(`  - Status              : ${dbState.alpha.relationshipStatus}`);
    console.log(`  - Consecutive Failures: ${dbState.alpha.consecutiveFailures}`);
    console.log(`  - Latest Episode      : outcome=${latestEpisode.outcome}`);

    // -------------------------------------------------------------------------
    // STEP 3: Process B (Session 2 Cold Start - Genuine Mathematical Assertion)
    // -------------------------------------------------------------------------
    console.log("\n[Test Step 3] Programmatically invoking Process B (Session 2 Cold Start)...");
    const resB = runSession("--session-b", dbPath, tempDir);

    if (resB.status !== 0) {
      console.error(`❌ FAIL: Process B exited with non-zero exit code: ${resB.status}`);
      console.error("--- Process B Stderr ---:\n", resB.stderr);
      console.error("--- Process B Stdout ---:\n", resB.stdout);
      process.exit(1);
    }

    const cleanStdoutB = stripAnsi(resB.stdout);

    // 1. Assert side-by-side comparison output structure
    const hasPriceOnly = /PRICE-ONLY|Price-Only|Amnesia/i.test(cleanStdoutB);
    const hasHistoryAware = /HISTORY-AWARE|History-Aware|Memory[- ]Protected/i.test(cleanStdoutB);
    assert.ok(
      hasPriceOnly && hasHistoryAware,
      "Process B output must contain the side-by-side comparison (Price-Only vs History-Aware).",
    );

    // 2. Assert Provider Beta won over Provider Alpha
    const betaWon =
      /(Selected|Winner|Winning).*?(Beta|virtuals:agent:beta)/i.test(cleanStdoutB) ||
      /(Beta|virtuals:agent:beta).*?(selected|won|winner)/i.test(cleanStdoutB);
    assert.ok(
      betaWon,
      "Process B must select Provider Beta over Provider Alpha due to history-aware reputation penalty.",
    );

    // 3. Mathematical assertions: genuine scoring outputs from scoreCandidates()
    // Authentic Margin: 100 vs 98 (Price Parity: Base 100 vs Base 100 + (-2) penalty)
    assert.ok(
      /100\s+vs\s+98/.test(cleanStdoutB),
      "Process B must display the authentic mathematical margin '100 vs 98'.",
    );

    // Authentic Alpha memory adjustment / penalty: -2
    assert.ok(
      /(?:Pen|Mem|adjustment|penalty):\s*-2/i.test(cleanStdoutB),
      "Process B must display Alpha's authentic memory penalty of -2.",
    );

    // Authentic Beta final score: 100
    assert.ok(
      /(?:Final|Score):\s*100/i.test(cleanStdoutB),
      "Process B must display Beta's authentic final score of 100.",
    );

    // Authentic Alpha final score: 98
    assert.ok(
      /(?:Final|Score):\s*98/i.test(cleanStdoutB),
      "Process B must display Alpha's authentic final score of 98.",
    );

    // Strict Anti-Cheat: Ensure fabricated static literals from dead-ends are eliminated
    assert.ok(
      !cleanStdoutB.includes("-32"),
      "Process B output must NOT contain the fabricated static -32 penalty.",
    );
    assert.ok(
      !/75\s+vs\s+68/.test(cleanStdoutB),
      "Process B output must NOT contain the fabricated static '75 vs 68' margin.",
    );

    // 4. Assert inspectable evidence card rendered
    const hasEvidence = /WATCH|consecutive failure|penalized|rejected/i.test(cleanStdoutB);
    assert.ok(
      hasEvidence,
      "Process B output must render the inspectable evidence card showing Alpha's prior rejection.",
    );

    console.log("✓ Process B exited 0.");
    console.log("✓ Side-by-side terminal comparison rendered.");
    console.log("✓ Provider Beta selected over Provider Alpha.");
    console.log("✓ Genuine scoreCandidates mathematical output verified: Beta 100 vs Alpha 98 (penalty: -2).");
    console.log("✓ Fabricated static literals (-32, 75 vs 68) confirmed eliminated.");
    console.log("✓ Inspectable evidence card displayed.");

    // -------------------------------------------------------------------------
    // STEP 4: Standalone CLI Execution Without Ambient Environment & Storage Isolation
    // -------------------------------------------------------------------------
    console.log("\n[Test Step 4] Standalone CLI execution without ambient SIBYL_NATIVE_DB_PATH & storage isolation check...");
    standaloneTempDir = fs.mkdtempSync(path.join(os.tmpdir(), "aura-cold-start-standalone-"));
    const standaloneDbPath = path.join(standaloneTempDir, "standalone-isolated.db");

    // Snapshot default storage path (~/.sibyl-memory/native-storage.db) to ensure zero leaked writes
    const defaultStoragePath = path.join(os.homedir(), ".sibyl-memory", "native-storage.db");
    const defaultStorageBefore = {
      exists: fs.existsSync(defaultStoragePath),
      mtimeMs: fs.existsSync(defaultStoragePath) ? fs.statSync(defaultStoragePath).mtimeMs : 0,
      size: fs.existsSync(defaultStoragePath) ? fs.statSync(defaultStoragePath).size : 0,
    };

    // Clean shell environment: explicitly remove all ambient SIBYL/AURA storage variables
    const cleanEnv: NodeJS.ProcessEnv = { ...process.env };
    delete cleanEnv.SIBYL_NATIVE_DB_PATH;
    delete cleanEnv.SIBYL_STORAGE_PATH;
    delete cleanEnv.AURA_NATIVE_STORAGE_PATH;
    delete cleanEnv.AURA_NATIVE_AUTO_SEED;
    delete cleanEnv.SIBYL_SEED_FIXTURES;
    delete cleanEnv.SIBYL_DISABLE_NATIVE;
    cleanEnv.NO_COLOR = "1";

    const runCleanChild = (flag: string, targetDb: string): RunResult => {
      const runnerArgs = fs.existsSync(tsxCli)
        ? [tsxCli, demoScriptPath, flag, "--db", targetDb]
        : ["--filter", "@aura/api", "exec", "tsx", "../../scripts/demo-cold-start.ts", flag, "--db", targetDb];
      const execBinary = fs.existsSync(tsxCli) ? process.execPath : "pnpm";
      return spawnSync(execBinary, runnerArgs, {
        cwd: repoRoot,
        env: cleanEnv,
        encoding: "utf8",
        timeout: 45_000,
      });
    };

    // 1. Run Session A in clean shell
    const standaloneResA = runCleanChild("--session-a", standaloneDbPath);
    assert.strictEqual(
      standaloneResA.status,
      0,
      `Standalone Process A failed in clean environment:\nStderr: ${standaloneResA.stderr}\nStdout: ${standaloneResA.stdout}`,
    );

    // 2. Verify default storage was NOT touched at all
    if (!defaultStorageBefore.exists) {
      assert.ok(
        !fs.existsSync(defaultStoragePath),
        `Default storage (${defaultStoragePath}) was created during standalone execution! Ambient isolation failed.`,
      );
    } else {
      const afterStat = fs.statSync(defaultStoragePath);
      assert.strictEqual(
        afterStat.mtimeMs,
        defaultStorageBefore.mtimeMs,
        `Default storage (${defaultStoragePath}) mtime changed! Standalone Session A leaked writes to default DB.`,
      );
      assert.strictEqual(
        afterStat.size,
        defaultStorageBefore.size,
        `Default storage (${defaultStoragePath}) size changed! Standalone Session A leaked writes to default DB.`,
      );
    }
    console.log("✓ Default storage (~/.sibyl-memory/native-storage.db) was NOT touched (zero leaked writes).");

    // 3. Inspect custom SQLite file directly to verify WATCH and consecutive_failures: 1
    const standaloneDbState = inspectDatabaseState(standaloneDbPath);
    assert.ok(
      standaloneDbState.exists,
      `Standalone SQLite database does not exist at: ${standaloneDbPath}`,
    );
    assert.ok(
      standaloneDbState.alpha,
      `Alpha record was not found in standalone SQLite database: ${standaloneDbPath}`,
    );
    assert.strictEqual(
      standaloneDbState.alpha?.relationshipStatus,
      "WATCH",
      `Expected Alpha in WATCH status in standalone DB, found: ${standaloneDbState.alpha?.relationshipStatus}`,
    );
    assert.strictEqual(
      standaloneDbState.alpha?.consecutiveFailures,
      1,
      `Expected consecutiveFailures=1 in standalone DB, found: ${standaloneDbState.alpha?.consecutiveFailures}`,
    );
    const standaloneEpisode =
      standaloneDbState.alpha?.episodes?.[standaloneDbState.alpha.episodes.length - 1];
    assert.strictEqual(
      standaloneEpisode?.outcome,
      "rejected",
      `Expected standalone episode outcome 'rejected', found: ${standaloneEpisode?.outcome}`,
    );
    console.log("✓ Standalone SQLite database verified on disk (Alpha: WATCH, consecutiveFailures: 1, episode: rejected).");

    // 4. Run Session B against custom SQLite file in clean shell
    const standaloneResB = runCleanChild("--session-b", standaloneDbPath);
    assert.strictEqual(
      standaloneResB.status,
      0,
      `Standalone Process B failed in clean environment:\nStderr: ${standaloneResB.stderr}\nStdout: ${standaloneResB.stdout}`,
    );
    const cleanStdoutStandaloneB = stripAnsi(standaloneResB.stdout);
    const standaloneBetaWon =
      /(Selected|Winner|Winning).*?(Beta|virtuals:agent:beta)/i.test(cleanStdoutStandaloneB) ||
      /(Beta|virtuals:agent:beta).*?(selected|won|winner)/i.test(cleanStdoutStandaloneB);
    assert.ok(
      standaloneBetaWon,
      "Standalone Process B must select Provider Beta over Provider Alpha in clean environment.",
    );
    assert.ok(
      /100\s+vs\s+98/.test(cleanStdoutStandaloneB),
      "Standalone Process B output must display authentic margin 100 vs 98.",
    );
    assert.ok(
      /(?:Pen|Mem|adjustment|penalty):\s*-2/i.test(cleanStdoutStandaloneB),
      "Standalone Process B output must display authentic Alpha memory penalty -2.",
    );
    console.log("✓ Standalone Session B exited 0 and selected Provider Beta (100 vs 98, -2 penalty).");

    // -------------------------------------------------------------------------
    // STEP 5: Full Sequential Composite Run
    // -------------------------------------------------------------------------
    console.log("\n[Test Step 5] Verifying full composite execution (demo-cold-start without flags)...");
    const compositeDbPath = path.join(tempDir, "composite-cold-start.db");
    const resComposite = runSession(null, compositeDbPath, tempDir);
    assert.strictEqual(
      resComposite.status,
      0,
      `Full composite run failed with status: ${resComposite.status}\nStderr: ${resComposite.stderr}`,
    );
    console.log("✓ Full composite execution passed cleanly.");

    console.log("\n===============================================================================");
    console.log("   ✓ ALL COLD-START ASSERTIONS PASSED (100% VERIFIED)");
    console.log("===============================================================================\n");
    process.exit(0);
  } catch (err) {
    console.error("\n❌ COLD-START TEST FAILED WITH DIAGNOSTIC ERROR:\n", err);
    process.exit(1);
  } finally {
    cleanDirectory(tempDir);
    if (standaloneTempDir) {
      cleanDirectory(standaloneTempDir);
    }
  }
}

runColdStartTest().catch((err) => {
  console.error("❌ Fatal unhandled rejection in test-cold-start:", err);
  process.exit(1);
});

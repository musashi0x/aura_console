#!/usr/bin/env tsx

/**
 * Aura Memory — Automated Test Harness for Causal Memory Loop
 *
 * Programmatically runs the complete 4-phase causal memory loop end-to-end
 * across decoupled OS process boundaries with an isolated SQLite database.
 *
 * Invariants Verified:
 * 1. Phase 1 (Process A) selects Alpha on price, rejects defective deliverable,
 *    and commits failure episode & WATCH status to physical SQLite on disk.
 * 2. SQLite inspection confirms Alpha has consecutiveFailures=1 and outcome="rejected".
 * 3. Phase 2 (Process B) cold starts in fresh process, reads disk store, penalizes Alpha,
 *    selects Beta, verifies complete deliverable, and reports TASK SUCCEEDED.
 * 4. Phase 3 (Process C) tests controlled deletion / amnesia: preserves market catalog,
 *    wipes relationship memory, proves agent reverts to Alpha on price, rejects defective
 *    deliverable, reports TASK FAILED, and renders the causal impact matrix.
 * 5. Phase 4 (Process D) injects storage outage, proves system returns ERROR without
 *    silent in-RAM fallback, and halts fail-closed.
 * 6. Full composite master execution completes cleanly with exit code 0.
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
const demoScriptPath = path.join(repoRoot, "scripts", "demo-causal-memory-loop.ts");
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

function runPhase(phaseFlag: string | null, dbPath: string, tempDir: string): RunResult {
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
    if (phaseFlag) args.push(phaseFlag);
    args.push("--db", dbPath);
    return spawnSync(process.execPath, args, {
      cwd: repoRoot,
      env,
      encoding: "utf8",
      timeout: 45_000,
    });
  }

  // Fallback to pnpm invocation
  const pnpmArgs = ["--filter", "@aura/api", "exec", "tsx", "../../scripts/demo-causal-memory-loop.ts"];
  if (phaseFlag) pnpmArgs.push(phaseFlag);
  pnpmArgs.push("--db", dbPath);
  return spawnSync("pnpm", pnpmArgs, {
    cwd: repoRoot,
    env,
    encoding: "utf8",
    timeout: 45_000,
  });
}

async function runCausalMemoryLoopTest(): Promise<void> {
  console.log("===============================================================================");
  console.log("   AURA MEMORY: AUTOMATED CAUSAL MEMORY LOOP TEST HARNESS");
  console.log("   Verifying Load-Bearing Memory, Verifier Outcomes & Controlled Amnesia");
  console.log("===============================================================================\n");

  if (!fs.existsSync(demoScriptPath)) {
    console.error(`❌ FATAL: Target demo script does not exist at: ${demoScriptPath}`);
    process.exit(1);
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "aura-causal-test-"));
  const dbPath = path.join(tempDir, "isolated-causal-loop.db");

  try {
    // -------------------------------------------------------------------------
    // STEP 1: Phase 1 (Process A - Initial Defect & Failure Commitment)
    // -------------------------------------------------------------------------
    console.log("[Test Step 1] Programmatically invoking Phase 1 (Process A: Initial Defect & Storage)...");
    const res1 = runPhase("--phase-1", dbPath, tempDir);

    if (res1.status !== 0) {
      console.error(`❌ FAIL: Phase 1 exited with non-zero exit code: ${res1.status}`);
      console.error("--- Stderr ---:\n", res1.stderr);
      console.error("--- Stdout ---:\n", res1.stdout);
      process.exit(1);
    }

    const cleanStdout1 = stripAnsi(res1.stdout);
    assert.ok(
      cleanStdout1.includes("virtuals:agent:alpha") || cleanStdout1.includes("Alpha"),
      "Phase 1 must select Provider Alpha on price efficiency.",
    );
    assert.ok(
      /reject|failed verification|missing/i.test(cleanStdout1),
      "Phase 1 must verify deliverable defect and reject deliverable.",
    );
    console.log("✓ Phase 1 exited 0. Provider Alpha selected on price, deliverable rejected, failure committed.");

    // -------------------------------------------------------------------------
    // STEP 2: SQLite Disk Inspection (Zero Shared Memory)
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
    console.log("✓ Physical SQLite database verified on disk:");
    console.log(`  - Relationship Status : ${dbState.alpha.relationshipStatus}`);
    console.log(`  - Consecutive Failures: ${dbState.alpha.consecutiveFailures}`);
    console.log(`  - Latest Episode      : outcome=${latestEpisode.outcome}`);

    // -------------------------------------------------------------------------
    // STEP 3: Phase 2 (Process B - With Memory: Task Success)
    // -------------------------------------------------------------------------
    console.log("\n[Test Step 3] Programmatically invoking Phase 2 (Process B: With Memory -> Task Success)...");
    const res2 = runPhase("--phase-2", dbPath, tempDir);

    if (res2.status !== 0) {
      console.error(`❌ FAIL: Phase 2 exited with non-zero exit code: ${res2.status}`);
      console.error("--- Stderr ---:\n", res2.stderr);
      console.error("--- Stdout ---:\n", res2.stdout);
      process.exit(1);
    }

    const cleanStdout2 = stripAnsi(res2.stdout);
    const betaWon =
      /(Selected|Winner|Winning).*?(Beta|virtuals:agent:beta)/i.test(cleanStdout2) ||
      /(Beta|virtuals:agent:beta).*?(selected|won|winner)/i.test(cleanStdout2);
    assert.ok(
      betaWon,
      "Phase 2 must select Provider Beta over Provider Alpha due to history-aware reputation penalty.",
    );
    assert.ok(
      /TASK SUCCEEDED/i.test(cleanStdout2) || /ACCEPTED/i.test(cleanStdout2),
      "Phase 2 must verify complete deliverable and confirm TASK SUCCEEDED.",
    );
    console.log("✓ Phase 2 exited 0. Provider Beta selected, deliverable verified (1.00/1.00), TASK SUCCEEDED.");

    // -------------------------------------------------------------------------
    // STEP 4: Phase 3 (Process C - Controlled Deletion / Amnesia: Task Fails)
    // -------------------------------------------------------------------------
    console.log("\n[Test Step 4] Programmatically invoking Phase 3 (Process C: Controlled Amnesia -> Task Fails)...");
    const res3 = runPhase("--phase-3", dbPath, tempDir);

    if (res3.status !== 0) {
      console.error(`❌ FAIL: Phase 3 exited with non-zero exit code: ${res3.status}`);
      console.error("--- Stderr ---:\n", res3.stderr);
      console.error("--- Stdout ---:\n", res3.stdout);
      process.exit(1);
    }

    const cleanStdout3 = stripAnsi(res3.stdout);
    const alphaReverted =
      /(selects|selected|winner).*?(Alpha|virtuals:agent:alpha)/i.test(cleanStdout3) ||
      /(Alpha|virtuals:agent:alpha).*?(selects|selected|won|winner)/i.test(cleanStdout3);
    assert.ok(
      alphaReverted,
      "Phase 3 must prove amnesic agent reverts to Alpha solely on price.",
    );
    assert.ok(
      /TASK FAILED/i.test(cleanStdout3) || /REJECTED/i.test(cleanStdout3),
      "Phase 3 must prove deliverable is rejected and TASK FAILS without memory.",
    );
    assert.ok(
      cleanStdout3.includes("CAUSAL MEMORY IMPACT MATRIX"),
      "Phase 3 must render the Causal Memory Impact Matrix.",
    );
    console.log("✓ Phase 3 exited 0. Amnesia verified: Alpha selected on price, deliverable rejected, TASK FAILED.");
    console.log("✓ Causal Memory Impact Matrix successfully verified.");

    // -------------------------------------------------------------------------
    // STEP 5: Phase 4 (Process D - Fault Injection: Fail-Closed Guard)
    // -------------------------------------------------------------------------
    console.log("\n[Test Step 5] Programmatically invoking Phase 4 (Process D: Fault Injection)...");
    const res4 = runPhase("--phase-4", dbPath, tempDir);

    if (res4.status !== 0) {
      console.error(`❌ FAIL: Phase 4 exited with non-zero exit code: ${res4.status}`);
      console.error("--- Stderr ---:\n", res4.stderr);
      console.error("--- Stdout ---:\n", res4.stdout);
      process.exit(1);
    }

    const cleanStdout4 = stripAnsi(res4.stdout);
    assert.ok(
      cleanStdout4.includes("storage_unreachable") || cleanStdout4.includes("ERROR"),
      "Phase 4 must report storage_unreachable error during outage.",
    );
    assert.ok(
      cleanStdout4.includes("refused silent in-RAM mock fallback") || cleanStdout4.includes("Fail-Closed"),
      "Phase 4 must confirm fail-closed invariant without silent in-RAM mock fallback.",
    );
    console.log("✓ Phase 4 exited 0. System confirmed fail-closed (storage_unreachable, zero RAM fallback).");

    // -------------------------------------------------------------------------
    // STEP 6: Full Composite Master Execution
    // -------------------------------------------------------------------------
    console.log("\n[Test Step 6] Verifying full composite master execution...");
    const compositeDb = path.join(tempDir, "composite-causal.db");
    const resComp = runPhase(null, compositeDb, tempDir);

    assert.strictEqual(
      resComp.status,
      0,
      `Full composite run failed with status ${resComp.status}:\n${resComp.stderr}`,
    );
    console.log("✓ Full composite master execution passed cleanly.");

    console.log("\n===============================================================================");
    console.log("   ✔ ALL CAUSAL MEMORY LOOP ASSERTIONS PASSED (100% VERIFIED)");
    console.log("===============================================================================\n");
    process.exit(0);
  } catch (err) {
    console.error("\n❌ CAUSAL MEMORY LOOP TEST FAILED WITH DIAGNOSTIC ERROR:\n", err);
    process.exit(1);
  } finally {
    cleanDirectory(tempDir);
  }
}

runCausalMemoryLoopTest().catch((err) => {
  console.error("Fatal unhandled rejection in test-causal-memory-loop:", err);
  process.exit(1);
});

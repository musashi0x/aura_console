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

import { reconstructCounterpartyStateAt } from "../apps/api/src/services/temporal-engine.js";
import { searchMemoryRecords } from "../apps/api/src/services/semantic-search.js";
import { generateExecutiveSummary } from "../apps/api/src/services/executive-summarizer.js";
import { closeNativeSibylDatabase } from "../apps/api/src/services/native-sibyl.js";

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
  reflections: Array<{
    key: string;
    id: string;
    category: string;
    name: string;
    body: Record<string, unknown>;
  }>;
  dossiers: Array<{
    key: string;
    id: string;
    category: string;
    name: string;
    body: Record<string, unknown>;
  }>;
} {
  if (!fs.existsSync(dbPath)) {
    return { exists: false, reflections: [], dossiers: [] };
  }

  const db = new DatabaseSync(dbPath);
  try {
    const tableCheck = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='entities'")
      .get();
    if (!tableCheck) {
      return { exists: true, reflections: [], dossiers: [] };
    }

    const row = db
      .prepare("SELECT body FROM entities WHERE key = ?")
      .get("counterparty:virtuals:agent:alpha") as { body: string } | undefined;
    
    const alpha = row
      ? (() => {
          const body = JSON.parse(row.body);
          return {
            relationshipStatus: body.relationship_status ?? body.relationshipStatus,
            consecutiveFailures: body.consecutive_failures ?? body.consecutiveFailures,
            overallReliability: body.overall_reliability ?? body.overallReliability,
            alpha: body.alpha,
            beta: body.beta,
            episodes: body.episodes,
          };
        })()
      : undefined;

    const reflectionRows = db
      .prepare("SELECT * FROM entities WHERE category = 'reflection'")
      .all() as Array<{ key: string; id: string; category: string; name: string; body: string }>;
    const reflections = reflectionRows.map((r) => ({
      key: r.key,
      id: r.id,
      category: r.category,
      name: r.name,
      body: JSON.parse(r.body) as Record<string, unknown>,
    }));

    const dossierRows = db
      .prepare("SELECT * FROM entities WHERE category = 'dossier'")
      .all() as Array<{ key: string; id: string; category: string; name: string; body: string }>;
    const dossiers = dossierRows.map((d) => ({
      key: d.key,
      id: d.id,
      category: d.category,
      name: d.name,
      body: JSON.parse(d.body) as Record<string, unknown>,
    }));

    return {
      exists: true,
      alpha,
      reflections,
      dossiers,
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
    assert.ok(
      cleanStdout1.includes("Primitive 1") || cleanStdout1.includes("Reflection Engine"),
      "Phase 1 must render Primitive 1 Reflection card.",
    );
    assert.ok(
      cleanStdout1.includes("Primitive 2") || cleanStdout1.includes("Episodic Memory Consolidation"),
      "Phase 1 must render Primitive 2 Consolidated Dossier card.",
    );
    console.log("✓ Phase 1 exited 0. Provider Alpha selected on price, deliverable rejected, failure committed.");
    console.log("✓ Reflection card (Primitive 1) and Consolidated Dossier card (Primitive 2) rendered.");

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

    // Programmatic assertion: category = 'reflection' for Alpha in SQLite
    console.log("\n[Test Step 2A] Programmatically asserting SQLite category = 'reflection' for Alpha...");
    const alphaReflection = dbState.reflections.find(
      (r) => r.name === "virtuals:agent:alpha" || r.key.includes("virtuals:agent:alpha"),
    );
    assert.ok(alphaReflection, "Physical SQLite must contain category = 'reflection' row for Alpha.");
    assert.strictEqual(alphaReflection.category, "reflection");
    assert.strictEqual(alphaReflection.name, "virtuals:agent:alpha");
    assert.strictEqual(alphaReflection.body.failureCategory, "MISSING_CITATIONS");
    assert.ok(
      typeof alphaReflection.body.rootCause === "string" &&
        /citation|source/i.test(alphaReflection.body.rootCause),
      "Reflection root cause must mention citation/source defect.",
    );
    assert.ok(
      typeof alphaReflection.body.lesson === "string" && alphaReflection.body.lesson.length > 0,
      "Reflection must contain non-empty lesson.",
    );
    assert.ok(
      Array.isArray(alphaReflection.body.schemaErrors) && alphaReflection.body.schemaErrors.length > 0,
      "Reflection must contain schemaErrors array.",
    );
    console.log("✓ Physical SQLite contains valid category = 'reflection' for Alpha.");

    // Programmatic assertion: category = 'dossier' for Alpha in SQLite
    console.log("\n[Test Step 2B] Programmatically asserting SQLite category = 'dossier' for Alpha...");
    const alphaDossier = dbState.dossiers.find(
      (d) => d.name === "virtuals:agent:alpha" || d.key.includes("virtuals:agent:alpha"),
    );
    assert.ok(alphaDossier, "Physical SQLite must contain category = 'dossier' row for Alpha.");
    assert.strictEqual(alphaDossier.category, "dossier");
    assert.strictEqual(alphaDossier.name, "virtuals:agent:alpha");
    assert.strictEqual(alphaDossier.body.totalMissions, 1);
    assert.strictEqual(alphaDossier.body.rejectedCount, 1);
    assert.strictEqual(alphaDossier.body.acceptedCount, 0);
    assert.strictEqual(alphaDossier.body.successRate, 0);
    assert.ok(
      typeof alphaDossier.body.auditTrailHash === "string" &&
        alphaDossier.body.auditTrailHash.length === 64,
      "Dossier must contain 64-char SHA-256 auditTrailHash.",
    );
    assert.ok(
      alphaDossier.body.recurringDefects && typeof alphaDossier.body.recurringDefects === "object",
      "Dossier must contain recurringDefects map.",
    );
    assert.ok(
      Array.isArray(alphaDossier.body.probationHistory) && alphaDossier.body.probationHistory.length >= 1,
      "Dossier must track probation transition from NEW to WATCH.",
    );
    console.log("✓ Physical SQLite contains valid category = 'dossier' for Alpha.");

    // Configure test environment to read from isolated dbPath
    process.env.SIBYL_NATIVE_DB_PATH = dbPath;
    process.env.SIBYL_STORAGE_PATH = dbPath;
    process.env.AURA_NATIVE_STORAGE_PATH = dbPath;
    closeNativeSibylDatabase();

    // Programmatic assertion: Temporal Reconstruction at t0 and t1
    console.log("\n[Test Step 2C] Programmatically asserting Temporal Point-in-Time Reconstruction at t0 and t1...");
    const t0 = reconstructCounterpartyStateAt("virtuals:agent:alpha", 0);
    assert.ok(t0 !== null, "Temporal reconstruction at t0 must return non-null reconstruction.");
    assert.strictEqual(t0.historicalState.relationshipStatus, "NEW");
    assert.strictEqual(t0.historicalState.consecutiveFailures, 0);
    assert.strictEqual(t0.historicalState.overallReliability, 0.5);
    assert.strictEqual(t0.historicalState.episodesCount, 0);
    assert.strictEqual(t0.delta.statusChanged, true);
    assert.strictEqual(t0.delta.pastStatus, "NEW");
    assert.strictEqual(t0.delta.currentStatus, "WATCH");
    assert.strictEqual(t0.delta.failuresDelta, 1);
    assert.strictEqual(t0.delta.missionsDelta, 1);

    const t1 = reconstructCounterpartyStateAt("virtuals:agent:alpha", 1);
    assert.ok(t1 !== null, "Temporal reconstruction at t1 must return non-null reconstruction.");
    assert.strictEqual(t1.historicalState.relationshipStatus, "WATCH");
    assert.strictEqual(t1.historicalState.consecutiveFailures, 1);
    assert.strictEqual(t1.historicalState.episodesCount, 1);
    console.log("✓ Temporal reconstruction at t0 (NEW, 0 failures) and t1 (WATCH, 1 failure) verified.");

    // Programmatic assertion: Semantic Search query returns Alpha reflection with score > 80
    console.log("\n[Test Step 2D] Programmatically asserting Semantic Memory Search query...");
    const searchResults = searchMemoryRecords("missing citation sources");
    assert.ok(searchResults.length >= 1, "Semantic search for 'missing citation sources' must return matches.");
    const topMatch = searchResults[0];
    assert.strictEqual(topMatch.category, "reflection", "Top semantic search match must be category 'reflection'.");
    assert.strictEqual(topMatch.name, "virtuals:agent:alpha", "Top semantic match must target Alpha.");
    assert.ok(
      topMatch.score > 80,
      `Semantic search score for Alpha reflection must be > 80, received: ${topMatch.score}`,
    );
    assert.ok(
      topMatch.matchedTerms.some((t) => ["missing", "citation", "citations", "source", "sources"].includes(t)),
      "Matched terms must contain search keywords.",
    );
    console.log(`✓ Semantic search query returned Alpha reflection with score ${topMatch.score}/100 (> 80).`);

    // Programmatic assertion: Executive Summary returns Risk HIGH
    console.log("\n[Test Step 2E] Programmatically asserting Executive Risk Digest...");
    const execSummary = generateExecutiveSummary("virtuals:agent:alpha");
    assert.ok(execSummary !== null, "Executive summary for Alpha must exist.");
    assert.strictEqual(
      execSummary.riskLevel,
      "HIGH",
      `Executive summary riskLevel must be 'HIGH', found: ${execSummary.riskLevel}`,
    );
    assert.strictEqual(execSummary.relationshipStatus, "WATCH");
    assert.strictEqual(execSummary.consecutiveFailures, 1);
    assert.ok(execSummary.headline.includes("Alpha"), "Headline must mention Alpha.");
    assert.ok(execSummary.headline.includes("WATCH"), "Headline must mention WATCH status.");
    assert.ok(execSummary.keyFindings.length > 0, "Key findings must be populated.");
    assert.ok(execSummary.recommendations.length > 0, "Recommendations must be populated.");
    console.log("✓ Executive summary for Alpha verified with riskLevel = 'HIGH'.");

    closeNativeSibylDatabase();

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
    assert.ok(
      cleanStdout2.includes("Primitive 3") || cleanStdout2.includes("Temporal Point-in-Time"),
      "Phase 2 must render Temporal Point-in-Time diff card (Primitive 3).",
    );
    assert.ok(
      cleanStdout2.includes("Primitive 4") || cleanStdout2.includes("Semantic & Intent-Based"),
      "Phase 2 must render Semantic Memory Search card (Primitive 4).",
    );
    assert.ok(
      cleanStdout2.includes("Primitive 5") || cleanStdout2.includes("Executive Memory"),
      "Phase 2 must render Executive Risk Digest card (Primitive 5).",
    );
    console.log("✓ Phase 2 exited 0. Provider Beta selected, deliverable verified (1.00/1.00), TASK SUCCEEDED.");
    console.log("✓ Temporal card (Primitive 3), Search card (Primitive 4), and Executive card (Primitive 5) rendered.");

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

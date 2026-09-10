#!/usr/bin/env tsx

/**
 * Empirical Challenge Stress Test Suite for Milestone 4 Iteration 2
 *
 * Authored by: Challenger M4 It2 1
 * Purpose: Adversarial stress testing of:
 *   1. Genuine OS Process Decoupling & PID Termination & Zero In-Memory Carryover
 *   2. Custom Database Paths & Ambient Environment Isolation (Zero Default Storage Leakage)
 *   3. Standalone `--temp-db` Execution & Persistent Temp DB Validation
 *   4. Failure Modes: Deletion Prior to Process B, Missing Dirs, Corrupted DB
 */

import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

import {
  closeNativeSibylDatabase,
  getNativeSibylStatus,
  listNativeCounterpartiesFromSibyl,
  retrieveNativeFromSibyl,
} from "../apps/api/src/services/native-sibyl.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const demoScriptPath = path.join(repoRoot, "scripts", "demo-cold-start.ts");
const defaultStoragePath = path.join(os.homedir(), ".sibyl-memory", "native-storage.db");

function stripAnsi(text: string): string {
  return text.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "");
}

function getFileSha256(filePath: string): string | null {
  if (!fs.existsSync(filePath)) return null;
  const content = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(content).digest("hex");
}

function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err: any) {
    return err.code !== "ESRCH";
  }
}

interface ProcessExecutionResult {
  pid: number;
  exitCode: number;
  signal: string | null;
  stdout: string;
  stderr: string;
  pidWasAliveDuringRun: boolean;
  pidIsDeadAfterExit: boolean;
}

function runSpawnMonitored(
  cmd: string,
  args: string[],
  env: NodeJS.ProcessEnv,
): Promise<ProcessExecutionResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: repoRoot,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    const pid = child.pid!;
    let stdout = "";
    let stderr = "";
    let pidWasAliveDuringRun = false;

    if (pid && isPidAlive(pid)) {
      pidWasAliveDuringRun = true;
    }

    child.stdout?.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (err) => reject(err));

    child.on("close", (code, signal) => {
      // Check immediately if PID is dead
      const pidIsDeadAfterExit = !isPidAlive(pid);
      resolve({
        pid,
        exitCode: code ?? (signal ? 128 : 1),
        signal,
        stdout,
        stderr,
        pidWasAliveDuringRun,
        pidIsDeadAfterExit,
      });
    });
  });
}

function cleanEnvWithoutAura(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env };
  for (const key of Object.keys(env)) {
    if (key.startsWith("SIBYL_") || key.startsWith("AURA_")) {
      delete env[key];
    }
  }
  env.NO_COLOR = "1";
  return env;
}

// ---------------------------------------------------------------------------
// TEST SUITE
// ---------------------------------------------------------------------------

async function runEmpiricalStressSuite(): Promise<void> {
  console.log("===============================================================================");
  console.log("   CHALLENGER M4 IT2: EMPIRICAL STRESS TEST SUITE");
  console.log("   Process Decoupling, Environment Isolation, Temp DB & Failure Modes");
  console.log("===============================================================================\n");

  const testTempDir = fs.mkdtempSync(path.join(os.tmpdir(), "aura-challenger-m4it2-"));
  console.log(`[Harness] Working test sandbox: ${testTempDir}\n`);

  let testsPassed = 0;
  let testsFailed = 0;

  async function assertStep(name: string, fn: () => Promise<void>) {
    console.log(`-------------------------------------------------------------------------------`);
    console.log(`▶ CHALLENGE STEP: ${name}`);
    console.log(`-------------------------------------------------------------------------------`);
    try {
      await fn();
      console.log(`✓ PASS: ${name}\n`);
      testsPassed++;
    } catch (err: any) {
      console.error(`❌ FAIL: ${name}`);
      console.error(err);
      console.error("");
      testsFailed++;
      throw err;
    }
  }

  try {
    // -------------------------------------------------------------------------
    // 1. GENUINE OS PROCESS DECOUPLING & PID TERMINATION
    // -------------------------------------------------------------------------
    await assertStep(
      "1.1 OS Process Decoupling: Prove Process A terminates, PID is dead before Process B spawns",
      async () => {
        const customDb = path.join(testTempDir, "process-decoupling.db");
        const env = cleanEnvWithoutAura();

        // Launch Process A
        console.log("  [1.1a] Spawning Process A (--session-a)...");
        const resultA = await runSpawnMonitored("pnpm", [
          "demo:cold-start",
          "--session-a",
          "--db",
          customDb,
        ], env);

        console.log(`    Process A PID: ${resultA.pid}`);
        console.log(`    Process A Exit Code: ${resultA.exitCode}`);
        console.log(`    Process A was alive while executing: ${resultA.pidWasAliveDuringRun}`);
        console.log(`    Process A PID is dead after close event: ${resultA.pidIsDeadAfterExit}`);

        assert.strictEqual(resultA.exitCode, 0, `Process A must exit code 0. Stderr: ${resultA.stderr}`);
        assert.ok(resultA.pidWasAliveDuringRun, "Process A must have been alive during execution");
        assert.ok(resultA.pidIsDeadAfterExit, `Process A PID ${resultA.pid} must be DEAD before Process B spawns`);

        // Extra verification: check OS process table using kill -0
        let osCheckPassed = false;
        try {
          process.kill(resultA.pid, 0);
        } catch (e: any) {
          if (e.code === "ESRCH") osCheckPassed = true;
        }
        assert.ok(osCheckPassed, `kill -0 on Process A PID ${resultA.pid} must throw ESRCH (process does not exist)`);
        console.log(`    Confirmed ESRCH: Process A PID ${resultA.pid} is completely eradicated from OS table.`);

        // Launch Process B only now
        console.log("  [1.1b] Spawning Process B (--session-b) after Process A is verified dead...");
        const resultB = await runSpawnMonitored("pnpm", [
          "demo:cold-start",
          "--session-b",
          "--db",
          customDb,
        ], env);

        console.log(`    Process B PID: ${resultB.pid}`);
        console.log(`    Process B Exit Code: ${resultB.exitCode}`);
        console.log(`    Process B PID is dead after exit: ${resultB.pidIsDeadAfterExit}`);

        assert.notStrictEqual(resultB.pid, resultA.pid, "Process B PID must be completely distinct from Process A");
        assert.strictEqual(resultB.exitCode, 0, `Process B must exit code 0. Stderr: ${resultB.stderr}`);
        assert.ok(resultB.pidIsDeadAfterExit, "Process B PID must be dead after exit");

        const cleanStdoutB = stripAnsi(resultB.stdout);
        assert.ok(/Provider Beta/i.test(cleanStdoutB), "Process B must select Provider Beta");
        assert.ok(/100\s+vs\s+98/.test(cleanStdoutB), "Process B must output 100 vs 98 score comparison");
      },
    );

    await assertStep(
      "1.2 Zero In-Memory Carryover: Rehydration exclusively from SQLite disk (Disk Mutation Oracle)",
      async () => {
        const customDb = path.join(testTempDir, "disk-rehydration-oracle.db");
        const env = cleanEnvWithoutAura();

        // 1. Run Session A
        const resultA = await runSpawnMonitored("pnpm", [
          "demo:cold-start",
          "--session-a",
          "--db",
          customDb,
        ], env);
        assert.strictEqual(resultA.exitCode, 0);

        // 2. Tamper directly with the SQLite database file on disk while Process A is dead
        console.log("  [1.2a] Tampering with SQLite database on disk between sessions...");
        const db = new DatabaseSync(customDb);
        try {
          const row = db.prepare("SELECT body FROM entities WHERE key = ?").get("counterparty:virtuals:agent:alpha") as { body: string };
          const body = JSON.parse(row.body);

          // Change note in latest episode to a unique oracle token
          assert.ok(Array.isArray(body.episodes) && body.episodes.length > 0);
          const oracleToken = "ORACLE_EVIDENCE_PROVING_ZERO_IN_MEMORY_CARRYOVER_" + Date.now();
          body.episodes[body.episodes.length - 1].note = oracleToken;

          db.prepare("UPDATE entities SET body = ? WHERE key = ?").run(
            JSON.stringify(body),
            "counterparty:virtuals:agent:alpha",
          );
          console.log(`    Injected oracle token into SQLite disk file: "${oracleToken}"`);
        } finally {
          db.close();
        }

        // 3. Run Session B. Verify Process B reads the tampered note directly from disk!
        console.log("  [1.2b] Running Process B to observe rehydration from disk...");
        const resultB = await runSpawnMonitored("pnpm", [
          "demo:cold-start",
          "--session-b",
          "--db",
          customDb,
        ], env);
        assert.strictEqual(resultB.exitCode, 0);

        const cleanStdoutB = stripAnsi(resultB.stdout);
        assert.ok(
          cleanStdoutB.includes("ORACLE_EVIDENCE_PROVING_ZERO_IN_MEMORY_CARRYOVER_"),
          "Process B inspectable evidence card MUST display the exact token injected directly into the disk file!",
        );
        console.log("    Verified: Process B rendered the disk-injected oracle token in its terminal evidence card.");
        console.log("    Proof: Zero in-memory state carries over; all state is rehydrated exclusively from disk.");
      },
    );

    // -------------------------------------------------------------------------
    // 2. CUSTOM DATABASE PATHS AND ENVIRONMENT ISOLATION
    // -------------------------------------------------------------------------
    await assertStep(
      "2.1 Custom DB & Clean Environment Isolation: Zero leaked writes to ~/.sibyl-memory/native-storage.db",
      async () => {
        const customDb = path.join(testTempDir, "isolated-clean-env.db");

        // Snapshot default storage path before
        const defaultExistsBefore = fs.existsSync(defaultStoragePath);
        const defaultHashBefore = defaultExistsBefore ? getFileSha256(defaultStoragePath) : null;
        const defaultStatBefore = defaultExistsBefore ? fs.statSync(defaultStoragePath) : null;
        console.log(`  [2.1a] Default storage snapshot before: exists=${defaultExistsBefore}, size=${defaultStatBefore?.size ?? 0}, mtime=${defaultStatBefore?.mtime ?? "N/A"}`);

        // Clean environment with zero SIBYL_* and zero AURA_* variables
        const cleanEnv = cleanEnvWithoutAura();
        assert.strictEqual(cleanEnv.SIBYL_NATIVE_DB_PATH, undefined);
        assert.strictEqual(cleanEnv.SIBYL_STORAGE_PATH, undefined);
        assert.strictEqual(cleanEnv.AURA_NATIVE_STORAGE_PATH, undefined);

        // Run Session A with --db <custom_path>
        console.log(`  [2.1b] Invoking: pnpm demo:cold-start --session-a --db ${customDb}`);
        const resultA = await runSpawnMonitored("pnpm", [
          "demo:cold-start",
          "--session-a",
          "--db",
          customDb,
        ], cleanEnv);
        assert.strictEqual(resultA.exitCode, 0, `Session A failed in clean env: ${resultA.stderr}`);

        // Check custom DB on disk
        assert.ok(fs.existsSync(customDb), `Custom database file was not created at: ${customDb}`);
        const customDbHandle = new DatabaseSync(customDb);
        try {
          const row = customDbHandle.prepare("SELECT body FROM entities WHERE key = ?").get("counterparty:virtuals:agent:alpha") as { body: string };
          assert.ok(row, "Alpha entity must exist in custom database");
          const body = JSON.parse(row.body);
          assert.strictEqual(body.relationship_status, "WATCH", "Alpha must be in WATCH status in custom DB");
          assert.strictEqual(body.consecutive_failures, 1, "Alpha consecutive_failures must be 1 in custom DB");
          assert.ok(Array.isArray(body.episodes) && body.episodes.length >= 1, "Alpha must have >= 1 episode in custom DB");
          assert.strictEqual(body.episodes[body.episodes.length - 1].outcome, "rejected", "Latest episode must be 'rejected'");
          console.log("    Verified custom DB content: status=WATCH, consecutive_failures=1, episode=rejected");
        } finally {
          customDbHandle.close();
        }

        // Verify default storage was completely UNTOUCHED
        if (!defaultExistsBefore) {
          assert.ok(!fs.existsSync(defaultStoragePath), "Default storage was created when it should not have been!");
        } else {
          const defaultStatAfterA = fs.statSync(defaultStoragePath);
          const defaultHashAfterA = getFileSha256(defaultStoragePath);
          assert.strictEqual(defaultStatAfterA.size, defaultStatBefore!.size, "Default storage file size changed!");
          assert.strictEqual(defaultStatAfterA.mtimeMs, defaultStatBefore!.mtimeMs, "Default storage file mtime changed!");
          assert.strictEqual(defaultHashAfterA, defaultHashBefore, "Default storage SHA-256 hash changed!");
        }
        console.log("    Verified default storage (~/.sibyl-memory/native-storage.db) was UNTOUCHED after Session A (0 bytes written, mtime identical).");

        // Run Session B with --db <custom_path> from clean env
        console.log(`  [2.1c] Invoking: pnpm demo:cold-start --session-b --db ${customDb}`);
        const resultB = await runSpawnMonitored("pnpm", [
          "demo:cold-start",
          "--session-b",
          "--db",
          customDb,
        ], cleanEnv);
        assert.strictEqual(resultB.exitCode, 0, `Session B failed in clean env: ${resultB.stderr}`);

        const cleanStdoutB = stripAnsi(resultB.stdout);
        assert.ok(/Provider Beta/i.test(cleanStdoutB), "Session B must select Provider Beta");
        assert.ok(/100\s+vs\s+98/.test(cleanStdoutB), "Session B must display margin 100 vs 98");
        assert.ok(/(?:Pen|Mem|adjustment|penalty):\s*-2/i.test(cleanStdoutB), "Session B must display -2 penalty");

        // Verify default storage is STILL untouched after Session B
        if (defaultExistsBefore) {
          const defaultStatAfterB = fs.statSync(defaultStoragePath);
          const defaultHashAfterB = getFileSha256(defaultStoragePath);
          assert.strictEqual(defaultStatAfterB.size, defaultStatBefore!.size, "Default storage size changed after Session B!");
          assert.strictEqual(defaultStatAfterB.mtimeMs, defaultStatBefore!.mtimeMs, "Default storage mtime changed after Session B!");
          assert.strictEqual(defaultHashAfterB, defaultHashBefore, "Default storage hash changed after Session B!");
        }
        console.log("    Verified default storage was STILL UNTOUCHED after Session B.");
      },
    );

    // -------------------------------------------------------------------------
    // 3. STANDALONE `--temp-db` EXECUTION
    // -------------------------------------------------------------------------
    await assertStep(
      "3.1 Standalone --temp-db Execution: Persistent temporary file created and contains updated state",
      async () => {
        const cleanEnv = cleanEnvWithoutAura();

        console.log("  [3.1a] Executing: pnpm demo:cold-start --session-a --temp-db");
        const resultA = await runSpawnMonitored("pnpm", [
          "demo:cold-start",
          "--session-a",
          "--temp-db",
        ], cleanEnv);

        assert.strictEqual(resultA.exitCode, 0, `Session A with --temp-db failed: ${resultA.stderr}`);

        // Parse temp database path from output
        const match = resultA.stdout.match(/Database:\s+([^\r\n]+)/);
        assert.ok(match && match[1], "Output must log 'Database: <path>'");
        const tempDbPath = match[1].trim();
        console.log(`    Detected created temp DB path: ${tempDbPath}`);

        assert.ok(
          tempDbPath.includes("aura-coldstart-"),
          `Temp DB path should match aura-coldstart pattern: ${tempDbPath}`,
        );

        // Verify file exists on disk
        assert.ok(fs.existsSync(tempDbPath), `Persistent temp DB file does not exist at: ${tempDbPath}`);
        const stat = fs.statSync(tempDbPath);
        assert.ok(stat.size > 0, `Temp DB file must be non-empty (actual: ${stat.size} bytes)`);
        console.log(`    Physical file confirmed on disk: size=${stat.size} bytes`);

        // Inspect SQLite contents inside temp DB
        const db = new DatabaseSync(tempDbPath);
        try {
          const row = db.prepare("SELECT body FROM entities WHERE key = ?").get("counterparty:virtuals:agent:alpha") as { body: string };
          assert.ok(row, "Alpha must exist in temp DB");
          const body = JSON.parse(row.body);
          assert.strictEqual(body.relationship_status, "WATCH", "Alpha status must be WATCH in temp DB");
          assert.strictEqual(body.consecutive_failures, 1, "Alpha consecutive_failures must be 1 in temp DB");
          assert.strictEqual(body.episodes[body.episodes.length - 1].outcome, "rejected", "Alpha episode outcome must be rejected in temp DB");
          console.log("    Verified temp DB state: Alpha in WATCH state, consecutive_failures=1, outcome=rejected");
        } finally {
          db.close();
        }

        // Test running Session B against this persistent temp DB
        console.log("  [3.1b] Executing Session B against the persistent temp DB...");
        const resultB = await runSpawnMonitored("pnpm", [
          "demo:cold-start",
          "--session-b",
          "--db",
          tempDbPath,
        ], cleanEnv);

        assert.strictEqual(resultB.exitCode, 0, `Session B failed with temp DB: ${resultB.stderr}`);
        const cleanStdoutB = stripAnsi(resultB.stdout);
        assert.ok(/Provider Beta/i.test(cleanStdoutB), "Session B with temp DB must select Beta");
        assert.ok(/100\s+vs\s+98/.test(cleanStdoutB), "Session B with temp DB must display 100 vs 98");
        console.log("    Verified Session B completed cleanly against the temp DB.");

        // Clean up temp DB
        try {
          fs.unlinkSync(tempDbPath);
          for (const ext of ["-wal", "-shm", "-journal"]) {
            if (fs.existsSync(tempDbPath + ext)) fs.unlinkSync(tempDbPath + ext);
          }
        } catch {}
      },
    );

    // -------------------------------------------------------------------------
    // 4. FAILURE MODES: MISSING DATABASE, CORRUPT DATABASE, CLEAN CRASH PREVENTION
    // -------------------------------------------------------------------------
    await assertStep(
      "4.1 Failure Mode: SQLite database deleted prior to Process B (Clean exit 1, no unhandled crash)",
      async () => {
        const delDb = path.join(testTempDir, "deleted-prior-to-b.db");
        const env = cleanEnvWithoutAura();

        // 1. Run Session A
        const resultA = await runSpawnMonitored("pnpm", [
          "demo:cold-start",
          "--session-a",
          "--db",
          delDb,
        ], env);
        assert.strictEqual(resultA.exitCode, 0);
        assert.ok(fs.existsSync(delDb), "DB should exist after Session A");

        // 2. Explicitly delete the SQLite database file
        console.log(`  [4.1a] Deleting database file: ${delDb}`);
        fs.unlinkSync(delDb);
        for (const ext of ["-wal", "-shm", "-journal"]) {
          if (fs.existsSync(delDb + ext)) fs.unlinkSync(delDb + ext);
        }
        assert.ok(!fs.existsSync(delDb), "DB file must be deleted");

        // 3. Run Session B against the deleted database
        console.log("  [4.1b] Spawning Process B with deleted database file...");
        const resultB = await runSpawnMonitored("pnpm", [
          "demo:cold-start",
          "--session-b",
          "--db",
          delDb,
        ], env);

        console.log(`    Process B Exit Code: ${resultB.exitCode}`);
        console.log(`    Process B Signal: ${resultB.signal ?? "none"}`);
        console.log(`    Process B Stderr: ${resultB.stderr.trim()}`);

        // Must NOT crash (no uncaughtException, no SIGSEGV, no node unhandled rejection)
        assert.strictEqual(resultB.signal, null, "Process B must not crash from OS signal (e.g. SIGSEGV/SIGABRT)");
        assert.strictEqual(resultB.exitCode, 1, "Process B must handle missing DB with clean controlled exit code 1");
        assert.ok(
          !resultB.stderr.includes("UnhandledPromiseRejection") &&
          !resultB.stderr.includes("uncaughtException"),
          "Process B must not crash with unhandled promise rejection",
        );
        assert.ok(
          resultB.stderr.includes("NO_HISTORY") || resultB.stderr.includes("Expected Alpha in AVAILABLE status"),
          `Stderr should contain actionable diagnostic message about missing history. Actual: ${resultB.stderr}`,
        );
        console.log("    Verified: Process B gracefully detected missing store (NO_HISTORY) and exited 1 with clear diagnostic.");
      },
    );

    await assertStep(
      "4.2 Failure Mode: Non-existent parent directory for Process B",
      async () => {
        const nonExistentDirDb = path.join(testTempDir, "does-not-exist-dir", "sub", "missing.db");
        const env = cleanEnvWithoutAura();

        console.log(`  [4.2a] Spawning Process B with DB in non-existent directory: ${nonExistentDirDb}`);
        const result = await runSpawnMonitored("pnpm", [
          "demo:cold-start",
          "--session-b",
          "--db",
          nonExistentDirDb,
        ], env);

        assert.strictEqual(result.signal, null, "Process B must not crash from OS signal");
        assert.strictEqual(result.exitCode, 1, "Process B must exit with controlled error code 1");
        assert.ok(
          !result.stderr.includes("UnhandledPromiseRejection"),
          "Must not produce unhandled promise rejection",
        );
        console.log("    Verified: Non-existent parent directory handled cleanly without crash.");
      },
    );

    await assertStep(
      "4.3 Failure Mode: Empty (0-byte) database file prior to Process B",
      async () => {
        const emptyDb = path.join(testTempDir, "empty-zero-bytes.db");
        fs.writeFileSync(emptyDb, ""); // 0 bytes
        const env = cleanEnvWithoutAura();

        console.log(`  [4.3a] Spawning Process B with 0-byte database file: ${emptyDb}`);
        const result = await runSpawnMonitored("pnpm", [
          "demo:cold-start",
          "--session-b",
          "--db",
          emptyDb,
        ], env);

        assert.strictEqual(result.signal, null, "Process B must not crash from OS signal");
        assert.strictEqual(result.exitCode, 1, "Process B must exit with controlled error code 1");
        assert.ok(
          result.stderr.includes("NO_HISTORY") ||
          result.stderr.includes("Expected Alpha") ||
          result.stderr.includes("Expected consecutiveFailures"),
          `Process B should report missing or empty record cleanly. Stderr: ${result.stderr}`,
        );
        console.log("    Verified: 0-byte database file handled cleanly without crash.");
      },
    );

    await assertStep(
      "4.4 Failure Mode: Corrupted SQLite database file (Garbage Bytes)",
      async () => {
        const corruptDb = path.join(testTempDir, "corrupted-file.db");
        fs.writeFileSync(corruptDb, "NOT_A_SQLITE_DATABASE_GARBAGE_HEADER_DATA_1234567890\n".repeat(20));
        const env = cleanEnvWithoutAura();

        console.log(`  [4.4a] Spawning Process B with corrupted database file: ${corruptDb}`);
        const result = await runSpawnMonitored("pnpm", [
          "demo:cold-start",
          "--session-b",
          "--db",
          corruptDb,
        ], env);

        assert.strictEqual(result.signal, null, "Process B must not crash from OS signal");
        assert.strictEqual(result.exitCode, 1, "Process B must exit with controlled error code 1");
        assert.ok(
          result.stderr.includes("NO_HISTORY") ||
          result.stdout.includes("Database initialization") ||
          result.stderr.includes("Expected Alpha"),
          "Should handle SQLite corruption cleanly without crashing",
        );
        console.log("    Verified: Corrupted database file handled gracefully without crashing.");
      },
    );

    await assertStep(
      "4.5 Native Sibyl API Deletion Invariant Contract",
      async () => {
        const missingPath = path.join(testTempDir, "never-created.db");
        process.env.SIBYL_NATIVE_DB_PATH = missingPath;
        closeNativeSibylDatabase();

        console.log("  [4.5a] Testing retrieveNativeFromSibyl on missing file...");
        const ret = retrieveNativeFromSibyl("virtuals:agent:alpha");
        assert.strictEqual(ret.status, "NO_HISTORY", "Should return NO_HISTORY");
        assert.strictEqual(ret.overallReliability, 0.5, "Should return neutral prior 0.5");
        assert.strictEqual(ret.confidence, 0.0, "Should return neutral confidence 0.0");
        assert.strictEqual(ret.episodesUsed, 0, "Should return 0 episodes");

        console.log("  [4.5b] Testing listNativeCounterpartiesFromSibyl on missing file...");
        const list = listNativeCounterpartiesFromSibyl();
        assert.strictEqual(list.ok, true);
        assert.strictEqual(list.items.length, 0);

        console.log("  [4.5c] Testing getNativeSibylStatus on missing file...");
        const status = getNativeSibylStatus();
        assert.strictEqual(status.configured, true);
        assert.strictEqual(status.reachable, true);
        assert.strictEqual(status.backend, "native_durable");
        assert.strictEqual(status.entityCount, 0);

        closeNativeSibylDatabase();
        console.log("    Verified: All native-sibyl APIs satisfy clean deletion semantics without throwing.");
      },
    );

    console.log("===============================================================================");
    console.log(`   ALL EMPIRICAL CHALLENGE TESTS COMPLETED`);
    console.log(`   Passed: ${testsPassed} | Failed: ${testsFailed}`);
    console.log("===============================================================================\n");

    if (testsFailed > 0) {
      process.exit(1);
    }
  } finally {
    try {
      if (fs.existsSync(testTempDir)) {
        fs.rmSync(testTempDir, { recursive: true, force: true });
      }
    } catch {}
  }
}

runEmpiricalStressSuite().catch((err) => {
  console.error("FATAL ERROR in runEmpiricalStressSuite:", err);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * Standalone Adversarial Verification Script: Cross-Process Persistence & Concurrency
 *
 * Tests:
 * 1. Process 1 writes counterparty, episode, and Bayesian parameters, then exits.
 * 2. Process 2 cold-starts with zero shared memory, reads from disk, and asserts 100% match.
 * 3. Multiple simultaneous child processes stress-test WAL concurrency and busy_timeout.
 * 4. Concurrent child processes write to the same counterparty to check for lost updates.
 */

import { spawnSync, spawn } from "node:child_process";
import { existsSync, unlinkSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const nodeBin = process.env.NODE || "node";

function cleanDb(dbPath: string) {
  for (const ext of ["", "-wal", "-shm", "-journal"]) {
    const f = dbPath + ext;
    if (existsSync(f)) {
      try {
        unlinkSync(f);
      } catch {
        // ignore
      }
    }
  }
}

async function testColdStartRehydration() {
  console.log("\n=== TEST 1: Decoupled Two-Process Cold-Start Rehydration ===");
  const dbPath = path.join(os.tmpdir(), `standalone-coldstart-${Date.now()}.db`);
  const env = { ...process.env, AURA_NATIVE_STORAGE_PATH: dbPath, AURA_NATIVE_AUTO_SEED: "false" };

  const p1Code = `
    import { recordEpisodeToNativeSibyl, updateNativeCounterpartyInSibyl, closeNativeSibylDatabase } from './src/services/native-sibyl.ts';

    const rec = recordEpisodeToNativeSibyl('virtuals:agent:coldstart', {
      run: 'mission-cold-001',
      taskType: 'market-analysis',
      outcome: 'rejected',
      note: 'Simulated quality failure for cold start test',
      occurredAt: '2026-09-09T12:00:00.000Z',
    });
    if (!rec.ok) {
      console.error('P1 recordEpisode failed:', rec);
      process.exit(1);
    }

    const upd = updateNativeCounterpartyInSibyl('virtuals:agent:coldstart', {
      relationshipStatus: 'WATCH',
      overallReliability: 0.35,
      confidence: 0.82,
      riskNote: 'Penalized by consecutive failure',
      alpha: 3.5,
      beta: 6.5,
      consecutiveFailures: 2,
      totalMissions: 10,
      blockedReason: 'Consecutive failures in watch',
    });
    if (!upd.ok) {
      console.error('P1 updateCounterparty failed:', upd);
      process.exit(1);
    }

    closeNativeSibylDatabase();
    process.exit(0);
  `;

  console.log("[Process 1] Spawning to record episode and Bayesian parameters...");
  const p1 = spawnSync(nodeBin, ["--experimental-strip-types", "-e", p1Code], {
    cwd: path.resolve("apps/api"),
    env,
    encoding: "utf8",
  });

  if (p1.status !== 0) {
    console.error("[Process 1] Failed with exit code", p1.status, p1.stderr);
    cleanDb(dbPath);
    return false;
  }
  console.log("[Process 1] Completed and terminated cleanly with exit code 0.");

  const p2Code = `
    import { retrieveNativeFromSibyl, listNativeCounterpartiesFromSibyl, readNativeMemoryJournal, closeNativeSibylDatabase } from './src/services/native-sibyl.ts';

    const retrieval = retrieveNativeFromSibyl('virtuals:agent:coldstart');
    const counterparties = listNativeCounterpartiesFromSibyl();
    const journal = readNativeMemoryJournal(10, 'virtuals:agent:coldstart');

    console.log('JSON_OUTPUT_START');
    console.log(JSON.stringify({
      retrieval,
      counterparties,
      journal
    }));
    console.log('JSON_OUTPUT_END');
    closeNativeSibylDatabase();
    process.exit(0);
  `;

  console.log("[Process 2] Cold-starting without shared memory to read from disk...");
  const p2 = spawnSync(nodeBin, ["--experimental-strip-types", "-e", p2Code], {
    cwd: path.resolve("apps/api"),
    env,
    encoding: "utf8",
  });

  if (p2.status !== 0) {
    console.error("[Process 2] Failed with exit code", p2.status, p2.stderr);
    cleanDb(dbPath);
    return false;
  }

  const jsonMatch = p2.stdout.match(/JSON_OUTPUT_START\n([\s\S]*?)\nJSON_OUTPUT_END/);
  if (!jsonMatch) {
    console.error("[Process 2] Could not parse JSON output:", p2.stdout);
    cleanDb(dbPath);
    return false;
  }
  const data = JSON.parse(jsonMatch[1]);

  console.log("[Process 2] Rehydrated Retrieval:", data.retrieval);
  const ok =
    data.retrieval.status === "AVAILABLE" &&
    data.retrieval.relationshipStatus === "WATCH" &&
    data.retrieval.overallReliability === 0.35 &&
    data.retrieval.confidence === 0.82 &&
    data.retrieval.alpha === 3.5 &&
    data.retrieval.beta === 6.5 &&
    data.retrieval.consecutiveFailures === 2 &&
    data.retrieval.totalMissions === 10 &&
    data.retrieval.blockedReason === "Consecutive failures in watch" &&
    data.retrieval.episodesUsed === 1;

  cleanDb(dbPath);
  console.log("TEST 1 RESULT:", ok ? "PASSED (Cold-start persistence confirmed)" : "FAILED (State mismatch)");
  return ok;
}

async function testConcurrentWalTransactions() {
  console.log("\n=== TEST 2: Concurrent WAL Transactions Under Multi-Process Contention ===");
  const dbPath = path.join(os.tmpdir(), `standalone-concurrency-${Date.now()}.db`);
  const env = { ...process.env, AURA_NATIVE_STORAGE_PATH: dbPath, AURA_NATIVE_AUTO_SEED: "false" };

  const CONCURRENCY = 15;
  const EPISODES_PER_PROC = 3;

  const workerCode = (id: number) => `
    import { recordEpisodeToNativeSibyl, updateNativeCounterpartyInSibyl, closeNativeSibylDatabase } from './src/services/native-sibyl.ts';

    const agentKey = 'agent-proc-${id}';
    for (let i = 0; i < ${EPISODES_PER_PROC}; i++) {
      const rec = recordEpisodeToNativeSibyl(agentKey, {
        run: 'run-${id}-' + i,
        taskType: 'market-analysis',
        outcome: i % 2 === 0 ? 'accepted' : 'rejected',
        note: 'Episode ' + i + ' from proc ${id}',
        occurredAt: new Date(Date.now() + i * 1000).toISOString(),
      });
      if (!rec.ok) {
        console.error('Proc ${id} failed to record episode:', JSON.stringify(rec));
        process.exit(1);
      }
    }

    const upd = updateNativeCounterpartyInSibyl(agentKey, {
      relationshipStatus: 'WATCH',
      overallReliability: 0.60,
      confidence: 0.85,
      alpha: 5 + ${id},
      beta: 3,
      consecutiveFailures: 1,
      totalMissions: ${EPISODES_PER_PROC},
    });
    if (!upd.ok) {
      console.error('Proc ${id} failed to update counterparty:', JSON.stringify(upd));
      process.exit(1);
    }

    closeNativeSibylDatabase();
    process.exit(0);
  `;

  console.log(`Spawning ${CONCURRENCY} simultaneous child processes against ${dbPath}...`);
  const procs: Promise<{ id: number; code: number | null; stderr: string }>[] = [];
  for (let i = 0; i < CONCURRENCY; i++) {
    procs.push(
      new Promise((resolve) => {
        const child = spawn(nodeBin, ["--experimental-strip-types", "-e", workerCode(i)], {
          cwd: path.resolve("apps/api"),
          env,
          stdio: ["ignore", "pipe", "pipe"],
        });
        let stderr = "";
        child.stderr.on("data", (d) => {
          stderr += d.toString();
        });
        child.on("exit", (code) => {
          resolve({ id: i, code, stderr });
        });
      }),
    );
  }

  const results = await Promise.all(procs);
  const failedProcs = results.filter((r) => r.code !== 0);

  cleanDb(dbPath);
  if (failedProcs.length > 0) {
    console.error(`TEST 2 RESULT: FAILED (${failedProcs.length} processes failed with database is locked)`);
    for (const f of failedProcs) {
      console.error(` - Process ${f.id} error: ${f.stderr.trim()}`);
    }
    return false;
  }
  console.log(`TEST 2 RESULT: PASSED (${CONCURRENCY} processes completed without lock errors)`);
  return true;
}

async function testSharedCounterpartyLostUpdates() {
  console.log("\n=== TEST 3: Concurrent Episode Recording on Same Counterparty (Lost Updates) ===");
  const dbPath = path.join(os.tmpdir(), `standalone-shared-${Date.now()}.db`);
  const env = { ...process.env, AURA_NATIVE_STORAGE_PATH: dbPath, AURA_NATIVE_AUTO_SEED: "false" };

  const initCode = `
    import { recordEpisodeToNativeSibyl, closeNativeSibylDatabase } from './src/services/native-sibyl.ts';
    recordEpisodeToNativeSibyl('shared-agent', { run: 'init', outcome: 'accepted' });
    closeNativeSibylDatabase();
    process.exit(0);
  `;
  spawnSync(nodeBin, ["--experimental-strip-types", "-e", initCode], { cwd: path.resolve("apps/api"), env });

  const CONCURRENCY = 10;
  const workerCode = (id: number) => `
    import { recordEpisodeToNativeSibyl, closeNativeSibylDatabase } from './src/services/native-sibyl.ts';
    const rec = recordEpisodeToNativeSibyl('shared-agent', { run: 'run-p${id}', outcome: 'accepted' });
    closeNativeSibylDatabase();
    process.exit(rec.ok ? 0 : 1);
  `;

  console.log(`Spawning ${CONCURRENCY} simultaneous child processes writing to 'shared-agent'...`);
  const procs: Promise<number | null>[] = [];
  for (let i = 0; i < CONCURRENCY; i++) {
    procs.push(
      new Promise((resolve) => {
        const child = spawn(nodeBin, ["--experimental-strip-types", "-e", workerCode(i)], {
          cwd: path.resolve("apps/api"),
          env,
        });
        child.on("exit", resolve);
      }),
    );
  }
  await Promise.all(procs);

  const verifyCode = `
    import { retrieveNativeFromSibyl, closeNativeSibylDatabase } from './src/services/native-sibyl.ts';
    const res = retrieveNativeFromSibyl('shared-agent');
    console.log('EPISODES_COUNT:' + res.episodesUsed);
    closeNativeSibylDatabase();
    process.exit(0);
  `;
  const verify = spawnSync(nodeBin, ["--experimental-strip-types", "-e", verifyCode], {
    cwd: path.resolve("apps/api"),
    env,
    encoding: "utf8",
  });

  const match = verify.stdout.match(/EPISODES_COUNT:(\d+)/);
  const finalCount = match ? parseInt(match[1], 10) : 0;
  const expectedCount = CONCURRENCY + 1;

  cleanDb(dbPath);
  if (finalCount !== expectedCount) {
    console.error(`TEST 3 RESULT: FAILED (Lost updates detected: got ${finalCount} episodes, expected ${expectedCount})`);
    return false;
  }
  console.log(`TEST 3 RESULT: PASSED (All ${expectedCount} episodes preserved)`);
  return true;
}

async function main() {
  console.log("================================================================================");
  console.log("CHALLENGER M1: STANDALONE EMPIRICAL PERSISTENCE & CONCURRENCY HARNESS");
  console.log("================================================================================");

  const r1 = await testColdStartRehydration();
  const r2 = await testConcurrentWalTransactions();
  const r3 = await testSharedCounterpartyLostUpdates();

  console.log("\n================================================================================");
  console.log("HARNESS VERDICT SUMMARY");
  console.log("================================================================================");
  console.log(`Test 1 (Cold-Start Rehydration):          ${r1 ? "PASS" : "FAIL"}`);
  console.log(`Test 2 (Concurrent WAL Locks):             ${r2 ? "PASS" : "FAIL"}`);
  console.log(`Test 3 (Shared Counterparty Lost Updates): ${r3 ? "PASS" : "FAIL"}`);
  console.log(`Overall Empirical Verdict:                 ${r1 && r2 && r3 ? "APPROVE" : "REJECT"}`);
  console.log("================================================================================");

  process.exit(r1 && r2 && r3 ? 0 : 1);
}

main().catch((err) => {
  console.error("Harness error:", err);
  process.exit(1);
});

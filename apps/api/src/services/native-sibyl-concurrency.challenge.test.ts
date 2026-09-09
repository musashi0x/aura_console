import { unlinkSync, existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync, spawn } from "node:child_process";
import { describe, expect, it } from "vitest";

const nodeBin = process.env.NODE || "node";

describe("Native Sibyl Concurrency & Cross-Process Persistence Challenge", () => {
  it("Objective 1: verifies decoupled cross-process persistence and cold-start Bayesian rehydration", () => {
    const dbPath = path.join(os.tmpdir(), `challenger-coldstart-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
    const env = { ...process.env, AURA_NATIVE_STORAGE_PATH: dbPath, AURA_NATIVE_AUTO_SEED: "false" };

    // Process 1: Record episode and Bayesian parameters, then terminate cleanly
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

    const p1 = spawnSync(nodeBin, ["--experimental-strip-types", "-e", p1Code], {
      cwd: process.cwd(),
      env,
      encoding: "utf8",
    });

    expect(p1.status).toBe(0);

    // Process 2: Cold-starts in a brand-new process with zero shared memory, reads from disk
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

    const p2 = spawnSync(nodeBin, ["--experimental-strip-types", "-e", p2Code], {
      cwd: process.cwd(),
      env,
      encoding: "utf8",
    });

    expect(p2.status).toBe(0);

    const jsonMatch = p2.stdout.match(/JSON_OUTPUT_START\n([\s\S]*?)\nJSON_OUTPUT_END/);
    expect(jsonMatch).not.toBeNull();
    const data = JSON.parse(jsonMatch?.[1] ?? "{}");

    // Assert rehydrated Bayesian parameters and status match Process 1's write exactly
    expect(data.retrieval.status).toBe("AVAILABLE");
    expect(data.retrieval.counterpartyKey).toBe("virtuals:agent:coldstart");
    expect(data.retrieval.relationshipStatus).toBe("WATCH");
    expect(data.retrieval.overallReliability).toBe(0.35);
    expect(data.retrieval.confidence).toBe(0.82);
    expect(data.retrieval.alpha).toBe(3.5);
    expect(data.retrieval.beta).toBe(6.5);
    expect(data.retrieval.consecutiveFailures).toBe(2);
    expect(data.retrieval.totalMissions).toBe(10);
    expect(data.retrieval.blockedReason).toBe("Consecutive failures in watch");
    expect(data.retrieval.episodesUsed).toBe(1);

    // Assert journal and counterparty list match
    expect(data.journal.ok).toBe(true);
    expect(data.journal.count).toBe(1);
    expect(data.journal.episodes[0].run).toBe("mission-cold-001");
    expect(data.journal.episodes[0].outcome).toBe("rejected");

    // Clean up
    for (const ext of ["", "-wal", "-shm", "-journal"]) {
      const f = dbPath + ext;
      if (existsSync(f)) unlinkSync(f);
    }
  });

  it("Objective 2 & 3: stress-tests concurrent write transactions across multiple child processes", async () => {
    const dbPath = path.join(os.tmpdir(), `challenger-concurrency-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
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

    const procs: Promise<{ id: number; code: number | null; stderr: string }>[] = [];
    for (let i = 0; i < CONCURRENCY; i++) {
      procs.push(
        new Promise((resolve) => {
          const child = spawn(nodeBin, ["--experimental-strip-types", "-e", workerCode(i)], {
            cwd: process.cwd(),
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

    // Clean up
    for (const ext of ["", "-wal", "-shm", "-journal"]) {
      const f = dbPath + ext;
      if (existsSync(f)) unlinkSync(f);
    }

    // If PRAGMA busy_timeout = 5000 is correctly protecting connections, no process should fail
    expect(failedProcs, `Processes failed under concurrency due to lock contention: ${JSON.stringify(failedProcs)}`).toHaveLength(0);
  }, 15000);

  it("Objective 3: exposes lost updates when concurrent processes record episodes to the SAME counterparty", async () => {
    const dbPath = path.join(os.tmpdir(), `challenger-shared-counterparty-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
    const env = { ...process.env, AURA_NATIVE_STORAGE_PATH: dbPath, AURA_NATIVE_AUTO_SEED: "false" };

    // Seed initial counterparty
    const initCode = `
      import { recordEpisodeToNativeSibyl, closeNativeSibylDatabase } from './src/services/native-sibyl.ts';
      recordEpisodeToNativeSibyl('shared-agent', { run: 'init', outcome: 'accepted' });
      closeNativeSibylDatabase();
      process.exit(0);
    `;
    spawnSync(nodeBin, ["--experimental-strip-types", "-e", initCode], { cwd: process.cwd(), env });

    const CONCURRENCY = 10;
    const workerCode = (id: number) => `
      import { recordEpisodeToNativeSibyl, closeNativeSibylDatabase } from './src/services/native-sibyl.ts';
      const rec = recordEpisodeToNativeSibyl('shared-agent', { run: 'run-p${id}', outcome: 'accepted' });
      closeNativeSibylDatabase();
      process.exit(rec.ok ? 0 : 1);
    `;

    const procs: Promise<number | null>[] = [];
    for (let i = 0; i < CONCURRENCY; i++) {
      procs.push(
        new Promise((resolve) => {
          const child = spawn(nodeBin, ["--experimental-strip-types", "-e", workerCode(i)], {
            cwd: process.cwd(),
            env,
          });
          child.on("exit", resolve);
        }),
      );
    }
    await Promise.all(procs);

    // Verify final episode count
    const verifyCode = `
      import { retrieveNativeFromSibyl, closeNativeSibylDatabase } from './src/services/native-sibyl.ts';
      const res = retrieveNativeFromSibyl('shared-agent');
      console.log('EPISODES_COUNT:' + res.episodesUsed);
      closeNativeSibylDatabase();
      process.exit(0);
    `;
    const verify = spawnSync(nodeBin, ["--experimental-strip-types", "-e", verifyCode], {
      cwd: process.cwd(),
      env,
      encoding: "utf8",
    });

    const match = verify.stdout.match(/EPISODES_COUNT:(\d+)/);
    const finalCount = parseInt(match?.[1] ?? "0", 10);

    // Clean up
    for (const ext of ["", "-wal", "-shm", "-journal"]) {
      const f = dbPath + ext;
      if (existsSync(f)) unlinkSync(f);
    }

    // Expected: 1 initial + CONCURRENCY = 11 episodes.
    // If read-modify-write is not transactionally locked with BEGIN IMMEDIATE, episodes are silently lost.
    expect(finalCount, `Lost episodes under concurrent writes to same counterparty: got ${finalCount}, expected ${CONCURRENCY + 1}`).toBe(CONCURRENCY + 1);
  }, 15000);
});

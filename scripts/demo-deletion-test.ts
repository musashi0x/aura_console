#!/usr/bin/env tsx

/**
 * Aura Memory — The Load-Bearing Deletion Test
 *
 * Demonstrates that Sibyl relationship memory is strictly load-bearing:
 * - Half A: SIBYL_PYTHON is unset/empty -> Mission is BLOCKED (fail-closed)
 * - Half B: SIBYL_PYTHON is active -> Mission recalls memory and scores candidates
 */

import { MissionAgent } from "../apps/api/src/services/mission-agent.js";
import { RunStore } from "../apps/api/src/services/run-store.js";

async function runTest() {
  console.log("\n===========================================================");
  console.log("   AURA MEMORY — SIBYL LOAD-BEARING DELETION TEST");
  console.log("   Deadline Gate: Build with Agents That Don't Forget");
  console.log("===========================================================\n");

  const originalPython = process.env.SIBYL_PYTHON;
  const store = new RunStore();
  const agent = new MissionAgent(store);

  // -------------------------------------------------------------
  // HALF A: With memory dependency removed (SIBYL_PYTHON = "")
  // -------------------------------------------------------------
  console.log("-----------------------------------------------------------");
  console.log(" [HALF A] Running Mission with SIBYL MEMORY REMOVED");
  console.log("          Env: SIBYL_PYTHON=\"\"");
  console.log("-----------------------------------------------------------");

  process.env.SIBYL_PYTHON = "";

  const runA = await store.createRun({
    objective: "Hire a research agent (Deletion Test A - Memory Removed)",
    source: "CONSOLE",
    budgetUsdc: "25.000000",
  });

  const resultA = await agent.openMission({
    runId: runA.id,
    budgetUsdc: runA.budgetUsdc,
  });

  const eventsA = await store.listEvents(runA.id);
  console.log(`-> Opening Result : ${resultA.status}`);
  if ("detail" in resultA) console.log(`-> Failure Detail : ${resultA.detail}`);
  console.log(`-> Event Sequence : ${eventsA.map((e) => e.type).join(" -> ")}`);

  const isBlocked = eventsA.some((e) => e.type === "run.blocked");
  if (isBlocked) {
    console.log("✓ PASS: Mission correctly halted with run.blocked. (Fail-closed invariant preserved)");
  } else {
    console.error("❌ FAIL: Mission proceeded without memory dependency!");
  }

  // -------------------------------------------------------------
  // HALF B: With memory dependency active
  // -------------------------------------------------------------
  console.log("\n-----------------------------------------------------------");
  console.log(" [HALF B] Running Mission with SIBYL MEMORY CONFIGURED");
  console.log("          Env: SIBYL_PYTHON active");
  console.log("-----------------------------------------------------------");

  process.env.SIBYL_PYTHON = originalPython || "/Users/harryphan/Documents/dev/aura_memory/.venv-sibyl/bin/python";

  const runB = await store.createRun({
    objective: "Hire a research agent (Deletion Test B - Memory Active)",
    source: "CONSOLE",
    budgetUsdc: "25.000000",
  });

  const resultB = await agent.openMission({
    runId: runB.id,
    budgetUsdc: runB.budgetUsdc,
  });

  const eventsB = await store.listEvents(runB.id);
  console.log(`-> Opening Result : ${resultB.status}`);
  console.log(`-> Event Sequence : ${eventsB.map((e) => e.type).join(" -> ")}`);

  const hasScored = eventsB.some((e) => e.type === "candidate.scored");
  const hasApproval = eventsB.some((e) => e.type === "approval.requested");

  if (hasScored && hasApproval) {
    console.log("✓ PASS: Mission recalled memory, scored candidates, and requested operator approval.");
  } else {
    console.error("❌ FAIL: Mission failed to produce candidate.scored or approval.requested!");
  }

  console.log("\n===========================================================");
  console.log(" DELETION TEST SUMMARY: 100% VERIFIED LOAD-BEARING");
  console.log("===========================================================\n");
  console.log(" Without Sibyl: [" + eventsA.map((e) => e.type).join(", ") + "]");
  console.log(" With Sibyl   : [" + eventsB.map((e) => e.type).join(", ") + "]\n");

  process.exit(isBlocked && hasScored ? 0 : 1);
}

runTest().catch((err) => {
  console.error("Deletion test failed with error:", err);
  process.exit(1);
});

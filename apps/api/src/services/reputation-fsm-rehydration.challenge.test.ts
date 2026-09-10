import { randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  checkVeto,
  createInitialReputation,
  formatForSibyl,
  manualUnblock,
  rehydrateFromSibyl,
  updateReputation,
} from "./reputation-fsm.js";
import { MissionAgent } from "./mission-agent.js";
import { MissionExecutionService } from "./mission-execution.js";
import { scoreCandidates } from "./mission-scoring.js";
import {
  closeNativeSibylDatabase,
  getNativeStoragePath,
  resetNativeSibylStorage,
  retrieveNativeFromSibyl,
  updateNativeCounterpartyInSibyl,
} from "./native-sibyl.js";
import { RunStore } from "./run-store.js";
import { retrieveFromSibyl, updateCounterpartyInSibyl } from "./sibyl.js";
import { setupTestSibylDb } from "../test-support/sibyl.js";

describe.sequential("Challenger M3 1: Cross-Session Rehydration & Consecutive Failure State Transitions", () => {
  const store = new RunStore();
  const service = new MissionExecutionService(store);
  const agent = new MissionAgent(store);

  beforeEach(async () => {
    resetNativeSibylStorage({ seedFixtures: false });
    await setupTestSibylDb();
  });

  afterEach(() => {
    closeNativeSibylDatabase();
  });

  afterAll(async () => {
    resetNativeSibylStorage({ seedFixtures: true });
    closeNativeSibylDatabase();
    await setupTestSibylDb();
  });

  async function createApprovedRun(objective: string, counterpartyKey: string, ceilingUsdc = "10.000000") {
    const run = await store.createRun({
      objective,
      source: "AGENT",
      budgetUsdc: "50.000000",
    });

    await store.appendEvent({
      runId: run.id,
      eventId: randomUUID(),
      type: "approval.granted",
      eventTime: new Date(),
      data: {
        ceiling_usdc: ceilingUsdc,
        counterparty_key: counterpartyKey,
        granted_via: "operator_test",
      },
    });

    return run;
  }

  // =========================================================================
  // CHALLENGE 1: MULTI-SESSION FAILURE ACCUMULATION & MISSION 3 VETO
  // =========================================================================
  describe("1. Multi-Session Consecutive Failure Accumulation & Hard Veto", () => {
    it("progresses 2 consecutive failures across separate missions to BLOCKED, and Mission 3 enforces strict veto", async () => {
      const candidateKey = `adversary:vendor:${randomUUID()}`;

      // --- MISSION 1: First Defective Deliverable ---
      const run1 = await createApprovedRun("Mission 1: Competitor analysis report", candidateKey);
      const tmpDir1 = fs.mkdtempSync(path.join(os.tmpdir(), "aura-chall-m1-"));

      try {
        // Create defective deliverable: fewer than 3 competitors and invalid URLs
        const defective1 = {
          competitors: [
            { name: "Faulty Corp", website: "invalid-url", sources: [] },
          ],
        };
        fs.writeFileSync(path.join(tmpDir1, "competitor-report.json"), JSON.stringify(defective1));

        const res1 = await service.execute({
          runId: run1.id,
          worktreePath: tmpDir1,
        });

        expect(res1.status).toBe("REJECTED");
        expect(res1.evaluation.tests_passed).toBe(false);
        expect(res1.reputation.consecutiveFailures).toBe(1);
        expect(res1.reputation.totalMissions).toBe(1);
        expect(res1.reputation.status).toBe("WATCH");
        expect(res1.reputation.alpha).toBe(1.0);
        expect(res1.reputation.beta).toBe(2.0);
        // Confidence authentic scaling: N_eff = 1 => 1 / (1 + 5) = 1/6 ≈ 0.1667
        expect(res1.reputation.confidence).toBeCloseTo(1 / 6, 4);
        expect(res1.reputation.confidence).toBeLessThan(0.85);

        // Verify cold state persisted in Sibyl
        const sibyl1 = await retrieveFromSibyl(candidateKey);
        expect(sibyl1.status).toBe("AVAILABLE");
        if (sibyl1.status === "AVAILABLE") {
          expect(sibyl1.relationshipStatus).toBe("WATCH");
          expect(sibyl1.consecutiveFailures).toBe(1);
          expect(sibyl1.totalMissions).toBe(1);
          expect(sibyl1.alpha).toBe(1.0);
          expect(sibyl1.beta).toBe(2.0);
          expect(sibyl1.confidence).toBeCloseTo(1 / 6, 4);
        }
      } finally {
        fs.rmSync(tmpDir1, { recursive: true, force: true });
      }

      // --- MISSION 2: Second Defective Deliverable on Same Counterparty ---
      const run2 = await createApprovedRun("Mission 2: Deep dive audit", candidateKey);
      const tmpDir2 = fs.mkdtempSync(path.join(os.tmpdir(), "aura-chall-m2-"));

      try {
        // Create defective deliverable: 3 competitors but sources empty
        const defective2 = {
          competitors: [
            { name: "Comp A", website: "https://a.io", sources: [] },
            { name: "Comp B", website: "https://b.io", sources: [] },
            { name: "Comp C", website: "https://c.io", sources: [] },
          ],
        };
        fs.writeFileSync(path.join(tmpDir2, "competitor-report.json"), JSON.stringify(defective2));

        const res2 = await service.execute({
          runId: run2.id,
          worktreePath: tmpDir2,
        });

        // 2 consecutive failures in WATCH state must transition to BLOCKED
        expect(res2.status).toBe("REJECTED");
        expect(res2.reputation.status).toBe("BLOCKED");
        expect(res2.reputation.consecutiveFailures).toBe(2);
        expect(res2.reputation.totalMissions).toBe(2);
        expect(res2.reputation.alpha).toBe(1.0);
        expect(res2.reputation.beta).toBe(3.0);
        expect(res2.reputation.blockedReason).toContain("2 consecutive failures in WATCH state");

        // Verify BLOCKED status persisted in Sibyl
        const sibyl2 = await retrieveFromSibyl(candidateKey);
        expect(sibyl2.status).toBe("AVAILABLE");
        if (sibyl2.status === "AVAILABLE") {
          expect(sibyl2.relationshipStatus).toBe("BLOCKED");
          expect(sibyl2.consecutiveFailures).toBe(2);
          expect(sibyl2.blockedReason).toContain("2 consecutive failures in WATCH state");
        }
      } finally {
        fs.rmSync(tmpDir2, { recursive: true, force: true });
      }

      // --- MISSION 3: Verification of Veto Enforcement ---
      // A) FSM Veto Check
      const rehydrated = rehydrateFromSibyl(candidateKey, await retrieveFromSibyl(candidateKey));
      const veto = checkVeto(rehydrated);
      expect(veto.allowed).toBe(false);
      expect(veto.reason).toContain("BLOCKED: 2 consecutive failures in WATCH state");

      // B) Scoring Veto Invariant Under Ultra-Cheap Price ($0.01 vs $100.00)
      const blockedProfile = formatForSibyl(rehydrated, { observedPriceUsdc: "0.01" });
      const cleanCompetitor = formatForSibyl(createInitialReputation("vendor:clean-competitor"), {
        observedPriceUsdc: "100.00",
      });

      const scoringResult = scoreCandidates([blockedProfile, cleanCompetitor]);
      expect(scoringResult.ranked).toHaveLength(1);
      expect(scoringResult.ranked[0]?.key).toBe("vendor:clean-competitor");
      expect(scoringResult.excluded).toEqual([
        {
          key: candidateKey,
          reason: "Relationship status on record is BLOCKED, so this counterparty was not ranked.",
        },
      ]);

      // C) MissionAgent Open Mission Veto
      // When opening a mission where candidate is in Sibyl alongside clean competitor
      await updateCounterpartyInSibyl("vendor:clean-competitor", {
        relationshipStatus: "KNOWN",
        overallReliability: 0.6,
        confidence: 0.2,
      });

      const mission3Run = await store.createRun({
        objective: "Mission 3: Third procurement run",
        source: "AGENT",
        budgetUsdc: "50.000000",
      });

      const openResult = await agent.openMission({
        runId: mission3Run.id,
        budgetUsdc: "50.000000",
      });

      // The BLOCKED counterparty is strictly excluded; winner is not candidateKey
      expect(openResult.status).toBe("SCORED");
      if (openResult.status === "SCORED") {
        expect(openResult.chosen).not.toBe(candidateKey);
      }

      const m3Events = await store.listEvents(mission3Run.id);
      const scoredEvent = m3Events.find((e) => e.type === "candidate.scored");
      expect(scoredEvent).toBeDefined();
      const scoredData = scoredEvent?.data as Record<string, unknown>;
      const excludedList = (scoredData?.excluded ?? []) as Array<{ key: string; reason: string }>;
      expect(excludedList.some((ex) => ex.key === candidateKey)).toBe(true);
      const candExclusion = excludedList.find((ex) => ex.key === candidateKey);
      expect(candExclusion?.reason).toContain("BLOCKED");

      // D) Auto-Promotion Prevention
      // Even if positive outcome is fed to BLOCKED candidate, status NEVER changes
      const afterAttemptedPass = updateReputation(rehydrated, "success");
      expect(afterAttemptedPass.status).toBe("BLOCKED");
      expect(checkVeto(afterAttemptedPass).allowed).toBe(false);
    });
  });

  // =========================================================================
  // CHALLENGE 2: SUCCESS RECOVERY BEHAVIOR (1 FAILURE -> 1 SUCCESS)
  // =========================================================================
  describe("2. Success Recovery Behavior", () => {
    it("resets consecutiveFailures to 0 and recovers status from WATCH to KNOWN on success", async () => {
      const candidateKey = `recovery:vendor:${randomUUID()}`;

      // Mission 1: Failure drops candidate to WATCH
      let rep = createInitialReputation(candidateKey);
      rep = updateReputation(rep, "failure");
      expect(rep.status).toBe("WATCH");
      expect(rep.consecutiveFailures).toBe(1);
      expect(rep.totalMissions).toBe(1);
      expect(rep.alpha).toBe(1.0);
      expect(rep.beta).toBe(2.0);

      // Persist to Sibyl
      await updateCounterpartyInSibyl(candidateKey, {
        relationshipStatus: rep.status,
        overallReliability: rep.overallReliability,
        confidence: rep.confidence,
        alpha: rep.alpha,
        beta: rep.beta,
        consecutiveFailures: rep.consecutiveFailures,
        totalMissions: rep.totalMissions,
      });

      // Cold rehydration before Mission 2
      const sibylBefore = await retrieveFromSibyl(candidateKey);
      expect(sibylBefore.status).toBe("AVAILABLE");
      const rehydrated = rehydrateFromSibyl(candidateKey, sibylBefore);
      expect(rehydrated.status).toBe("WATCH");
      expect(rehydrated.consecutiveFailures).toBe(1);

      // Mission 2: Success
      const afterSuccess = updateReputation(rehydrated, "success");
      expect(afterSuccess.consecutiveFailures).toBe(0);
      expect(afterSuccess.totalMissions).toBe(2);
      expect(afterSuccess.alpha).toBe(2.0);
      expect(afterSuccess.beta).toBe(2.0);
      expect(afterSuccess.overallReliability).toBe(0.50);
      // Since reliability 0.50 >= watchRecoveryThreshold (0.50), recovers to KNOWN
      expect(afterSuccess.status).toBe("KNOWN");

      // Write-back to Sibyl
      await updateCounterpartyInSibyl(candidateKey, {
        relationshipStatus: afterSuccess.status,
        overallReliability: afterSuccess.overallReliability,
        confidence: afterSuccess.confidence,
        alpha: afterSuccess.alpha,
        beta: afterSuccess.beta,
        consecutiveFailures: afterSuccess.consecutiveFailures,
        totalMissions: afterSuccess.totalMissions,
      });

      // Re-read from storage: verify persisted state
      const sibylAfter = await retrieveFromSibyl(candidateKey);
      expect(sibylAfter.status).toBe("AVAILABLE");
      if (sibylAfter.status === "AVAILABLE") {
        expect(sibylAfter.relationshipStatus).toBe("KNOWN");
        expect(sibylAfter.consecutiveFailures).toBe(0);
        expect(sibylAfter.totalMissions).toBe(2);
        expect(sibylAfter.overallReliability).toBe(0.50);
      }
    });

    it("handles fast-flapping without transitioning to BLOCKED (fail, pass, fail, pass)", () => {
      let cand = createInitialReputation("candidate-flapping");

      // Round 1: Fail -> WATCH (consecutiveFailures: 1)
      cand = updateReputation(cand, "failure");
      expect(cand.status).toBe("WATCH");
      expect(cand.consecutiveFailures).toBe(1);

      // Round 2: Pass -> KNOWN (consecutiveFailures: 0)
      cand = updateReputation(cand, "success");
      expect(cand.status).toBe("KNOWN");
      expect(cand.consecutiveFailures).toBe(0);

      // Round 3: Fail -> WATCH (consecutiveFailures: 1)
      cand = updateReputation(cand, "failure");
      expect(cand.status).toBe("WATCH");
      expect(cand.consecutiveFailures).toBe(1);

      // Round 4: Pass -> KNOWN (consecutiveFailures: 0)
      cand = updateReputation(cand, "success");
      expect(cand.status).toBe("KNOWN");
      expect(cand.consecutiveFailures).toBe(0);

      // Candidate was never BLOCKED
      expect(cand.status).not.toBe("BLOCKED");
      expect(checkVeto(cand).allowed).toBe(true);
    });
  });

  // =========================================================================
  // CHALLENGE 3: AUTHENTIC CONFIDENCE SCALING WITHOUT 0.85 FLOOR
  // =========================================================================
  describe("3. Authentic Confidence Scaling Without Synthetic Floor", () => {
    it("calculates authentic rational saturation confidence starting at 0.0 without floor", () => {
      // 0 missions: alpha=1.0, beta=1.0 -> N_eff=0 -> confidence=0.0
      const initial = createInitialReputation("vendor:fresh");
      expect(initial.confidence).toBe(0.0);

      // 1 mission (failure): alpha=1.0, beta=2.0 -> N_eff=1 -> 1/6 ≈ 0.1667
      const after1Fail = updateReputation(initial, "failure");
      expect(after1Fail.confidence).toBeCloseTo(1 / 6, 4);
      expect(after1Fail.confidence).toBeLessThan(0.85);

      // 1 mission (success): alpha=2.0, beta=1.0 -> N_eff=1 -> 1/6 ≈ 0.1667
      const after1Pass = updateReputation(initial, "success");
      expect(after1Pass.confidence).toBeCloseTo(1 / 6, 4);
      expect(after1Pass.confidence).toBeLessThan(0.85);

      // 2 missions: N_eff=2 -> 2 / (2 + 5) = 2/7 ≈ 0.2857
      const after2 = updateReputation(after1Pass, "success");
      expect(after2.confidence).toBeCloseTo(2 / 7, 4);
      expect(after2.confidence).toBeLessThan(0.85);

      // 5 missions: N_eff=5 -> 5 / (5 + 5) = 0.5000
      let cur = after2;
      for (let i = 0; i < 3; i++) {
        cur = updateReputation(cur, "success");
      }
      expect(cur.totalMissions).toBe(5);
      expect(cur.confidence).toBeCloseTo(5 / 10, 4);
      expect(cur.confidence).toBeLessThan(0.85);

      // 10 missions: N_eff=10 -> 10 / (10 + 5) = 10/15 ≈ 0.6667
      for (let i = 0; i < 5; i++) {
        cur = updateReputation(cur, "success");
      }
      expect(cur.totalMissions).toBe(10);
      expect(cur.confidence).toBeCloseTo(10 / 15, 4);
      expect(cur.confidence).toBeLessThan(0.85);

      // 20 missions: N_eff=20 -> 20 / 25 = 0.8000
      for (let i = 0; i < 10; i++) {
        cur = updateReputation(cur, "success");
      }
      expect(cur.totalMissions).toBe(20);
      expect(cur.confidence).toBeCloseTo(20 / 25, 4);
      expect(cur.confidence).toBeLessThan(0.85);

      // 30 missions: N_eff=30 -> 30 / 35 ≈ 0.8571 (authentically crosses 0.85 only after substantial evidence)
      for (let i = 0; i < 10; i++) {
        cur = updateReputation(cur, "success");
      }
      expect(cur.totalMissions).toBe(30);
      expect(cur.confidence).toBeGreaterThan(0.85);
    });
  });

  // =========================================================================
  // CHALLENGE 4: UNOBSERVED COUNTERPARTY REHYDRATION & NEUTRAL PRIORS
  // =========================================================================
  describe("4. Unobserved Counterparty Rehydration & Neutral Priors", () => {
    it("returns neutral Beta(1,1) priors for unobserved counterparty across all layers", async () => {
      const nonExistentKey = `vendor:unseen:${randomUUID()}`;

      // A) Direct rehydration with null / undefined source
      const rep = rehydrateFromSibyl(nonExistentKey, null);
      expect(rep.candidateId).toBe(nonExistentKey);
      expect(rep.overallReliability).toBe(0.5);
      expect(rep.confidence).toBe(0.0);
      expect(rep.alpha).toBe(1.0);
      expect(rep.beta).toBe(1.0);
      expect(rep.status).toBe("NEW");
      expect(rep.consecutiveFailures).toBe(0);
      expect(rep.totalMissions).toBe(0);

      // B) Retrieval from Native Sibyl SQLite
      const nativeRetrieval = retrieveNativeFromSibyl(nonExistentKey);
      expect(nativeRetrieval.status).toBe("NO_HISTORY");
      if (nativeRetrieval.status === "NO_HISTORY") {
        expect(nativeRetrieval.overallReliability).toBe(0.5);
        expect(nativeRetrieval.confidence).toBe(0.0);
      }

      // C) Retrieval through Sibyl Bridge
      const bridgeRetrieval = await retrieveFromSibyl(nonExistentKey);
      expect(bridgeRetrieval.status).toBe("NO_HISTORY");
      if (bridgeRetrieval.status === "NO_HISTORY") {
        expect(bridgeRetrieval.overallReliability).toBe(0.5);
        expect(bridgeRetrieval.confidence).toBe(0.0);
      }

      // D) Rehydration from NO_HISTORY retrieval yields neutral candidate
      const rehydratedFromSibyl = rehydrateFromSibyl(
        nonExistentKey,
        bridgeRetrieval.status === "AVAILABLE" ? bridgeRetrieval : undefined,
      );
      expect(rehydratedFromSibyl.overallReliability).toBe(0.5);
      expect(rehydratedFromSibyl.confidence).toBe(0.0);
      expect(rehydratedFromSibyl.alpha).toBe(1.0);
      expect(rehydratedFromSibyl.beta).toBe(1.0);
      expect(rehydratedFromSibyl.status).toBe("NEW");
    });
  });

  // =========================================================================
  // CHALLENGE 5: DURABLE STORAGE DELETION & RESET SEMANTICS
  // =========================================================================
  describe("5. Durable Storage Deletion & Reset Semantics", () => {
    it("cleanly resets to NO_HISTORY when storage file is deleted or absent", () => {
      const testKey = "vendor:delete-test";

      // Seed an entity in native storage
      updateNativeCounterpartyInSibyl(testKey, {
        relationshipStatus: "WATCH",
        overallReliability: 0.35,
        confidence: 0.2,
        alpha: 1.0,
        beta: 2.0,
        consecutiveFailures: 1,
        totalMissions: 1,
      });

      // Verify available
      const before = retrieveNativeFromSibyl(testKey);
      expect(before.status).toBe("AVAILABLE");

      // Reset store without fixtures
      resetNativeSibylStorage({ seedFixtures: false });

      // Verify subsequent retrieve returns NO_HISTORY cleanly without throwing
      const after = retrieveNativeFromSibyl(testKey);
      expect(after.status).toBe("NO_HISTORY");
      if (after.status === "NO_HISTORY") {
        expect(after.overallReliability).toBe(0.5);
        expect(after.confidence).toBe(0.0);
      }

      // Verify physically removing storage file directly also produces NO_HISTORY
      const dbPath = getNativeStoragePath();
      if (dbPath !== ":memory:" && fs.existsSync(dbPath)) {
        closeNativeSibylDatabase();
        fs.unlinkSync(dbPath);
        const afterFileRemoval = retrieveNativeFromSibyl(testKey);
        expect(afterFileRemoval.status).toBe("NO_HISTORY");
      }
    });
  });

  // =========================================================================
  // CHALLENGE 6: MANUAL UNBLOCK OPERATOR LIFECYCLE
  // =========================================================================
  describe("6. Operator Manual Intervention (Unblock Contract)", () => {
    it("enforces explicit manual unblock with mandatory audit trail and resets consecutiveFailures", () => {
      let cand = createInitialReputation("vendor:admin-audit");
      cand = updateReputation(cand, "failure");
      cand = updateReputation(cand, "failure");
      expect(cand.status).toBe("BLOCKED");
      expect(cand.consecutiveFailures).toBe(2);

      // Attempting unblock without operatorId throws
      expect(() => manualUnblock(cand, "", "Reason")).toThrow(/operatorId is required/);

      // Attempting unblock without reason throws
      expect(() => manualUnblock(cand, "admin_alice", "")).toThrow(/reason is required/);

      // Valid operator unblock to WATCH
      const unblocked = manualUnblock(
        cand,
        "admin_alice",
        "Counterparty remediation plan verified and accepted",
        "WATCH",
      );

      expect(unblocked.status).toBe("WATCH");
      expect(unblocked.consecutiveFailures).toBe(0);
      expect(unblocked.unblockedBy).toBe("admin_alice");
      expect(unblocked.unblockedReason).toBe("Counterparty remediation plan verified and accepted");
      expect(unblocked.blockedReason).toBeUndefined();

      // Now veto check passes
      expect(checkVeto(unblocked).allowed).toBe(true);
    });
  });
});

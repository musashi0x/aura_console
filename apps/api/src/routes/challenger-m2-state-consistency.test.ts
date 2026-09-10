import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { app } from "../app.js";
import {
  computeAuditTrailHash,
  type CounterpartyDossier,
} from "../services/consolidation-engine.js";
import type { ExecutiveRiskDigest } from "../services/executive-summarizer.js";
import {
  getNativeDb,
  recordEpisodeToNativeSibyl,
  recordNativeReflection,
  resetNativeSibylStorage,
  setNativeSummary,
  updateNativeCounterpartyInSibyl,
  type ReflectionRecord,
} from "../services/native-sibyl.js";
import type { TemporalReputationReconstruction } from "../services/temporal-engine.js";

describe("Challenger M2: Route State Consistency against SQLite Storage", () => {
  beforeEach(() => {
    resetNativeSibylStorage({ seedFixtures: false });
  });

  afterAll(() => {
    resetNativeSibylStorage({ seedFixtures: true });
  });

  // =========================================================================
  // 1. Direct SQLite Seeding & Reflection Route Schema Consistency
  // =========================================================================
  describe("GET /api/counterparties/:key/reflections - SQLite Consistency", () => {
    const CP_KEY = "virtuals:agent:reflection_adversary_test";

    it("returns reflections directly matching raw SQLite entity rows with complete schema", async () => {
      const db = getNativeDb(true);
      expect(db).not.toBeNull();

      const ref1: ReflectionRecord = {
        id: `ref_${randomUUID()}`,
        counterpartyKey: CP_KEY,
        runId: "run-m2-seed-1",
        failureCategory: "MISSING_CITATIONS",
        rootCause: "Deliverable omitted citations in section 2",
        lesson: "Always require source URLs",
        schemaErrors: ["missing: sources[0]", "missing: sources[1]"],
        remediationGuidance: "Pre-validate citation schema before submission",
        createdAt: "2026-08-10T10:00:00.000Z",
      };

      const ref2: ReflectionRecord = {
        id: `ref_${randomUUID()}`,
        counterpartyKey: CP_KEY,
        runId: "run-m2-seed-2",
        failureCategory: "INSUFFICIENT_COMPETITORS",
        rootCause: "Report contained 2 competitors; minimum 3 required",
        lesson: "Enforce competitor threshold of 3",
        schemaErrors: ["competitorsCount: 2 < 3"],
        remediationGuidance: "Validate competitor array length >= 3",
        createdAt: "2026-08-10T11:00:00.000Z",
      };

      // Seed directly into SQLite entities table using raw SQL
      const insert = db!.prepare(`
        INSERT INTO entities (key, id, category, name, status, body, created_at, updated_at)
        VALUES (?, ?, 'reflection', ?, 'active', ?, ?, ?)
      `);

      insert.run(
        `reflection:${CP_KEY}:${ref1.runId}`,
        ref1.id,
        CP_KEY,
        JSON.stringify(ref1),
        ref1.createdAt,
        ref1.createdAt,
      );
      insert.run(
        `reflection:${CP_KEY}:${ref2.runId}`,
        ref2.id,
        CP_KEY,
        JSON.stringify(ref2),
        ref2.createdAt,
        ref2.createdAt,
      );

      // Verify records are physically in SQLite
      const sqlRows = db!
        .prepare("SELECT * FROM entities WHERE category = 'reflection' AND name = ? ORDER BY created_at DESC")
        .all(CP_KEY) as Array<{ key: string; body: string }>;
      expect(sqlRows).toHaveLength(2);

      // Query route
      const res = await app.request(`/api/counterparties/${encodeURIComponent(CP_KEY)}/reflections`);
      expect(res.status).toBe(200);

      const payload = (await res.json()) as {
        ok: boolean;
        counterpartyKey: string;
        count: number;
        items: ReflectionRecord[];
      };

      expect(payload.ok).toBe(true);
      expect(payload.counterpartyKey).toBe(CP_KEY);
      expect(payload.count).toBe(2);
      expect(payload.items).toHaveLength(2);

      // Order must be DESC by createdAt: ref2 (11:00) then ref1 (10:00)
      expect(payload.items[0]).toEqual(ref2);
      expect(payload.items[1]).toEqual(ref1);

      // Verify every schema field matches verbatim
      for (const item of payload.items) {
        expect(typeof item.id).toBe("string");
        expect(item.counterpartyKey).toBe(CP_KEY);
        expect(typeof item.runId).toBe("string");
        expect(["MISSING_CITATIONS", "INSUFFICIENT_COMPETITORS", "SCHEMA_VIOLATION", "TEST_FAILURE", "TIMEOUT"]).toContain(item.failureCategory);
        expect(typeof item.rootCause).toBe("string");
        expect(typeof item.lesson).toBe("string");
        expect(Array.isArray(item.schemaErrors)).toBe(true);
        expect(typeof item.remediationGuidance).toBe("string");
        expect(typeof item.createdAt).toBe("string");
      }
    });

    it("isolates reflections by counterpartyKey without cross-tenant leakage", async () => {
      const CP_A = "virtuals:agent:tenant_alpha";
      const CP_B = "virtuals:agent:tenant_beta";

      recordNativeReflection({
        id: "ref-alpha-1",
        counterpartyKey: CP_A,
        runId: "run-a",
        failureCategory: "TIMEOUT",
        rootCause: "Alpha timed out",
        lesson: "Increase timeout for Alpha",
        schemaErrors: ["Timeout after 30s"],
        remediationGuidance: "Adjust SLA",
        createdAt: "2026-08-10T12:00:00.000Z",
      });

      recordNativeReflection({
        id: "ref-beta-1",
        counterpartyKey: CP_B,
        runId: "run-b",
        failureCategory: "SCHEMA_VIOLATION",
        rootCause: "Beta sent invalid fields",
        lesson: "Beta schema check",
        schemaErrors: ["invalid field"],
        remediationGuidance: "Schema check",
        createdAt: "2026-08-10T12:05:00.000Z",
      });

      const resA = await app.request(`/api/counterparties/${encodeURIComponent(CP_A)}/reflections`);
      const bodyA = (await resA.json()) as { count: number; items: ReflectionRecord[] };
      expect(bodyA.count).toBe(1);
      expect(bodyA.items[0]?.counterpartyKey).toBe(CP_A);
      expect(bodyA.items[0]?.id).toBe("ref-alpha-1");

      const resB = await app.request(`/api/counterparties/${encodeURIComponent(CP_B)}/reflections`);
      const bodyB = (await resB.json()) as { count: number; items: ReflectionRecord[] };
      expect(bodyB.count).toBe(1);
      expect(bodyB.items[0]?.counterpartyKey).toBe(CP_B);
      expect(bodyB.items[0]?.id).toBe("ref-beta-1");
    });

    it("gracefully returns empty array for counterparty with no reflections", async () => {
      const res = await app.request("/api/counterparties/virtuals:agent:virgin_candidate/reflections");
      expect(res.status).toBe(200);
      const body = (await res.json()) as { ok: boolean; count: number; items: unknown[] };
      expect(body.ok).toBe(true);
      expect(body.count).toBe(0);
      expect(body.items).toEqual([]);
    });
  });

  // =========================================================================
  // 2. Dossier Route Consistency against SQLite
  // =========================================================================
  describe("GET /api/counterparties/:key/dossier - SQLite Consistency", () => {
    const CP_KEY = "virtuals:agent:dossier_direct_sqlite";

    it("returns directly seeded SQLite dossier verbatim without mutation", async () => {
      const db = getNativeDb(true);
      expect(db).not.toBeNull();

      const seededDossier: CounterpartyDossier = {
        counterpartyKey: CP_KEY,
        displayName: "Direct SQLite Counterparty",
        totalMissions: 10,
        acceptedCount: 7,
        rejectedCount: 3,
        successRate: 0.7,
        recurringDefects: {
          missing_citations: 2,
          timeout: 1,
        },
        probationHistory: [
          {
            fromStatus: "NEW",
            toStatus: "KNOWN",
            runId: "run-001",
            reason: "Initial successful mission",
            timestamp: "2026-08-01T10:00:00.000Z",
          },
          {
            fromStatus: "KNOWN",
            toStatus: "WATCH",
            runId: "run-002",
            reason: "Mission failed verification",
            timestamp: "2026-08-02T10:00:00.000Z",
          },
        ],
        auditTrailHash: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
        lastConsolidatedAt: "2026-08-10T12:00:00.000Z",
      };

      // Raw SQL write directly into entities table
      db!.prepare(`
        INSERT INTO entities (key, id, category, name, status, body, created_at, updated_at)
        VALUES (?, ?, 'dossier', ?, 'active', ?, ?, ?)
      `).run(
        `dossier:${CP_KEY}`,
        "dossier-raw-id",
        CP_KEY,
        JSON.stringify(seededDossier),
        seededDossier.lastConsolidatedAt,
        seededDossier.lastConsolidatedAt,
      );

      // Query route
      const res = await app.request(`/api/counterparties/${encodeURIComponent(CP_KEY)}/dossier`);
      expect(res.status).toBe(200);

      const returnedDossier = (await res.json()) as CounterpartyDossier;
      expect(returnedDossier).toEqual(seededDossier);

      // Confirm SQLite entity matches
      const sqlRow = db!.prepare("SELECT body FROM entities WHERE key = ?").get(`dossier:${CP_KEY}`) as { body: string };
      expect(JSON.parse(sqlRow.body)).toEqual(returnedDossier);
    });

    it("triggers on-demand consolidation from SQLite episodes and writes back to SQLite", async () => {
      const CP_CONSOLIDATE = "virtuals:agent:needs_consolidation";

      // Seed 3 raw episodes into SQLite
      recordEpisodeToNativeSibyl(CP_CONSOLIDATE, {
        run: "run-c1",
        outcome: "accepted",
        note: "Accepted delivery",
        occurredAt: "2026-08-01T10:00:00.000Z",
      });
      recordEpisodeToNativeSibyl(CP_CONSOLIDATE, {
        run: "run-c2",
        outcome: "rejected",
        note: "Missing sources and citations in competitor research",
        occurredAt: "2026-08-02T10:00:00.000Z",
      });
      recordEpisodeToNativeSibyl(CP_CONSOLIDATE, {
        run: "run-c3",
        outcome: "accepted",
        note: "Accepted on re-submission",
        occurredAt: "2026-08-03T10:00:00.000Z",
      });

      // Also seed a reflection
      recordNativeReflection({
        id: "ref-c2",
        counterpartyKey: CP_CONSOLIDATE,
        runId: "run-c2",
        failureCategory: "MISSING_CITATIONS",
        rootCause: "Deliverable lacked source URLs",
        lesson: "Check citations",
        schemaErrors: ["missing citation"],
        remediationGuidance: "Add citations",
        createdAt: "2026-08-02T10:05:00.000Z",
      });

      // Verify NO dossier entity exists prior to request
      const db = getNativeDb(false);
      const preRow = db?.prepare("SELECT body FROM entities WHERE key = ?").get(`dossier:${CP_CONSOLIDATE}`);
      expect(preRow).toBeUndefined();

      // Query GET /dossier -> must trigger on-demand consolidation
      const res = await app.request(`/api/counterparties/${encodeURIComponent(CP_CONSOLIDATE)}/dossier`);
      expect(res.status).toBe(200);

      const dossier = (await res.json()) as CounterpartyDossier;
      expect(dossier.counterpartyKey).toBe(CP_CONSOLIDATE);
      expect(dossier.totalMissions).toBe(3);
      expect(dossier.acceptedCount).toBe(2);
      expect(dossier.rejectedCount).toBe(1);
      expect(dossier.successRate).toBeCloseTo(2 / 3, 3);
      expect(dossier.recurringDefects.missing_citations).toBe(1);

      // Verify cryptographic audit trail hash is valid SHA-256 (64 hex characters)
      expect(dossier.auditTrailHash).toMatch(/^[a-f0-9]{64}$/);

      // Recompute audit trail hash manually to verify deterministic correctness
      const expectedHash = computeAuditTrailHash([
        { run: "run-c1", outcome: "accepted", occurredAt: "2026-08-01T10:00:00.000Z" },
        { run: "run-c2", outcome: "rejected", occurredAt: "2026-08-02T10:00:00.000Z" },
        { run: "run-c3", outcome: "accepted", occurredAt: "2026-08-03T10:00:00.000Z" },
      ]);
      expect(dossier.auditTrailHash).toBe(expectedHash);

      // Verify that the dossier was written back into SQLite table entities
      const postRow = db?.prepare("SELECT body FROM entities WHERE key = ?").get(`dossier:${CP_CONSOLIDATE}`) as { body: string };
      expect(postRow).toBeDefined();
      const persistedDossier = JSON.parse(postRow.body) as CounterpartyDossier;
      expect(persistedDossier).toEqual(dossier);
    });

    it("returns 404 with dossier_not_found for an unrecorded counterparty", async () => {
      const res = await app.request("/api/counterparties/virtuals:agent:unknown_phantom/dossier");
      expect(res.status).toBe(404);
      const body = (await res.json()) as { error: { code: string; message: string } };
      expect(body.error.code).toBe("dossier_not_found");
    });
  });

  // =========================================================================
  // 3. Summary Route Consistency & Dynamic Risk Tier Alignment
  // =========================================================================
  describe("GET /api/counterparties/:key/summary - SQLite Consistency & Risk Tiers", () => {
    it("returns directly seeded SQLite summary verbatim", async () => {
      const CP_DIRECT = "virtuals:agent:summary_direct";
      const seededSummary: ExecutiveRiskDigest = {
        counterpartyKey: CP_DIRECT,
        displayName: "Direct Summary Agent",
        headline: "Direct Summary Agent: Custom headline",
        riskLevel: "HIGH",
        reliabilityRating: "45.0% (NEUTRAL)",
        relationshipStatus: "WATCH",
        consecutiveFailures: 1,
        totalMissions: 4,
        successRate: 0.75,
        keyFindings: ["Finding A", "Finding B"],
        recommendations: ["Rec A", "Rec B"],
        generatedAt: "2026-08-10T12:00:00.000Z",
      };

      setNativeSummary(CP_DIRECT, seededSummary);

      const res = await app.request(`/api/counterparties/${encodeURIComponent(CP_DIRECT)}/summary`);
      expect(res.status).toBe(200);

      const returned = (await res.json()) as ExecutiveRiskDigest;
      expect(returned).toEqual(seededSummary);
    });

    it("dynamically generates summary aligning risk tiers with SQLite reputation state", async () => {
      // Test matrix:
      // 1. BLOCKED -> CRITICAL risk, DO NOT HIRE recommendation, veto headline
      // 2. WATCH with 1 failure -> HIGH risk, PROCEED WITH CAUTION, WATCH headline
      // 3. KNOWN -> MEDIUM risk, ELIGIBLE recommendation
      // 4. PREFERRED with reliability >= 0.8 -> LOW risk, RECOMMENDED recommendation

      const cases = [
        {
          key: "virtuals:agent:risk_blocked",
          status: "BLOCKED",
          failures: 2,
          reliability: 0.25,
          confidence: 0.3,
          missions: 2,
          expectedRisk: "CRITICAL",
          headlineMustContain: "hard veto",
          recMustContain: "DO NOT HIRE",
        },
        {
          key: "virtuals:agent:risk_watch",
          status: "WATCH",
          failures: 1,
          reliability: 0.4,
          confidence: 0.2,
          missions: 1,
          expectedRisk: "HIGH",
          headlineMustContain: "WATCH",
          recMustContain: "PROCEED WITH CAUTION",
        },
        {
          key: "virtuals:agent:risk_known",
          status: "KNOWN",
          failures: 0,
          reliability: 0.65,
          confidence: 0.4,
          missions: 4,
          expectedRisk: "MEDIUM",
          headlineMustContain: "Active counterparty",
          recMustContain: "ELIGIBLE",
        },
        {
          key: "virtuals:agent:risk_preferred",
          status: "PREFERRED",
          failures: 0,
          reliability: 0.92,
          confidence: 0.85,
          missions: 10,
          expectedRisk: "LOW",
          headlineMustContain: "Verified high-trust",
          recMustContain: "RECOMMENDED",
        },
      ];

      for (const tc of cases) {
        updateNativeCounterpartyInSibyl(tc.key, {
          relationshipStatus: tc.status,
          consecutiveFailures: tc.failures,
          overallReliability: tc.reliability,
          confidence: tc.confidence,
          totalMissions: tc.missions,
        });

        const res = await app.request(`/api/counterparties/${encodeURIComponent(tc.key)}/summary`);
        expect(res.status).toBe(200);

        const summary = (await res.json()) as ExecutiveRiskDigest;
        expect(summary.counterpartyKey).toBe(tc.key);
        expect(summary.riskLevel).toBe(tc.expectedRisk);
        expect(summary.relationshipStatus).toBe(tc.status);
        expect(summary.consecutiveFailures).toBe(tc.failures);
        expect(summary.headline).toContain(tc.headlineMustContain);
        expect(summary.recommendations.some((r) => r.includes(tc.recMustContain))).toBe(true);

        // Verify write-back: summary was saved to SQLite entities table
        const db = getNativeDb(false);
        const savedRow = db?.prepare("SELECT body FROM entities WHERE key = ?").get(`summary:${tc.key}`) as { body: string };
        expect(savedRow).toBeDefined();
        const persisted = JSON.parse(savedRow.body) as ExecutiveRiskDigest;
        expect(persisted.riskLevel).toBe(tc.expectedRisk);
      }
    });

    it("embeds executive_summary in GET /api/counterparties/:key/memory matching summary route", async () => {
      const CP_KEY = "virtuals:agent:memory_embed_test";
      updateNativeCounterpartyInSibyl(CP_KEY, {
        relationshipStatus: "WATCH",
        consecutiveFailures: 1,
        overallReliability: 0.42,
      });

      const summaryRes = await app.request(`/api/counterparties/${encodeURIComponent(CP_KEY)}/summary`);
      expect(summaryRes.status).toBe(200);
      const summaryPayload = (await summaryRes.json()) as ExecutiveRiskDigest;

      const memRes = await app.request(`/api/counterparties/${encodeURIComponent(CP_KEY)}/memory`);
      expect(memRes.status).toBe(200);
      const memPayload = (await memRes.json()) as { executive_summary?: ExecutiveRiskDigest };

      expect(memPayload.executive_summary).toBeDefined();
      expect(memPayload.executive_summary?.counterpartyKey).toBe(CP_KEY);
      expect(memPayload.executive_summary?.riskLevel).toBe(summaryPayload.riskLevel);
      expect(memPayload.executive_summary?.relationshipStatus).toBe(summaryPayload.relationshipStatus);
    });

    it("returns 404 for non-existent counterparty with no records", async () => {
      const res = await app.request("/api/counterparties/virtuals:agent:nobody_here/summary");
      expect(res.status).toBe(404);
      const body = (await res.json()) as { error: { code: string } };
      expect(body.error.code).toBe("counterparty_not_found");
    });
  });

  // =========================================================================
  // 4. Temporal Replay Route Consistency at Checkpoints t0, t1, t2
  // =========================================================================
  describe("GET /api/counterparties/:key/temporal - Sequence Checkpoints Replay", () => {
    const CP_KEY = "virtuals:agent:temporal_adversarial";

    const ep1 = {
      run: "run-t1",
      outcome: "rejected" as const,
      note: "Episode 1 rejected: Missing citations",
      occurredAt: "2026-08-01T10:00:00.000Z",
    };
    const ep2 = {
      run: "run-t2",
      outcome: "rejected" as const,
      note: "Episode 2 rejected: 2nd consecutive failure -> trigger BLOCKED",
      occurredAt: "2026-08-02T10:00:00.000Z",
    };
    const ep3 = {
      run: "run-t3",
      outcome: "accepted" as const,
      note: "Episode 3: Hard veto invariant prevents promotion while BLOCKED",
      occurredAt: "2026-08-03T10:00:00.000Z",
    };

    beforeEach(() => {
      // Seed the 3 episodes sequentially into SQLite
      recordEpisodeToNativeSibyl(CP_KEY, ep1);
      recordEpisodeToNativeSibyl(CP_KEY, ep2);
      recordEpisodeToNativeSibyl(CP_KEY, ep3);
    });

    it("reconstructs exact mathematical FSM parameters at t0, t1, t2 via episode index", async () => {
      // Manual FSM calculation:
      // Init (t0): alpha=1, beta=1, rel=0.5, conf=0, status=NEW, failures=0, missions=0
      // Ep 1 (t1): outcome=failure -> alpha=1, beta=2, rel=1/3 (~0.3333), conf=1/6 (~0.1667), status=WATCH, failures=1, missions=1
      // Ep 2 (t2): outcome=failure -> 2 consecutive failures in WATCH -> alpha=1, beta=3, rel=0.25, conf=2/7 (~0.2857), status=BLOCKED, failures=2, missions=2
      // Ep 3 (t3): BLOCKED veto prevents update -> alpha=1, beta=3, rel=0.25, status=BLOCKED, failures=2, missions=2

      // Checkpoint t0 (asOf=0: prior neutral state before any missions)
      const res0 = await app.request(`/api/counterparties/${encodeURIComponent(CP_KEY)}/temporal?asOf=0`);
      expect(res0.status).toBe(200);
      const body0 = (await res0.json()) as TemporalReputationReconstruction;

      expect(body0.asOfType).toBe("episode_index");
      expect(body0.asOf).toBe("0");
      expect(body0.historicalState.relationshipStatus).toBe("NEW");
      expect(body0.historicalState.overallReliability).toBe(0.5);
      expect(body0.historicalState.confidence).toBe(0);
      expect(body0.historicalState.alpha).toBe(1.0);
      expect(body0.historicalState.beta).toBe(1.0);
      expect(body0.historicalState.consecutiveFailures).toBe(0);
      expect(body0.historicalState.totalMissions).toBe(0);
      expect(body0.historicalState.episodesCount).toBe(0);

      // Current state at present is BLOCKED
      expect(body0.currentState.relationshipStatus).toBe("BLOCKED");
      expect(body0.currentState.overallReliability).toBe(0.25);
      expect(body0.currentState.consecutiveFailures).toBe(2);
      expect(body0.currentState.episodesCount).toBe(3);

      // Delta from t0 to current
      expect(body0.delta.statusChanged).toBe(true);
      expect(body0.delta.pastStatus).toBe("NEW");
      expect(body0.delta.currentStatus).toBe("BLOCKED");
      expect(body0.delta.reliabilityDelta).toBeCloseTo(0.25 - 0.5, 4); // -0.25
      expect(body0.delta.failuresDelta).toBe(2); // 2 - 0

      // Checkpoint t1 (asOf=1: state after 1st episode)
      const res1 = await app.request(`/api/counterparties/${encodeURIComponent(CP_KEY)}/temporal?asOf=1`);
      expect(res1.status).toBe(200);
      const body1 = (await res1.json()) as TemporalReputationReconstruction;

      expect(body1.asOfType).toBe("episode_index");
      expect(body1.asOf).toBe("1");
      expect(body1.historicalState.relationshipStatus).toBe("WATCH");
      expect(body1.historicalState.alpha).toBe(1.0);
      expect(body1.historicalState.beta).toBe(2.0);
      expect(body1.historicalState.overallReliability).toBeCloseTo(1 / 3, 4);
      expect(body1.historicalState.confidence).toBeCloseTo(1 / 6, 4);
      expect(body1.historicalState.consecutiveFailures).toBe(1);
      expect(body1.historicalState.totalMissions).toBe(1);
      expect(body1.historicalState.episodesCount).toBe(1);

      // Delta from t1 to current
      expect(body1.delta.statusChanged).toBe(true);
      expect(body1.delta.pastStatus).toBe("WATCH");
      expect(body1.delta.currentStatus).toBe("BLOCKED");
      expect(body1.delta.reliabilityDelta).toBeCloseTo(0.25 - 1 / 3, 4);
      expect(body1.delta.failuresDelta).toBe(1); // 2 - 1

      // Checkpoint t2 (asOf=2: state after 2nd episode -> transitioned to BLOCKED)
      const res2 = await app.request(`/api/counterparties/${encodeURIComponent(CP_KEY)}/temporal?asOf=2`);
      expect(res2.status).toBe(200);
      const body2 = (await res2.json()) as TemporalReputationReconstruction;

      expect(body2.asOfType).toBe("episode_index");
      expect(body2.asOf).toBe("2");
      expect(body2.historicalState.relationshipStatus).toBe("BLOCKED");
      expect(body2.historicalState.alpha).toBe(1.0);
      expect(body2.historicalState.beta).toBe(3.0);
      expect(body2.historicalState.overallReliability).toBe(0.25);
      expect(body2.historicalState.confidence).toBeCloseTo(2 / 7, 4);
      expect(body2.historicalState.consecutiveFailures).toBe(2);
      expect(body2.historicalState.totalMissions).toBe(2);
      expect(body2.historicalState.episodesCount).toBe(2);

      // Delta at t2: both past and current are BLOCKED
      expect(body2.delta.statusChanged).toBe(false);
      expect(body2.delta.pastStatus).toBe("BLOCKED");
      expect(body2.delta.currentStatus).toBe("BLOCKED");
      expect(body2.delta.reliabilityDelta).toBe(0);
      expect(body2.delta.failuresDelta).toBe(0);
    });

    it("reconstructs identical state using ISO timestamp cutoffs", async () => {
      // Cutoff before ep1: 2026-08-01T08:00:00Z -> should equal t0
      const resT0 = await app.request(
        `/api/counterparties/${encodeURIComponent(CP_KEY)}/temporal?asOf=2026-08-01T08:00:00.000Z`,
      );
      expect(resT0.status).toBe(200);
      const bodyT0 = (await resT0.json()) as TemporalReputationReconstruction;
      expect(bodyT0.asOfType).toBe("timestamp");
      expect(bodyT0.historicalState.episodesCount).toBe(0);
      expect(bodyT0.historicalState.relationshipStatus).toBe("NEW");

      // Cutoff between ep1 and ep2: 2026-08-01T15:00:00Z -> should equal t1
      const resT1 = await app.request(
        `/api/counterparties/${encodeURIComponent(CP_KEY)}/temporal?asOf=2026-08-01T15:00:00.000Z`,
      );
      expect(resT1.status).toBe(200);
      const bodyT1 = (await resT1.json()) as TemporalReputationReconstruction;
      expect(bodyT1.asOfType).toBe("timestamp");
      expect(bodyT1.historicalState.episodesCount).toBe(1);
      expect(bodyT1.historicalState.relationshipStatus).toBe("WATCH");

      // Cutoff between ep2 and ep3: 2026-08-02T15:00:00Z -> should equal t2
      const resT2 = await app.request(
        `/api/counterparties/${encodeURIComponent(CP_KEY)}/temporal?asOf=2026-08-02T15:00:00.000Z`,
      );
      expect(resT2.status).toBe(200);
      const bodyT2 = (await resT2.json()) as TemporalReputationReconstruction;
      expect(bodyT2.asOfType).toBe("timestamp");
      expect(bodyT2.historicalState.episodesCount).toBe(2);
      expect(bodyT2.historicalState.relationshipStatus).toBe("BLOCKED");
    });

    it("reconstructs identical state using numeric epoch millisecond timestamps", async () => {
      const epochT1 = new Date("2026-08-01T15:00:00.000Z").getTime();
      const res = await app.request(
        `/api/counterparties/${encodeURIComponent(CP_KEY)}/temporal?asOf=${epochT1}`,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as TemporalReputationReconstruction;
      expect(body.asOfType).toBe("timestamp");
      expect(body.historicalState.episodesCount).toBe(1);
      expect(body.historicalState.relationshipStatus).toBe("WATCH");
    });

    it("returns 400 invalid_as_of when asOf is missing or unparseable", async () => {
      const resMissing = await app.request(`/api/counterparties/${encodeURIComponent(CP_KEY)}/temporal`);
      expect(resMissing.status).toBe(400);
      const bodyMissing = (await resMissing.json()) as { error: { code: string } };
      expect(bodyMissing.error.code).toBe("invalid_as_of");

      const resBad = await app.request(`/api/counterparties/${encodeURIComponent(CP_KEY)}/temporal?asOf=not-a-valid-date-or-index`);
      expect(resBad.status).toBe(400);
      const bodyBad = (await resBad.json()) as { error: { code: string } };
      expect(bodyBad.error.code).toBe("invalid_as_of");
    });

    it("returns 404 counterparty_not_found for counterparty with no history", async () => {
      const res = await app.request("/api/counterparties/virtuals:agent:non_existent_ghost/temporal?asOf=0");
      expect(res.status).toBe(404);
      const body = (await res.json()) as { error: { code: string } };
      expect(body.error.code).toBe("counterparty_not_found");
    });
  });

  // =========================================================================
  // 5. Adversarial Stress & Resiliency Scenarios
  // =========================================================================
  describe("Adversarial Edge Cases & Resiliency", () => {
    it("handles URL-encoded counterparty keys containing special characters", async () => {
      const SPECIAL_KEY = "virtuals:agent:alpha_special-test.v1";
      recordNativeReflection({
        id: "ref-spec-1",
        counterpartyKey: SPECIAL_KEY,
        runId: "run-spec",
        failureCategory: "TIMEOUT",
        rootCause: "Special key timeout",
        lesson: "Special key lesson",
        schemaErrors: ["Timeout"],
        remediationGuidance: "Guidance",
        createdAt: "2026-08-10T12:00:00.000Z",
      });

      const res = await app.request(`/api/counterparties/${encodeURIComponent(SPECIAL_KEY)}/reflections`);
      expect(res.status).toBe(200);
      const body = (await res.json()) as { ok: boolean; counterpartyKey: string; count: number };
      expect(body.ok).toBe(true);
      expect(body.counterpartyKey).toBe(SPECIAL_KEY);
      expect(body.count).toBe(1);
    });

    it("tolerates corrupted JSON in SQLite reflection row without crashing", async () => {
      const db = getNativeDb(true);
      const CORRUPT_KEY = "virtuals:agent:corrupt_db_agent";

      // Insert one corrupted row and one valid row
      db!.prepare(`
        INSERT INTO entities (key, id, category, name, status, body, created_at, updated_at)
        VALUES ('reflection:corrupt:1', 'id-1', 'reflection', ?, 'active', '{BAD_MALFORMED_JSON}', '2026-08-10T12:00:00.000Z', '2026-08-10T12:00:00.000Z')
      `).run(CORRUPT_KEY);

      recordNativeReflection({
        id: "ref-valid-after-corrupt",
        counterpartyKey: CORRUPT_KEY,
        runId: "run-valid",
        failureCategory: "SCHEMA_VIOLATION",
        rootCause: "Valid reflection after corrupt row",
        lesson: "Resilient parsing",
        schemaErrors: ["none"],
        remediationGuidance: "Pre-check",
        createdAt: "2026-08-10T12:01:00.000Z",
      });

      const res = await app.request(`/api/counterparties/${encodeURIComponent(CORRUPT_KEY)}/reflections`);
      expect(res.status).toBe(200);
      const body = (await res.json()) as { ok: boolean; count: number; items: ReflectionRecord[] };
      expect(body.ok).toBe(true);
      // Malformed row skipped, valid row preserved
      expect(body.count).toBe(1);
      expect(body.items[0]?.id).toBe("ref-valid-after-corrupt");
    });

    it("handles concurrent requests across all 4 endpoints without SQLite locking conflicts", async () => {
      const CONCURRENCY_KEY = "virtuals:agent:concurrent_stress";

      recordEpisodeToNativeSibyl(CONCURRENCY_KEY, {
        run: "run-conc-1",
        outcome: "accepted",
        note: "Passed",
        occurredAt: "2026-08-01T10:00:00.000Z",
      });
      recordEpisodeToNativeSibyl(CONCURRENCY_KEY, {
        run: "run-conc-2",
        outcome: "rejected",
        note: "Failed",
        occurredAt: "2026-08-02T10:00:00.000Z",
      });
      recordNativeReflection({
        id: "ref-conc-1",
        counterpartyKey: CONCURRENCY_KEY,
        runId: "run-conc-2",
        failureCategory: "MISSING_CITATIONS",
        rootCause: "Missing citations under stress",
        lesson: "Always verify",
        schemaErrors: ["missing citations"],
        remediationGuidance: "Add sources",
        createdAt: "2026-08-02T10:05:00.000Z",
      });
      updateNativeCounterpartyInSibyl(CONCURRENCY_KEY, {
        relationshipStatus: "WATCH",
        consecutiveFailures: 1,
        overallReliability: 0.3333,
      });

      // Fire 20 parallel requests across all endpoints
      const requests = [
        ...Array.from({ length: 5 }, () =>
          app.request(`/api/counterparties/${encodeURIComponent(CONCURRENCY_KEY)}/reflections`),
        ),
        ...Array.from({ length: 5 }, () =>
          app.request(`/api/counterparties/${encodeURIComponent(CONCURRENCY_KEY)}/dossier`),
        ),
        ...Array.from({ length: 5 }, () =>
          app.request(`/api/counterparties/${encodeURIComponent(CONCURRENCY_KEY)}/summary`),
        ),
        ...Array.from({ length: 5 }, () =>
          app.request(`/api/counterparties/${encodeURIComponent(CONCURRENCY_KEY)}/temporal?asOf=1`),
        ),
      ];

      const responses = await Promise.all(requests);
      for (const res of responses) {
        expect(res.status).toBe(200);
      }
    });
  });
});

import { beforeEach, describe, expect, it } from "vitest";

import { app } from "../app.js";
import {
  recordEpisodeToNativeSibyl,
  recordNativeReflection,
  resetNativeSibylStorage,
  updateNativeCounterpartyInSibyl,
} from "../services/native-sibyl.js";

beforeEach(() => {
  resetNativeSibylStorage();
});

describe("POST /api/counterparties/:counterpartyKey/unblock", () => {
  it("unblocks a counterparty restoring status to WATCH", async () => {
    const res = await app.request("/api/counterparties/virtuals:agent:blocked_test/unblock", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        reason: "Operator reviewed logs and granted manual forgiveness",
        targetStatus: "WATCH",
      }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      ok: boolean;
      counterpartyKey: string;
      status: string;
      unblockedBy: string;
      reason: string;
    };
    expect(body.ok).toBe(true);
    expect(body.counterpartyKey).toBe("virtuals:agent:blocked_test");
    expect(body.status).toBe("WATCH");
    expect(body.unblockedBy).toBe("console_operator");
    expect(body.reason).toContain("Operator reviewed logs");
  });

  it("defaults to WATCH when no targetStatus is specified", async () => {
    const res = await app.request("/api/counterparties/virtuals:agent:beta/unblock", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; status: string };
    expect(body.ok).toBe(true);
    expect(body.status).toBe("WATCH");
  });

  it("rejects invalid targetStatus with 422", async () => {
    const res = await app.request("/api/counterparties/virtuals:agent:alpha/unblock", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        targetStatus: "INVALID_STATUS",
      }),
    });

    expect(res.status).toBe(422);
  });
});

describe("GET /api/counterparties/:counterpartyKey/temporal", () => {
  const CP_KEY = "virtuals:agent:temporal_fixture";

  beforeEach(() => {
    recordEpisodeToNativeSibyl(CP_KEY, {
      run: "run-temp-1",
      outcome: "rejected",
      note: "Missing sources",
      occurredAt: "2026-08-01T10:00:00Z",
    });
    recordEpisodeToNativeSibyl(CP_KEY, {
      run: "run-temp-2",
      outcome: "accepted",
      note: "Delivered successfully",
      occurredAt: "2026-08-02T10:00:00Z",
    });
  });

  it("reconstructs historical state by episode index (asOf=0 and asOf=1)", async () => {

    // asOf=0: prior neutral state before any episodes
    const res0 = await app.request(`/api/counterparties/${encodeURIComponent(CP_KEY)}/temporal?asOf=0`);
    expect(res0.status).toBe(200);
    const body0 = (await res0.json()) as {
      counterpartyKey: string;
      asOf: string;
      asOfType: string;
      historicalState: { relationshipStatus: string; episodesCount: number; consecutiveFailures: number };
      currentState: { episodesCount: number };
      delta: { statusChanged: boolean };
    };
    expect(body0.counterpartyKey).toBe(CP_KEY);
    expect(body0.asOfType).toBe("episode_index");
    expect(body0.historicalState.episodesCount).toBe(0);
    expect(body0.historicalState.relationshipStatus).toBe("NEW");
    expect(body0.currentState.episodesCount).toBe(2);

    // asOf=1: state after 1st episode (failure -> WATCH)
    const res1 = await app.request(`/api/counterparties/${encodeURIComponent(CP_KEY)}/temporal?asOf=1`);
    expect(res1.status).toBe(200);
    const body1 = (await res1.json()) as {
      asOfType: string;
      historicalState: { relationshipStatus: string; episodesCount: number; consecutiveFailures: number };
      delta: { failuresDelta: number };
    };
    expect(body1.asOfType).toBe("episode_index");
    expect(body1.historicalState.episodesCount).toBe(1);
    expect(body1.historicalState.relationshipStatus).toBe("WATCH");
    expect(body1.historicalState.consecutiveFailures).toBe(1);
  });

  it("reconstructs historical state by ISO timestamp", async () => {
    const res = await app.request(
      `/api/counterparties/${encodeURIComponent(CP_KEY)}/temporal?asOf=2026-08-01T12:00:00Z`,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      asOfType: string;
      asOf: string;
      historicalState: { episodesCount: number };
    };
    expect(body.asOfType).toBe("timestamp");
    expect(body.historicalState.episodesCount).toBe(1);
  });

  it("reconstructs historical state by epoch milliseconds", async () => {
    const epochMs = new Date("2026-08-01T12:00:00Z").getTime();
    const res = await app.request(
      `/api/counterparties/${encodeURIComponent(CP_KEY)}/temporal?asOf=${epochMs}`,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      asOfType: string;
      historicalState: { episodesCount: number };
    };
    expect(body.asOfType).toBe("timestamp");
    expect(body.historicalState.episodesCount).toBe(1);
  });

  it("rejects missing asOf parameter with 400", async () => {
    const res = await app.request(`/api/counterparties/${encodeURIComponent(CP_KEY)}/temporal`);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe("invalid_as_of");
  });

  it("rejects invalid asOf parameter with 400", async () => {
    const res = await app.request(
      `/api/counterparties/${encodeURIComponent(CP_KEY)}/temporal?asOf=not-a-valid-date-or-index`,
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe("invalid_as_of");
  });

  it("returns 404 for counterparty with no history", async () => {
    const res = await app.request("/api/counterparties/virtuals:agent:unknown_ghost/temporal?asOf=0");
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("counterparty_not_found");
  });
});

describe("GET /api/counterparties/:counterpartyKey/summary", () => {
  const CP_KEY = "virtuals:agent:summary_fixture";

  it("returns executive risk digest for existing counterparty", async () => {
    recordEpisodeToNativeSibyl(CP_KEY, {
      run: "run-sum-1",
      outcome: "rejected",
      note: "Citation failure",
      occurredAt: "2026-08-05T10:00:00Z",
    });
    updateNativeCounterpartyInSibyl(CP_KEY, {
      relationshipStatus: "WATCH",
      consecutiveFailures: 1,
      overallReliability: 0.3333,
    });
    recordNativeReflection({
      id: "ref-sum-1",
      counterpartyKey: CP_KEY,
      runId: "run-sum-1",
      failureCategory: "MISSING_CITATIONS",
      rootCause: "Deliverable omitted citations",
      lesson: "Always verify sources",
      schemaErrors: ["missing sources"],
      remediationGuidance: "Require citations",
      createdAt: "2026-08-05T10:05:00Z",
    });

    const res = await app.request(`/api/counterparties/${encodeURIComponent(CP_KEY)}/summary`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      counterpartyKey: string;
      displayName: string;
      headline: string;
      riskLevel: string;
      reliabilityRating: string;
      relationshipStatus: string;
      keyFindings: string[];
      recommendations: string[];
      totalMissions: number;
    };
    expect(body.counterpartyKey).toBe(CP_KEY);
    expect(body.riskLevel).toBe("HIGH");
    expect(body.relationshipStatus).toBe("WATCH");
    expect(body.headline).toContain(CP_KEY);
    expect(body.keyFindings.length).toBeGreaterThan(0);
    expect(body.recommendations.length).toBeGreaterThan(0);
  });

  it("returns 404 for counterparty with no records", async () => {
    const res = await app.request("/api/counterparties/virtuals:agent:nobody_here/summary");
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("counterparty_not_found");
  });
});

describe("GET /api/counterparties/:counterpartyKey/reflections", () => {
  const CP_KEY = "virtuals:agent:reflection_fixture";

  it("returns list of structured reflections for a counterparty", async () => {
    recordNativeReflection({
      id: "ref-test-101",
      counterpartyKey: CP_KEY,
      runId: "run-ref-1",
      failureCategory: "INSUFFICIENT_COMPETITORS",
      rootCause: "Report had only 1 competitor instead of 3",
      lesson: "Enforce competitor threshold",
      schemaErrors: ["competitors count < 3"],
      remediationGuidance: "Pre-validate count",
      createdAt: "2026-08-06T10:00:00Z",
    });

    const res = await app.request(`/api/counterparties/${encodeURIComponent(CP_KEY)}/reflections`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      ok: boolean;
      counterpartyKey: string;
      count: number;
      items: Array<{
        id: string;
        failureCategory: string;
        rootCause: string;
        lesson: string;
      }>;
    };
    expect(body.ok).toBe(true);
    expect(body.counterpartyKey).toBe(CP_KEY);
    expect(body.count).toBeGreaterThanOrEqual(1);
    expect(body.items[0]?.failureCategory).toBe("INSUFFICIENT_COMPETITORS");
    expect(body.items[0]?.rootCause).toContain("1 competitor");
  });

  it("returns empty items array when counterparty has no reflections", async () => {
    const res = await app.request("/api/counterparties/virtuals:agent:clean_fixture/reflections");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; count: number; items: unknown[] };
    expect(body.ok).toBe(true);
    expect(body.count).toBe(0);
    expect(body.items).toEqual([]);
  });
});

describe("GET /api/counterparties/:counterpartyKey/dossier", () => {
  const CP_KEY = "virtuals:agent:dossier_fixture";

  it("returns consolidated dossier for counterparty with history", async () => {
    recordEpisodeToNativeSibyl(CP_KEY, {
      run: "run-dos-1",
      outcome: "accepted",
      note: "Task passed",
      occurredAt: "2026-08-07T10:00:00Z",
    });

    const res = await app.request(`/api/counterparties/${encodeURIComponent(CP_KEY)}/dossier`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      counterpartyKey: string;
      totalMissions: number;
      acceptedCount: number;
      rejectedCount: number;
      successRate: number;
      auditTrailHash: string;
    };
    expect(body.counterpartyKey).toBe(CP_KEY);
    expect(body.totalMissions).toBe(1);
    expect(body.acceptedCount).toBe(1);
    expect(body.rejectedCount).toBe(0);
    expect(body.successRate).toBe(1.0);
    expect(body.auditTrailHash).toBeTruthy();
  });

  it("returns 404 when counterparty has no history", async () => {
    const res = await app.request("/api/counterparties/virtuals:agent:no_dossier_here/dossier");
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("dossier_not_found");
  });

  it("preserves 404 for dossier after calling read-only GET /memory and GET /summary on unobserved counterparty", async () => {
    const unobservedKey = `virtuals:agent:unobserved_ghost_${Date.now()}`;

    // 1. Initial check confirms dossier does not exist (404)
    const initialDossierRes = await app.request(`/api/counterparties/${encodeURIComponent(unobservedKey)}/dossier`);
    expect(initialDossierRes.status).toBe(404);
    const initialDossierBody = (await initialDossierRes.json()) as { error: { code: string } };
    expect(initialDossierBody.error.code).toBe("dossier_not_found");

    // 2. Read-only summary request returns 404 for unobserved counterparty without creating a dossier
    const summaryRes = await app.request(`/api/counterparties/${encodeURIComponent(unobservedKey)}/summary`);
    expect(summaryRes.status).toBe(404);

    // 3. Read-only memory request returns 200 with null executive_summary without creating a dossier
    const memoryRes = await app.request(`/api/counterparties/${encodeURIComponent(unobservedKey)}/memory`);
    expect(memoryRes.status).toBe(200);
    const memoryBody = (await memoryRes.json()) as { executive_summary?: unknown };
    expect(memoryBody.executive_summary).toBeNull();

    // 4. Subsequent dossier check MUST still return 404 (read-only GET did not mutate SQLite)
    const postReadDossierRes = await app.request(`/api/counterparties/${encodeURIComponent(unobservedKey)}/dossier`);
    expect(postReadDossierRes.status).toBe(404);
    const postReadDossierBody = (await postReadDossierRes.json()) as { error: { code: string } };
    expect(postReadDossierBody.error.code).toBe("dossier_not_found");
  });
});


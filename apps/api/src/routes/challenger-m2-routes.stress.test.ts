import { beforeEach, describe, expect, it } from "vitest";

import { app } from "../app.js";
import {
  recordEpisodeToNativeSibyl,
  recordNativeReflection,
  resetNativeSibylStorage,
  setNativeDossier,
} from "../services/native-sibyl.js";

describe("Adversarial Challenger Suite: M2 API Routes", () => {
  beforeEach(() => {
    resetNativeSibylStorage();
  });

  describe("1. Search Query Fuzzing (GET /api/memory/search)", () => {
    const TARGET_KEY = "virtuals:agent:fuzz_search_target";

    beforeEach(() => {
      // Seed test records
      recordNativeReflection({
        id: "ref-fuzz-1",
        counterpartyKey: TARGET_KEY,
        runId: "run-fuzz-1",
        failureCategory: "MISSING_CITATIONS",
        rootCause: "Verification failed due to missing citations in report.",
        lesson: "Provider Alpha failed to include valid URLs.",
        schemaErrors: ["missing sources URL citation"],
        remediationGuidance: "Always require source URLs before accepting deliverable.",
        createdAt: "2026-09-05T10:00:00Z",
      });

      recordEpisodeToNativeSibyl(TARGET_KEY, {
        run: "run-fuzz-2",
        outcome: "rejected",
        taskType: "competitor-research",
        note: "Defective deliverable without citations.",
        occurredAt: "2026-09-06T10:00:00Z",
      });

      setNativeDossier(TARGET_KEY, {
        counterpartyKey: TARGET_KEY,
        displayName: "Fuzz Target Agent",
        totalMissions: 1,
        acceptedCount: 0,
        rejectedCount: 1,
        successRate: 0.0,
        recurringDefects: { missing_citations: 1 },
        probationHistory: [],
        auditTrailHash: "fuzzhash789",
        lastConsolidatedAt: "2026-09-06T10:05:00Z",
      });
    });

    describe("1.1 Query parameter boundary and syntax fuzzing", () => {
      it("rejects missing query parameter with 400 invalid_search_query", async () => {
        const res = await app.request("/api/memory/search");
        expect(res.status).toBe(400);
        const body = (await res.json()) as { error: { code: string } };
        expect(body.error.code).toBe("invalid_search_query");
      });

      it("rejects empty query (q=) with 400 invalid_search_query", async () => {
        const res = await app.request("/api/memory/search?q=");
        expect(res.status).toBe(400);
        const body = (await res.json()) as { error: { code: string } };
        expect(body.error.code).toBe("invalid_search_query");
      });

      it("rejects whitespace-only queries with 400 invalid_search_query", async () => {
        const whitespaces = [
          "%20",
          "%20%20%20",
          "%09", // tab
          "%0A", // newline
          "%20%09%0A%20",
        ];

        for (const ws of whitespaces) {
          const res = await app.request(`/api/memory/search?q=${ws}`);
          expect(res.status).toBe(400);
          const body = (await res.json()) as { error: { code: string } };
          expect(body.error.code).toBe("invalid_search_query");
        }
      });

      it("accepts query of exactly 200 characters and rejects 201 characters", async () => {
        const q200 = "a".repeat(200);
        const res200 = await app.request(`/api/memory/search?q=${q200}`);
        expect(res200.status).toBe(200);
        const body200 = (await res200.json()) as { ok: boolean };
        expect(body200.ok).toBe(true);

        const q201 = "a".repeat(201);
        const res201 = await app.request(`/api/memory/search?q=${q201}`);
        expect(res201.status).toBe(400);
        const body201 = (await res201.json()) as { error: { code: string } };
        expect(body201.error.code).toBe("invalid_search_query");

        const q500 = "a".repeat(500);
        const res500 = await app.request(`/api/memory/search?q=${q500}`);
        expect(res500.status).toBe(400);
      });

      it("gracefully handles special characters without crashing or throwing 500", async () => {
        const specialInputs = [
          "!@#$%^&*()_+{}[]:;\"'<>?,./~`",
          "---",
          "...",
          "===+++***",
          "&& || ^^",
          "%00", // null byte
          "\\n\\r\\t",
        ];

        for (const input of specialInputs) {
          const res = await app.request(`/api/memory/search?q=${encodeURIComponent(input)}`);
          expect(res.status).toBe(200);
          const body = (await res.json()) as { ok: boolean; count: number; items: unknown[] };
          expect(body.ok).toBe(true);
          expect(Array.isArray(body.items)).toBe(true);
        }
      });

      it("gracefully handles unicode, emoji, and multi-language scripts", async () => {
        const unicodeInputs = [
          "🚀 🤖 🔥 💡",
          "日本語のテスト検索クエリ",
          "中文测试查询违规行为",
          "استعلام البحث باللغة العربية",
          "ZeroWidth\u200BSpace\u200CVerification",
        ];

        for (const input of unicodeInputs) {
          const res = await app.request(`/api/memory/search?q=${encodeURIComponent(input)}`);
          expect(res.status).toBe(200);
          const body = (await res.json()) as { ok: boolean; count: number };
          expect(body.ok).toBe(true);
        }
      });
    });

    describe("1.2 SQL Injection Attack Payloads in Search", () => {
      const sqlInjections = [
        "' OR '1'='1",
        "' OR '1'='1' --",
        "'; DROP TABLE entities; --",
        "'; DROP TABLE counterparties; --",
        "UNION SELECT 1, 'admin', 'pass', 'active', '{}', '2026-01-01', '2026-01-01' --",
        "\" OR 1=1 --",
        "' OR 1=1 #",
        "'; VACUUM; --",
        "'; ATTACH DATABASE '/tmp/pwned.db' AS pwn; --",
        "1' AND (SELECT count(*) FROM entities) > 0 --",
      ];

      it("neutralizes SQL injection in q parameter without database mutation or 500 errors", async () => {
        for (const sqli of sqlInjections) {
          const res = await app.request(`/api/memory/search?q=${encodeURIComponent(sqli)}`);
          expect(res.status).toBe(200);
          const body = (await res.json()) as { ok: boolean; items: unknown[] };
          expect(body.ok).toBe(true);
        }

        // Verify entities table still exists and data remains intact
        const verifyRes = await app.request(`/api/memory/search?q=citations`);
        expect(verifyRes.status).toBe(200);
        const verifyBody = (await verifyRes.json()) as { count: number };
        expect(verifyBody.count).toBeGreaterThan(0);
      });

      it("neutralizes SQL injection in counterpartyKey parameter", async () => {
        for (const sqli of sqlInjections) {
          const res = await app.request(
            `/api/memory/search?q=citations&counterpartyKey=${encodeURIComponent(sqli)}`,
          );
          expect(res.status).toBe(200);
          const body = (await res.json()) as { ok: boolean; count: number };
          expect(body.ok).toBe(true);
          expect(body.count).toBe(0); // non-existent SQL injection key yields 0
        }
      });
    });

    describe("1.3 Limit parameter fuzzing and boundary constraints", () => {
      it("rejects negative limit with 400 invalid_search_query", async () => {
        const res = await app.request("/api/memory/search?q=citations&limit=-1");
        expect(res.status).toBe(400);
        const body = (await res.json()) as { error: { code: string } };
        expect(body.error.code).toBe("invalid_search_query");
      });

      it("rejects zero limit (limit=0) with 400 invalid_search_query", async () => {
        const res = await app.request("/api/memory/search?q=citations&limit=0");
        expect(res.status).toBe(400);
        const body = (await res.json()) as { error: { code: string } };
        expect(body.error.code).toBe("invalid_search_query");
      });

      it("rejects floating-point limit with 400 invalid_search_query", async () => {
        const floats = ["1.5", "0.99", "5.0001", "20.5"];
        for (const f of floats) {
          const res = await app.request(`/api/memory/search?q=citations&limit=${f}`);
          expect(res.status).toBe(400);
          const body = (await res.json()) as { error: { code: string } };
          expect(body.error.code).toBe("invalid_search_query");
        }
      });

      it("rejects limit exceeding maximum (limit > 100) with 400 invalid_search_query", async () => {
        const overLimits = ["101", "1000", "999999"];
        for (const ol of overLimits) {
          const res = await app.request(`/api/memory/search?q=citations&limit=${ol}`);
          expect(res.status).toBe(400);
          const body = (await res.json()) as { error: { code: string } };
          expect(body.error.code).toBe("invalid_search_query");
        }
      });

      it("rejects non-numeric limit values with 400 invalid_search_query", async () => {
        const nonNumerics = ["abc", "NaN", "null", "undefined", "true", "{}"];
        for (const val of nonNumerics) {
          const res = await app.request(`/api/memory/search?q=citations&limit=${val}`);
          expect(res.status).toBe(400);
          const body = (await res.json()) as { error: { code: string } };
          expect(body.error.code).toBe("invalid_search_query");
        }
      });

      it("accepts valid boundary limit values (limit=1 and limit=100)", async () => {
        const res1 = await app.request("/api/memory/search?q=citations&limit=1");
        expect(res1.status).toBe(200);
        const body1 = (await res1.json()) as { ok: boolean; items: unknown[] };
        expect(body1.ok).toBe(true);
        expect(body1.items.length).toBeLessThanOrEqual(1);

        const res100 = await app.request("/api/memory/search?q=citations&limit=100");
        expect(res100.status).toBe(200);
        const body100 = (await res100.json()) as { ok: boolean };
        expect(body100.ok).toBe(true);
      });
    });

    describe("1.4 Category parameter fuzzing and validation", () => {
      it("rejects invalid category enum values with 400 invalid_search_query", async () => {
        const invalidCategories = [
          "invalid",
          "REFLECTIONS", // uppercase
          "Episode",     // mixed case
          "dossiers",    // plural
          "users",
          "all_records",
          "'; DROP TABLE entities; --",
          "123",
        ];

        for (const cat of invalidCategories) {
          const res = await app.request(`/api/memory/search?q=citations&category=${encodeURIComponent(cat)}`);
          expect(res.status).toBe(400);
          const body = (await res.json()) as { error: { code: string } };
          expect(body.error.code).toBe("invalid_search_query");
        }
      });

      it("accepts all valid category values", async () => {
        const validCategories = ["all", "reflection", "episode", "dossier"];
        for (const cat of validCategories) {
          const res = await app.request(`/api/memory/search?q=citations&category=${cat}`);
          expect(res.status).toBe(200);
          const body = (await res.json()) as { ok: boolean };
          expect(body.ok).toBe(true);
        }
      });
    });
  });

  describe("2. Temporal Endpoint Stress Testing (GET /api/counterparties/:counterpartyKey/temporal)", () => {
    const CHRONO_KEY = "virtuals:agent:temporal_stress_test";

    beforeEach(() => {
      // Create a deterministic sequence of 4 episodes
      // Episode 1: Failure at 2026-08-01 -> NEW -> WATCH (consecutiveFailures: 1)
      recordEpisodeToNativeSibyl(CHRONO_KEY, {
        run: "run-chrono-1",
        outcome: "rejected",
        note: "Delivery failure 1",
        occurredAt: "2026-08-01T10:00:00Z",
      });

      // Episode 2: Success at 2026-08-02 -> WATCH -> KNOWN (consecutiveFailures: 0)
      recordEpisodeToNativeSibyl(CHRONO_KEY, {
        run: "run-chrono-2",
        outcome: "accepted",
        note: "Delivery success 2",
        occurredAt: "2026-08-02T10:00:00Z",
      });

      // Episode 3: Failure at 2026-08-03 -> KNOWN -> WATCH (consecutiveFailures: 1)
      recordEpisodeToNativeSibyl(CHRONO_KEY, {
        run: "run-chrono-3",
        outcome: "rejected",
        note: "Delivery failure 3",
        occurredAt: "2026-08-03T10:00:00Z",
      });

      // Episode 4: Failure at 2026-08-04 -> WATCH -> BLOCKED (consecutiveFailures: 2 in WATCH)
      recordEpisodeToNativeSibyl(CHRONO_KEY, {
        run: "run-chrono-4",
        outcome: "rejected",
        note: "Delivery failure 4",
        occurredAt: "2026-08-04T10:00:00Z",
      });
    });

    describe("2.1 Missing, empty, and whitespace asOf query parameters", () => {
      it("rejects missing asOf query parameter with 400 invalid_as_of", async () => {
        const res = await app.request(`/api/counterparties/${encodeURIComponent(CHRONO_KEY)}/temporal`);
        expect(res.status).toBe(400);
        const body = (await res.json()) as { error: { code: string; message: string } };
        expect(body.error.code).toBe("invalid_as_of");
        expect(typeof body.error.message).toBe("string");
        expect(body.error.message.length).toBeGreaterThan(0);
      });

      it("rejects empty asOf query parameter with 400 invalid_as_of", async () => {
        const res = await app.request(`/api/counterparties/${encodeURIComponent(CHRONO_KEY)}/temporal?asOf=`);
        expect(res.status).toBe(400);
        const body = (await res.json()) as { error: { code: string } };
        expect(body.error.code).toBe("invalid_as_of");
      });

      it("rejects whitespace-only asOf query parameter with 400 invalid_as_of", async () => {
        const whitespaces = ["%20", "%20%20%20", "%09", "%0A"];
        for (const ws of whitespaces) {
          const res = await app.request(
            `/api/counterparties/${encodeURIComponent(CHRONO_KEY)}/temporal?asOf=${ws}`,
          );
          expect(res.status).toBe(400);
          const body = (await res.json()) as { error: { code: string } };
          expect(body.error.code).toBe("invalid_as_of");
        }
      });
    });

    describe("2.2 Non-existent counterparty and malformed key validation", () => {
      it("returns 404 counterparty_not_found for unobserved counterparty with asOf=0", async () => {
        const res = await app.request(
          "/api/counterparties/virtuals:agent:completely_unknown_agent_9999/temporal?asOf=0",
        );
        expect(res.status).toBe(404);
        const body = (await res.json()) as { error: { code: string } };
        expect(body.error.code).toBe("counterparty_not_found");
      });

      it("returns 404 counterparty_not_found for unobserved counterparty with timestamp asOf", async () => {
        const res = await app.request(
          "/api/counterparties/virtuals:agent:completely_unknown_agent_9999/temporal?asOf=2026-08-01T12:00:00Z",
        );
        expect(res.status).toBe(404);
        const body = (await res.json()) as { error: { code: string } };
        expect(body.error.code).toBe("counterparty_not_found");
      });

      it("rejects key longer than 200 characters with 400 invalid_counterparty_key", async () => {
        const longKey = "a".repeat(201);
        const res = await app.request(`/api/counterparties/${encodeURIComponent(longKey)}/temporal?asOf=0`);
        expect(res.status).toBe(400);
        const body = (await res.json()) as { error: { code: string } };
        expect(body.error.code).toBe("invalid_counterparty_key");
      });

      it("neutralizes SQL injection in counterpartyKey path parameter", async () => {
        const sqliKey = "'; DROP TABLE entities; --";
        const res = await app.request(`/api/counterparties/${encodeURIComponent(sqliKey)}/temporal?asOf=0`);
        // Should return 404 counterparty_not_found (or 400), never 500 and never mutate DB
        expect([400, 404]).toContain(res.status);

        // Verify entities table still intact
        const testRes = await app.request(`/api/counterparties/${encodeURIComponent(CHRONO_KEY)}/temporal?asOf=0`);
        expect(testRes.status).toBe(200);
      });
    });

    describe("2.3 Invalid dates, negative timestamps, and malformed time inputs", () => {
      it("rejects non-date string formats with 400 invalid_as_of", async () => {
        const invalidDates = [
          "invalid-date",
          "not_a_date",
          "yesterday",
          "2026-13-45",
          "2026-08-01T99:99:99Z",
          "true",
          "null",
          "undefined",
          "NaN",
          "{} ",
        ];

        for (const d of invalidDates) {
          const res = await app.request(
            `/api/counterparties/${encodeURIComponent(CHRONO_KEY)}/temporal?asOf=${encodeURIComponent(d)}`,
          );
          expect(res.status).toBe(400);
          const body = (await res.json()) as { error: { code: string } };
          expect(body.error.code).toBe("invalid_as_of");
        }
      });

      it("handles negative numeric asOf or rejects without 500 server crash", async () => {
        const negativeInputs = ["-1", "-100", "-999999999999"];
        for (const neg of negativeInputs) {
          const res = await app.request(
            `/api/counterparties/${encodeURIComponent(CHRONO_KEY)}/temporal?asOf=${neg}`,
          );
          // Negative is either parsed as invalid date (400) or epoch timestamp before 1970 (200)
          expect([200, 400]).toContain(res.status);
          if (res.status === 200) {
            const body = (await res.json()) as { historicalState: { episodesCount: number } };
            expect(body.historicalState.episodesCount).toBe(0);
          }
        }
      });

      it("handles extremely huge numbers without 500 unhandled exceptions", async () => {
        const extremeNumbers = [
          "999999999999999999999999999999999999", // beyond Date max value
          "1e30",
          "9999999999999999",
        ];

        for (const num of extremeNumbers) {
          const res = await app.request(
            `/api/counterparties/${encodeURIComponent(CHRONO_KEY)}/temporal?asOf=${encodeURIComponent(num)}`,
          );
          // Must either return 400 (caught RangeError / invalid date) or 200, but NEVER 500
          expect(res.status).not.toBe(500);
        }
      });
    });

    describe("2.4 Out-of-range episode indices and point-in-time oracle verification", () => {
      it("reconstructs exact point-in-time FSM states at each episode index (t=0..4)", async () => {
        // t = 0: Prior state before any episodes
        const res0 = await app.request(
          `/api/counterparties/${encodeURIComponent(CHRONO_KEY)}/temporal?asOf=0`,
        );
        expect(res0.status).toBe(200);
        const b0 = (await res0.json()) as {
          asOfType: string;
          historicalState: {
            relationshipStatus: string;
            episodesCount: number;
            consecutiveFailures: number;
            totalMissions: number;
            overallReliability: number;
          };
          currentState: {
            relationshipStatus: string;
            episodesCount: number;
          };
          delta: {
            statusChanged: boolean;
            pastStatus: string;
            currentStatus: string;
          };
        };
        expect(b0.asOfType).toBe("episode_index");
        expect(b0.historicalState.episodesCount).toBe(0);
        expect(b0.historicalState.relationshipStatus).toBe("NEW");
        expect(b0.historicalState.consecutiveFailures).toBe(0);
        expect(b0.historicalState.overallReliability).toBe(0.5);
        expect(b0.currentState.episodesCount).toBe(4);
        expect(b0.currentState.relationshipStatus).toBe("BLOCKED");
        expect(b0.delta.statusChanged).toBe(true);
        expect(b0.delta.pastStatus).toBe("NEW");
        expect(b0.delta.currentStatus).toBe("BLOCKED");

        // t = 1: After Episode 1 (failure) -> WATCH
        const res1 = await app.request(
          `/api/counterparties/${encodeURIComponent(CHRONO_KEY)}/temporal?asOf=1`,
        );
        expect(res1.status).toBe(200);
        const b1 = (await res1.json()) as {
          historicalState: { relationshipStatus: string; episodesCount: number; consecutiveFailures: number };
        };
        expect(b1.historicalState.episodesCount).toBe(1);
        expect(b1.historicalState.relationshipStatus).toBe("WATCH");
        expect(b1.historicalState.consecutiveFailures).toBe(1);

        // t = 2: After Episode 2 (success) -> KNOWN
        const res2 = await app.request(
          `/api/counterparties/${encodeURIComponent(CHRONO_KEY)}/temporal?asOf=2`,
        );
        expect(res2.status).toBe(200);
        const b2 = (await res2.json()) as {
          historicalState: { relationshipStatus: string; episodesCount: number; consecutiveFailures: number };
        };
        expect(b2.historicalState.episodesCount).toBe(2);
        expect(b2.historicalState.relationshipStatus).toBe("KNOWN");
        expect(b2.historicalState.consecutiveFailures).toBe(0);

        // t = 3: After Episode 3 (failure) -> WATCH
        const res3 = await app.request(
          `/api/counterparties/${encodeURIComponent(CHRONO_KEY)}/temporal?asOf=3`,
        );
        expect(res3.status).toBe(200);
        const b3 = (await res3.json()) as {
          historicalState: { relationshipStatus: string; episodesCount: number; consecutiveFailures: number };
        };
        expect(b3.historicalState.episodesCount).toBe(3);
        expect(b3.historicalState.relationshipStatus).toBe("WATCH");
        expect(b3.historicalState.consecutiveFailures).toBe(1);

        // t = 4: After Episode 4 (2nd consecutive failure in WATCH) -> BLOCKED
        const res4 = await app.request(
          `/api/counterparties/${encodeURIComponent(CHRONO_KEY)}/temporal?asOf=4`,
        );
        expect(res4.status).toBe(200);
        const b4 = (await res4.json()) as {
          historicalState: { relationshipStatus: string; episodesCount: number; consecutiveFailures: number };
          delta: { statusChanged: boolean };
        };
        expect(b4.historicalState.episodesCount).toBe(4);
        expect(b4.historicalState.relationshipStatus).toBe("BLOCKED");
        expect(b4.historicalState.consecutiveFailures).toBe(2);
        expect(b4.delta.statusChanged).toBe(false); // Current state is also BLOCKED
      });

      it("handles episode index greater than existing episode count safely (e.g. asOf=10, 50, 500)", async () => {
        // Only 4 episodes exist. asOf=10 should safely slice all 4 episodes without overflowing or erroring
        const res10 = await app.request(
          `/api/counterparties/${encodeURIComponent(CHRONO_KEY)}/temporal?asOf=10`,
        );
        expect(res10.status).toBe(200);
        const b10 = (await res10.json()) as {
          asOfType: string;
          historicalState: { episodesCount: number; relationshipStatus: string };
        };
        expect(b10.asOfType).toBe("episode_index");
        expect(b10.historicalState.episodesCount).toBe(4);
        expect(b10.historicalState.relationshipStatus).toBe("BLOCKED");

        const res500 = await app.request(
          `/api/counterparties/${encodeURIComponent(CHRONO_KEY)}/temporal?asOf=500`,
        );
        expect(res500.status).toBe(200);
        const b500 = (await res500.json()) as {
          asOfType: string;
          historicalState: { episodesCount: number };
        };
        expect(b500.asOfType).toBe("episode_index");
        expect(b500.historicalState.episodesCount).toBe(4);
      });

      it("handles boundary episode index asOf=10000 and asOf=10001", async () => {
        // asOf=10000 is maximum allowed episode_index
        const res10k = await app.request(
          `/api/counterparties/${encodeURIComponent(CHRONO_KEY)}/temporal?asOf=10000`,
        );
        expect(res10k.status).toBe(200);
        const b10k = (await res10k.json()) as { asOfType: string };
        expect(b10k.asOfType).toBe("episode_index");

        // asOf=10001 has length 5, so /^\d+$/.test and length <= 5 parses as episode_index=10001
        const res10001 = await app.request(
          `/api/counterparties/${encodeURIComponent(CHRONO_KEY)}/temporal?asOf=10001`,
        );
        expect(res10001.status).toBe(200);
      });
    });

    describe("2.5 Timestamp-based temporal point-in-time reconstruction", () => {
      it("accurately slices episodes by ISO timestamps across chronological boundary", async () => {
        // Timestamp before any episode (2026-07-31)
        const resBefore = await app.request(
          `/api/counterparties/${encodeURIComponent(CHRONO_KEY)}/temporal?asOf=2026-07-31T23:59:59Z`,
        );
        expect(resBefore.status).toBe(200);
        const bBefore = (await resBefore.json()) as {
          asOfType: string;
          historicalState: { episodesCount: number; relationshipStatus: string };
        };
        expect(bBefore.asOfType).toBe("timestamp");
        expect(bBefore.historicalState.episodesCount).toBe(0);
        expect(bBefore.historicalState.relationshipStatus).toBe("NEW");

        // Timestamp between episode 1 and episode 2 (2026-08-01T12:00:00Z)
        const resMid = await app.request(
          `/api/counterparties/${encodeURIComponent(CHRONO_KEY)}/temporal?asOf=2026-08-01T12:00:00Z`,
        );
        expect(resMid.status).toBe(200);
        const bMid = (await resMid.json()) as {
          asOfType: string;
          historicalState: { episodesCount: number; relationshipStatus: string };
        };
        expect(bMid.asOfType).toBe("timestamp");
        expect(bMid.historicalState.episodesCount).toBe(1);
        expect(bMid.historicalState.relationshipStatus).toBe("WATCH");

        // Timestamp after all episodes (2026-08-10)
        const resAfter = await app.request(
          `/api/counterparties/${encodeURIComponent(CHRONO_KEY)}/temporal?asOf=2026-08-10T00:00:00Z`,
        );
        expect(resAfter.status).toBe(200);
        const bAfter = (await resAfter.json()) as {
          asOfType: string;
          historicalState: { episodesCount: number; relationshipStatus: string };
        };
        expect(bAfter.asOfType).toBe("timestamp");
        expect(bAfter.historicalState.episodesCount).toBe(4);
        expect(bAfter.historicalState.relationshipStatus).toBe("BLOCKED");
      });
    });
  });

  describe("3. Related Primitive Endpoints Integrity (Summary, Reflections, Dossier)", () => {
    it("returns 404 for summary of counterparty with zero history", async () => {
      const res = await app.request("/api/counterparties/virtuals:agent:nobody_here/summary");
      expect(res.status).toBe(404);
      const body = (await res.json()) as { error: { code: string } };
      expect(body.error.code).toBe("counterparty_not_found");
    });

    it("returns empty reflections array for counterparty with zero reflections", async () => {
      const res = await app.request("/api/counterparties/virtuals:agent:clean_agent/reflections");
      expect(res.status).toBe(200);
      const body = (await res.json()) as { ok: boolean; count: number; items: unknown[] };
      expect(body.ok).toBe(true);
      expect(body.count).toBe(0);
      expect(body.items).toEqual([]);
    });

    it("returns 404 for dossier of counterparty with zero history", async () => {
      const res = await app.request("/api/counterparties/virtuals:agent:no_dossier/dossier");
      expect(res.status).toBe(404);
      const body = (await res.json()) as { error: { code: string } };
      expect(body.error.code).toBe("dossier_not_found");
    });
  });

  describe("4. Advanced Boundary & Hostile Input Fuzzing", () => {
    beforeEach(() => {
      recordEpisodeToNativeSibyl("virtuals:agent:temporal_stress_test", {
        run: "run-adv-1",
        outcome: "accepted",
        note: "Delivery verified",
        occurredAt: "2026-08-01T10:00:00Z",
      });
      recordEpisodeToNativeSibyl("virtuals:agent:temporal_stress_test", {
        run: "run-adv-2",
        outcome: "rejected",
        note: "Delivery failure",
        occurredAt: "2026-08-02T10:00:00Z",
      });
    });

    it("rejects invalid counterpartyKey in search query with 400", async () => {
      // Empty counterpartyKey
      const resEmpty = await app.request("/api/memory/search?q=test&counterpartyKey=");
      expect(resEmpty.status).toBe(400);

      // Whitespace counterpartyKey
      const resWs = await app.request("/api/memory/search?q=test&counterpartyKey=%20%20");
      expect(resWs.status).toBe(400);

      // CounterpartyKey > 200 chars
      const resTooLong = await app.request(`/api/memory/search?q=test&counterpartyKey=${"a".repeat(201)}`);
      expect(resTooLong.status).toBe(400);
    });

    it("rejects non-parsable decimal / non-date strings in temporal endpoint with 400", async () => {
      const nonDates = ["3.14159", "2.0.0", "1.2.3.4", "NaN", "undefined"];
      for (const nd of nonDates) {
        const res = await app.request(
          `/api/counterparties/virtuals:agent:temporal_stress_test/temporal?asOf=${nd}`,
        );
        expect(res.status).toBe(400);
        const body = (await res.json()) as { error: { code: string } };
        expect(body.error.code).toBe("invalid_as_of");
      }
    });

    it("rejects impossible calendar dates with 400", async () => {
      const badDates = ["2026-99-99", "2026-13-32", "2026-00-00", "2026-02-30T25:70:99Z"];
      for (const bd of badDates) {
        const res = await app.request(
          `/api/counterparties/virtuals:agent:temporal_stress_test/temporal?asOf=${bd}`,
        );
        expect(res.status).toBe(400);
        const body = (await res.json()) as { error: { code: string } };
        expect(body.error.code).toBe("invalid_as_of");
      }
    });

    it("handles concurrent requests across search and temporal without race conditions", async () => {
      const requests = Array.from({ length: 25 }, (_, i) => {
        if (i % 2 === 0) {
          return app.request(`/api/memory/search?q=citation&limit=${(i % 10) + 1}`);
        } else {
          return app.request(
            `/api/counterparties/virtuals:agent:temporal_stress_test/temporal?asOf=${i % 4}`,
          );
        }
      });

      const responses = await Promise.all(requests);
      for (const res of responses) {
        expect(res.status).toBe(200);
        const body = (await res.json()) as Record<string, unknown>;
        expect(body).toBeDefined();
      }
    });

    it("validates semantic search ranking monotonicity (exact phrase > synonym)", async () => {
      // Seed two reflections: one with exact keyword 'citation', one with synonym 'reference'
      const testKey = "virtuals:agent:ranking_oracle";
      recordNativeReflection({
        id: "ref-exact",
        counterpartyKey: testKey,
        runId: "run-exact",
        failureCategory: "MISSING_CITATIONS",
        rootCause: "missing citations in report",
        lesson: "must include citations",
        schemaErrors: [],
        remediationGuidance: "enforce citations",
        createdAt: "2026-09-08T10:00:00Z",
      });

      recordNativeReflection({
        id: "ref-synonym",
        counterpartyKey: testKey,
        runId: "run-synonym",
        failureCategory: "SCHEMA_VIOLATION",
        rootCause: "unverified deliverable and defective submission",
        lesson: "failed acceptance checks",
        schemaErrors: [],
        remediationGuidance: "review acceptance",
        createdAt: "2026-09-08T10:00:00Z",
      });

      const res = await app.request(`/api/memory/search?q=citations&counterpartyKey=${testKey}`);
      expect(res.status).toBe(200);
      const body = (await res.json()) as { items: Array<{ id: string; score: number }> };
      expect(body.items.length).toBeGreaterThanOrEqual(1);

      // Top result must be ref-exact with a higher score than any partial match
      expect(body.items[0]?.id).toBe("ref-exact");
      expect(body.items[0]?.score).toBeGreaterThan(50);
    });
  });
});

import { getDb, schema } from "@aura/db";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { app } from "../app.js";
import {
  recordEpisodeToNativeSibyl,
  recordNativeReflection,
  resetNativeSibylStorage,
  setNativeDossier,
  updateNativeCounterpartyInSibyl,
} from "../services/native-sibyl.js";
import type * as AdkAgent from "../services/adk-agent.js";
import type * as GeminiAgent from "../services/gemini-agent.js";

/**
 * The agent's configured-ness is stubbed rather than read from the environment.
 *
 * `packages/db/src/root-env.ts` walks up to the repository root .env, so a
 * developer who has a real ADK agent configured was running a different test
 * from CI: this case asserts the UNCONFIGURED branch, and it passed only on
 * machines that happened to have no agent. Stubbing the seam makes the test
 * assert the branch it names, on every machine.
 */
vi.mock("../services/adk-agent.js", async () => {
  const actual = await vi.importActual<typeof AdkAgent>("../services/adk-agent.js");
  return { ...actual, isAgentConfigured: vi.fn(() => false) };
});

vi.mock("../services/gemini-agent.js", async () => {
  const actual = await vi.importActual<typeof GeminiAgent>("../services/gemini-agent.js");
  return { ...actual, isGeminiAgentConfigured: vi.fn(() => false) };
});

const KEY = "virtuals:agent:alpha";

async function seedCounterparty() {
  const db = getDb();
  await db
    .insert(schema.counterparties)
    .values({
      counterpartyKey: KEY,
      protocol: "virtuals",
      agentId: "alpha",
      address: "0xabc",
      displayName: "Alpha Research",
      acpLifecycleState: "ACTIVE",
      relationshipStatus: "PREFERRED",
      latestMemoryVersion: 13,
      classifiedAggregates: { completed_jobs: 4 },
      offerings: [{ offering_id: "research_basic" }],
    })
    .onConflictDoNothing();
  await db
    .insert(schema.counterpartySalts)
    .values({ counterpartyKey: KEY, salt: "s3cr3t-salt" })
    .onConflictDoNothing();
  await db
    .insert(schema.counterpartyEpisodes)
    .values({
      counterpartyKey: KEY,
      ownerAgentId: "agent_buyer_1",
      taskType: "research",
      outcome: "DELIVERED",
      amountUsdc: "18.500000",
      occurredAt: new Date("2026-08-29T10:00:00.000Z"),
      body: { note: "private episode body" },
    })
    .onConflictDoNothing();
}

describe("counterparty projection (AD-04)", () => {
  beforeEach(seedCounterparty);

  it("returns only allow-listed fields", async () => {
    const res = await app.request(`/api/counterparties/${encodeURIComponent(KEY)}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;

    expect(Object.keys(body).sort()).toEqual(
      [
        "acp_lifecycle_state",
        "classified_aggregates",
        "display",
        "identity",
        "latest_memory_version",
        "offerings",
        "public_trust",
        "relationship_status",
      ].sort(),
    );

    // The denied set must not appear anywhere in the serialized response, not
    // merely be absent from the top level.
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain("salt");
    expect(serialized).not.toContain("private episode body");
    expect(serialized).not.toContain("episodes");
  });

  it("404s for an unknown counterparty rather than returning an empty projection", async () => {
    const res = await app.request("/api/counterparties/virtuals:agent:nobody");
    expect(res.status).toBe(404);
  });

  it("serves first-party episodes on their own endpoint", async () => {
    const res = await app.request(`/api/counterparties/${encodeURIComponent(KEY)}/episodes`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: { outcome: string }[] };
    expect(body.items).toHaveLength(1);
    expect(body.items[0]?.outcome).toBe("DELIVERED");
  });
});

describe("policies", () => {
  it("404s when nothing is stored, rather than returning assumed ceilings", async () => {
    const res = await app.request("/api/policies/agent_buyer_1");
    expect(res.status).toBe(404);
  });

  it("stores a policy and bumps its version on each write", async () => {
    const put = async (limit: string) =>
      app.request("/api/policies/agent_buyer_1", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ auto_spend_limit_usdc: limit, minimum_reliability: 70 }),
      });

    const first = (await (await put("0.500000")).json()) as { policy_version: number };
    const second = (await (await put("0.750000")).json()) as {
      policy_version: number;
      auto_spend_limit_usdc: string;
    };

    expect(second.policy_version).toBe(first.policy_version + 1);
    // Money survives the round trip as a string.
    expect(second.auto_spend_limit_usdc).toBe("0.750000");
  });

  it("rejects a spend limit that is not a decimal amount", async () => {
    const res = await app.request("/api/policies/agent_buyer_1", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ auto_spend_limit_usdc: "one dollar" }),
    });
    expect(res.status).toBe(422);
  });
});

describe("memory ablation (/api/memory/ablation)", () => {
  it("serves causal memory ablation proof with answer and walkthrough metrics", async () => {
    const res = await app.request("/api/memory/ablation");
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      ok: boolean;
      question: string;
      answer: string;
      memory_walkthrough: {
        line_1_what_you_persist: string;
        line_2_how_fresh_session_recalls_it: string;
        line_3_decision_or_action_it_changes: string;
      };
      memory_primitives_used: string[];
      matrix: {
        condition_a_with_memory: { provider_selected: string; verifier_score: number; task_outcome: string };
        condition_b_memory_deleted: { provider_selected: string; verifier_score: number; task_outcome: string };
      };
    };

    expect(body.ok).toBe(true);
    expect(body.question).toContain("What breaks when memory is deleted?");
    expect(body.answer).toContain("When memory is deleted, the agent suffers amnesia");
    expect(body.memory_primitives_used).toContain("recall");
    expect(body.memory_primitives_used).toContain("reflection");
    expect(body.matrix.condition_a_with_memory.provider_selected).toBe("virtuals:agent:beta");
    expect(body.matrix.condition_a_with_memory.verifier_score).toBe(1.0);
    expect(body.matrix.condition_b_memory_deleted.provider_selected).toBe("virtuals:agent:alpha");
    expect(body.matrix.condition_b_memory_deleted.verifier_score).toBe(0.0);
  });
});

describe("agent chat", () => {
  async function createRun() {
    const res = await app.request("/api/runs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ objective: "Buy one dataset" }),
    });
    const body = (await res.json()) as { run: { id: string } };
    return body.run.id;
  }

  it("refuses before opening the stream when no agent is configured", async () => {
    /* Both halves of this merge fixed the same bug: the env module reads the
       repository's own .env, so this assertion passed only on a machine with no
       agent configured and failed the moment one was. The module seam is
       stubbed at the top of this file rather than the env being mutated here,
       because a mutation that is restored on the next line is not restored at
       all when the request between them throws. */
    const runId = await createRun();
    const res = await app.request(`/api/runs/${runId}/chat?q=why%20alpha`);
    // A 503 means the console sees a connection that never established and
    // reports the agent unavailable. An open stream producing nothing would
    // read as a silent agent instead.
    expect(res.status).toBe(503);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("agent_unavailable");
  });

  it("rejects an empty question", async () => {
    const runId = await createRun();
    const res = await app.request(`/api/runs/${runId}/chat?q=`);
    expect(res.status).toBe(400);
  });

  it("replays a Run's events in order", async () => {
    const runId = await createRun();
    const res = await app.request(`/api/runs/${runId}/stream`);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("event: run.created");
    expect(text).toContain("event: replay.complete");
  });
});

describe("counterparty memory with embedded executive_summary", () => {
  it("embeds executive_summary in GET /api/counterparties/:counterpartyKey/memory", async () => {
    const cpKey = "virtuals:agent:alpha_mem_test";
    recordEpisodeToNativeSibyl(cpKey, {
      run: "run-m-1",
      outcome: "rejected",
      note: "Citation error",
      occurredAt: "2026-08-10T10:00:00Z",
    });
    updateNativeCounterpartyInSibyl(cpKey, {
      relationshipStatus: "WATCH",
      consecutiveFailures: 1,
      overallReliability: 0.33,
    });
    recordNativeReflection({
      id: "ref-m-1",
      counterpartyKey: cpKey,
      runId: "run-m-1",
      failureCategory: "MISSING_CITATIONS",
      rootCause: "Citations missing",
      lesson: "Verify citations",
      schemaErrors: ["sources required"],
      remediationGuidance: "Require citations",
      createdAt: "2026-08-10T10:05:00Z",
    });

    const res = await app.request(`/api/counterparties/${encodeURIComponent(cpKey)}/memory`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      counterparty_key: string;
      executive_summary: {
        counterpartyKey: string;
        riskLevel: string;
        relationshipStatus: string;
        headline: string;
        recommendations: string[];
      } | null;
    };

    expect(body.counterparty_key).toBe(cpKey);
    expect(body.executive_summary).not.toBeNull();
    expect(body.executive_summary?.counterpartyKey).toBe(cpKey);
    expect(body.executive_summary?.riskLevel).toBe("HIGH");
    expect(body.executive_summary?.relationshipStatus).toBe("WATCH");
    expect(body.executive_summary?.headline).toContain(cpKey);
  });

  it("returns executive_summary as null for unobserved counterparty with no records", async () => {
    const res = await app.request("/api/counterparties/virtuals:agent:unobserved_mem/memory");
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      counterparty_key: string;
      executive_summary: unknown;
    };
    expect(body.counterparty_key).toBe("virtuals:agent:unobserved_mem");
    expect(body.executive_summary).toBeNull();
  });
});

describe("semantic search (/api/memory/search)", () => {
  const searchKey = "virtuals:agent:search_target";

  beforeEach(() => {
    resetNativeSibylStorage();
    // Seed a reflection
    recordNativeReflection({
      id: "ref-search-1",
      counterpartyKey: searchKey,
      runId: "run-s-1",
      failureCategory: "MISSING_CITATIONS",
      rootCause: "Deliverable failed verification due to missing mandatory source citations.",
      lesson: "Provider repeatedly omits required source citations on competitor research tasks.",
      schemaErrors: ["competitors.0.sources: At least one source citation URL is required"],
      remediationGuidance: "Enforce strict citation validation.",
      createdAt: "2026-09-01T10:00:00Z",
    });

    // Seed an episode
    recordEpisodeToNativeSibyl(searchKey, {
      run: "run-s-2",
      outcome: "accepted",
      taskType: "competitor-research",
      note: "Verified deliverable accepted with complete source URLs and competitor analysis.",
      occurredAt: "2026-09-02T12:00:00Z",
    });

    // Seed a dossier
    setNativeDossier(searchKey, {
      counterpartyKey: searchKey,
      displayName: "Search Target Labs",
      totalMissions: 2,
      acceptedCount: 1,
      rejectedCount: 1,
      successRate: 0.5,
      recurringDefects: { missing_citations: 1 },
      probationHistory: [],
      auditTrailHash: "hash123456",
      lastConsolidatedAt: "2026-09-02T12:05:00Z",
    });
  });

  it("returns ranked search results across reflections, episodes, and dossiers", async () => {
    const res = await app.request("/api/memory/search?q=missing%20citation%20sources");
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      ok: boolean;
      query: string;
      count: number;
      items: Array<{
        id: string;
        category: string;
        name: string;
        score: number;
        matchedTerms: string[];
        headline: string;
        snippet: string;
      }>;
    };
    expect(body.ok).toBe(true);
    expect(body.query).toBe("missing citation sources");
    expect(body.count).toBeGreaterThanOrEqual(1);
    const reflectionItem = body.items.find((i) => i.category === "reflection");
    expect(reflectionItem).toBeDefined();
    expect(reflectionItem?.name).toBe(searchKey);
    expect(reflectionItem?.score).toBeGreaterThan(50);
    expect(reflectionItem?.matchedTerms).toContain("citation");
  });

  it("filters search results by category", async () => {
    const resRef = await app.request("/api/memory/search?q=citation&category=reflection");
    expect(resRef.status).toBe(200);
    const bodyRef = (await resRef.json()) as { items: Array<{ category: string }> };
    expect(bodyRef.items.length).toBeGreaterThan(0);
    expect(bodyRef.items.every((i) => i.category === "reflection")).toBe(true);

    const resEp = await app.request("/api/memory/search?q=verified&category=episode");
    expect(resEp.status).toBe(200);
    const bodyEp = (await resEp.json()) as { items: Array<{ category: string }> };
    expect(bodyEp.items.length).toBeGreaterThan(0);
    expect(bodyEp.items.every((i) => i.category === "episode")).toBe(true);

    const resDos = await app.request("/api/memory/search?q=Search%20Target&category=dossier");
    expect(resDos.status).toBe(200);
    const bodyDos = (await resDos.json()) as { items: Array<{ category: string }> };
    expect(bodyDos.items.length).toBeGreaterThan(0);
    expect(bodyDos.items.every((i) => i.category === "dossier")).toBe(true);
  });

  it("filters search results by counterpartyKey", async () => {
    const res = await app.request(
      `/api/memory/search?q=citation&counterpartyKey=${encodeURIComponent(searchKey)}`,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: Array<{ name: string }> };
    expect(body.items.length).toBeGreaterThan(0);
    expect(body.items.every((i) => i.name === searchKey)).toBe(true);

    const resEmpty = await app.request(
      "/api/memory/search?q=citation&counterpartyKey=virtuals:agent:nonexistent",
    );
    expect(resEmpty.status).toBe(200);
    const bodyEmpty = (await resEmpty.json()) as { count: number; items: unknown[] };
    expect(bodyEmpty.count).toBe(0);
    expect(bodyEmpty.items).toEqual([]);
  });

  it("enforces limit parameter", async () => {
    const res = await app.request("/api/memory/search?q=citation&limit=1");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { count: number; items: unknown[] };
    expect(body.items.length).toBeLessThanOrEqual(1);
  });

  it("rejects empty query with 400", async () => {
    const resEmpty = await app.request("/api/memory/search?q=");
    expect(resEmpty.status).toBe(400);
    const bodyEmpty = (await resEmpty.json()) as { error: { code: string } };
    expect(bodyEmpty.error.code).toBe("invalid_search_query");

    const resMissing = await app.request("/api/memory/search");
    expect(resMissing.status).toBe(400);
    const bodyMissing = (await resMissing.json()) as { error: { code: string } };
    expect(bodyMissing.error.code).toBe("invalid_search_query");
  });

  it("rejects invalid category with 400", async () => {
    const res = await app.request("/api/memory/search?q=test&category=invalid_category");
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("invalid_search_query");
  });
});


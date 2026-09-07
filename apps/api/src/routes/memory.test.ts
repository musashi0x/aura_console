import { getDb, schema } from "@aura/db";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { app } from "../app.js";
import type * as AdkAgent from "../services/adk-agent.js";

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

const KEY = "virtuals:agent:alpha";

async function seedCounterparty() {
  const db = getDb();
  await db.insert(schema.counterparties).values({
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
  });
  await db.insert(schema.counterpartySalts).values({ counterpartyKey: KEY, salt: "s3cr3t-salt" });
  await db.insert(schema.counterpartyEpisodes).values({
    counterpartyKey: KEY,
    ownerAgentId: "agent_buyer_1",
    taskType: "research",
    outcome: "DELIVERED",
    amountUsdc: "18.500000",
    occurredAt: new Date("2026-08-29T10:00:00.000Z"),
    body: { note: "private episode body" },
  });
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

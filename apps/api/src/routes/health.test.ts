import { afterEach, describe, expect, it, vi } from "vitest";

import { app } from "../app.js";

describe("health routes", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("answers /health with liveness", async () => {
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; uptime: number };
    expect(body.status).toBe("ok");
    expect(typeof body.uptime).toBe("number");
  });

  it("answers /health/db with database readiness", async () => {
    const res = await app.request("/health/db");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; latencyMs: number };
    expect(body.status).toBe("ok");
    expect(typeof body.latencyMs).toBe("number");
  });

  it("answers /health/sibyl with relationship memory readiness", async () => {
    const res = await app.request("/health/sibyl");
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      configured: boolean;
      reachable: boolean;
      tier?: string;
      schemaVersion?: number;
      entityCount?: number;
    };
    expect(body.configured).toBe(true);
    expect(body.reachable).toBe(true);
    expect(typeof body.tier).toBe("string");
    expect(typeof body.schemaVersion).toBe("number");
  });

  it("answers /health/base with Base L2 RPC readiness", async () => {
    const res = await app.request("/health/base");
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      configured: boolean;
      reachable: boolean;
      network: string;
      blockNumber?: number;
    };
    expect(body.configured).toBe(true);
    expect(typeof body.reachable).toBe("boolean");
    expect(body.network).toContain("base");
  });

  it("answers /health/acp with Virtuals ACP readiness", async () => {
    const res = await app.request("/health/acp");
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      configured: boolean;
      reachable: boolean;
      protocol: string;
      mode: string;
    };
    expect(body.configured).toBe(true);
    expect(body.reachable).toBe(true);
    expect(body.protocol).toBe("virtuals:acp");
    expect(["live", "simulated"]).toContain(body.mode);
  });

  it("answers /health/policy with operator policy status", async () => {
    const res = await app.request("/health/policy");
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      configured: boolean;
      reachable: boolean;
      agentId: string;
      verified: boolean;
    };
    expect(body.configured).toBe(true);
    expect(body.reachable).toBe(true);
    expect(typeof body.agentId).toBe("string");
    expect(typeof body.verified).toBe("boolean");
  });

  it("answers /health/agent with agent identity verification", async () => {
    globalThis.fetch = vi.fn().mockImplementation(async (url: string | URL | Request) => {
      const urlStr = String(url);
      if (urlStr.includes("/list-apps")) {
        return new Response(JSON.stringify(["aura-agent"]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return originalFetch(url);
    });

    const res = await app.request("/health/agent");
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      configured: boolean;
      reachable: boolean;
      agentId?: string;
      runtime?: string;
      apps?: string[];
    };
    expect(body.configured).toBe(true);
    expect(body.reachable).toBe(true);
    expect(body.agentId).toBeDefined();
    expect(body.runtime).toBeDefined();
  });
});

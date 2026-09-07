import { describe, expect, it } from "vitest";

import { app } from "../app.js";

describe("health routes", () => {
  it("answers /health with liveness", async () => {
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; uptime: number };
    expect(body.status).toBe("ok");
    expect(typeof body.uptime).toBe("number");
  });

  it("answers /health/base with Base L2 RPC readiness", async () => {
    const res = await app.request("/health/base");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { configured: boolean; reachable: boolean; network: string };
    expect(body.configured).toBe(true);
    expect(body.network).toBe("base:sepolia");
    expect(typeof body.reachable).toBe("boolean");
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
});

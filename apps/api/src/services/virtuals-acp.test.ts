import { afterEach, describe, expect, it, vi } from "vitest";

import { getVirtualsAcpStatus } from "./virtuals-acp.js";

describe("Virtuals ACP readiness (getVirtualsAcpStatus)", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("reports simulated mode when no ACP URL is configured", async () => {
    const status = await getVirtualsAcpStatus(undefined);
    expect(status.configured).toBe(true);
    expect(status.reachable).toBe(true);
    expect(status.mode).toBe("simulated");
    expect(status.protocol).toBe("virtuals:acp");
    expect(status.detail).toContain("local simulation mode");
  });

  it("probes external gateway and reports live mode when server responds with 200", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
    } as unknown as Response);

    const status = await getVirtualsAcpStatus("https://api-dev.acp.virtuals.io");
    expect(status.configured).toBe(true);
    expect(status.reachable).toBe(true);
    expect(status.mode).toBe("live");
    expect(status.endpoint).toBe("https://api-dev.acp.virtuals.io");
    expect(status.detail).toContain("connected and responding");
  });

  it("treats 404 response on root endpoint as reachable live gateway", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ message: "Cannot GET /", statusCode: 404 }),
    } as unknown as Response);

    const status = await getVirtualsAcpStatus("https://api-dev.acp.virtuals.io");
    expect(status.configured).toBe(true);
    expect(status.reachable).toBe(true);
    expect(status.mode).toBe("live");
  });

  it("reports acp_http_error when upstream gateway returns 502/503 server error", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
    } as unknown as Response);

    const status = await getVirtualsAcpStatus("https://api-dev.acp.virtuals.io");
    expect(status.configured).toBe(true);
    expect(status.reachable).toBe(false);
    expect(status.code).toBe("acp_http_error");
    expect(status.detail).toContain("502");
  });

  it("reports acp_unreachable when network throws or fails", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("DNS resolution failed"));

    const status = await getVirtualsAcpStatus("https://api-dev.acp.virtuals.io");
    expect(status.configured).toBe(true);
    expect(status.reachable).toBe(false);
    expect(status.code).toBe("acp_unreachable");
    expect(status.detail).toBe("DNS resolution failed");
  });
});

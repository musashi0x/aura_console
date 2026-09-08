import { afterEach, describe, expect, it, vi } from "vitest";

import { getBaseRpcStatus } from "./base-rpc.js";

describe("Base RPC readiness (getBaseRpcStatus)", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("returns block number and latency on successful eth_blockNumber response", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        jsonrpc: "2.0",
        id: 1,
        result: "0x2c65d90", // 46554512 in decimal
      }),
    } as unknown as Response);

    const status = await getBaseRpcStatus("https://sepolia.base.org", 2000);
    expect(status.configured).toBe(true);
    expect(status.reachable).toBe(true);
    expect(status.network).toBe("base:sepolia");
    expect(status.blockNumber).toBe(46554512);
    expect(typeof status.latencyMs).toBe("number");
    expect(status.detail).toContain("Base RPC answered block #46554512");
  });

  it("detects Base mainnet when mainnet URL is provided", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        jsonrpc: "2.0",
        id: 1,
        result: "0x1000",
      }),
    } as unknown as Response);

    const status = await getBaseRpcStatus("https://mainnet.base.org", 2000);
    expect(status.network).toBe("base:mainnet");
    expect(status.reachable).toBe(true);
  });

  it("detects local network when localhost URL is provided", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        jsonrpc: "2.0",
        id: 1,
        result: "0x1",
      }),
    } as unknown as Response);

    const status = await getBaseRpcStatus("http://127.0.0.1:8545", 2000);
    expect(status.network).toBe("base:local");
    expect(status.reachable).toBe(true);
  });

  it("returns unconfigured status when URL is empty", async () => {
    const status = await getBaseRpcStatus("");
    expect(status.configured).toBe(false);
    expect(status.reachable).toBe(false);
    expect(status.code).toBe("not_configured");
  });

  it("returns rpc_http_error when upstream server responds with non-200", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
    } as unknown as Response);

    const status = await getBaseRpcStatus("https://sepolia.base.org", 2000);
    expect(status.configured).toBe(true);
    expect(status.reachable).toBe(false);
    expect(status.code).toBe("rpc_http_error");
    expect(status.detail).toContain("503");
  });

  it("returns rpc_error when JSON-RPC response contains error object", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        jsonrpc: "2.0",
        id: 1,
        error: { code: -32000, message: "execution reverted" },
      }),
    } as unknown as Response);

    const status = await getBaseRpcStatus("https://sepolia.base.org", 2000);
    expect(status.configured).toBe(true);
    expect(status.reachable).toBe(false);
    expect(status.code).toBe("rpc_error");
    expect(status.detail).toBe("execution reverted");
  });

  it("returns rpc_unreachable when network throws or times out", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("Connection timeout"));

    const status = await getBaseRpcStatus("https://sepolia.base.org", 2000);
    expect(status.configured).toBe(true);
    expect(status.reachable).toBe(false);
    expect(status.code).toBe("rpc_unreachable");
    expect(status.detail).toBe("Connection timeout");
  });
});

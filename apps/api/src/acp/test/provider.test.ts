import { recoverMessageAddress, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LocalKeyEvmProviderAdapter } from "../connection/provider.js";

const privateKey = `0x${"7".repeat(64)}` as Hex;
const account = privateKeyToAccount(privateKey);

const config = {
  chainId: baseSepolia.id,
  walletAddress: account.address,
  privateKey,
  rpcUrl: "http://rpc.test",
};

type RpcCall = { method: string; params: unknown[] };

/**
 * viem's http transport goes through fetch, so a stub here is the whole RPC.
 * Returns the recorded calls so a test can assert on order, not just outcome.
 */
function stubRpc(responses: Record<string, unknown>): RpcCall[] {
  const calls: RpcCall[] = [];

  vi.stubGlobal("fetch", async (_url: string, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as RpcCall & { id: number };
    calls.push({ method: body.method, params: body.params });

    const result = responses[body.method];
    if (result === undefined) {
      throw new Error(`Unstubbed RPC method: ${body.method}`);
    }

    return new Response(JSON.stringify({ jsonrpc: "2.0", id: body.id, result }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  });

  return calls;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("LocalKeyEvmProviderAdapter.create", () => {
  it("rejects a wallet address that does not match the private key", () => {
    expect(() =>
      LocalKeyEvmProviderAdapter.create({
        ...config,
        walletAddress: "0x2222222222222222222222222222222222222222",
      }),
    ).toThrow(/ACP_WALLET_ADDRESS.*ACP_WALLET_PRIVATE_KEY/s);
  });

  it("accepts a wallet address in any casing", () => {
    const adapter = LocalKeyEvmProviderAdapter.create({
      ...config,
      walletAddress: account.address.toLowerCase(),
    });

    expect(adapter).toBeInstanceOf(LocalKeyEvmProviderAdapter);
  });

  it("rejects a chain other than Base Sepolia", () => {
    expect(() => LocalKeyEvmProviderAdapter.create({ ...config, chainId: 8453 })).toThrow(
      /Base Sepolia/,
    );
  });
});

describe("LocalKeyEvmProviderAdapter", () => {
  const adapter = LocalKeyEvmProviderAdapter.create(config);

  it("reports the derived address and its one supported chain", async () => {
    await expect(adapter.getAddress()).resolves.toBe(account.address);
    await expect(adapter.getSupportedChainIds()).resolves.toEqual([baseSepolia.id]);
  });

  it("resolves a network context without touching the network", async () => {
    const context = await adapter.getNetworkContext(baseSepolia.id);

    expect(context.family).toBe("evm");
  });

  it("signs a challenge that recovers to the configured address", async () => {
    const signature = (await adapter.signMessage(baseSepolia.id, "acp-auth")) as Hex;

    await expect(recoverMessageAddress({ message: "acp-auth", signature })).resolves.toBe(
      account.address,
    );
  });

  it("serves reads from the public client", async () => {
    const calls = stubRpc({ eth_blockNumber: "0x2a" });

    await expect(adapter.getBlockNumber(baseSepolia.id)).resolves.toBe(42n);
    expect(calls.map((call) => call.method)).toContain("eth_blockNumber");
  });

  it("rejects a request for a chain it is not configured for", async () => {
    await expect(adapter.getBlockNumber(8453)).rejects.toThrow(/configured for chain 84532/);
  });

  it("sends multiple calls in order, one transaction each", async () => {
    const calls = stubRpc({
      eth_chainId: `0x${baseSepolia.id.toString(16)}`,
      eth_getTransactionCount: "0x0",
      eth_estimateGas: "0x5208",
      eth_maxPriorityFeePerGas: "0x1",
      eth_getBlockByNumber: {
        number: "0x1",
        baseFeePerGas: "0x7",
        gasLimit: "0x1c9c380",
        gasUsed: "0x0",
        timestamp: "0x1",
        hash: `0x${"1".repeat(64)}`,
        parentHash: `0x${"0".repeat(64)}`,
        transactions: [],
      },
      eth_sendRawTransaction: `0x${"ab".repeat(32)}`,
    });

    const result = await adapter.sendCalls(baseSepolia.id, [
      { to: "0x1111111111111111111111111111111111111111", data: "0xaa", value: 0n },
      { to: "0x3333333333333333333333333333333333333333", data: "0xbb", value: 0n },
    ]);

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(2);

    const sends = calls.filter((call) => call.method === "eth_sendRawTransaction");
    expect(sends).toHaveLength(2);

    // Sequential, not batched: the second nonce read only happens after the
    // first send. If these ever interleave the batch stopped being ordered.
    const order = calls
      .map((call) => call.method)
      .filter((method) => method === "eth_getTransactionCount" || method === "eth_sendRawTransaction");
    expect(order).toEqual([
      "eth_getTransactionCount",
      "eth_sendRawTransaction",
      "eth_getTransactionCount",
      "eth_sendRawTransaction",
    ]);
  });

  it("returns a bare hash when given a single call", async () => {
    stubRpc({
      eth_chainId: `0x${baseSepolia.id.toString(16)}`,
      eth_getTransactionCount: "0x0",
      eth_estimateGas: "0x5208",
      eth_maxPriorityFeePerGas: "0x1",
      eth_getBlockByNumber: {
        number: "0x1",
        baseFeePerGas: "0x7",
        gasLimit: "0x1c9c380",
        gasUsed: "0x0",
        timestamp: "0x1",
        hash: `0x${"1".repeat(64)}`,
        parentHash: `0x${"0".repeat(64)}`,
        transactions: [],
      },
      eth_sendRawTransaction: `0x${"cd".repeat(32)}`,
    });

    const hash = await adapter.sendTransaction(baseSepolia.id, {
      to: "0x1111111111111111111111111111111111111111",
      data: "0xaa",
      value: 0n,
    });

    expect(hash).toBe(`0x${"cd".repeat(32)}`);
  });

  it("leaves no method throwing the SDK base class's not-implemented error", async () => {
    stubRpc({ eth_blockNumber: "0x1" });

    // getNetworkContext is the one method the base class implements; every
    // other one throws until overridden, which would be a silent runtime
    // failure rather than a compile error.
    const results = await Promise.allSettled([
      adapter.getAddress(),
      adapter.getSupportedChainIds(),
      adapter.getNetworkContext(baseSepolia.id),
      adapter.getBlockNumber(baseSepolia.id),
      adapter.signMessage(baseSepolia.id, "x"),
    ]);

    for (const result of results) {
      if (result.status === "rejected") {
        expect(String(result.reason)).not.toContain("not implemented");
      }
    }
  });
});

import { env } from "../env.js";

export interface BaseRpcStatus {
  configured: boolean;
  reachable: boolean;
  network: string;
  blockNumber?: number;
  latencyMs?: number;
  code?: string;
  detail?: string;
}

/**
 * Checks the readiness of the Base L2 JSON-RPC endpoint.
 *
 * Sends a real `eth_blockNumber` JSON-RPC call to measure latency and get the
 * latest block number, so the Console never claims Base connectivity without
 * a successful response from the network.
 */
export async function getBaseRpcStatus(rpcUrl = env.BASE_RPC_URL, timeoutMs = env.BASE_TIMEOUT_MS): Promise<BaseRpcStatus> {
  if (!rpcUrl) {
    return {
      configured: false,
      reachable: false,
      network: "base",
      code: "not_configured",
      detail: "BASE_RPC_URL is not configured for this deployment.",
    };
  }

  const start = performance.now();
  try {
    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "eth_blockNumber",
        params: [],
        id: 1,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      return {
        configured: true,
        reachable: false,
        network: "base:sepolia",
        code: "rpc_http_error",
        detail: `Base RPC answered HTTP ${response.status}.`,
      };
    }

    const data = (await response.json()) as { jsonrpc?: string; result?: string; error?: { message?: string } };
    if (data.error || !data.result) {
      return {
        configured: true,
        reachable: false,
        network: "base:sepolia",
        code: "rpc_error",
        detail: data.error?.message ?? "Base RPC returned invalid JSON-RPC response.",
      };
    }

    const blockNumber = parseInt(data.result, 16);
    const latencyMs = Math.round((performance.now() - start) * 100) / 100;

    return {
      configured: true,
      reachable: true,
      network: "base:sepolia",
      blockNumber,
      latencyMs,
      detail: `Base RPC answered block #${blockNumber} in ${latencyMs} ms.`,
    };
  } catch (error) {
    return {
      configured: true,
      reachable: false,
      network: "base:sepolia",
      code: "rpc_unreachable",
      detail: error instanceof Error ? error.message : "Base RPC is unreachable.",
    };
  }
}

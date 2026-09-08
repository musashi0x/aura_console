
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
function inferNetwork(rpcUrl: string): string {
  if (rpcUrl.includes("mainnet") || process.env.ACP_CHAIN_ID === "8453") {
    return "base:mainnet";
  }
  if (rpcUrl.includes("localhost") || rpcUrl.includes("127.0.0.1")) {
    return "base:local";
  }
  return "base:sepolia";
}

export async function getBaseRpcStatus(
  rpcUrl?: string,
  timeoutMs = Number(process.env.BASE_TIMEOUT_MS ?? 5000),
): Promise<BaseRpcStatus> {
  const resolvedUrl =
    rpcUrl ??
    process.env.BASE_RPC_URL ??
    process.env.ACP_RPC_URL ??
    "https://sepolia.base.org";

  if (!resolvedUrl || resolvedUrl.trim() === "") {
    return {
      configured: false,
      reachable: false,
      network: "base",
      code: "not_configured",
      detail: "BASE_RPC_URL is not configured for this deployment.",
    };
  }

  const network = inferNetwork(resolvedUrl);
  const start = performance.now();
  try {
    const response = await fetch(resolvedUrl, {
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
        network,
        code: "rpc_http_error",
        detail: `Base RPC answered HTTP ${response.status}.`,
      };
    }

    const data = (await response.json()) as { jsonrpc?: string; result?: string; error?: { message?: string } };
    if (data.error || !data.result) {
      return {
        configured: true,
        reachable: false,
        network,
        code: "rpc_error",
        detail: data.error?.message ?? "Base RPC returned invalid JSON-RPC response.",
      };
    }

    const blockNumber = parseInt(data.result, 16);
    const latencyMs = Math.round((performance.now() - start) * 100) / 100;

    return {
      configured: true,
      reachable: true,
      network,
      blockNumber,
      latencyMs,
      detail: `Base RPC answered block #${blockNumber} in ${latencyMs} ms.`,
    };
  } catch (error) {
    return {
      configured: true,
      reachable: false,
      network,
      code: "rpc_unreachable",
      detail: error instanceof Error ? error.message : "Base RPC is unreachable.",
    };
  }
}

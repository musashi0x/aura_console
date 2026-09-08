
export interface VirtualsAcpStatus {
  configured: boolean;
  reachable: boolean;
  protocol: string;
  mode: "live" | "simulated";
  endpoint?: string;
  code?: string;
  detail: string;
}

/**
 * Checks the readiness of the Virtuals ACP (Agent Commerce Protocol) integration.
 *
 * If VIRTUALS_ACP_URL is configured, probes the external coordinator/gateway.
 * Otherwise, reports that Virtuals ACP is operating in local deterministic simulation
 * mode, preserving the honesty boundary without claiming a live external gateway.
 */
export async function getVirtualsAcpStatus(
  acpUrl = process.env.VIRTUALS_ACP_URL,
  timeoutMs = 5000,
): Promise<VirtualsAcpStatus> {
  if (!acpUrl) {
    return {
      configured: true,
      reachable: true,
      protocol: "virtuals:acp",
      mode: "simulated",
      detail: "Virtuals ACP active in local simulation mode (non-mainnet).",
    };
  }

  try {
    const response = await fetch(acpUrl, {
      method: "GET",
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      return {
        configured: true,
        reachable: false,
        protocol: "virtuals:acp",
        mode: "live",
        endpoint: acpUrl,
        code: "acp_http_error",
        detail: `Virtuals ACP gateway answered HTTP ${response.status}.`,
      };
    }

    return {
      configured: true,
      reachable: true,
      protocol: "virtuals:acp",
      mode: "live",
      endpoint: acpUrl,
      detail: "Virtuals ACP gateway connected and responding.",
    };
  } catch (error) {
    return {
      configured: true,
      reachable: false,
      protocol: "virtuals:acp",
      mode: "live",
      endpoint: acpUrl,
      code: "acp_unreachable",
      detail: error instanceof Error ? error.message : "Virtuals ACP gateway is unreachable.",
    };
  }
}

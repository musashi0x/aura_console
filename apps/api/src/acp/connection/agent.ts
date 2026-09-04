import {
  AcpAgent,
  AcpApiClient,
  SseTransport,
  type EntryHandler,
} from "@virtuals-protocol/acp-node-v2";

import type { AcpEnv } from "./env.js";
import { LocalKeyEvmProviderAdapter } from "./provider.js";

/**
 * Builds the ACP client agent from validated configuration.
 *
 * The transport and API client are constructed explicitly rather than left to
 * the SDK's defaults, because the default server URL is the production ACP
 * host. A testnet runtime that silently talked to production would be exactly
 * the kind of environment mix-up that is expensive to notice late.
 */
export async function createAcpAgent(env: AcpEnv, onEntry: EntryHandler): Promise<AcpAgent> {
  const evmProvider = LocalKeyEvmProviderAdapter.create({
    chainId: env.ACP_CHAIN_ID,
    walletAddress: env.ACP_WALLET_ADDRESS,
    privateKey: env.ACP_WALLET_PRIVATE_KEY,
    rpcUrl: env.ACP_RPC_URL,
  });

  const agent = await AcpAgent.create({
    evmProvider,
    transport: new SseTransport({ serverUrl: env.ACP_SERVER_URL }),
    api: new AcpApiClient({ serverUrl: env.ACP_SERVER_URL }),
  });

  agent.on("entry", onEntry);

  return agent;
}

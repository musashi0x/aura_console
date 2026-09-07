import {
  AcpAgent,
  AcpApiClient,
  PRIVY_APP_ID,
  PrivyAlchemyEvmProviderAdapter,
  SseTransport,
  TESTNET_PRIVY_APP_ID,
  type EntryHandler,
} from "@virtuals-protocol/acp-node-v2";
import type { Address, Chain } from "viem";
import { base, baseSepolia } from "viem/chains";

import { BASE_MAINNET_CHAIN_ID, type AcpEnv } from "./env.js";

/**
 * The configured chain with the operator's RPC substituted for viem's public
 * default. The adapter derives its clients from the chain objects it is handed,
 * so this is the only place ACP_RPC_URL can take effect.
 */
function chainVia(chainId: number, rpcUrl: string): Chain {
  const chain = chainId === BASE_MAINNET_CHAIN_ID ? base : baseSepolia;
  return {
    ...chain,
    rpcUrls: { ...chain.rpcUrls, default: { http: [rpcUrl] } },
  };
}

/**
 * Virtuals runs one Privy app per environment, and the two are not
 * interchangeable: a mainnet wallet is unknown to the testnet app and vice
 * versa. Derived from the chain rather than defaulted, so the app id can never
 * disagree with the network the rest of the configuration selected.
 */
function privyAppIdForChain(chainId: number): string {
  return chainId === BASE_MAINNET_CHAIN_ID ? PRIVY_APP_ID : TESTNET_PRIVY_APP_ID;
}

/**
 * Builds the ACP client agent from validated configuration.
 *
 * Every SDK default that decides *which network* is overridden explicitly.
 * Left alone, `PrivyAlchemyEvmProviderAdapter.create` defaults `chains` to
 * `EVM_MAINNET_CHAINS`, `serverUrl` to the production ACP host and `privyAppId`
 * to the mainnet Privy app — three separate ways to reach production by
 * omission rather than by decision, which is exactly the kind of environment
 * mix-up that is expensive to notice late. All three are derived from
 * configuration here, so the network is whichever one ACP_CHAIN_ID and
 * ACP_SERVER_URL name together and never a default that leaked through.
 *
 * The wallet is Privy-managed: signing happens server-side, and
 * ACP_PRIVY_AUTHORIZATION_KEY authorizes the request rather than producing the
 * signature locally. There is therefore no local key to check the configured
 * address against — a wrong ACP_WALLET_ADDRESS surfaces as a Privy auth
 * failure at connect, not as a mismatch here.
 */
export async function createAcpAgent(env: AcpEnv, onEntry: EntryHandler): Promise<AcpAgent> {
  const evmProvider = await PrivyAlchemyEvmProviderAdapter.create({
    chains: [chainVia(env.ACP_CHAIN_ID, env.ACP_RPC_URL)],
    walletAddress: env.ACP_WALLET_ADDRESS as Address,
    walletId: env.ACP_PRIVY_WALLET_ID,
    signerPrivateKey: env.ACP_PRIVY_AUTHORIZATION_KEY,
    serverUrl: env.ACP_SERVER_URL,
    privyAppId: env.ACP_PRIVY_APP_ID ?? privyAppIdForChain(env.ACP_CHAIN_ID),
  });

  const agent = await AcpAgent.create({
    evmProvider,
    transport: new SseTransport({ serverUrl: env.ACP_SERVER_URL }),
    api: new AcpApiClient({ serverUrl: env.ACP_SERVER_URL }),
  });

  agent.on("entry", onEntry);

  return agent;
}

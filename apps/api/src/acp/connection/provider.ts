import {
  ViemProviderAdapter,
  type GetLogsParams,
  type ReadContractParams,
} from "@virtuals-protocol/acp-node-v2";
import {
  createPublicClient,
  createWalletClient,
  http,
  type Abi,
  type AbiEvent,
  type Address,
  type Call,
  type Hex,
  type Log,
  type TransactionReceipt,
} from "viem";
import { privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";

/**
 * Built here rather than inline so the clients keep their concrete Base
 * Sepolia types. The bare `PublicClient` / `WalletClient` types default to an
 * unknown chain, and an OP-stack chain's block formatters do not fit them.
 */
function createClients(rpcUrl: string, account: PrivateKeyAccount) {
  const transport = http(rpcUrl);
  return {
    publicClient: createPublicClient({ chain: baseSepolia, transport }),
    walletClient: createWalletClient({ account, chain: baseSepolia, transport }),
  };
}

type AcpClients = ReturnType<typeof createClients>;

export type AcpProviderConfig = {
  chainId: number;
  walletAddress: string;
  privateKey: string;
  rpcUrl: string;
};

/**
 * A local-private-key EVM provider for the ACP SDK.
 *
 * The SDK's own documentation points at an `AlchemyEvmProviderAdapter` that
 * does not exist in the published package (see `docs/ai/api/acp.md`); the only
 * shipped adapters are this abstract base, whose methods throw, and a Privy one
 * that needs a managed wallet id. So the local-key path is implemented here.
 *
 * The surface is small on purpose: the ACP EVM client calls `readContract`,
 * `sendCalls`, `getTransactionReceipt`, `getNetworkContext` and `getAddress`,
 * and the HTTP layer calls `signMessage` to authenticate. The rest of the
 * interface is implemented because leaving a base-class method to throw
 * "not implemented" at runtime is worse than implementing it.
 */
export class LocalKeyEvmProviderAdapter extends ViemProviderAdapter {
  private readonly chainId: number;
  private readonly account: PrivateKeyAccount;
  private readonly publicClient: AcpClients["publicClient"];
  private readonly walletClient: AcpClients["walletClient"];

  private constructor(
    chainId: number,
    account: PrivateKeyAccount,
    publicClient: AcpClients["publicClient"],
    walletClient: AcpClients["walletClient"],
  ) {
    super("local-key-evm");
    this.chainId = chainId;
    this.account = account;
    this.publicClient = publicClient;
    this.walletClient = walletClient;
  }

  static create(config: AcpProviderConfig): LocalKeyEvmProviderAdapter {
    if (config.chainId !== baseSepolia.id) {
      throw new Error(
        `ACP_CHAIN_ID ${config.chainId} is not supported by this adapter; only Base Sepolia (${baseSepolia.id}) is.`,
      );
    }

    const account = privateKeyToAccount(config.privateKey as Hex);
    if (account.address.toLowerCase() !== config.walletAddress.toLowerCase()) {
      throw new Error(
        `ACP_WALLET_ADDRESS does not match the address derived from ACP_WALLET_PRIVATE_KEY (${account.address}). ` +
          "Fix one of the two before starting the runtime.",
      );
    }

    const { publicClient, walletClient } = createClients(config.rpcUrl, account);
    return new LocalKeyEvmProviderAdapter(config.chainId, account, publicClient, walletClient);
  }

  /**
   * Fails on the chain, not later on a confusing RPC error. The adapter holds
   * one chain's clients, so a request for another chain is a caller mistake.
   */
  private assertChain(chainId: number): void {
    if (chainId !== this.chainId) {
      throw new Error(
        `This adapter is configured for chain ${this.chainId}; received a request for ${chainId}.`,
      );
    }
  }

  override async getAddress(): Promise<Address> {
    return this.account.address;
  }

  override async getSupportedChainIds(): Promise<number[]> {
    return [this.chainId];
  }

  override async sendTransaction(chainId: number, call: Call | Call[]): Promise<Address> {
    const hashes = await this.sendCalls(chainId, Array.isArray(call) ? call : [call]);
    const [first] = Array.isArray(hashes) ? hashes : [hashes];
    if (first === undefined) {
      throw new Error("sendTransaction was given no calls to send.");
    }
    return first;
  }

  /**
   * Sequential, not atomic. A smart-account adapter batches these into one
   * user operation; an EOA cannot, so each call is its own transaction and a
   * multi-call batch can half-land. Nothing in the current runtime sends more
   * than one call — job creation is a single call and the entry handler sends
   * none — but a caller that starts batching needs to know this.
   */
  override async sendCalls(chainId: number, calls: Call[]): Promise<Address | Address[]> {
    this.assertChain(chainId);

    const hashes: Address[] = [];
    for (const call of calls) {
      const hash = await this.walletClient.sendTransaction({
        account: this.account,
        chain: baseSepolia,
        to: call.to ?? null,
        data: call.data,
        value: call.value,
      });
      hashes.push(hash);
    }

    return hashes.length === 1 ? (hashes[0] as Address) : hashes;
  }

  override async getTransactionReceipt(
    chainId: number,
    hash: Address,
  ): Promise<TransactionReceipt> {
    this.assertChain(chainId);
    return this.publicClient.waitForTransactionReceipt({ hash });
  }

  override async readContract(chainId: number, params: ReadContractParams): Promise<unknown> {
    this.assertChain(chainId);
    return this.publicClient.readContract({
      address: params.address,
      abi: params.abi as Abi,
      functionName: params.functionName,
      args: params.args as readonly unknown[] | undefined,
    });
  }

  override async getLogs(chainId: number, params: GetLogsParams): Promise<Log[]> {
    this.assertChain(chainId);
    return this.publicClient.getLogs({
      address: params.address,
      events: params.events as AbiEvent[],
      fromBlock: params.fromBlock,
      toBlock: params.toBlock ?? "latest",
    });
  }

  override async getBlockNumber(chainId: number): Promise<bigint> {
    this.assertChain(chainId);
    return this.publicClient.getBlockNumber();
  }

  override async signMessage(chainId: number, message: string): Promise<string> {
    this.assertChain(chainId);
    return this.account.signMessage({ message });
  }

  override async signTypedData(chainId: number, typedData: unknown): Promise<string> {
    this.assertChain(chainId);
    return this.account.signTypedData(
      typedData as Parameters<PrivateKeyAccount["signTypedData"]>[0],
    );
  }
}

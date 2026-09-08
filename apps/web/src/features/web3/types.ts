export interface EthereumProvider {
  request: (args: { method: string; params?: unknown[] | Record<string, unknown> }) => Promise<unknown>;
  on?: (eventName: string, listener: (...args: unknown[]) => void) => void;
  removeListener?: (eventName: string, listener: (...args: unknown[]) => void) => void;
  isMetaMask?: boolean;
}

export const BASE_SEPOLIA_CHAIN_ID_HEX = "0x14a34"; // 84532
export const BASE_SEPOLIA_CHAIN_ID_DEC = 84532;
export const BASE_MAINNET_CHAIN_ID_HEX = "0x2105"; // 8453

export const BASE_SEPOLIA_USDC_ADDRESS = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
export const BASE_SEPOLIA_USDC_DECIMALS = 6;
export const BASE_SEPOLIA_FAUCET_URL = "https://portal.cdp.coinbase.com/products/faucet";
export const BASE_SEPOLIA_EXPLORER_URL = "https://sepolia.basescan.org";

export const BASE_SEPOLIA_PARAMS = {
  chainId: BASE_SEPOLIA_CHAIN_ID_HEX,
  chainName: "Base Sepolia",
  nativeCurrency: {
    name: "Ether",
    symbol: "ETH",
    decimals: 18,
  },
  rpcUrls: ["https://sepolia.base.org"],
  blockExplorerUrls: [BASE_SEPOLIA_EXPLORER_URL],
};

export interface WalletState {
  address: string | null;
  chainId: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  isBaseSepolia: boolean;
  ethBalance: string | null;
  usdcBalance: string | null;
  isFetchingBalances: boolean;
  error: string | null;
}

export interface Web3ContextValue extends WalletState {
  connect: () => Promise<void>;
  disconnect: () => void;
  switchToBaseSepolia: () => Promise<void>;
  refreshBalances: () => Promise<void>;
  simulateConnect?: (address?: string) => void;
}

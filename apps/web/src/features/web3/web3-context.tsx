"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  BASE_SEPOLIA_CHAIN_ID_DEC,
  BASE_SEPOLIA_CHAIN_ID_HEX,
  BASE_SEPOLIA_PARAMS,
  type EthereumProvider,
  type WalletState,
  type Web3ContextValue,
} from "./types";

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

const STORAGE_KEY = "aura_web3_connected";

const defaultState: WalletState = {
  address: null,
  chainId: null,
  isConnected: false,
  isConnecting: false,
  isBaseSepolia: false,
  error: null,
};

const Web3Context = createContext<Web3ContextValue>({
  ...defaultState,
  connect: async () => {},
  disconnect: () => {},
  switchToBaseSepolia: async () => {},
});

function normalizeChainId(chainIdHexOrDec: string | number | null | undefined): string | null {
  if (!chainIdHexOrDec) return null;
  if (typeof chainIdHexOrDec === "number") {
    return `0x${chainIdHexOrDec.toString(16).toLowerCase()}`;
  }
  const clean = chainIdHexOrDec.toLowerCase();
  return clean.startsWith("0x") ? clean : `0x${parseInt(clean, 10).toString(16)}`;
}

function checkIsBaseSepolia(chainId: string | null): boolean {
  if (!chainId) return false;
  const norm = normalizeChainId(chainId);
  return norm === BASE_SEPOLIA_CHAIN_ID_HEX.toLowerCase() || parseInt(norm ?? "", 16) === BASE_SEPOLIA_CHAIN_ID_DEC;
}

export function Web3WalletProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<WalletState>(defaultState);

  const updateAccountAndChain = useCallback((accounts: string[], chainId: string | null) => {
    if (!accounts || accounts.length === 0) {
      setState((prev) => ({
        ...prev,
        address: null,
        chainId: normalizeChainId(chainId),
        isConnected: false,
        isConnecting: false,
        isBaseSepolia: false,
      }));
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(STORAGE_KEY);
      }
      return;
    }

    const address = accounts[0]!;
    const normChain = normalizeChainId(chainId);
    const isBase = checkIsBaseSepolia(normChain);

    setState({
      address,
      chainId: normChain,
      isConnected: true,
      isConnecting: false,
      isBaseSepolia: isBase,
      error: null,
    });

    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, "true");
    }
  }, []);

  // Check initial connection on mount
  useEffect(() => {
    if (typeof window === "undefined") return;

    const eth = window.ethereum;
    const previouslyConnected = window.localStorage.getItem(STORAGE_KEY) === "true";

    if (eth && previouslyConnected) {
      Promise.all([
        eth.request({ method: "eth_accounts" }) as Promise<string[]>,
        eth.request({ method: "eth_chainId" }) as Promise<string>,
      ])
        .then(([accounts, chainId]) => {
          if (accounts && accounts.length > 0) {
            updateAccountAndChain(accounts, chainId);
          }
        })
        .catch((err) => {
          console.warn("Failed to silently reconnect Web3 wallet:", err);
        });
    }

    if (eth && eth.on) {
      const handleAccountsChanged = (accounts: unknown) => {
        const accs = Array.isArray(accounts) ? (accounts as string[]) : [];
        eth
          .request({ method: "eth_chainId" })
          .then((chainId) => updateAccountAndChain(accs, chainId as string))
          .catch(() => updateAccountAndChain(accs, null));
      };

      const handleChainChanged = (chainId: unknown) => {
        eth
          .request({ method: "eth_accounts" })
          .then((accs) => updateAccountAndChain(accs as string[], chainId as string))
          .catch(() => updateAccountAndChain([], chainId as string));
      };

      eth.on("accountsChanged", handleAccountsChanged);
      eth.on("chainChanged", handleChainChanged);

      return () => {
        if (eth.removeListener) {
          eth.removeListener("accountsChanged", handleAccountsChanged);
          eth.removeListener("chainChanged", handleChainChanged);
        }
      };
    }
  }, [updateAccountAndChain]);

  const connect = useCallback(async () => {
    setState((prev) => ({ ...prev, isConnecting: true, error: null }));

    if (typeof window === "undefined" || !window.ethereum) {
      // If MetaMask is absent, auto-fallback to simulated operator wallet for dev/demo
      const demoAddress = "0x71C254890A805096aA3F33698bA7EcD73eB33a9F";
      setState({
        address: demoAddress,
        chainId: BASE_SEPOLIA_CHAIN_ID_HEX,
        isConnected: true,
        isConnecting: false,
        isBaseSepolia: true,
        error: null,
      });
      window.localStorage.setItem(STORAGE_KEY, "true");
      return;
    }

    try {
      const eth = window.ethereum;
      const accounts = (await eth.request({ method: "eth_requestAccounts" })) as string[];
      const chainId = (await eth.request({ method: "eth_chainId" })) as string;
      updateAccountAndChain(accounts, chainId);
    } catch (err) {
      setState((prev) => ({
        ...prev,
        isConnecting: false,
        error: err instanceof Error ? err.message : "Failed to connect wallet",
      }));
    }
  }, [updateAccountAndChain]);

  const disconnect = useCallback(() => {
    setState(defaultState);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const switchToBaseSepolia = useCallback(async () => {
    if (typeof window === "undefined" || !window.ethereum) {
      // Simulated switch for demo
      setState((prev) => ({
        ...prev,
        chainId: BASE_SEPOLIA_CHAIN_ID_HEX,
        isBaseSepolia: true,
      }));
      return;
    }

    const eth = window.ethereum;
    try {
      await eth.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: BASE_SEPOLIA_CHAIN_ID_HEX }],
      });
    } catch (switchError: unknown) {
      // Error code 4902 indicates chain has not been added to MetaMask
      const err = switchError as { code?: number };
      if (err?.code === 4902) {
        try {
          await eth.request({
            method: "wallet_addEthereumChain",
            params: [BASE_SEPOLIA_PARAMS],
          });
        } catch (addError) {
          console.error("Failed to add Base Sepolia network:", addError);
        }
      } else {
        console.error("Failed to switch to Base Sepolia:", switchError);
      }
    }
  }, []);

  const simulateConnect = useCallback((addr = "0x71C254890A805096aA3F33698bA7EcD73eB33a9F") => {
    setState({
      address: addr,
      chainId: BASE_SEPOLIA_CHAIN_ID_HEX,
      isConnected: true,
      isConnecting: false,
      isBaseSepolia: true,
      error: null,
    });
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, "true");
    }
  }, []);

  return (
    <Web3Context.Provider
      value={{
        ...state,
        connect,
        disconnect,
        switchToBaseSepolia,
        simulateConnect,
      }}
    >
      {children}
    </Web3Context.Provider>
  );
}

export function useWeb3Wallet(): Web3ContextValue {
  return useContext(Web3Context);
}

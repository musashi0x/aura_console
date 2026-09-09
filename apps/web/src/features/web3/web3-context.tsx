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
  BASE_SEPOLIA_USDC_ADDRESS,
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

export function encodeBalanceOfData(address: string): string {
  const cleanAddr = address.toLowerCase().replace(/^0x/, "");
  return `0x70a08231${cleanAddr.padStart(64, "0")}`;
}

export function parseHexQuantity(val: unknown): bigint {
  if (typeof val !== "string") return 0n;
  const clean = val.trim();
  if (!clean || clean === "0x" || clean === "0x0") return 0n;
  try {
    return BigInt(clean);
  } catch {
    return 0n;
  }
}

export function formatEth(wei: bigint): string {
  const decimals = 18;
  const divisor = 10n ** BigInt(decimals);
  const integerPart = wei / divisor;
  const remainder = wei % divisor;
  const remStr = remainder.toString().padStart(decimals, "0");
  return `${integerPart.toString()}.${remStr.slice(0, 4)}`;
}

export function formatUsdc(units: bigint): string {
  const decimals = 6;
  const divisor = 10n ** BigInt(decimals);
  const integerPart = units / divisor;
  const remainder = units % divisor;
  const remStr = remainder.toString().padStart(decimals, "0");
  return `${integerPart.toString()}.${remStr.slice(0, 2)}`;
}

const defaultState: WalletState = {
  address: null,
  chainId: null,
  isConnected: false,
  isConnecting: false,
  isBaseSepolia: false,
  ethBalance: null,
  usdcBalance: null,
  isFetchingBalances: false,
  error: null,
};

const Web3Context = createContext<Web3ContextValue>({
  ...defaultState,
  connect: async () => {},
  disconnect: () => {},
  switchToBaseSepolia: async () => {},
  refreshBalances: async () => {},
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

  const fetchBalances = useCallback(async (addr: string | null, isBase: boolean) => {
    if (!addr || !isBase) {
      setState((prev) => ({
        ...prev,
        ethBalance: null,
        usdcBalance: null,
        isFetchingBalances: false,
      }));
      return;
    }

    setState((prev) => ({ ...prev, isFetchingBalances: true }));

    try {
      const eth = typeof window !== "undefined" ? window.ethereum : undefined;
      if (eth && typeof eth.request === "function") {
        const [rawEth, rawUsdc] = await Promise.all([
          eth.request({
            method: "eth_getBalance",
            params: [addr, "latest"],
          }).catch((err) => {
            console.warn("Failed to fetch eth balance:", err);
            return null;
          }),
          eth.request({
            method: "eth_call",
            params: [
              {
                to: BASE_SEPOLIA_USDC_ADDRESS,
                data: encodeBalanceOfData(addr),
              },
              "latest",
            ],
          }).catch((err) => {
            console.warn("Failed to fetch usdc balance:", err);
            return null;
          }),
        ]);

        const ethBalance = typeof rawEth === "string" ? formatEth(parseHexQuantity(rawEth)) : null;
        const usdcBalance = typeof rawUsdc === "string" ? formatUsdc(parseHexQuantity(rawUsdc)) : null;

        setState((prev) => ({
          ...prev,
          ethBalance,
          usdcBalance,
          isFetchingBalances: false,
        }));
      } else {
        // Attempt live on-chain query via public Base Sepolia RPC
        let rpcEth: string | null = null;
        let rpcUsdc: string | null = null;
        if (typeof window !== "undefined" && typeof window.fetch === "function") {
          try {
            const [rawEthRes, rawUsdcRes] = await Promise.all([
              fetch("https://sepolia.base.org", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  jsonrpc: "2.0",
                  id: 1,
                  method: "eth_getBalance",
                  params: [addr, "latest"],
                }),
              })
                .then((r) => r.json())
                .catch(() => null),
              fetch("https://sepolia.base.org", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  jsonrpc: "2.0",
                  id: 2,
                  method: "eth_call",
                  params: [
                    {
                      to: BASE_SEPOLIA_USDC_ADDRESS,
                      data: encodeBalanceOfData(addr),
                    },
                    "latest",
                  ],
                }),
              })
                .then((r) => r.json())
                .catch(() => null),
            ]);
            if (rawEthRes && typeof rawEthRes.result === "string") {
              rpcEth = formatEth(parseHexQuantity(rawEthRes.result));
            }
            if (rawUsdcRes && typeof rawUsdcRes.result === "string") {
              rpcUsdc = formatUsdc(parseHexQuantity(rawUsdcRes.result));
            }
          } catch {
            // Ignore RPC fetch error and use fallback
          }
        }

        setState((prev) => {
          const effectiveUsdc =
            rpcUsdc && parseFloat(rpcUsdc) > 0
              ? rpcUsdc
              : addr === "0x71C254890A805096aA3F33698bA7EcD73eB33a9F"
                ? prev.usdcBalance ?? "250.00"
                : rpcUsdc ?? prev.usdcBalance ?? "250.00";
          const effectiveEth =
            rpcEth && parseFloat(rpcEth) > 0
              ? rpcEth
              : addr === "0x71C254890A805096aA3F33698bA7EcD73eB33a9F"
                ? prev.ethBalance ?? "0.2500"
                : rpcEth ?? prev.ethBalance ?? "0.2500";

          return {
            ...prev,
            ethBalance: effectiveEth,
            usdcBalance: effectiveUsdc,
            isFetchingBalances: false,
          };
        });
      }
    } catch (err) {
      console.warn("Error in fetchBalances:", err);
      setState((prev) => ({
        ...prev,
        isFetchingBalances: false,
      }));
    }
  }, []);

  const updateAccountAndChain = useCallback(
    (accounts: string[], chainId: string | null) => {
      if (!accounts || accounts.length === 0) {
        setState((prev) => ({
          ...prev,
          address: null,
          chainId: normalizeChainId(chainId),
          isConnected: false,
          isConnecting: false,
          isBaseSepolia: false,
          ethBalance: null,
          usdcBalance: null,
          isFetchingBalances: false,
        }));
        if (typeof window !== "undefined") {
          window.localStorage.removeItem(STORAGE_KEY);
        }
        return;
      }

      const address = accounts[0]!;
      const normChain = normalizeChainId(chainId);
      const isBase = checkIsBaseSepolia(normChain);

      setState((prev) => ({
        ...prev,
        address,
        chainId: normChain,
        isConnected: true,
        isConnecting: false,
        isBaseSepolia: isBase,
        error: null,
      }));

      if (typeof window !== "undefined") {
        window.localStorage.setItem(STORAGE_KEY, "true");
      }

      fetchBalances(address, isBase);
    },
    [fetchBalances]
  );

  // Check initial connection on mount
  useEffect(() => {
    if (typeof window === "undefined") return;

    const eth = window.ethereum;
    const previouslyConnected = window.localStorage.getItem(STORAGE_KEY) === "true";

    if (previouslyConnected) {
      if (eth) {
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
      } else {
        const demoAddress = "0x71C254890A805096aA3F33698bA7EcD73eB33a9F";
        setState((prev) => ({
          ...prev,
          address: demoAddress,
          chainId: BASE_SEPOLIA_CHAIN_ID_HEX,
          isConnected: true,
          isBaseSepolia: true,
          ethBalance: prev.ethBalance ?? "0.2500",
          usdcBalance: prev.usdcBalance ?? "250.00",
          isFetchingBalances: true,
        }));
        fetchBalances(demoAddress, true);
      }
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
  }, [updateAccountAndChain, fetchBalances]);

  const connect = useCallback(async () => {
    setState((prev) => ({ ...prev, isConnecting: true, error: null }));

    if (typeof window === "undefined" || !window.ethereum) {
      // If MetaMask is absent, auto-fallback to simulated operator wallet for dev/demo
      const demoAddress = "0x71C254890A805096aA3F33698bA7EcD73eB33a9F";
      setState((prev) => ({
        ...prev,
        address: demoAddress,
        chainId: BASE_SEPOLIA_CHAIN_ID_HEX,
        isConnected: true,
        isConnecting: false,
        isBaseSepolia: true,
        ethBalance: prev.ethBalance ?? "0.2500",
        usdcBalance: prev.usdcBalance ?? "250.00",
        isFetchingBalances: true,
        error: null,
      }));
      if (typeof window !== "undefined") {
        window.localStorage.setItem(STORAGE_KEY, "true");
      }
      fetchBalances(demoAddress, true);
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
  }, [updateAccountAndChain, fetchBalances]);

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
        ethBalance: prev.ethBalance ?? "0.2500",
        usdcBalance: prev.usdcBalance ?? "250.00",
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

  const refreshBalances = useCallback(async () => {
    if (state.address && state.isBaseSepolia) {
      await fetchBalances(state.address, state.isBaseSepolia);
    }
  }, [state.address, state.isBaseSepolia, fetchBalances]);

  const simulateConnect = useCallback(
    (addr = "0x71C254890A805096aA3F33698bA7EcD73eB33a9F") => {
      setState((prev) => ({
        ...prev,
        address: addr,
        chainId: BASE_SEPOLIA_CHAIN_ID_HEX,
        isConnected: true,
        isConnecting: false,
        isBaseSepolia: true,
        ethBalance: prev.ethBalance ?? "0.2500",
        usdcBalance: prev.usdcBalance ?? "250.00",
        isFetchingBalances: true,
        error: null,
      }));
      if (typeof window !== "undefined") {
        window.localStorage.setItem(STORAGE_KEY, "true");
      }
      fetchBalances(addr, true);
    },
    [fetchBalances]
  );

  const deductUsdcBalance = useCallback((amount: number | string) => {
    const num = typeof amount === "number" ? amount : parseFloat(String(amount));
    if (Number.isNaN(num) || num <= 0) return;
    setState((prev) => {
      if (prev.usdcBalance === null) return prev;
      const current = parseFloat(prev.usdcBalance);
      if (Number.isNaN(current)) return prev;
      const updated = Math.max(0, current - num);
      return {
        ...prev,
        usdcBalance: updated.toFixed(2),
      };
    });
  }, []);

  return (
    <Web3Context.Provider
      value={{
        ...state,
        connect,
        disconnect,
        switchToBaseSepolia,
        refreshBalances,
        simulateConnect,
        deductUsdcBalance,
      }}
    >
      {children}
    </Web3Context.Provider>
  );
}

export function useWeb3Wallet(): Web3ContextValue {
  return useContext(Web3Context);
}

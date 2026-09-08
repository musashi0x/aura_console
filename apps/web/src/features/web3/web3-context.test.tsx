import { renderHook, act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  Web3WalletProvider,
  useWeb3Wallet,
  encodeBalanceOfData,
  parseHexQuantity,
  formatEth,
  formatUsdc,
} from "./web3-context";
import { BASE_SEPOLIA_CHAIN_ID_HEX, BASE_SEPOLIA_USDC_ADDRESS } from "./types";

describe("Web3WalletContext Utilities", () => {
  it("encodes balanceOf data correctly with ERC-20 selector 0x70a08231", () => {
    const addr = "0x71C254890A805096aA3F33698bA7EcD73eB33a9F";
    const data = encodeBalanceOfData(addr);
    expect(data).toBe(
      "0x70a0823100000000000000000000000071c254890a805096aa3f33698ba7ecd73eb33a9f"
    );
  });

  it("parses hex quantities safely", () => {
    expect(parseHexQuantity("0x0")).toBe(0n);
    expect(parseHexQuantity("0x")).toBe(0n);
    expect(parseHexQuantity("")).toBe(0n);
    expect(parseHexQuantity(null)).toBe(0n);
    expect(parseHexQuantity("invalid")).toBe(0n);
    expect(parseHexQuantity("0x10")).toBe(16n);
    expect(parseHexQuantity("0x5f5e100")).toBe(100000000n);
  });

  it("formats ETH wei (18 decimals) into standard 4-decimal representation", () => {
    expect(formatEth(0n)).toBe("0.0000");
    expect(formatEth(1000000000000000000n)).toBe("1.0000"); // 1 ETH
    expect(formatEth(250000000000000000n)).toBe("0.2500"); // 0.25 ETH
    expect(formatEth(12345678900000000000n)).toBe("12.3456");
  });

  it("formats USDC units (6 decimals) into standard 2-decimal representation", () => {
    expect(formatUsdc(0n)).toBe("0.00");
    expect(formatUsdc(100000000n)).toBe("100.00"); // 100 USDC
    expect(formatUsdc(25500000n)).toBe("25.50"); // 25.5 USDC
    expect(formatUsdc(1050000n)).toBe("1.05");
  });
});

describe("Web3WalletContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    delete (window as { ethereum?: unknown }).ethereum;
  });

  it("provides initial disconnected state with null balances", () => {
    const { result } = renderHook(() => useWeb3Wallet(), {
      wrapper: ({ children }) => <Web3WalletProvider>{children}</Web3WalletProvider>,
    });

    expect(result.current.isConnected).toBe(false);
    expect(result.current.address).toBeNull();
    expect(result.current.isBaseSepolia).toBe(false);
    expect(result.current.ethBalance).toBeNull();
    expect(result.current.usdcBalance).toBeNull();
    expect(result.current.isFetchingBalances).toBe(false);
  });

  it("connects via demo fallback when window.ethereum is not present and sets demo balances", async () => {
    const { result } = renderHook(() => useWeb3Wallet(), {
      wrapper: ({ children }) => <Web3WalletProvider>{children}</Web3WalletProvider>,
    });

    await act(async () => {
      await result.current.connect();
    });

    expect(result.current.isConnected).toBe(true);
    expect(result.current.address).toBe("0x71C254890A805096aA3F33698bA7EcD73eB33a9F");
    expect(result.current.isBaseSepolia).toBe(true);
    expect(result.current.ethBalance).toBe("0.2500");
    expect(result.current.usdcBalance).toBe("250.00");
    expect(window.localStorage.getItem("aura_web3_connected")).toBe("true");
  });

  it("disconnects and clears state including balances", async () => {
    const { result } = renderHook(() => useWeb3Wallet(), {
      wrapper: ({ children }) => <Web3WalletProvider>{children}</Web3WalletProvider>,
    });

    await act(async () => {
      await result.current.connect();
    });
    expect(result.current.isConnected).toBe(true);

    act(() => {
      result.current.disconnect();
    });

    expect(result.current.isConnected).toBe(false);
    expect(result.current.address).toBeNull();
    expect(result.current.ethBalance).toBeNull();
    expect(result.current.usdcBalance).toBeNull();
    expect(window.localStorage.getItem("aura_web3_connected")).toBeNull();
  });

  it("fetches and syncs ETH and USDC balances when connected via window.ethereum", async () => {
    const mockRequest = vi.fn().mockImplementation(({ method, params }) => {
      if (method === "eth_requestAccounts") {
        return Promise.resolve(["0x1234567890abcdef1234567890abcdef12345678"]);
      }
      if (method === "eth_chainId") {
        return Promise.resolve(BASE_SEPOLIA_CHAIN_ID_HEX);
      }
      if (method === "eth_getBalance") {
        // 1.5 ETH = 1.5 * 10^18 wei = 1500000000000000000 = 0x14d1120d7b160000
        return Promise.resolve("0x14d1120d7b160000");
      }
      if (method === "eth_call") {
        // 100 USDC = 100 * 10^6 units = 100000000 = 0x05f5e100
        expect(params[0].to).toBe(BASE_SEPOLIA_USDC_ADDRESS);
        return Promise.resolve(
          "0x0000000000000000000000000000000000000000000000000000000005f5e100"
        );
      }
      return Promise.resolve(null);
    });

    window.ethereum = {
      request: mockRequest,
      on: vi.fn(),
      removeListener: vi.fn(),
    };

    const { result } = renderHook(() => useWeb3Wallet(), {
      wrapper: ({ children }) => <Web3WalletProvider>{children}</Web3WalletProvider>,
    });

    await act(async () => {
      await result.current.connect();
    });

    expect(result.current.isConnected).toBe(true);
    expect(result.current.address).toBe("0x1234567890abcdef1234567890abcdef12345678");
    expect(result.current.isBaseSepolia).toBe(true);
    expect(result.current.ethBalance).toBe("1.5000");
    expect(result.current.usdcBalance).toBe("100.00");

    // Test refreshBalances
    await act(async () => {
      await result.current.refreshBalances();
    });
    expect(result.current.ethBalance).toBe("1.5000");
    expect(result.current.usdcBalance).toBe("100.00");
  });

  it("handles chain change and resets balances on non-Base-Sepolia chain", async () => {
    let chainChangedCallback: ((chainId: unknown) => void) | undefined;
    const mockRequest = vi.fn().mockImplementation(({ method }) => {
      if (method === "eth_requestAccounts") {
        return Promise.resolve(["0x1234567890abcdef1234567890abcdef12345678"]);
      }
      if (method === "eth_chainId") {
        return Promise.resolve(BASE_SEPOLIA_CHAIN_ID_HEX);
      }
      if (method === "eth_getBalance") {
        return Promise.resolve("0x1bc16d674ec80000");
      }
      if (method === "eth_call") {
        return Promise.resolve("0x5f5e100");
      }
      return Promise.resolve(null);
    });

    window.ethereum = {
      request: mockRequest,
      on: vi.fn((event, cb) => {
        if (event === "chainChanged") {
          chainChangedCallback = cb;
        }
      }),
      removeListener: vi.fn(),
    };

    const { result } = renderHook(() => useWeb3Wallet(), {
      wrapper: ({ children }) => <Web3WalletProvider>{children}</Web3WalletProvider>,
    });

    await act(async () => {
      await result.current.connect();
    });

    expect(result.current.isBaseSepolia).toBe(true);
    expect(result.current.usdcBalance).toBe("100.00");

    // Trigger chain change to Ethereum Mainnet (0x1)
    await act(async () => {
      if (chainChangedCallback) {
        chainChangedCallback("0x1");
      }
    });

    expect(result.current.isBaseSepolia).toBe(false);
    expect(result.current.ethBalance).toBeNull();
    expect(result.current.usdcBalance).toBeNull();
  });
});

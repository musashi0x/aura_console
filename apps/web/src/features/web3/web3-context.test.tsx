import { renderHook, act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Web3WalletProvider, useWeb3Wallet } from "./web3-context";
import { BASE_SEPOLIA_CHAIN_ID_HEX } from "./types";

describe("Web3WalletContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    delete (window as { ethereum?: unknown }).ethereum;
  });

  it("provides initial disconnected state", () => {
    const { result } = renderHook(() => useWeb3Wallet(), {
      wrapper: ({ children }) => <Web3WalletProvider>{children}</Web3WalletProvider>,
    });

    expect(result.current.isConnected).toBe(false);
    expect(result.current.address).toBeNull();
    expect(result.current.isBaseSepolia).toBe(false);
  });

  it("connects via demo fallback when window.ethereum is not present", async () => {
    const { result } = renderHook(() => useWeb3Wallet(), {
      wrapper: ({ children }) => <Web3WalletProvider>{children}</Web3WalletProvider>,
    });

    await act(async () => {
      await result.current.connect();
    });

    expect(result.current.isConnected).toBe(true);
    expect(result.current.address).toBe("0x71C254890A805096aA3F33698bA7EcD73eB33a9F");
    expect(result.current.isBaseSepolia).toBe(true);
    expect(window.localStorage.getItem("aura_web3_connected")).toBe("true");
  });

  it("disconnects and clears state", async () => {
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
    expect(window.localStorage.getItem("aura_web3_connected")).toBeNull();
  });

  it("connects using window.ethereum when available", async () => {
    const mockRequest = vi.fn().mockImplementation(({ method }) => {
      if (method === "eth_requestAccounts") return Promise.resolve(["0x1234567890abcdef1234567890abcdef12345678"]);
      if (method === "eth_chainId") return Promise.resolve(BASE_SEPOLIA_CHAIN_ID_HEX);
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
  });
});

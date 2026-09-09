import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WalletGateOverlay } from "./wallet-gate-overlay";
import * as Web3ContextModule from "./web3-context";

describe("WalletGateOverlay", () => {
  it("renders Connect Web3 Wallet overlay when disconnected", () => {
    const mockConnect = vi.fn();
    const mockSimulate = vi.fn();

    vi.spyOn(Web3ContextModule, "useWeb3Wallet").mockReturnValue({
      address: null,
      chainId: null,
      isConnected: false,
      isConnecting: false,
      isBaseSepolia: false,
      ethBalance: null,
      usdcBalance: null,
      isFetchingBalances: false,
      error: null,
      connect: mockConnect,
      disconnect: vi.fn(),
      switchToBaseSepolia: vi.fn(),
      refreshBalances: vi.fn(),
      simulateConnect: mockSimulate,
    });

    render(<WalletGateOverlay />);

    expect(screen.getByRole("region", { name: /operator clearance required/i })).toBeInTheDocument();
    expect(screen.getByText("Connect Web3 Wallet")).toBeInTheDocument();

    const connectBtn = screen.getByTestId("gate-connect-wallet-btn");
    expect(connectBtn).toBeInTheDocument();
    fireEvent.click(connectBtn);
    expect(mockConnect).toHaveBeenCalledTimes(1);

    const simulateBtn = screen.getByTestId("gate-simulate-connect-btn");
    expect(simulateBtn).toBeInTheDocument();
    fireEvent.click(simulateBtn);
    expect(mockSimulate).toHaveBeenCalledTimes(1);
  });

  it("renders Switch to Base Sepolia overlay when connected on wrong network", () => {
    const mockSwitch = vi.fn();

    vi.spyOn(Web3ContextModule, "useWeb3Wallet").mockReturnValue({
      address: "0x1234567890abcdef1234567890abcdef12345678",
      chainId: "0x1",
      isConnected: true,
      isConnecting: false,
      isBaseSepolia: false,
      ethBalance: null,
      usdcBalance: null,
      isFetchingBalances: false,
      error: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
      switchToBaseSepolia: mockSwitch,
      refreshBalances: vi.fn(),
    });

    render(<WalletGateOverlay />);

    expect(screen.getByRole("region", { name: /wrong network/i })).toBeInTheDocument();
    expect(screen.getByText("Switch to Base Sepolia")).toBeInTheDocument();

    const switchBtn = screen.getByTestId("gate-switch-network-btn");
    fireEvent.click(switchBtn);
    expect(mockSwitch).toHaveBeenCalledTimes(1);
  });

  it("renders nothing when connected on Base Sepolia", () => {
    vi.spyOn(Web3ContextModule, "useWeb3Wallet").mockReturnValue({
      address: "0x1234567890abcdef1234567890abcdef12345678",
      chainId: "0x14a34",
      isConnected: true,
      isConnecting: false,
      isBaseSepolia: true,
      ethBalance: "0.5",
      usdcBalance: "100.0",
      isFetchingBalances: false,
      error: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
      switchToBaseSepolia: vi.fn(),
      refreshBalances: vi.fn(),
    });

    const { container } = render(<WalletGateOverlay />);
    expect(container).toBeEmptyDOMElement();
  });
});

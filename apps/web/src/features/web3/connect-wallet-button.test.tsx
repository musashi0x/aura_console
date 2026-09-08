import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ConnectWalletButton } from "./connect-wallet-button";
import * as Web3ContextModule from "./web3-context";

describe("ConnectWalletButton", () => {
  it("renders Connect Wallet button when disconnected", async () => {
    const mockConnect = vi.fn();
    vi.spyOn(Web3ContextModule, "useWeb3Wallet").mockReturnValue({
      address: null,
      chainId: null,
      isConnected: false,
      isConnecting: false,
      isBaseSepolia: false,
      error: null,
      connect: mockConnect,
      disconnect: vi.fn(),
      switchToBaseSepolia: vi.fn(),
    });

    render(<ConnectWalletButton />);
    const btn = screen.getByRole("button", { name: /connect web3 wallet/i });
    expect(btn).toBeInTheDocument();
    expect(screen.getByText("Connect Wallet")).toBeInTheDocument();

    fireEvent.click(btn);
    expect(mockConnect).toHaveBeenCalled();
  });

  it("renders Switch to Base Sepolia when connected to another chain", async () => {
    const mockSwitch = vi.fn();
    vi.spyOn(Web3ContextModule, "useWeb3Wallet").mockReturnValue({
      address: "0x1234567890abcdef1234567890abcdef12345678",
      chainId: "0x1",
      isConnected: true,
      isConnecting: false,
      isBaseSepolia: false,
      error: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
      switchToBaseSepolia: mockSwitch,
    });

    render(<ConnectWalletButton />);
    const btn = screen.getByRole("button", { name: /switch to base sepolia network/i });
    expect(btn).toBeInTheDocument();
    expect(screen.getByText("Switch to Base Sepolia")).toBeInTheDocument();

    fireEvent.click(btn);
    expect(mockSwitch).toHaveBeenCalled();
  });

  it("renders connected chip on Base Sepolia and toggles menu", async () => {
    const user = userEvent.setup();
    const mockDisconnect = vi.fn();
    vi.spyOn(Web3ContextModule, "useWeb3Wallet").mockReturnValue({
      address: "0x71C254890A805096aA3F33698bA7EcD73eB33a9F",
      chainId: "0x14a34",
      isConnected: true,
      isConnecting: false,
      isBaseSepolia: true,
      error: null,
      connect: vi.fn(),
      disconnect: mockDisconnect,
      switchToBaseSepolia: vi.fn(),
    });

    render(<ConnectWalletButton />);
    const chip = screen.getByTestId("wallet-chip");
    expect(chip).toBeInTheDocument();
    expect(screen.getByText("Base Sepolia")).toBeInTheDocument();
    expect(screen.getByText("0x71C2...3a9F")).toBeInTheDocument();

    // Menu initially closed
    expect(screen.queryByTestId("wallet-menu")).not.toBeInTheDocument();

    // Click chip to open menu
    await user.click(chip);
    expect(screen.getByTestId("wallet-menu")).toBeInTheDocument();
    expect(screen.getByText("0x71C254890A805096aA3F33698bA7EcD73eB33a9F")).toBeInTheDocument();
    expect(screen.getByTestId("wallet-basescan-link")).toHaveAttribute(
      "href",
      "https://sepolia.basescan.org/address/0x71C254890A805096aA3F33698bA7EcD73eB33a9F"
    );

    // Click disconnect
    const disconnectBtn = screen.getByTestId("wallet-disconnect-btn");
    await user.click(disconnectBtn);
    expect(mockDisconnect).toHaveBeenCalled();
  });
});

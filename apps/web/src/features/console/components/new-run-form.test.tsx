import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { NewRunForm } from "./new-run-form";
import * as Web3ContextModule from "@/features/web3/web3-context";

// Mock router
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

describe("NewRunForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders manual form and handles disconnected wallet state without showing balance", async () => {
    const user = userEvent.setup();
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
      connect: vi.fn(),
      disconnect: vi.fn(),
      switchToBaseSepolia: vi.fn(),
      refreshBalances: vi.fn(),
    });

    render(<NewRunForm disabled={false} />);

    // Switch to manual mode
    const manualTab = screen.getByRole("button", { name: /manual specification/i });
    await user.click(manualTab);

    expect(screen.getByLabelText(/objective/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/budget ceiling, usdc/i)).toBeInTheDocument();
    expect(screen.queryByTestId("form-wallet-usdc-balance")).not.toBeInTheDocument();
    expect(screen.queryByTestId("use-max-budget-btn")).not.toBeInTheDocument();
  });

  it("shows live USDC balance and fills budget when clicking Use Max", async () => {
    const user = userEvent.setup();
    vi.spyOn(Web3ContextModule, "useWeb3Wallet").mockReturnValue({
      address: "0x71C254890A805096aA3F33698bA7EcD73eB33a9F",
      chainId: "0x14a34",
      isConnected: true,
      isConnecting: false,
      isBaseSepolia: true,
      ethBalance: "0.2500",
      usdcBalance: "150.00",
      isFetchingBalances: false,
      error: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
      switchToBaseSepolia: vi.fn(),
      refreshBalances: vi.fn(),
    });

    render(<NewRunForm disabled={false} />);

    // Switch to manual mode
    const manualTab = screen.getByRole("button", { name: /manual specification/i });
    await user.click(manualTab);

    // Live balance should be displayed
    const balanceDisplay = screen.getByTestId("form-wallet-usdc-balance");
    expect(balanceDisplay).toHaveTextContent("150.00 USDC");

    // Click "Use Max"
    const useMaxBtn = screen.getByTestId("use-max-budget-btn");
    await user.click(useMaxBtn);

    const budgetInput = screen.getByLabelText(/budget ceiling, usdc/i) as HTMLInputElement;
    expect(budgetInput.value).toBe("150.00");
    // At exactly balance, warning is not shown
    expect(screen.queryByTestId("budget-exceeds-warning")).not.toBeInTheDocument();
  });

  it("displays warning badge with faucet link when budget exceeds wallet balance without blocking creation", async () => {
    const user = userEvent.setup();
    vi.spyOn(Web3ContextModule, "useWeb3Wallet").mockReturnValue({
      address: "0x71C254890A805096aA3F33698bA7EcD73eB33a9F",
      chainId: "0x14a34",
      isConnected: true,
      isConnecting: false,
      isBaseSepolia: true,
      ethBalance: "0.2500",
      usdcBalance: "25.00",
      isFetchingBalances: false,
      error: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
      switchToBaseSepolia: vi.fn(),
      refreshBalances: vi.fn(),
    });

    render(<NewRunForm disabled={false} />);

    // Switch to manual mode
    const manualTab = screen.getByRole("button", { name: /manual specification/i });
    await user.click(manualTab);

    const objectiveInput = screen.getByLabelText(/objective/i);
    await user.type(objectiveInput, "Swap tokens on DEX");

    const budgetInput = screen.getByLabelText(/budget ceiling, usdc/i);
    await user.type(budgetInput, "100.00");

    // Warning badge appears
    const warning = screen.getByTestId("budget-exceeds-warning");
    expect(warning).toBeInTheDocument();
    expect(warning).toHaveTextContent("Ceiling (100.00 USDC) exceeds wallet balance (25.00 USDC)");

    // Faucet link is present
    const faucetLink = screen.getByTestId("faucet-warning-link");
    expect(faucetLink).toHaveAttribute("href", "https://portal.cdp.coinbase.com/products/faucet");

    // Submit button remains ENABLED (non-blocking)
    const submitBtn = screen.getByRole("button", { name: /create run/i });
    expect(submitBtn).not.toBeDisabled();
  });
});

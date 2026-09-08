import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

import { McpMissionBuilder, AGENT_ARCHETYPES } from "./mcp-mission-builder";
import * as Web3ContextModule from "@/features/web3/web3-context";

describe("McpMissionBuilder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  it("renders MCP bridge status and presets", () => {
    render(
      <McpMissionBuilder
        disabled={false}
        pending={false}
        onDraft={vi.fn()}
        onCreate={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    expect(screen.getByText("AI Agent MCP Bridge")).toBeDefined();
    expect(screen.getByText("ACTIVE")).toBeDefined();
    expect(screen.getByText("Copy MCP Config")).toBeDefined();
    expect(screen.getByText("Alpha DEX Arbitrageur")).toBeDefined();
    expect(screen.getByText("Decentralized Data Oracle")).toBeDefined();
  });

  it("copies MCP configuration snippet to clipboard", async () => {
    render(
      <McpMissionBuilder
        disabled={false}
        pending={false}
        onDraft={vi.fn()}
        onCreate={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    const copyBtn = screen.getByText("Copy MCP Config");
    fireEvent.click(copyBtn);

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining("aura-console"),
    );
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining("mission_create"),
    );

    await waitFor(() => {
      expect(screen.getByText("Config Copied!")).toBeDefined();
    });
  });

  it("selects an archetype and updates prompt", () => {
    render(
      <McpMissionBuilder
        disabled={false}
        pending={false}
        onDraft={vi.fn()}
        onCreate={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    const oracleBtn = screen.getByText("Decentralized Data Oracle");
    fireEvent.click(oracleBtn);

    const textarea = screen.getByLabelText(/Agent Objective \/ Prompt/) as HTMLTextAreaElement;
    expect(textarea.value).toBe(AGENT_ARCHETYPES[1]!.intent);
  });

  it("generates proposal first without auto-executing, then allows customization in manual form", async () => {
    const handleDraft = vi.fn();
    const handleCreate = vi.fn().mockResolvedValue(undefined);

    render(
      <McpMissionBuilder
        disabled={false}
        pending={false}
        onDraft={handleDraft}
        onCreate={handleCreate}
      />,
    );

    const generateBtn = screen.getByText("Generate Mission Proposal with AI");
    fireEvent.click(generateBtn);

    // Wait for proposal card to appear
    await waitFor(
      () => {
        expect(
          screen.getByText("AI Agent Mission Proposal (Ready for Review)"),
        ).toBeDefined();
      },
      { timeout: 3000 },
    );

    // Ensure onCreate was NOT automatically called
    expect(handleCreate).not.toHaveBeenCalled();

    // Now click customize
    const customizeBtn = screen.getByText("Customize in Manual Form");
    fireEvent.click(customizeBtn);

    expect(handleDraft).toHaveBeenCalledWith({
      objective: AGENT_ARCHETYPES[0]!.intent,
      budgetUsdc: AGENT_ARCHETYPES[0]!.suggestedBudget,
    });
  });

  it("generates proposal, then allows explicit confirmation to launch mission", async () => {
    const handleCreate = vi.fn().mockResolvedValue(undefined);

    render(
      <McpMissionBuilder
        disabled={false}
        pending={false}
        onDraft={vi.fn()}
        onCreate={handleCreate}
      />,
    );

    const generateBtn = screen.getByText("Generate Mission Proposal with AI");
    fireEvent.click(generateBtn);

    await waitFor(
      () => {
        expect(
          screen.getByText("Approve & Launch Mission"),
        ).toBeDefined();
      },
      { timeout: 3000 },
    );

    const launchBtn = screen.getByText("Approve & Launch Mission");
    fireEvent.click(launchBtn);

    expect(handleCreate).toHaveBeenCalledWith({
      objective: AGENT_ARCHETYPES[0]!.intent,
      budgetUsdc: AGENT_ARCHETYPES[0]!.suggestedBudget,
    });
  });

  it("displays live USDC balance, allows Use Max, and shows warning badge when exceeding balance", async () => {
    vi.spyOn(Web3ContextModule, "useWeb3Wallet").mockReturnValue({
      address: "0x71C254890A805096aA3F33698bA7EcD73eB33a9F",
      chainId: "0x14a34",
      isConnected: true,
      isConnecting: false,
      isBaseSepolia: true,
      ethBalance: "0.2500",
      usdcBalance: "10.00",
      isFetchingBalances: false,
      error: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
      switchToBaseSepolia: vi.fn(),
      refreshBalances: vi.fn(),
    });

    render(
      <McpMissionBuilder
        disabled={false}
        pending={false}
        onDraft={vi.fn()}
        onCreate={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    // Shows live wallet balance next to archetype ceiling
    expect(screen.getByText("Wallet: 10.00 USDC")).toBeDefined();

    // Generate proposal (Alpha DEX suggested budget is 15.00 USDC > wallet balance 10.00 USDC)
    const generateBtn = screen.getByText("Generate Mission Proposal with AI");
    fireEvent.click(generateBtn);

    await waitFor(
      () => {
        expect(screen.getByText("AI Agent Mission Proposal (Ready for Review)")).toBeDefined();
      },
      { timeout: 3000 },
    );

    // Warning badge is displayed because 15.00 > 10.00
    const warning = screen.getByTestId("mcp-budget-exceeds-warning");
    expect(warning).toBeDefined();
    expect(warning.textContent).toContain("Ceiling (15.00 USDC) exceeds wallet balance (10.00 USDC)");
    expect(screen.getByTestId("mcp-faucet-warning-link")).toHaveAttribute(
      "href",
      "https://portal.cdp.coinbase.com/products/faucet",
    );

    // Click "Use Max" to cap at wallet balance 10.00
    const useMaxBtn = screen.getByTestId("mcp-use-max-btn");
    fireEvent.click(useMaxBtn);

    // Warning should disappear once budget is 10.00 (not exceeding)
    expect(screen.queryByTestId("mcp-budget-exceeds-warning")).toBeNull();
  });
});

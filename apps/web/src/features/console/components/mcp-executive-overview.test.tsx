import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { expectNoAxeViolations } from "@/test/axe";
import { McpExecutiveOverview } from "./mcp-executive-overview";

describe("McpExecutiveOverview", () => {
  it("renders top executive pitch TL;DR banner understood in 5 seconds", () => {
    render(<McpExecutiveOverview />);
    expect(
      screen.getByText(
        /Aura stops AI Agents from blindly spending money. It uses Sibyl Memory to remember supplier track records, flips decisions away from bad actors, anchors cryptographic proof on Base, and settles via Virtuals Protocol ACP./i,
      ),
    ).toBeInTheDocument();
  });

  it("renders the 3-pill hackathon scorecard", () => {
    render(<McpExecutiveOverview />);
    expect(screen.getByText(/Pass\/Fail Gate \(40 pts\)/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Sibyl Memory is Load-Bearing \(Zero Blind Spend\)/i),
    ).toBeInTheDocument();

    expect(screen.getByText(/Verified Stack \(x1\.15\)/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Base Sepolia On-chain Keccak256 Audit Anchor/i),
    ).toBeInTheDocument();

    expect(screen.getByText(/Verified Stack \(x1\.25 Cap\)/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Virtuals Protocol ACP Escrow Settlement/i),
    ).toBeInTheDocument();
  });

  it("renders the 1-second visual decision flip comparison", () => {
    render(<McpExecutiveOverview />);
    expect(
      screen.getByText(/The 1-Second Proof: Why Sibyl Memory is Load-Bearing/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Without Sibyl Memory \(Amnesia\)/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Suffers SLA failure \(41h late delivery, wasted treasury\)/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/With Sibyl Memory \(Load-Bearing\)/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Recalls Alpha's prior penalty/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/\$22\.00 quote, 100% on-time record/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Mission Succeeds! Verified deliverable accepted/i),
    ).toBeInTheDocument();
  });

  it("renders executive title and description", () => {
    render(<McpExecutiveOverview />);
    expect(
      screen.getByRole("heading", { name: /Autonomous MCP Agent & Sibyl Memory Protocol/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Live demonstration of an autonomous AI agent/i)).toBeInTheDocument();
  });

  it("renders all 4 Sibyl Memory impact metrics (the counterfactual proof)", () => {
    render(
      <McpExecutiveOverview
        budgetUsdc="25.00"
        spentUsdc="18.50"
      />,
    );

    // Treasury safeguard
    expect(screen.getByText("Treasury Safeguard")).toBeInTheDocument();
    expect(screen.getByText("18.50 USDC")).toBeInTheDocument();
    expect(screen.getByText(/✓ 6.50 USDC Treasury Saved/i)).toBeInTheDocument();

    // Rogue agent blocked
    expect(screen.getByText("Rogue Counterparty Blocked")).toBeInTheDocument();
    expect(screen.getByText("virtuals:agent:alpha")).toBeInTheDocument();
    expect(screen.getByText(/Score: 28 \/ 100 · BLOCKED/i)).toBeInTheDocument();

    // Trusted partner selected
    expect(screen.getByText("Trusted Partner Selected")).toBeInTheDocument();
    expect(screen.getByText("virtuals:agent:beta")).toBeInTheDocument();
    expect(screen.getByText(/Score: 94 \/ 100 · SELECTED/i)).toBeInTheDocument();

    // Memory evolution
    expect(screen.getByText("Memory Evolution (L2)")).toBeInTheDocument();
    expect(screen.getByText("Sibyl v12 → v13")).toBeInTheDocument();
    expect(screen.getByText(/\+5 Pts · Keccak256 Salted/i)).toBeInTheDocument();
  });

  it("renders all 4 canonical MCP tool calls in sequence", () => {
    render(<McpExecutiveOverview />);

    expect(screen.getByText("memory_recall_counterparty")).toBeInTheDocument();
    expect(screen.getByText("policy_gate")).toBeInTheDocument();
    expect(screen.getByText("base_escrow")).toBeInTheDocument();
    expect(screen.getByText("memory_journal")).toBeInTheDocument();
  });

  it("toggles tool code preview on click", async () => {
    const user = userEvent.setup();
    const onJumpToTool = vi.fn();
    render(<McpExecutiveOverview onJumpToTool={onJumpToTool} />);

    const toolCard = screen.getByRole("button", { name: /Tool step 1: memory_recall_counterparty/i });
    await user.click(toolCard);

    expect(onJumpToTool).toHaveBeenCalledWith("memory_recall_counterparty");
    expect(screen.getByText(/min_reputation: 70/i)).toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<McpExecutiveOverview />);
    await expectNoAxeViolations(container);
  });
});

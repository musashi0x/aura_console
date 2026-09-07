import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { expectNoAxeViolations } from "@/test/axe";
import { MissionInspector } from "./mission-inspector";

describe("MissionInspector", () => {
  const defaultProps = {
    runId: "run_test_01",
    environment: "base-sepolia-sandbox",
    budgetUsdc: "50.000000",
    spentUsdc: "12.345678",
  };

  it("renders key technical parameters with Astryx MetadataList", () => {
    render(<MissionInspector {...defaultProps} />);

    expect(screen.getByText("Mission Technical Parameters")).toBeInTheDocument();
    expect(screen.getByText("Mission UUID")).toBeInTheDocument();
    expect(screen.getByText("Sandbox Environment")).toBeInTheDocument();
    expect(screen.getByText("Budget Ceiling")).toBeInTheDocument();
    expect(screen.getByText("Budget Spent")).toBeInTheDocument();
  });

  it("displays Mission UUID in a monospace <code> element", () => {
    render(<MissionInspector {...defaultProps} />);

    const code = screen.getByTestId("meta-run-id");
    expect(code).toHaveTextContent("run_test_01");
    expect(code.tagName.toLowerCase()).toBe("code");
  });

  it("displays Base Sepolia transaction hash linking to BaseScan block explorer", () => {
    const tx = "0x8f3c7a6e129b014d3c9071fe25a6b8c9d01234567890abcdef1234567890abcd";
    render(<MissionInspector {...defaultProps} txHash={tx} />);

    const link = screen.getByTestId("meta-tx-link");
    expect(link).toHaveAttribute("href", `https://sepolia.basescan.org/tx/${tx}`);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(link).toHaveTextContent("0x8f3c7a6e...7890abcd ↗");
  });

  it("displays fallback when no transaction hashes exist", () => {
    render(<MissionInspector {...defaultProps} />);

    expect(screen.getByTestId("meta-no-tx")).toHaveTextContent("None");
  });

  it("formats budget ceiling and spend in USDC", () => {
    render(<MissionInspector {...defaultProps} />);

    expect(screen.getByTestId("meta-budget")).toHaveTextContent("50.000000 USDC");
    expect(screen.getByTestId("meta-spent")).toHaveTextContent("12.345678 USDC");
  });

  it("preserves honest fact invariant: renders 'Not yet reported' when spend is missing", () => {
    render(<MissionInspector {...defaultProps} spentUsdc={undefined} />);

    expect(screen.getByText("Not yet reported")).toBeInTheDocument();
    expect(screen.queryByText("0.00")).not.toBeInTheDocument();
    expect(screen.getByTestId("meta-spent")).toHaveTextContent("Not yet reported");
  });

  it("renders causal memory status when provided", () => {
    render(<MissionInspector {...defaultProps} memoryStatus="Memory was not queried for this mission" />);

    expect(screen.getByText("Memory")).toBeInTheDocument();
    expect(screen.getByTestId("meta-memory")).toHaveTextContent("Memory was not queried for this mission");
  });

  it("supports collapsible disclosure toggle button", async () => {
    const user = userEvent.setup();
    render(<MissionInspector {...defaultProps} isCollapsible={true} />);

    const toggle = screen.getByRole("button", { name: /show inspector/i });
    expect(toggle).toBeInTheDocument();
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByTestId("mission-inspector-panel")).not.toBeInTheDocument();

    await user.click(toggle);
    expect(screen.getByRole("button", { name: /hide inspector/i })).toBeInTheDocument();
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByTestId("mission-inspector-panel")).toBeInTheDocument();

    await user.click(toggle);
    expect(screen.queryByTestId("mission-inspector-panel")).not.toBeInTheDocument();
  });

  it("has no axe violations when open", async () => {
    const { container } = render(
      <MissionInspector
        {...defaultProps}
        txHash="0x8f3c7a6e129b014d3c9071fe25a6b8c9d01234567890abcdef1234567890abcd"
        memoryStatus="History available"
      />,
    );
    await expectNoAxeViolations(container);
  });

  it("has no axe violations when collapsible and closed", async () => {
    const { container } = render(
      <MissionInspector {...defaultProps} isCollapsible={true} />,
    );
    await expectNoAxeViolations(container);
  });
});

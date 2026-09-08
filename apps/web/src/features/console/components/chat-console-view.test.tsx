import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { expectNoAxeViolations } from "@/test/axe";
import type { ChatConsoleRun } from "./chat-console-view";
import { ChatConsoleView } from "./chat-console-view";

function createMockRun(overrides: Partial<ChatConsoleRun> = {}): ChatConsoleRun {
  const id = overrides.id ?? `run-${Math.random().toString(36).slice(2, 9)}`;
  return {
    id,
    objective: `Mission objective for ${id}`,
    source: "CONSOLE",
    environment: "base-sepolia-demo",
    isMainnet: false,
    budgetUsdc: "10.000000",
    createdAt: "2026-09-07T08:00:00.000Z",
    updatedAt: "2026-09-07T08:30:00.000Z",
    status: "RUNNING",
    ...overrides,
  };
}

const activeRun = createMockRun({
  id: "run-active-1",
  objective: "Active arbitrage on Base Sepolia",
  status: "RUNNING",
  budgetUsdc: "50.000000",
});

const completedRun = createMockRun({
  id: "run-completed-2",
  objective: "Completed dataset purchase",
  status: "COMPLETED",
  budgetUsdc: "25.000000",
});

const failedRun = createMockRun({
  id: "run-failed-3",
  objective: "Failed liquidity pool probe",
  status: "FAILED",
  budgetUsdc: "5.000000",
});

const variedRuns: readonly ChatConsoleRun[] = [
  activeRun,
  completedRun,
  failedRun,
];

describe("ChatConsoleView", () => {
  describe("Status Indicators (<StatusDot>)", () => {
    it("renders active runs with an active pulsing status dot", () => {
      render(<ChatConsoleView runs={[activeRun]} />);

      const list = screen.getByRole("list");
      expect(within(list).getByRole("img", { name: /active/i })).toBeInTheDocument();
    });

    it("renders completed runs with a completed status dot", () => {
      render(<ChatConsoleView runs={[completedRun]} />);

      const list = screen.getByRole("list");
      expect(within(list).getByRole("img", { name: /completed/i })).toBeInTheDocument();
    });

    it("renders failed runs with a failed status dot", () => {
      render(<ChatConsoleView runs={[failedRun]} />);

      const list = screen.getByRole("list");
      expect(within(list).getByRole("img", { name: /failed/i })).toBeInTheDocument();
    });

    it("renders blocked runs with active category warning indicator", () => {
      const blockedRun = createMockRun({
        id: "run-blocked",
        objective: "Policy blocked mission",
        status: "BLOCKED",
      });
      render(<ChatConsoleView runs={[blockedRun]} />);

      const list = screen.getByRole("list");
      expect(within(list).getByRole("img", { name: /active/i })).toBeInTheDocument();
    });

    it("renders unobserved status with settled indicator", () => {
      const defaultRun = createMockRun({
        id: "run-default",
        objective: "Unobserved run",
        status: undefined,
      });
      render(<ChatConsoleView runs={[defaultRun]} />);

      const list = screen.getByRole("list");
      expect(within(list).getByRole("img", { name: /settled/i })).toBeInTheDocument();
    });

    it("renders distinct status dots for all items in a mixed list", () => {
      render(<ChatConsoleView runs={variedRuns} />);

      const list = screen.getByRole("list");
      expect(within(list).getByRole("img", { name: /active/i })).toBeInTheDocument();
      expect(within(list).getByRole("img", { name: /completed/i })).toBeInTheDocument();
      expect(within(list).getByRole("img", { name: /failed/i })).toBeInTheDocument();
    });

    it("renders status dot in the active run header", () => {
      render(<ChatConsoleView runs={[activeRun]} initialRunId="run-active-1" />);

      const mainArea = screen.getByRole("region", { name: /conversation area/i });
      expect(within(mainArea).getByRole("img", { name: /active/i })).toBeInTheDocument();
      expect(
        within(mainArea).getByRole("heading", {
          level: 1,
          name: "Active arbitrage on Base Sepolia",
        }),
      ).toBeInTheDocument();
    });
  });

  describe("Mission Filter (<SegmentedControl>)", () => {
    it("renders a radiogroup with All, Active, and Settled options", () => {
      render(<ChatConsoleView runs={variedRuns} />);

      const control = screen.getByRole("radiogroup", { name: /filter missions/i });
      expect(control).toBeInTheDocument();

      expect(within(control).getByRole("radio", { name: "All" })).toBeInTheDocument();
      expect(within(control).getByRole("radio", { name: "Active" })).toBeInTheDocument();
      expect(within(control).getByRole("radio", { name: "Settled" })).toBeInTheDocument();
    });

    it("defaults to the 'All' segment selected", () => {
      render(<ChatConsoleView runs={variedRuns} />);

      expect(screen.getByRole("radio", { name: "All" })).toHaveAttribute("aria-checked", "true");
      expect(screen.getByRole("radio", { name: "Active" })).toHaveAttribute("aria-checked", "false");
      expect(screen.getByRole("radio", { name: "Settled" })).toHaveAttribute("aria-checked", "false");
    });
  });

  describe("Filtering Logic", () => {
    it("displays all missions when 'All' is selected", () => {
      render(<ChatConsoleView runs={variedRuns} />);

      const list = screen.getByRole("list");
      expect(within(list).getByText("Active arbitrage on Base Sepolia")).toBeInTheDocument();
      expect(within(list).getByText("Completed dataset purchase")).toBeInTheDocument();
      expect(within(list).getByText("Failed liquidity pool probe")).toBeInTheDocument();
      expect(screen.getByText("RECENT MISSIONS (3)")).toBeInTheDocument();
    });

    it("displays only active missions when 'Active' segment is selected", async () => {
      const user = userEvent.setup();
      render(<ChatConsoleView runs={variedRuns} />);

      await user.click(screen.getByRole("radio", { name: "Active" }));

      expect(screen.getByRole("radio", { name: "Active" })).toHaveAttribute("aria-checked", "true");
      const list = screen.getByRole("list");
      expect(within(list).getByText("Active arbitrage on Base Sepolia")).toBeInTheDocument();
      expect(within(list).queryByText("Completed dataset purchase")).not.toBeInTheDocument();
      expect(within(list).queryByText("Failed liquidity pool probe")).not.toBeInTheDocument();
      expect(screen.getByText("RECENT MISSIONS (1)")).toBeInTheDocument();
    });

    it("displays completed and failed missions when 'Settled' segment is selected", async () => {
      const user = userEvent.setup();
      render(<ChatConsoleView runs={variedRuns} />);

      await user.click(screen.getByRole("radio", { name: "Settled" }));

      expect(screen.getByRole("radio", { name: "Settled" })).toHaveAttribute("aria-checked", "true");
      const list = screen.getByRole("list");
      expect(within(list).queryByText("Active arbitrage on Base Sepolia")).not.toBeInTheDocument();
      expect(within(list).getByText("Completed dataset purchase")).toBeInTheDocument();
      expect(within(list).getByText("Failed liquidity pool probe")).toBeInTheDocument();
      expect(screen.getByText("RECENT MISSIONS (2)")).toBeInTheDocument();
    });

    it("restores all missions when switching back to 'All'", async () => {
      const user = userEvent.setup();
      render(<ChatConsoleView runs={variedRuns} />);

      await user.click(screen.getByRole("radio", { name: "Active" }));
      const listAfterActive = screen.getByRole("list");
      expect(within(listAfterActive).queryByText("Completed dataset purchase")).not.toBeInTheDocument();

      await user.click(screen.getByRole("radio", { name: "All" }));
      const listAfterAll = screen.getByRole("list");
      expect(within(listAfterAll).getByText("Active arbitrage on Base Sepolia")).toBeInTheDocument();
      expect(within(listAfterAll).getByText("Completed dataset purchase")).toBeInTheDocument();
      expect(within(listAfterAll).getByText("Failed liquidity pool probe")).toBeInTheDocument();
      expect(screen.getByText("RECENT MISSIONS (3)")).toBeInTheDocument();
    });

    it("displays empty state when filter yields zero matches", async () => {
      const user = userEvent.setup();
      render(<ChatConsoleView runs={[completedRun]} />);

      await user.click(screen.getByRole("radio", { name: "Active" }));

      expect(screen.getByText("No active missions found.")).toBeInTheDocument();
    });
  });

  describe("Run Selection and onSelectRun", () => {
    it("calls onSelectRun with runId when a mission item is clicked", async () => {
      const user = userEvent.setup();
      const onSelectRun = vi.fn();
      render(<ChatConsoleView runs={variedRuns} onSelectRun={onSelectRun} />);

      const list = screen.getByRole("list");
      const completedButton = within(list).getByRole("button", {
        name: /Completed dataset purchase/i,
      });
      await user.click(completedButton);

      expect(onSelectRun).toHaveBeenCalledWith("run-completed-2");
      expect(
        screen.getByRole("heading", {
          level: 1,
          name: "Completed dataset purchase",
        }),
      ).toBeInTheDocument();
    });

    it("calls onSelectRun with null when Global Assistant is clicked", async () => {
      const user = userEvent.setup();
      const onSelectRun = vi.fn();
      render(
        <ChatConsoleView
          runs={variedRuns}
          onSelectRun={onSelectRun}
          initialRunId="run-active-1"
        />,
      );

      const globalButton = screen.getByRole("button", { name: /Global Assistant/i });
      await user.click(globalButton);

      expect(onSelectRun).toHaveBeenCalledWith(null);
      expect(
        screen.getByRole("heading", { level: 1, name: "Global Chat Console" }),
      ).toBeInTheDocument();
    });

    it("respects initialRunId prop", () => {
      render(<ChatConsoleView runs={variedRuns} initialRunId="run-completed-2" />);

      expect(
        screen.getByRole("heading", {
          level: 1,
          name: "Completed dataset purchase",
        }),
      ).toBeInTheDocument();
    });

    it("retains selectedRunId context selection across filters", async () => {
      const user = userEvent.setup();
      render(<ChatConsoleView runs={variedRuns} initialRunId="run-active-1" />);

      expect(
        screen.getByRole("heading", {
          level: 1,
          name: "Active arbitrage on Base Sepolia",
        }),
      ).toBeInTheDocument();

      // Switch to Settled (active run is now filtered out of sidebar list)
      await user.click(screen.getByRole("radio", { name: "Settled" }));

      // Conversation header should remain grounded in the active run
      expect(
        screen.getByRole("heading", {
          level: 1,
          name: "Active arbitrage on Base Sepolia",
        }),
      ).toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    it("has no axe violations with populated runs in default state", async () => {
      const { container } = render(<ChatConsoleView runs={variedRuns} />);
      await expectNoAxeViolations(container);
    });

    it("has no axe violations when filtered to Active", async () => {
      const user = userEvent.setup();
      const { container } = render(<ChatConsoleView runs={variedRuns} />);
      await user.click(screen.getByRole("radio", { name: "Active" }));
      await expectNoAxeViolations(container);
    });

    it("has no axe violations when filtered to Settled", async () => {
      const user = userEvent.setup();
      const { container } = render(<ChatConsoleView runs={variedRuns} />);
      await user.click(screen.getByRole("radio", { name: "Settled" }));
      await expectNoAxeViolations(container);
    });

    it("has no axe violations with empty runs list", async () => {
      const { container } = render(<ChatConsoleView runs={[]} />);
      await expectNoAxeViolations(container);
    });
  });
});

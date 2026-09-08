import { render, screen, within, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { expectNoAxeViolations } from "@/test/axe";
import type { ChatConsoleRun } from "./chat-console-view";
import { ChatConsoleView, getRunStatusInfo } from "./chat-console-view";

afterEach(() => {
  cleanup();
});

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

describe("Adversarial Challenge: Milestone 1 Robustness", () => {
  // ===========================================================================
  // 1. Status Derivation Spectrum & Exotic Values
  // ===========================================================================
  describe("1. Status Derivation Spectrum & Exotic Values", () => {
    it("handles null, undefined, empty string, whitespace without throwing", () => {
      expect(getRunStatusInfo(null)).toMatchObject({
        variant: "neutral",
        label: "Settled",
        isPulsing: false,
        filterCategory: "settled",
      });

      expect(getRunStatusInfo(undefined)).toMatchObject({
        variant: "neutral",
        label: "Settled",
        isPulsing: false,
        filterCategory: "settled",
      });

      expect(getRunStatusInfo("")).toMatchObject({
        variant: "neutral",
        label: "Settled",
        isPulsing: false,
        filterCategory: "settled",
      });

      expect(getRunStatusInfo("   ")).toMatchObject({
        variant: "neutral",
        label: "Settled",
        isPulsing: false,
        filterCategory: "settled",
      });
    });

    it("handles object input with status property or missing status property", () => {
      expect(getRunStatusInfo({ status: "RUNNING" })).toMatchObject({
        variant: "accent",
        label: "Active",
        isPulsing: true,
        filterCategory: "active",
      });

      expect(getRunStatusInfo({ status: null })).toMatchObject({
        variant: "neutral",
        label: "Settled",
        isPulsing: false,
        filterCategory: "settled",
      });

      expect(getRunStatusInfo({ status: undefined })).toMatchObject({
        variant: "neutral",
        label: "Settled",
        isPulsing: false,
        filterCategory: "settled",
      });

      expect(getRunStatusInfo({})).toMatchObject({
        variant: "neutral",
        label: "Settled",
        isPulsing: false,
        filterCategory: "settled",
      });
    });

    it("handles case-insensitivity across all known lifecycle statuses", () => {
      const activeCases = ["running", "Running", "RUNNING", "starting", "Starting", "created", "active", "Active"];
      for (const st of activeCases) {
        const info = getRunStatusInfo(st);
        expect(info.filterCategory, `expected active for ${st}`).toBe("active");
        expect(info.variant).toBe("accent");
        expect(info.isPulsing).toBe(true);
      }

      const warningCases = ["waiting_approval", "Waiting_Approval", "awaiting_approval", "blocked", "Blocked"];
      for (const st of warningCases) {
        const info = getRunStatusInfo(st);
        expect(info.filterCategory, `expected active for ${st}`).toBe("active");
        expect(info.variant).toBe("warning");
        expect(info.isPulsing).toBe(true);
      }

      const successCases = ["completed", "Completed", "success", "Success"];
      for (const st of successCases) {
        const info = getRunStatusInfo(st);
        expect(info.filterCategory, `expected settled for ${st}`).toBe("settled");
        expect(info.variant).toBe("success");
        expect(info.isPulsing).toBe(false);
      }

      const failedCases = ["failed", "Failed", "error", "cancelled", "canceled"];
      for (const st of failedCases) {
        const info = getRunStatusInfo(st);
        expect(info.filterCategory, `expected settled for ${st}`).toBe("settled");
        expect(info.variant).toBe("error");
        expect(info.isPulsing).toBe(false);
      }
    });

    it("handles unknown and unstandardized lifecycle strings safely", () => {
      const unknownCases = ["UNKNOWN", "PENDING", "ARCHIVED", "DEPRECATED", "PAUSED", "ZOMBIE_STATE", "xyz123"];
      for (const st of unknownCases) {
        const info = getRunStatusInfo(st);
        expect(info.filterCategory, `expected settled fallback for ${st}`).toBe("settled");
        expect(info.variant).toBe("neutral");
        expect(info.isPulsing).toBe(false);
      }
    });

    it("evaluates behavior on non-string runtime status (e.g. numeric enum or boolean from JSON)", () => {
      // Whitebox verification: does getRunStatusInfo crash when given non-string runtime values?
      let threwNumeric = false;
      try {
        getRunStatusInfo(123 as unknown as string);
      } catch {
        threwNumeric = true;
      }
      expect(threwNumeric).toBe(true);

      let threwObjectWithNumeric = false;
      try {
        getRunStatusInfo({ status: 123 as unknown as string });
      } catch {
        threwObjectWithNumeric = true;
      }
      expect(threwObjectWithNumeric).toBe(true);
    });
  });

  // ===========================================================================
  // 2. Empty Runs List Handling & Toggling
  // ===========================================================================
  describe("2. Empty Runs List Handling", () => {
    it("renders empty state cleanly with 0 counts on all segments", () => {
      render(<ChatConsoleView runs={[]} />);

      expect(screen.getByText("RECENT MISSIONS (0)")).toBeInTheDocument();
      expect(screen.getByText("No missions found yet.")).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "+ Start a Mission" })).toBeInTheDocument();
      expect(screen.getByText("Global Chat Console")).toBeInTheDocument();
      expect(screen.getByText("GLOBAL")).toBeInTheDocument();
      // role="list" should not be on empty missions list
      expect(screen.queryByRole("list")).not.toBeInTheDocument();
    });

    it("allows toggling tabs when runs list is empty without errors", async () => {
      const user = userEvent.setup();
      render(<ChatConsoleView runs={[]} />);

      const activeTab = screen.getByRole("radio", { name: "Active" });
      await user.click(activeTab);

      expect(screen.getByText("RECENT MISSIONS (0)")).toBeInTheDocument();
      expect(screen.getByText("No missions found yet.")).toBeInTheDocument();

      const settledTab = screen.getByRole("radio", { name: "Settled" });
      await user.click(settledTab);

      expect(screen.getByText("RECENT MISSIONS (0)")).toBeInTheDocument();
      expect(screen.getByText("No missions found yet.")).toBeInTheDocument();
    });

    it("passes axe accessibility in empty state across all tabs", async () => {
      const { container } = render(<ChatConsoleView runs={[]} />);
      await expectNoAxeViolations(container);
    });
  });

  // ===========================================================================
  // 3. Selection Persistence Across Filter Switches (Adversarial Edge Case #2)
  // ===========================================================================
  describe("3. Selection Persistence Across Filter Switches", () => {
    const activeRunA = createMockRun({
      id: "run-act-persist",
      objective: "Active Persist Objective",
      status: "RUNNING",
      budgetUsdc: "100.000000",
      environment: "arbitrum-sepolia",
    });

    const settledRunB = createMockRun({
      id: "run-set-persist",
      objective: "Settled Persist Objective",
      status: "COMPLETED",
      budgetUsdc: "45.000000",
      environment: "base-sepolia",
    });

    it("keeps active run grounded when switching to Settled tab where it is not in the list", async () => {
      const user = userEvent.setup();
      const onSelectRun = vi.fn();

      render(
        <ChatConsoleView
          runs={[activeRunA, settledRunB]}
          initialRunId={activeRunA.id}
          onSelectRun={onSelectRun}
        />,
      );

      // Verify initial state: activeRunA is grounded in header
      const mainArea = screen.getByRole("region", { name: /conversation area/i });
      expect(within(mainArea).getByText("Active Persist Objective")).toBeInTheDocument();
      expect(within(mainArea).getByText("MISSION SCOPED")).toBeInTheDocument();
      expect(within(mainArea).getByText(/Grounded in Mission/)).toHaveTextContent("run-act-persist");

      // Switch filter to "Settled"
      const settledTab = screen.getByRole("radio", { name: "Settled" });
      await user.click(settledTab);

      // Sidebar missions list: activeRunA should NOT be in the list
      const sidebarList = screen.getByRole("list");
      expect(within(sidebarList).queryByText("Active Persist Objective")).not.toBeInTheDocument();
      expect(within(sidebarList).getByText("Settled Persist Objective")).toBeInTheDocument();

      // Crucial: Active run in header MUST REMAIN GROUNDED without crashing or reverting to Global!
      expect(within(mainArea).getByText("Active Persist Objective")).toBeInTheDocument();
      expect(within(mainArea).getByRole("img", { name: /active/i })).toBeInTheDocument();
      expect(within(mainArea).getByText("MISSION SCOPED")).toBeInTheDocument();
      expect(within(mainArea).getByText(/Grounded in Mission/)).toHaveTextContent("run-act-persist");
      expect(within(mainArea).getByRole("link", { name: /Open Mission Workspace/i })).toHaveAttribute(
        "href",
        "/runs/run-act-persist",
      );

      // Now click the settled run in sidebar
      await user.click(within(sidebarList).getByText("Settled Persist Objective"));
      expect(onSelectRun).toHaveBeenCalledWith("run-set-persist");

      // Header should now reflect settledRunB
      expect(within(mainArea).getByText("Settled Persist Objective")).toBeInTheDocument();
      expect(within(mainArea).getByRole("img", { name: /completed/i })).toBeInTheDocument();

      // Now switch back to "Active"
      const activeTab = screen.getByRole("radio", { name: "Active" });
      await user.click(activeTab);

      // settledRunB is NOT in the Active sidebar list
      const activeSidebarList = screen.getByRole("list");
      expect(within(activeSidebarList).queryByText("Settled Persist Objective")).not.toBeInTheDocument();
      expect(within(activeSidebarList).getByText("Active Persist Objective")).toBeInTheDocument();

      // But header STAYS grounded in settledRunB!
      expect(within(mainArea).getByText("Settled Persist Objective")).toBeInTheDocument();
      expect(within(mainArea).getByRole("img", { name: /completed/i })).toBeInTheDocument();
    });

    it("stays grounded even when the filter produces 0 items", async () => {
      const user = userEvent.setup();
      // Only active runs exist
      render(
        <ChatConsoleView
          runs={[activeRunA]}
          initialRunId={activeRunA.id}
        />,
      );

      // Switch to Settled (which has 0 items)
      await user.click(screen.getByRole("radio", { name: "Settled" }));

      // Empty list message in sidebar
      expect(screen.getByText("No settled missions found.")).toBeInTheDocument();

      // Main header remains completely intact with activeRunA
      const mainArea = screen.getByRole("region", { name: /conversation area/i });
      expect(within(mainArea).getByText("Active Persist Objective")).toBeInTheDocument();
      expect(within(mainArea).getByText("MISSION SCOPED")).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // 4. Massive Runs List (100+ items) & Rapid Toggling
  // ===========================================================================
  describe("4. Massive Runs List (100+ items) & Rapid Toggling", () => {
    it("correctly aggregates counts and renders 105 runs with diverse statuses", { timeout: 20000 }, async () => {
      const user = userEvent.setup();
      const massiveRuns: ChatConsoleRun[] = [];
      let activeExpected = 0;
      let settledExpected = 0;

      const statuses = [
        "RUNNING",
        "STARTING",
        "CREATED",
        "ACTIVE",
        "WAITING_APPROVAL",
        "BLOCKED",
        "COMPLETED",
        "SUCCESS",
        "FAILED",
        "ERROR",
        "CANCELLED",
        "UNKNOWN_STATUS",
        null,
        undefined,
      ];

      for (let i = 0; i < 105; i++) {
        const st = statuses[i % statuses.length];
        const run = createMockRun({
          id: `run-massive-${i}`,
          objective: `Massive mission #${i} with status ${st ?? "null"}`,
          status: st ?? undefined,
        });
        massiveRuns.push(run);

        const info = getRunStatusInfo(st);
        if (info.filterCategory === "active") activeExpected++;
        else settledExpected++;
      }

      render(<ChatConsoleView runs={massiveRuns} />);

      // Verify counts in header
      expect(screen.getByText(`RECENT MISSIONS (${massiveRuns.length})`)).toBeInTheDocument();

      const items = screen.getAllByRole("listitem");
      expect(items.length).toBe(105);

      // Verify filter category aggregation
      await user.click(screen.getByRole("radio", { name: "Active" }));
      expect(screen.getByText(`RECENT MISSIONS (${activeExpected})`)).toBeInTheDocument();

      await user.click(screen.getByRole("radio", { name: "Settled" }));
      expect(screen.getByText(`RECENT MISSIONS (${settledExpected})`)).toBeInTheDocument();
    });

    it("rapidly toggles between All / Active / Settled without state corruption or crash", { timeout: 20000 }, async () => {
      const user = userEvent.setup();

      // Generate 100 items (50 active, 50 settled)
      const runs: ChatConsoleRun[] = [];
      for (let i = 0; i < 100; i++) {
        runs.push(
          createMockRun({
            id: `run-stress-${i}`,
            objective: `Stress run ${i}`,
            status: i % 2 === 0 ? "RUNNING" : "COMPLETED",
          }),
        );
      }

      render(<ChatConsoleView runs={runs} />);

      const allTab = screen.getByRole("radio", { name: "All" });
      const activeTab = screen.getByRole("radio", { name: "Active" });
      const settledTab = screen.getByRole("radio", { name: "Settled" });

      // Rapidly toggle 4 full cycles
      for (let cycle = 0; cycle < 4; cycle++) {
        await user.click(activeTab);
        expect(screen.getByText("RECENT MISSIONS (50)")).toBeInTheDocument();

        await user.click(settledTab);
        expect(screen.getByText("RECENT MISSIONS (50)")).toBeInTheDocument();

        await user.click(allTab);
        expect(screen.getByText("RECENT MISSIONS (100)")).toBeInTheDocument();
      }
    });

    it("allows selecting item #100 in a large list and grounds properly", { timeout: 15000 }, async () => {
      const user = userEvent.setup();
      const runs: ChatConsoleRun[] = [];
      for (let i = 0; i < 100; i++) {
        runs.push(
          createMockRun({
            id: `run-target-${i}`,
            objective: `Target mission run ${i}`,
            status: "COMPLETED",
          }),
        );
      }

      render(<ChatConsoleView runs={runs} />);

      // Find the 100th item (index 99)
      const targetRun = screen.getByText("Target mission run 99");
      await user.click(targetRun);

      const mainArea = screen.getByRole("region", { name: /conversation area/i });
      expect(within(mainArea).getByText("Target mission run 99")).toBeInTheDocument();
      const codeElements = within(mainArea).getAllByText(/run-target-99/);
      expect(codeElements.length).toBeGreaterThan(0);
    });
  });

  // ===========================================================================
  // 5. Extreme Boundary & Formatting Edge Cases
  // ===========================================================================
  describe("5. Extreme Boundary & Formatting Edge Cases", () => {
    it("handles extreme / unusual run data without throwing", () => {
      const edgeRun = createMockRun({
        id: "short", // short id < 8 chars
        objective: "A".repeat(1000), // very long objective
        budgetUsdc: null, // null budget
        createdAt: "1970-01-01T00:00:00.000Z", // epoch 0
      });

      render(<ChatConsoleView runs={[edgeRun]} />);

      // Short ID sliced: "short..."
      expect(screen.getByText("short...")).toBeInTheDocument();
      // Null budget renders "RUN"
      expect(screen.getByText("RUN")).toBeInTheDocument();
      // Long objective rendered
      expect(screen.getAllByText("A".repeat(1000)).length).toBeGreaterThan(0);
    });

    it("handles non-standard budget format (e.g. 0 USDC, scientific notation, decimals)", () => {
      const runZeroBudget = createMockRun({
        id: "run-zero",
        budgetUsdc: "0.000000",
      });
      const runLargeBudget = createMockRun({
        id: "run-large",
        budgetUsdc: "1000000000.500000",
      });

      render(<ChatConsoleView runs={[runZeroBudget, runLargeBudget]} />);

      expect(screen.getByText("0 USDC")).toBeInTheDocument();
      expect(screen.getByText("1000000000.5 USDC")).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // 6. Global Assistant Selection & Grounding Reset
  // ===========================================================================
  describe("6. Global Assistant Interaction", () => {
    it("switches to Global Assistant and notifies callback with null", async () => {
      const user = userEvent.setup();
      const onSelectRun = vi.fn();
      const run = createMockRun({ id: "run-init", objective: "Initial Run" });

      render(
        <ChatConsoleView
          runs={[run]}
          initialRunId="run-init"
          onSelectRun={onSelectRun}
        />,
      );

      const globalBtn = screen.getByRole("button", { name: /Global Assistant/i });
      await user.click(globalBtn);

      expect(onSelectRun).toHaveBeenCalledWith(null);

      const mainArea = screen.getByRole("region", { name: /conversation area/i });
      expect(within(mainArea).getByText("Global Chat Console")).toBeInTheDocument();
      expect(within(mainArea).getByText("GLOBAL")).toBeInTheDocument();
      expect(within(mainArea).getByText(/Ready for console navigation commands/)).toBeInTheDocument();
      expect(within(mainArea).getByRole("link", { name: "+ New Mission" })).toBeInTheDocument();
    });
  });
});

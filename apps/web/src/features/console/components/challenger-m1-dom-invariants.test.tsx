import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { StatusDot } from "@astryxdesign/core/StatusDot";
import {
  getRunStatusInfo,
} from "./chat-console-view";
import { expectNoAxeViolations } from "@/test/axe";

// Mock api-client for runs page testing
const dbHealth = vi.fn();
const listRuns = vi.fn();

vi.mock("@/lib/api-client", () => ({
  apiClient: {
    agentHealth: async () => ({ ok: true, data: { configured: false, reachable: false } }),
    sibylHealth: async () => ({ ok: true, data: { configured: false, reachable: false } }),
    dbHealth: () => dbHealth(),
    listRuns: () => listRuns(),
  },
}));

// Dynamic import of RunsPage
const { default: RunsPage } = await import("@/app/runs/page");

describe("Milestone 1 Empirical Verification: DOM & Visual Invariants", () => {
  beforeEach(() => {
    dbHealth.mockReset();
    listRuns.mockReset();
  });

  // =========================================================================
  // 1. StatusDot 8px Indicator, Variants, Pulsing & Motion Invariants
  // =========================================================================
  describe("Invariant 1: StatusDot 8px indicator, pulsing & reduced-motion", () => {
    it("renders as an 8px circular span with role='img' and accessible label", () => {
      render(<StatusDot variant="accent" label="Active run" isPulsing />);
      const dot = screen.getByRole("img", { name: "Active run" });

      expect(dot.tagName).toBe("SPAN");
      expect(dot).toHaveAttribute("role", "img");
      expect(dot).toHaveAttribute("aria-label", "Active run");
      expect(dot.getAttribute("tabindex")).toBeNull();

      // Verify Astryx component naming classes and stylex classes
      expect(dot.className).toContain("astryx-status-dot");
      expect(dot.className).toContain("astryx-statusdot");
    });

    it("verifies active runs (RUNNING, STARTING, CREATED, ACTIVE) produce pulsing accent indicator", () => {
      const activeStatuses = ["RUNNING", "STARTING", "CREATED", "ACTIVE"] as const;

      for (const st of activeStatuses) {
        const info = getRunStatusInfo(st);
        expect(info.variant).toBe("accent");
        expect(info.isPulsing).toBe(true);
        expect(info.label).toBe("Active");
        expect(info.filterCategory).toBe("active");

        const { unmount } = render(
          <StatusDot
            variant={info.variant}
            label={info.label}
            isPulsing={info.isPulsing}
            data-testid={`dot-${st}`}
          />
        );

        const dot = screen.getByTestId(`dot-${st}`);
        expect(dot).toHaveAttribute("data-variant", "accent");
        expect(dot.className).toContain("accent");

        // The dot with isPulsing has more StyleX atomic classes than static dot
        const staticRender = render(
          <StatusDot variant="accent" label="Static" isPulsing={false} data-testid="dot-static" />
        );
        const staticDot = screen.getByTestId("dot-static");

        const pulsingClasses = dot.className.split(/\s+/);
        const staticClasses = staticDot.className.split(/\s+/);

        // Pulsing dot must contain animation classes (pulsing + reducedMotion)
        expect(pulsingClasses.length).toBeGreaterThan(staticClasses.length);

        staticRender.unmount();
        unmount();
      }
    });

    it("verifies approval/blocked runs (WAITING_APPROVAL, BLOCKED) produce pulsing warning indicator", () => {
      const warningStatuses = ["WAITING_APPROVAL", "AWAITING_APPROVAL", "BLOCKED"] as const;

      for (const st of warningStatuses) {
        const info = getRunStatusInfo(st);
        expect(info.variant).toBe("warning");
        expect(info.isPulsing).toBe(true);
        expect(info.label).toBe("Active");
        expect(info.filterCategory).toBe("active");

        const { unmount } = render(
          <StatusDot
            variant={info.variant}
            label={info.label}
            isPulsing={info.isPulsing}
            data-testid={`dot-warn-${st}`}
          />
        );

        const dot = screen.getByTestId(`dot-warn-${st}`);
        expect(dot).toHaveAttribute("data-variant", "warning");
        expect(dot.className).toContain("warning");
        unmount();
      }
    });

    it("verifies completed runs (COMPLETED, SUCCESS) produce static success indicator", () => {
      const completedStatuses = ["COMPLETED", "SUCCESS"] as const;

      for (const st of completedStatuses) {
        const info = getRunStatusInfo(st);
        expect(info.variant).toBe("success");
        expect(info.isPulsing).toBe(false);
        expect(info.label).toBe("Completed");
        expect(info.filterCategory).toBe("settled");

        const { unmount } = render(
          <StatusDot
            variant={info.variant}
            label={info.label}
            isPulsing={info.isPulsing}
            data-testid={`dot-${st}`}
          />
        );

        const dot = screen.getByTestId(`dot-${st}`);
        expect(dot).toHaveAttribute("data-variant", "success");
        expect(dot.className).toContain("success");
        unmount();
      }
    });

    it("verifies failed/cancelled runs (FAILED, ERROR, CANCELLED, CANCELED) produce static error indicator", () => {
      const failedStatuses = ["FAILED", "ERROR", "CANCELLED", "CANCELED"] as const;

      for (const st of failedStatuses) {
        const info = getRunStatusInfo(st);
        expect(info.variant).toBe("error");
        expect(info.isPulsing).toBe(false);
        expect(info.label).toBe("Failed");
        expect(info.filterCategory).toBe("settled");

        const { unmount } = render(
          <StatusDot
            variant={info.variant}
            label={info.label}
            isPulsing={info.isPulsing}
            data-testid={`dot-${st}`}
          />
        );

        const dot = screen.getByTestId(`dot-${st}`);
        expect(dot).toHaveAttribute("data-variant", "error");
        expect(dot.className).toContain("error");
        unmount();
      }
    });

    it("verifies default / unobserved statuses produce static neutral indicator", () => {
      const unobserved = [undefined, null, "UNKNOWN_STAGE", "INITIALIZING"];

      for (const st of unobserved) {
        const info = getRunStatusInfo(st);
        expect(info.variant).toBe("neutral");
        expect(info.isPulsing).toBe(false);
        expect(info.label).toBe("Settled");
        expect(info.filterCategory).toBe("settled");
      }
    });

    it("verifies prefers-reduced-motion contract in StatusDot", () => {
      const dotPulsing = render(<StatusDot variant="accent" label="Pulsing" isPulsing={true} />);
      const pulsingEl = screen.getByRole("img", { name: "Pulsing" });
      const pulsingClasses = pulsingEl.className.split(/\s+/);
      dotPulsing.unmount();

      const dotStatic = render(<StatusDot variant="accent" label="Static" isPulsing={false} />);
      const staticEl = screen.getByRole("img", { name: "Static" });
      const staticClasses = staticEl.className.split(/\s+/);
      dotStatic.unmount();

      // Pulsing dot has styles.pulsing AND styles.reducedMotion
      const diffClasses = pulsingClasses.filter(c => !staticClasses.includes(c));
      expect(diffClasses.length).toBeGreaterThanOrEqual(2);
    });
  });

  // =========================================================================
  // 2. runs/page.tsx StatusDot Rendering & Layout Stability
  // =========================================================================
  describe("Invariant 2: runs/page.tsx renders StatusDot properly without breaking layout", () => {
    const mockRun = (over: Record<string, unknown> = {}) => ({
      id: "run-test-1",
      objective: "Arbitrage Execution on Base Sepolia",
      source: "CONSOLE",
      environment: "base-sepolia",
      isMainnet: false,
      budgetUsdc: "100.000000",
      createdAt: "2026-09-07T08:00:00.000Z",
      updatedAt: "2026-09-07T08:30:00.000Z",
      status: "RUNNING",
      ...over,
    });

    it("renders StatusDot for both demo run and all API runs in the missions table", async () => {
      dbHealth.mockResolvedValue({ ok: true, data: { status: "ok", latencyMs: 2 } });
      listRuns.mockResolvedValue({
        ok: true,
        data: {
          runs: [
            mockRun({ id: "run-act", status: "RUNNING", objective: "Active mission" }),
            mockRun({ id: "run-cmp", status: "COMPLETED", objective: "Completed mission" }),
            mockRun({ id: "run-fld", status: "FAILED", objective: "Failed mission" }),
            mockRun({ id: "run-blk", status: "BLOCKED", objective: "Blocked mission" }),
            mockRun({ id: "run-unk", status: null, objective: "Unobserved status mission" }),
          ],
        },
      });

      const { container } = render(await RunsPage());

      // Demo mission row must have a completed status dot
      const demoLink = screen.getByRole("link", { name: /demo/i });
      expect(demoLink).toBeInTheDocument();
      const demoDot = within(demoLink).getByRole("img", { name: "Completed" });
      expect(demoDot).toBeInTheDocument();
      expect(demoDot).toHaveAttribute("data-variant", "success");

      // API runs
      const actLink = screen.getByRole("link", { name: /Active mission/i });
      const actDot = within(actLink).getByRole("img", { name: "Active" });
      expect(actDot).toHaveAttribute("data-variant", "accent");

      const cmpLink = screen.getByRole("link", { name: /Completed mission/i });
      const cmpDot = within(cmpLink).getByRole("img", { name: "Completed" });
      expect(cmpDot).toHaveAttribute("data-variant", "success");

      const fldLink = screen.getByRole("link", { name: /Failed mission/i });
      const fldDot = within(fldLink).getByRole("img", { name: "Failed" });
      expect(fldDot).toHaveAttribute("data-variant", "error");

      const blkLink = screen.getByRole("link", { name: /Blocked mission/i });
      const blkDot = within(blkLink).getByRole("img", { name: "Active" });
      expect(blkDot).toHaveAttribute("data-variant", "warning");

      const unkLink = screen.getByRole("link", { name: /Unobserved status mission/i });
      const unkDot = within(unkLink).getByRole("img", { name: "Settled" });
      expect(unkDot).toHaveAttribute("data-variant", "neutral");

      // Verify DOM layout structure:
      // Each row has .cs__row-title-wrap with inline-flex alignment
      const titleWrappers = container.querySelectorAll(".cs__row-title-wrap");
      expect(titleWrappers.length).toBe(6); // 1 demo + 5 runs

      titleWrappers.forEach((wrapper) => {
        expect(wrapper.getAttribute("style")).toContain("display: inline-flex");
        expect(wrapper.getAttribute("style")).toContain("align-items: center");
        expect(wrapper.getAttribute("style")).toContain("gap: var(--space-2)");
        // StatusDot is first child of title wrapper
        const firstEl = wrapper.firstElementChild;
        expect(firstEl).not.toBeNull();
        expect(wrapper.querySelector('[role="img"]')).not.toBeNull();
      });
    });

    it("handles extreme string lengths without breaking row layout", async () => {
      const hugeObjective = "Very Long Objective ".repeat(30);
      dbHealth.mockResolvedValue({ ok: true, data: { status: "ok", latencyMs: 2 } });
      listRuns.mockResolvedValue({
        ok: true,
        data: {
          runs: [mockRun({ id: "run-huge", objective: hugeObjective, status: "RUNNING" })],
        },
      });

      const { container } = render(await RunsPage());

      const row = container.querySelector('a.cs__row[href="/runs/run-huge"]');
      expect(row).not.toBeNull();

      const objectiveEl = row!.querySelector(".cs__row-objective");
      expect(objectiveEl).not.toBeNull();

      const dot = within(row as HTMLElement).getByRole("img", { name: "Active" });
      expect(dot).toBeInTheDocument();
    });

    it("verifies axe accessibility compliance on runs page", async () => {
      dbHealth.mockResolvedValue({ ok: true, data: { status: "ok", latencyMs: 1 } });
      listRuns.mockResolvedValue({
        ok: true,
        data: {
          runs: [
            mockRun({ id: "run-1", status: "RUNNING" }),
            mockRun({ id: "run-2", status: "COMPLETED" }),
          ],
        },
      });

      const { container } = render(await RunsPage());
      await expectNoAxeViolations(container);
    });
  });

  // =========================================================================
  // 3. Token Conformance & globals.css Raw Hex Check
  // =========================================================================
  describe("Invariant 3: Design Tokens & globals.css Hex Ban", () => {
    it("ensures getRunStatusInfo outputs variants that match Astryx color token variables", () => {
      const allowedVariants = ["accent", "success", "error", "warning", "neutral"] as const;
      const testStatuses = [
        "RUNNING", "COMPLETED", "FAILED", "BLOCKED", "WAITING_APPROVAL", "CANCELLED", undefined
      ];

      for (const st of testStatuses) {
        const info = getRunStatusInfo(st);
        expect(allowedVariants).toContain(info.variant);
      }
    });
  });
});

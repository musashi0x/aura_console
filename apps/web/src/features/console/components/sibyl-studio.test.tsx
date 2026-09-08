import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { expectNoAxeViolations } from "@/test/axe";
import { SibylFlowSimulator } from "./sibyl-flow-simulator";
import { SibylCounterfactualSimulator } from "./sibyl-counterfactual-simulator";
import { SibylDatabaseInspector } from "./sibyl-database-inspector";
import { SibylDeletionDemo } from "./sibyl-deletion-demo";

describe("Sibyl Studio Components", () => {
  describe("SibylFlowSimulator", () => {
    it("renders the 7-step simulator with controls and initial step", () => {
      render(<SibylFlowSimulator />);
      expect(screen.getByText(/LIVE FLOW SIMULATOR/i)).toBeInTheDocument();
      expect(screen.getByText(/Step 1 of 7: Mission Initialization/i)).toBeInTheDocument();
      expect(screen.getByText("mission_initialize")).toBeInTheDocument();
      expect(screen.getByText(/AGENT AUTONOMOUS REASONING/i)).toBeInTheDocument();
      expect(screen.getByText(/LIVE TERMINAL & MCP PROTOCOL EXECUTION/i)).toBeInTheDocument();
    });

    it("navigates forward to step 2 on Next click", async () => {
      const user = userEvent.setup();
      const onStepChange = vi.fn();
      render(<SibylFlowSimulator onStepChange={onStepChange} />);

      const nextBtn = screen.getByRole("button", { name: /^Next$/i });
      await user.click(nextBtn);

      expect(onStepChange).toHaveBeenCalledWith(2);
      expect(screen.getByText(/Step 2 of 7: Sibyl Memory Recall/i)).toBeInTheDocument();
      expect(screen.getByText("memory_recall_counterparty")).toBeInTheDocument();
    });

    it("has no axe violations", async () => {
      const { container } = render(<SibylFlowSimulator />);
      await expectNoAxeViolations(container);
    });
  });

  describe("SibylCounterfactualSimulator", () => {
    it("renders both stateless and Sibyl comparative columns", () => {
      render(<SibylCounterfactualSimulator />);
      expect(screen.getByText(/Stateless Blind Spend vs. Stateful Sibyl Governance/i)).toBeInTheDocument();
      expect(screen.getByText(/WITHOUT SIBYL \(STATELESS AGENT\)/i)).toBeInTheDocument();
      expect(screen.getByText(/WITH SIBYL MEMORY \(AURA AGENT\)/i)).toBeInTheDocument();
      expect(screen.getByText(/-\$9.00 USDC Deficit/i)).toBeInTheDocument();
      expect(screen.getByText(/\+\$6.50 USDC Saved/i)).toBeInTheDocument();
    });

    it("has no axe violations", async () => {
      const { container } = render(<SibylCounterfactualSimulator />);
      await expectNoAxeViolations(container);
    });
  });

  describe("SibylDatabaseInspector", () => {
    it("renders SQLite database records and switches between alpha and beta", async () => {
      const user = userEvent.setup();
      render(<SibylDatabaseInspector />);

      expect(screen.getByText(/Live Sibyl Memory Database & 5-Tier Inspector/i)).toBeInTheDocument();
      expect(screen.getByText("Alpha Research Agent")).toBeInTheDocument();
      expect(screen.getByText(/28 \/ 100/i)).toBeInTheDocument();
      expect(screen.getByText("Tier 3: COLD")).toBeInTheDocument();

      const betaBtn = screen.getByRole("button", { name: /virtuals:agent:beta/i });
      await user.click(betaBtn);

      expect(screen.getByText("Beta Labs High-Integrity Agent")).toBeInTheDocument();
      expect(screen.getByText(/94 \/ 100/i)).toBeInTheDocument();
    });

    it("has no axe violations", async () => {
      const { container } = render(<SibylDatabaseInspector />);
      await expectNoAxeViolations(container);
    });
  });

  describe("SibylDeletionDemo", () => {
    it("renders the load-bearing deletion test and toggles memory state", async () => {
      const user = userEvent.setup();
      render(<SibylDeletionDemo />);

      expect(screen.getByText(/Load-Bearing Memory Deletion Test/i)).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: /HALF A: SIBYL MEMORY OFFLINE/i })).toBeInTheDocument();
      expect(screen.getByText("RUN.BLOCKED")).toBeInTheDocument();

      const onlineBtn = screen.getByRole("button", { name: /Memory Online \(Active\)/i });
      await user.click(onlineBtn);

      expect(screen.getByRole("heading", { name: /HALF B: SIBYL MEMORY ONLINE/i })).toBeInTheDocument();
      expect(screen.getByText("APPROVAL.REQUESTED")).toBeInTheDocument();
    });

    it("has no axe violations", async () => {
      const { container } = render(<SibylDeletionDemo />);
      await expectNoAxeViolations(container);
    });
  });
});

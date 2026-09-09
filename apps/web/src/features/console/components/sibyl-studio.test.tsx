import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { expectNoAxeViolations } from "@/test/axe";
import { SibylFlowSimulator } from "./sibyl-flow-simulator";
import { SibylCounterfactualSimulator } from "./sibyl-counterfactual-simulator";
import { SibylDatabaseInspector } from "./sibyl-database-inspector";
import { SibylDeletionDemo } from "./sibyl-deletion-demo";
import { SibylCliWalkthrough } from "./sibyl-cli-walkthrough";

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

  describe("SibylCliWalkthrough", () => {
    it("renders the 4-step setup walkthrough with official commands", () => {
      render(<SibylCliWalkthrough />);

      expect(screen.getByText(/Give your AI a memory, in about two minutes/i)).toBeInTheDocument();
      expect(screen.getAllByText(/pip install 'sibyl-memory-cli\[mcp\]'/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/Install Sibyl Memory CLI & MCP/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/Option A \(pip\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Option B \(curl one-liner\)/i)).toBeInTheDocument();
    });

    it("toggles between pip and curl options on step 1 and updates terminal output", async () => {
      const user = userEvent.setup();
      render(<SibylCliWalkthrough />);

      // Pip is default
      expect(screen.getByText(/Downloading sibyl_memory_cli/i)).toBeInTheDocument();

      const curlBtn = screen.getByRole("button", { name: /Option B \(curl one-liner\)/i });
      await user.click(curlBtn);

      expect(screen.getAllByText(/curl -fsSL https:\/\/sibyllabs.org\/install \| sh/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/Fetching Sibyl Memory installer from sibyllabs\.org/i)).toBeInTheDocument();
      expect(screen.getByText(/Downloading release v0\.4\.1/i)).toBeInTheDocument();
    });

    it("wires accessible ARIA tabs and tabpanels correctly", () => {
      render(<SibylCliWalkthrough />);

      const tab = screen.getByRole("tab", { name: /Step 1/i });
      expect(tab).toHaveAttribute("aria-controls", "walkthrough-panel-install");
      expect(tab).toHaveAttribute("id", "walkthrough-tab-install");

      const panel = screen.getByRole("tabpanel");
      expect(panel).toHaveAttribute("id", "walkthrough-panel-install");
      expect(panel).toHaveAttribute("aria-labelledby", "walkthrough-tab-install");
    });

    it("triggers live progressive simulation in the terminal", async () => {
      const user = userEvent.setup();
      render(<SibylCliWalkthrough />);

      const simulateBtn = screen.getByRole("button", { name: /Simulate/i });
      await user.click(simulateBtn);

      expect(screen.getByText(/Running\.\.\./i)).toBeInTheDocument();
    });

    it("copies command with feedback", async () => {
      const user = userEvent.setup();
      render(<SibylCliWalkthrough />);

      const copyBtn = screen.getByRole("button", { name: /Copy command for Install Sibyl Memory CLI & MCP/i });
      await user.click(copyBtn);

      expect(screen.getByText("Copied")).toBeInTheDocument();
    });

    it("navigates forward through all 4 steps", async () => {
      const user = userEvent.setup();
      const onJumpToTool = vi.fn();
      render(<SibylCliWalkthrough onJumpToTool={onJumpToTool} />);

      // Step 1 -> Step 2
      const nextBtn = screen.getByRole("button", { name: /Next: Sign in/i });
      await user.click(nextBtn);

      expect(screen.getByText(/Sign in \(Free Tier, No Card Needed\)/i)).toBeInTheDocument();
      expect(screen.getAllByText(/sibyl init/i).length).toBeGreaterThanOrEqual(1);

      // Step 2 -> Step 3
      const nextToStep3 = screen.getByRole("button", { name: /Next: Connect it to your AI/i });
      await user.click(nextToStep3);

      expect(screen.getByText(/Connect it to your AI \(Claude, Codex, Hermes, Aura\)/i)).toBeInTheDocument();
      expect(screen.getAllByText(/sibyl setup/i).length).toBeGreaterThanOrEqual(1);

      // Step 3 -> Step 4
      const nextToStep4 = screen.getByRole("button", { name: /Next: Test it works/i });
      await user.click(nextToStep4);

      expect(screen.getByText(/Test it works \(Stateful Cold Recall\)/i)).toBeInTheDocument();
      expect(screen.getAllByText(/remember that I like short, direct answers\./i).length).toBeGreaterThanOrEqual(1);
    });

    it("toggles troubleshooting guide", async () => {
      const user = userEvent.setup();
      render(<SibylCliWalkthrough />);

      const toggleBtn = screen.getByRole("button", { name: /Show troubleshooting/i });
      await user.click(toggleBtn);

      expect(screen.getByText(/Externally managed environment/i)).toBeInTheDocument();
      expect(screen.getByText(/python3 -m venv ~\/\.sibyl-memory\/venv/i)).toBeInTheDocument();
    });

    it("has no axe violations", async () => {
      const { container } = render(<SibylCliWalkthrough />);
      await expectNoAxeViolations(container);
    });
  });
});

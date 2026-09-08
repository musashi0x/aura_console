import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { expectNoAxeViolations } from "@/test-support/axe";
import { console_ } from "../copy";
import { ConsoleShell } from "./console-shell";
import { RunsView } from "./runs-view";
import { MissionWorkspace } from "./mission-workspace";
import { MissionInspector } from "./mission-inspector";
import { ChatConsoleView, type ChatConsoleRun } from "./chat-console-view";
import type { CanonicalEvent } from "../model/types";
import type { FoldSeed } from "../projection/fold-run";
import type { RunSummary } from "@/lib/api-client";

describe("Challenger M1 Empirical Verification: Base Sepolia Rebranding on All Surfaces", () => {
  const defaultExampleRun = {
    objective: "Buy one market dataset under ceiling",
    environment: "Base Sepolia",
  };

  const sampleRuns: RunSummary[] = [
    {
      id: "run-sepolia-1",
      objective: "Arbitrage probe on testnet",
      source: "CONSOLE",
      environment: "base-sepolia",
      isMainnet: false,
      budgetUsdc: "10.00",
      createdAt: "2026-09-08T10:00:00.000Z",
      updatedAt: "2026-09-08T10:00:00.000Z",
    },
    {
      id: "run-legacy-2",
      objective: "Legacy mission with old environment string",
      source: "CONSOLE",
      environment: "non-mainnet",
      isMainnet: false,
      budgetUsdc: "15.00",
      createdAt: "2026-09-08T11:00:00.000Z",
      updatedAt: "2026-09-08T11:00:00.000Z",
    },
    {
      id: "run-display-3",
      objective: "Mission with pre-formatted display name",
      source: "CONSOLE",
      environment: "Base Sepolia",
      isMainnet: false,
      budgetUsdc: "20.00",
      createdAt: "2026-09-08T12:00:00.000Z",
      updatedAt: "2026-09-08T12:00:00.000Z",
    },
  ];

  // =========================================================================
  // Surface 1: Mission cards (/runs)
  // =========================================================================
  describe("Surface 1: Mission cards (/runs)", () => {
    it("renders 'Base Sepolia' badge on the fixture demo Mission card", () => {
      render(<RunsView runs={[]} exampleRun={defaultExampleRun} />);
      const demoCard = screen.getByRole("link", { name: new RegExp(console_.missions.demoBadge, "i") });
      expect(demoCard).toBeInTheDocument();

      const envBadge = demoCard.querySelector(".cs__row-env");
      expect(envBadge).not.toBeNull();
      expect(envBadge).toHaveTextContent("Base Sepolia");
      expect(demoCard.textContent).not.toMatch(/non-mainnet/i);
    });

    it("normalizes raw 'non-mainnet' in fixture demo Mission card to 'Base Sepolia'", () => {
      render(
        <RunsView
          runs={[]}
          exampleRun={{
            objective: "Demo mission with old environment string",
            environment: "non-mainnet",
          }}
        />,
      );
      const demoCard = screen.getByRole("link", { name: new RegExp(console_.missions.demoBadge, "i") });
      const envBadge = demoCard.querySelector(".cs__row-env");
      expect(envBadge).toHaveTextContent("Base Sepolia");
      expect(demoCard.textContent).not.toMatch(/non-mainnet/i);
    });

    it("renders 'Base Sepolia' on all API mission cards regardless of raw environment variant", () => {
      const { container } = render(<RunsView runs={sampleRuns} exampleRun={defaultExampleRun} />);

      const envSpans = container.querySelectorAll(".cs__row-env");
      // 1 demo card + 3 API cards = 4 cards total
      expect(envSpans.length).toBe(4);

      envSpans.forEach((span) => {
        expect(span.textContent?.trim()).toBe("Base Sepolia");
      });

      // Crucial negative invariant: non-mainnet must NOT appear anywhere in the rendered cards
      expect(container.textContent).not.toMatch(/non-mainnet/i);
    });

    it("falls back gracefully to 'Base Sepolia' when environment is undefined or null", () => {
      const unenvRun: RunSummary[] = [
        {
          id: "run-unenv",
          objective: "Mission with missing environment",
          source: "CONSOLE",
          environment: undefined as unknown as string,
          isMainnet: false,
          budgetUsdc: "5.00",
          createdAt: "2026-09-08T10:00:00.000Z",
          updatedAt: "2026-09-08T10:00:00.000Z",
        },
      ];
      render(<RunsView runs={unenvRun} exampleRun={defaultExampleRun} />);
      const apiCard = screen.getByRole("link", { name: /Mission with missing environment/i });
      const envSpan = apiCard.querySelector(".cs__row-env");
      expect(envSpan).toHaveTextContent("Base Sepolia");
    });
  });

  // =========================================================================
  // Surface 2: Run headers (MissionWorkspace & ChatConsoleView)
  // =========================================================================
  describe("Surface 2: Run headers", () => {
    const seedWith = (env: string): FoldSeed => ({
      runId: "run_rebrand_test",
      objective: "Header verification mission",
      source: "CONSOLE",
      environment: env,
      budgetUsdc: "50.00",
    });

    const canonicalEvents: readonly CanonicalEvent[] = [
      {
        event_id: "evt_1",
        run_id: "run_rebrand_test",
        sequence: 1,
        type: "run.created",
        event_time: "2026-09-08T10:00:00Z",
        data: {},
      },
    ];

    it("renders 'Base Sepolia' in MissionWorkspace header when environment is 'base-sepolia'", () => {
      const { container } = render(
        <MissionWorkspace events={canonicalEvents} seed={seedWith("base-sepolia")} />,
      );

      const header = container.querySelector(".run__head");
      expect(header).not.toBeNull();

      const monoRefs = header?.querySelectorAll(".mono-ref");
      expect(monoRefs).toBeDefined();

      // Find the MonoRef with label "ENV"
      const envMonoRef = Array.from(monoRefs ?? []).find(
        (el) => el.querySelector(".mono-ref__label")?.textContent?.trim() === "ENV",
      );
      expect(envMonoRef).toBeDefined();

      const envValue = envMonoRef?.querySelector(".mono-ref__value");
      expect(envValue).toHaveTextContent("Base Sepolia");
      expect(header?.textContent).not.toMatch(/non-mainnet/i);
    });

    it("normalizes 'non-mainnet' to 'Base Sepolia' in MissionWorkspace header", () => {
      const { container } = render(
        <MissionWorkspace events={canonicalEvents} seed={seedWith("non-mainnet")} />,
      );

      const header = container.querySelector(".run__head");
      const envMonoRef = Array.from(header?.querySelectorAll(".mono-ref") ?? []).find(
        (el) => el.querySelector(".mono-ref__label")?.textContent?.trim() === "ENV",
      );
      expect(envMonoRef?.querySelector(".mono-ref__value")).toHaveTextContent("Base Sepolia");
      expect(header?.textContent).not.toMatch(/non-mainnet/i);
    });

    it("renders 'Base Sepolia' in ChatConsoleView active run header", () => {
      const activeRun: ChatConsoleRun = {
        id: "run-chat-sepolia",
        objective: "Active run for chat test",
        source: "CONSOLE",
        environment: "base-sepolia",
        isMainnet: false,
        budgetUsdc: "30.000000",
        createdAt: "2026-09-08T10:00:00.000Z",
        updatedAt: "2026-09-08T10:00:00.000Z",
        status: "RUNNING",
      };

      const { container } = render(
        <ChatConsoleView runs={[activeRun]} initialRunId="run-chat-sepolia" />,
      );

      const header = container.querySelector(".cs__chat-console-main-header");
      expect(header).not.toBeNull();
      expect(header?.textContent).toContain("Base Sepolia");
      expect(header?.textContent).toContain("Grounded in Mission run-chat-sepolia");
      expect(header?.textContent).not.toMatch(/non-mainnet/i);
    });

    it("normalizes 'non-mainnet' to 'Base Sepolia' in ChatConsoleView active run header", () => {
      const legacyRun: ChatConsoleRun = {
        id: "run-chat-legacy",
        objective: "Legacy run for chat test",
        source: "CONSOLE",
        environment: "non-mainnet",
        isMainnet: false,
        budgetUsdc: "30.000000",
        createdAt: "2026-09-08T10:00:00.000Z",
        updatedAt: "2026-09-08T10:00:00.000Z",
        status: "RUNNING",
      };

      const { container } = render(
        <ChatConsoleView runs={[legacyRun]} initialRunId="run-chat-legacy" />,
      );

      const header = container.querySelector(".cs__chat-console-main-header");
      expect(header?.textContent).toContain("Base Sepolia");
      expect(header?.textContent).not.toMatch(/non-mainnet/i);
    });
  });

  // =========================================================================
  // Surface 3: Topbar (ConsoleTopbar / ConsoleShell)
  // =========================================================================
  describe("Surface 3: Topbar", () => {
    it("renders 'Base Sepolia' badge with updated tooltip and no 'NON-MAINNET' traces", () => {
      const { container } = render(
        <ConsoleShell surface="Runs" readiness="ready">
          <div>Content</div>
        </ConsoleShell>,
      );

      const envBadge = container.querySelector(".cs__env");
      expect(envBadge).not.toBeNull();
      expect(envBadge).toHaveTextContent("Base Sepolia");

      const titleAttr = envBadge?.getAttribute("title") ?? "";
      expect(titleAttr).toContain("Base Sepolia Network:");
      expect(titleAttr).toContain("Aura Console operates on Base Sepolia testnet");
      expect(titleAttr).not.toMatch(/NON-MAINNET Environment:/i);

      // Verify no stray "NON-MAINNET" text anywhere in the rendered shell
      expect(container.textContent ?? "").not.toMatch(/non-mainnet/i);
    });
  });

  // =========================================================================
  // Surface 4: Inspector (MissionInspector)
  // =========================================================================
  describe("Surface 4: Inspector", () => {
    it("renders 'Base Sepolia' for 'base-sepolia' environment in standalone MissionInspector", () => {
      render(
        <MissionInspector
          runId="run_inspect_1"
          environment="base-sepolia"
          budgetUsdc="100.00"
        />,
      );

      const envItem = screen.getByTestId("meta-environment");
      expect(envItem).toHaveTextContent("Base Sepolia");
    });

    it("normalizes 'non-mainnet' to 'Base Sepolia' in standalone MissionInspector", () => {
      render(
        <MissionInspector
          runId="run_inspect_2"
          environment="non-mainnet"
          budgetUsdc="100.00"
        />,
      );

      const envItem = screen.getByTestId("meta-environment");
      expect(envItem).toHaveTextContent("Base Sepolia");
    });

    it("renders 'Base Sepolia' in MissionInspector inside MissionWorkspace", () => {
      const seed: FoldSeed = {
        runId: "run_ws_inspector",
        objective: "Inspector integration test",
        source: "CONSOLE",
        environment: "base-sepolia",
        budgetUsdc: "75.00",
      };

      const events: readonly CanonicalEvent[] = [
        {
          event_id: "evt_insp_1",
          run_id: "run_ws_inspector",
          sequence: 1,
          type: "run.created",
          event_time: "2026-09-08T10:00:00Z",
          data: {},
        },
      ];

      render(<MissionWorkspace events={events} seed={seed} />);

      const envItem = screen.getByTestId("meta-environment");
      expect(envItem).toHaveTextContent("Base Sepolia");
    });

    it("renders 'Base Sepolia' in MissionInspector inside ChatConsoleView when opened", async () => {
      const user = userEvent.setup();
      const activeRun: ChatConsoleRun = {
        id: "run-chat-insp",
        objective: "Chat inspector test",
        source: "CONSOLE",
        environment: "base-sepolia",
        isMainnet: false,
        budgetUsdc: "45.000000",
        createdAt: "2026-09-08T10:00:00.000Z",
        updatedAt: "2026-09-08T10:00:00.000Z",
        status: "RUNNING",
      };

      render(
        <ChatConsoleView runs={[activeRun]} initialRunId="run-chat-insp" />,
      );

      // In ChatConsoleView, MissionInspector is rendered with isCollapsible={true}
      const toggle = screen.getByRole("button", { name: /show inspector/i });
      expect(toggle).toBeInTheDocument();
      await user.click(toggle);

      const envItem = screen.getByTestId("meta-environment");
      expect(envItem).toHaveTextContent("Base Sepolia");
    });
  });

  // =========================================================================
  // Accessibility & Token Conformance Check
  // =========================================================================
  describe("Accessibility & Theme Invariants", () => {
    it("has no axe violations on RunsView displaying Base Sepolia badges", async () => {
      const { container } = render(<RunsView runs={sampleRuns} exampleRun={defaultExampleRun} />);
      await expectNoAxeViolations(container);
    });

    it("has no axe violations on MissionInspector displaying Base Sepolia", async () => {
      const { container } = render(
        <MissionInspector
          runId="run_a11y_1"
          environment="base-sepolia"
          budgetUsdc="100.00"
          txHash="0x8f3c7a6e129b014d3c9071fe25a6b8c9d01234567890abcdef1234567890abcd"
        />,
      );
      await expectNoAxeViolations(container);
    });
  });
});

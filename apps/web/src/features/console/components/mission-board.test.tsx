import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { expectNoAxeViolations } from "@/test/axe";
import type { CanonicalStage, TimelineEntry } from "../model/types";
import { buildMissionProgress } from "../projection/mission-rail";
import { console_ } from "../copy";
import { MissionBoard } from "./mission-board";

const makeEntry = (
  sequence: number,
  type: string,
  stage: CanonicalStage,
  summary: string,
  data: Record<string, unknown> = {},
): TimelineEntry => ({
  eventId: `evt_${sequence}`,
  sequence,
  type,
  eventTime: `2026-08-29T10:00:0${sequence}Z`,
  stage,
  support: "SUPPORTED",
  summary,
  data,
});

const dummyEntries: TimelineEntry[] = [
  makeEntry(1, "provider.discovered", "DISCOVER", "Three counterparties offered the dataset", {
    candidates: ["beta_labs", "alpha_research"],
  }),
  makeEntry(2, "memory.retrieved", "MEMORY", "Two prior settlements recalled for this counterparty", {
    counterparty_key: "beta_labs",
    episodes_used: 2,
  }),
  makeEntry(3, "decision.made", "DECIDE", "Selected counterparty beta_labs", {
    counterparty_key: "beta_labs",
    policy_version: "v4",
  }),
  makeEntry(4, "acp.job.funded", "FUND", "Job funded with 18.50 USDC", {
    amount_usdc: "18.500000",
    counterparty_key: "beta_labs",
  }),
  makeEntry(5, "evaluation.completed", "EVALUATE", "Delivery verified against objective", {
    result: "ACCEPTED",
  }),
  makeEntry(6, "memory.diff.published", "LEARN", "Relationship memory moved from v12 to v13", {
    from_version: "v12",
    to_version: "v13",
  }),
];

describe("MissionBoard", () => {
  it("renders 4 kanban columns and progress KPI bar", () => {
    const progress = buildMissionProgress(dummyEntries, "COMPLETED");
    render(
      <MissionBoard
        progress={progress}
        runId="run_test_001"
        budgetUsdc="25.00"
        spentUsdc="18.50"
      />,
    );

    // Check Board heading & toolbar
    expect(screen.getByRole("region", { name: console_.mission.board.label })).toBeInTheDocument();
    expect(screen.getAllByText(/Mission Execution Progress/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/6\/6 Steps \(100%\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Spent: 18.50 USDC/i)).toBeInTheDocument();
    expect(screen.getByText(/Ceiling: 25.00 USDC/i)).toBeInTheDocument();

    // Check all 4 columns exist
    for (const column of ["QUEUED", "RUNNING", "NEEDS_YOU", "DONE"] as const) {
      expect(
        screen.getByRole("region", { name: console_.mission.board.columns[column] }),
      ).toBeInTheDocument();
    }
  });

  it("renders rich step cards with executive narrative and entity tokens", () => {
    const progress = buildMissionProgress(dummyEntries, "COMPLETED");
    render(
      <MissionBoard
        progress={progress}
        runId="run_test_001"
      />,
    );

    // Check step labels
    expect(screen.getByRole("heading", { name: console_.mission.rail.steps.UNDERSTAND })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: console_.mission.rail.steps.REMEMBER })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: console_.mission.rail.steps.DECIDE })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: console_.mission.rail.steps.ACT })).toBeInTheDocument();

    // Check entity tokens extracted from entries
    expect(screen.getAllByText("beta_labs").length).toBeGreaterThan(0);
    expect(screen.getByText("2 recalled")).toBeInTheDocument();
    expect(screen.getByText("18.500000 USDC")).toBeInTheDocument();
    expect(screen.getByText("Policy v4")).toBeInTheDocument();
    expect(screen.getByText("ACCEPTED")).toBeInTheDocument();
  });

  it("expands and reveals micro-events within a step card", async () => {
    const user = userEvent.setup();
    const progress = buildMissionProgress(dummyEntries, "COMPLETED");
    render(
      <MissionBoard
        progress={progress}
        runId="run_test_001"
      />,
    );

    // Click "Events (1)" on the Understand card
    const toggleBtn = screen.getAllByRole("button", { name: /events \(1\)/i })[0]!;
    await user.click(toggleBtn);

    // Verify micro-event details are shown
    expect(screen.getByText("provider.discovered")).toBeInTheDocument();
    expect(screen.getByText("Three counterparties offered the dataset")).toBeInTheDocument();

    // Click again to hide
    await user.click(screen.getByRole("button", { name: /hide events/i }));
    expect(screen.queryByText("provider.discovered")).not.toBeInTheDocument();
  });

  it("filters step cards based on user search input", async () => {
    const user = userEvent.setup();
    const progress = buildMissionProgress(dummyEntries, "COMPLETED");
    render(
      <MissionBoard
        progress={progress}
        runId="run_test_001"
      />,
    );

    const input = screen.getByPlaceholderText(/filter steps/i);
    await user.type(input, "remember");

    // Only Remember card should be present
    expect(screen.getByRole("heading", { name: console_.mission.rail.steps.REMEMBER })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: console_.mission.rail.steps.ACT })).not.toBeInTheDocument();

    // Clear filter
    await user.click(screen.getByRole("button", { name: /clear filter/i }));
    expect(screen.getByRole("heading", { name: console_.mission.rail.steps.ACT })).toBeInTheDocument();
  });

  it("invokes onSelect to jump to Operator mode when clicking Operator button", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const progress = buildMissionProgress(dummyEntries, "COMPLETED");
    render(
      <MissionBoard
        progress={progress}
        runId="run_test_001"
        onSelect={onSelect}
      />,
    );

    const operatorBtns = screen.getAllByRole("button", { name: /operator/i });
    expect(operatorBtns.length).toBeGreaterThan(0);
    await user.click(operatorBtns[0]!);

    expect(onSelect).toHaveBeenCalledWith("evt_1");
  });

  it("renders pipeline view with all 6 steps when switched via SegmentedControl", async () => {
    const user = userEvent.setup();
    const progress = buildMissionProgress(dummyEntries, "COMPLETED");
    render(
      <MissionBoard
        progress={progress}
        runId="run_test_001"
        allEntries={dummyEntries}
      />,
    );

    // Switch to Pipeline view
    const pipelineTab = screen.getByRole("radio", { name: /pipeline/i });
    await user.click(pipelineTab);

    // Verify pipeline region exists
    expect(screen.getByRole("region", { name: /pipeline view of all 6 steps/i })).toBeInTheDocument();

    // All 6 steps should be rendered as headings in pipeline view
    for (const stepKey of ["UNDERSTAND", "REMEMBER", "DECIDE", "ACT", "VERIFY", "LEARN"] as const) {
      expect(
        screen.getByRole("heading", { name: console_.mission.rail.steps[stepKey] }),
      ).toBeInTheDocument();
    }
  });

  it("renders historical intelligence cards in empty kanban columns for a completed run", () => {
    const entriesWithApproval: TimelineEntry[] = [
      ...dummyEntries,
      makeEntry(7, "run.blocked", "DECIDE", "Paused: operator approval required"),
      makeEntry(8, "approval.granted", "DECIDE", "Operator approved spend"),
    ];
    const progress = buildMissionProgress(entriesWithApproval, "COMPLETED");
    render(
      <MissionBoard
        progress={progress}
        runId="run_test_001"
        allEntries={entriesWithApproval}
      />,
    );

    // In a completed run with 0 active needs-you cards, the historical intelligence card is shown
    expect(screen.getByText("1 Approval Gate Resolved")).toBeInTheDocument();
    expect(screen.getByText("All Steps Executed")).toBeInTheDocument();
    expect(screen.getByText("Pipeline Fully Dispatched")).toBeInTheDocument();
  });

  it("triggers onScrubTo when clicking lifecycle simulation buttons", async () => {
    const user = userEvent.setup();
    const onScrubTo = vi.fn();
    const onResetLive = vi.fn();
    const entriesWithApproval: TimelineEntry[] = [
      ...dummyEntries,
      makeEntry(7, "run.blocked", "DECIDE", "Paused: operator approval required"),
    ];
    const progress = buildMissionProgress(entriesWithApproval, "COMPLETED");

    render(
      <MissionBoard
        progress={progress}
        runId="run_test_001"
        allEntries={entriesWithApproval}
        onScrubTo={onScrubTo}
        onResetLive={onResetLive}
        isHistorical={true}
      />,
    );

    // Click "Needs Approval" simulation button
    const approvalBtn = screen.getByRole("button", { name: /needs approval/i });
    await user.click(approvalBtn);
    expect(onScrubTo).toHaveBeenCalledWith(expect.objectContaining({ type: "run.blocked" }));

    // Click "Running Dispatched" simulation button
    const runningBtn = screen.getByRole("button", { name: /running dispatched/i });
    await user.click(runningBtn);
    expect(onScrubTo).toHaveBeenCalledWith(expect.objectContaining({ type: "acp.job.funded" }));

    // Click "Completed" button
    const completedBtn = screen.getByRole("button", { name: /completed \(settled\)/i });
    await user.click(completedBtn);
    expect(onResetLive).toHaveBeenCalled();
  });

  it("renders live backend run banner when viewing the example fixture", () => {
    const progress = buildMissionProgress(dummyEntries, "COMPLETED");
    render(
      <MissionBoard
        progress={progress}
        runId="run_example_0001"
        fixtureLabel="Demo Mission Fixture"
        allEntries={dummyEntries}
      />,
    );

    expect(screen.getByTestId("mission-board-live-banner")).toBeInTheDocument();
    expect(screen.getByText(/Viewing Demo Mission Fixture/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /open live run/i })).toBeInTheDocument();
  });

  it("renders prominent MCP tool call highlights on step cards", () => {
    const progress = buildMissionProgress(dummyEntries, "COMPLETED");
    render(
      <MissionBoard
        progress={progress}
        runId="run_test_001"
      />,
    );

    expect(screen.getByTestId("mcp-step-highlight-remember")).toBeInTheDocument();
    expect(screen.getAllByText("memory_recall_counterparty").length).toBeGreaterThan(0);
    expect(screen.getByText(/Sibyl Memory Lookup/i)).toBeInTheDocument();
    expect(screen.getByText(/alpha \(score 28\) blocked · beta \(score 94\) verified/i)).toBeInTheDocument();
  });

  it("omits the board impact strip when showImpactStrip is false", () => {
    const progress = buildMissionProgress(dummyEntries, "COMPLETED");
    render(
      <MissionBoard
        progress={progress}
        runId="run_test_001"
        showImpactStrip={false}
      />,
    );

    expect(screen.queryByLabelText("Executive Impact Summary")).not.toBeInTheDocument();
  });

  it("initializes directly in pipeline view when initialViewMode is pipeline", () => {
    const progress = buildMissionProgress(dummyEntries, "COMPLETED");
    render(
      <MissionBoard
        progress={progress}
        runId="run_test_001"
        allEntries={dummyEntries}
        initialViewMode="pipeline"
      />,
    );

    expect(screen.getByRole("region", { name: /pipeline view of all 6 steps/i })).toBeInTheDocument();
  });

  it("has no accessibility violations in Board view", async () => {
    const progress = buildMissionProgress(dummyEntries, "COMPLETED");
    const { container } = render(
      <MissionBoard
        progress={progress}
        runId="run_test_001"
      />,
    );

    await expectNoAxeViolations(container);
  });
});

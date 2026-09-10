import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { expectNoAxeViolations } from "@/test/axe";
import { StreamlinedDecisionCard } from "./streamlined-decision-card";

describe("StreamlinedDecisionCard", () => {
  it("renders Task & budget prominently", () => {
    render(
      <StreamlinedDecisionCard
        objective="Find a provider for a competitor report. Budget: 15 USDC."
        budgetUsdc="15.000000"
      />,
    );

    expect(
      screen.getByRole("heading", {
        name: /Find a provider for a competitor report. Budget: 15 USDC./i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("15.00 USDC")).toBeInTheDocument();
    expect(screen.getByText("AURA ACTIVE TASK")).toBeInTheDocument();
  });

  it("renders Recommendation with quoted price and source-backed reason", () => {
    render(<StreamlinedDecisionCard />);

    expect(screen.getByText("Recommended Provider")).toBeInTheDocument();
    expect(screen.getAllByText(/Beta Research/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/12\.00 USDC/i).length).toBeGreaterThanOrEqual(1);
    expect(
      screen.getByText(/Selected based on verified deliverable history stored in Sibyl Memory/i),
    ).toBeInTheDocument();
  });

  it("renders 'What Aura remembers' with episodes and failure reasons", () => {
    render(<StreamlinedDecisionCard />);

    expect(screen.getByText("What Aura remembers")).toBeInTheDocument();
    expect(screen.getByText("Alpha Research")).toBeInTheDocument();
    expect(screen.getByText(/REJECTED · SCORE 0.20/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Competitor report deliverable missing mandatory citation sources/i),
    ).toBeInTheDocument();

    expect(screen.getByText(/ACCEPTED · SCORE 1.00/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Delivered 3 competitors with authentic website URLs/i),
    ).toBeInTheDocument();
  });

  it("renders 'What changed: Price-only vs. History-aware' comparison and explanatory note", () => {
    render(<StreamlinedDecisionCard />);

    expect(
      screen.getByText("What changed: Price-only vs. History-aware"),
    ).toBeInTheDocument();
    expect(screen.getByText("Price-Only Choice")).toBeInTheDocument();
    expect(screen.getByText("With Recorded History")).toBeInTheDocument();
    expect(
      screen.getByText(/The comparison is recalculated from verified delivery evidence; no second job was created or funded/i),
    ).toBeInTheDocument();
  });

  it("supports approving provider, opening drawers, and toggling memory details", async () => {
    const user = userEvent.setup();
    const onApprove = vi.fn();
    render(<StreamlinedDecisionCard onApprove={onApprove} />);

    // Approve
    const approveBtn = screen.getByRole("button", { name: "Approve Provider" });
    await user.click(approveBtn);
    expect(onApprove).toHaveBeenCalledOnce();
    expect(screen.getByText("Provider Approved & Ready")).toBeInTheDocument();

    // Drawer: Why this provider?
    const whyBtn = screen.getByRole("button", { name: /Why this provider\?/i });
    await user.click(whyBtn);
    expect(
      screen.getByRole("heading", { name: /Why This Provider: Evidence & Provenance/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("RISK: CRITICAL")).toBeInTheDocument();
    expect(screen.getByText("MISSING_CITATIONS")).toBeInTheDocument();
    expect(screen.getByText("Action: DO_NOT_HIRE")).toBeInTheDocument();
    expect(screen.getByText("RISK: LOW")).toBeInTheDocument();
    expect(screen.getByText("Action: HIRE")).toBeInTheDocument();
    const closeBtn = screen.getByRole("button", { name: "Close" });
    await user.click(closeBtn);

    // Drawer: Technical Traces
    const traceBtn = screen.getByRole("button", { name: "Open Technical Traces drawer" });
    await user.click(traceBtn);
    expect(
      screen.getByRole("heading", { name: /Technical Traces & Audit Spine/i }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Close" }));

    // Drawer: Guardrails
    const guardrailsBtn = screen.getByRole("button", { name: "Open Guardrails drawer" });
    await user.click(guardrailsBtn);
    expect(
      screen.getByRole("heading", { name: /Operator Guardrails & Policy Ceilings/i }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Close" }));

    // Drawer: Readiness
    const readinessBtn = screen.getByRole("button", { name: "Open Readiness drawer" });
    await user.click(readinessBtn);
    expect(
      screen.getByRole("heading", { name: /System & Memory Store Readiness/i }),
    ).toBeInTheDocument();

    // Close drawer via Escape key
    await user.keyboard("{Escape}");
    expect(
      screen.queryByRole("heading", { name: /System & Memory Store Readiness/i }),
    ).not.toBeInTheDocument();
  });

  it("extracts dynamic recommendation, quoted price, and approval status from timeline entries", () => {
    const entries = [
      {
        eventId: "e1",
        runId: "r1",
        sequence: 1,
        type: "decision.made",
        eventTime: "2026-09-09T10:00:00Z",
        summary: "Decision made",
        stage: "DECIDE" as const,
        support: "SUPPORTED" as const,
        data: {
          counterparty_key: "virtuals:agent:custom-research",
          chosen: "virtuals:agent:custom-research",
          reasons: ["Top deliverable accuracy in prior benchmarks."],
        },
      },
      {
        eventId: "e2",
        runId: "r1",
        sequence: 2,
        type: "approval.requested",
        eventTime: "2026-09-09T10:01:00Z",
        summary: "Approval requested",
        stage: "DECIDE" as const,
        support: "SUPPORTED" as const,
        data: {
          amount_usdc: "14.500000",
        },
      },
      {
        eventId: "e3",
        runId: "r1",
        sequence: 3,
        type: "approval.granted",
        eventTime: "2026-09-09T10:02:00Z",
        summary: "Approval granted",
        stage: "FUND" as const,
        support: "SUPPORTED" as const,
        data: {},
      },
    ];

    render(
      <StreamlinedDecisionCard
        objective="Custom Intelligence Report"
        budgetUsdc="20.00"
        entries={entries}
      />,
    );

    expect(
      screen.getAllByText(/virtuals:agent:custom-research/i).length,
    ).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("14.50 USDC")).toBeInTheDocument();
    expect(screen.getByText(/Top deliverable accuracy in prior benchmarks/i)).toBeInTheDocument();
    expect(screen.getByText("Provider Approved & Ready")).toBeInTheDocument();
  });

  it("safely formats non-numeric or missing budgetUsdc", () => {
    render(<StreamlinedDecisionCard budgetUsdc={null} />);
    expect(screen.getByText("15.00 USDC")).toBeInTheDocument();
  });

  it("renders 'What breaks when memory is deleted?' milestone section with Causal Outcome Matrix and 3-line walkthrough", () => {
    render(<StreamlinedDecisionCard />);

    expect(screen.getByText("Hackathon PMF Milestone")).toBeInTheDocument();
    expect(screen.getByText("What breaks when memory is deleted?")).toBeInTheDocument();
    expect(screen.getByText("Condition A: With Sibyl Memory")).toBeInTheDocument();
    expect(screen.getByText("Condition B: Memory Deleted (Amnesia)")).toBeInTheDocument();
    expect(screen.getByText(/Memory Walkthrough \(Judges score 40% from this\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Counterparty Bayesian reputation parameters/i)).toBeInTheDocument();
    expect(screen.getByText(/Cold-booted OS process starts with blank V8 heap/i)).toBeInTheDocument();
    expect(screen.getByText(/Flips selection from price-only Alpha/i)).toBeInTheDocument();
    expect(screen.getByText("✓ recall")).toBeInTheDocument();
    expect(screen.getByText("✓ reflection")).toBeInTheDocument();
  });

  it("supports interactive controlled memory ablation simulation, flipping recommendation to Alpha on price and showing verifier failure", async () => {
    const user = userEvent.setup();
    render(<StreamlinedDecisionCard />);

    // Initially with memory: Beta is recommended
    expect(screen.getByText("Recommended Provider")).toBeInTheDocument();
    expect(screen.getAllByText(/Beta Research/i).length).toBeGreaterThanOrEqual(1);

    // Click Simulate Memory Deletion
    const toggleBtn = screen.getByTestId("toggle-ablation-btn");
    await user.click(toggleBtn);

    // Banner and amnesic state active
    expect(screen.getByTestId("controlled-ablation-banner")).toBeInTheDocument();
    expect(screen.getByText("Amnesic Provider Selection")).toBeInTheDocument();
    expect(screen.getAllByText(/Alpha Research/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("9.00 USDC").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Deliverable schema validation failed — 3 competitors missing required source citation URLs/i)).toBeInTheDocument();
    expect(screen.getByText("Blocked: Amnesic Rejection")).toBeInTheDocument();

    // Click Restore Sibyl Memory
    await user.click(screen.getAllByRole("button", { name: /Restore Sibyl Memory/i })[0]!);
    expect(screen.queryByTestId("controlled-ablation-banner")).not.toBeInTheDocument();
    expect(screen.getByText("Recommended Provider")).toBeInTheDocument();
    expect(screen.getAllByText(/Beta Research/i).length).toBeGreaterThanOrEqual(1);
  });

  it("passes accessibility checks with no axe violations", async () => {
    const { container } = render(<StreamlinedDecisionCard />);
    await expectNoAxeViolations(container);
  });
});

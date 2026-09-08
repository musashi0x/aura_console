import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { TimelineEntry } from "@/features/console/model/types";
import type { Counterfactual } from "@/features/console/projection/counterfactual";

const api = vi.hoisted(() => ({
  approve: vi.fn(async () => ({ ok: true as const, data: { event: { event_id: "e", type: "approval.granted", sequence: 5 } } })),
  reject: vi.fn(async () => ({ ok: true as const, data: { event: { event_id: "e", type: "approval.rejected", sequence: 5 } } })),
  authorizeAcpFund: vi.fn(async () => ({
    ok: true as const,
    data: {
      authorization: {
        eventId: "auth-1",
        runId: "run-1",
        type: "acp.fund.authorized",
        sequence: 5,
        chainId: 84532,
        jobId: "42",
      },
    },
  })),
}));

vi.mock("@/lib/api-client", () => ({
  apiClient: {
    approveRun: api.approve,
    rejectRun: api.reject,
    authorizeAcpFund: api.authorizeAcpFund,
  },
}));

const { ApprovalRequestCard } = await import("./approval-request-card");

/**
 * The only control in the console that authorizes a spend.
 *
 * Every test here is a way "money is never ambient" could be lost: approving
 * without a click, without a ceiling, on example data, or without the operator
 * being able to tell whether it worked.
 */

function requested(data: Record<string, unknown>): TimelineEntry {
  return {
    eventId: "evt_1",
    sequence: 4,
    type: "approval.requested",
    eventTime: "2026-09-07T00:00:00.000Z",
    stage: null,
    support: "SUPPORTED",
    summary: "Funding the job needs an operator decision",
    data,
  };
}

const PENDING = requested({
  action: "Fund the research job at 12.000000 USDC",
  counterparty_key: "virtuals:agent:beta",
  ceiling_usdc: "25.000000",
});

const CHANGED: Counterfactual = {
  status: "DECISION_CHANGED",
  withMemory: [
    { key: "virtuals:agent:beta", score: 92 },
    { key: "virtuals:agent:gamma", score: 85 },
  ],
  withoutMemory: [
    { key: "virtuals:agent:gamma", score: 85 },
    { key: "virtuals:agent:beta", score: 82 },
  ],
  explanation: "Beta ranked higher due to historical reliability.",
};

beforeEach(() => {
  api.approve.mockClear();
  api.reject.mockClear();
  api.authorizeAcpFund.mockClear();
});

describe("the approval control", () => {
  it("names what the click will authorize before it is pressed", async () => {
    render(<ApprovalRequestCard entry={PENDING} runId="run-1" />);
    expect(screen.getByText("Fund the research job at 12.000000 USDC")).toBeInTheDocument();
    expect(screen.getByText("virtuals:agent:beta")).toBeInTheDocument();
    expect(screen.getByText("25.000000")).toBeInTheDocument();
  });

  it("authorizes nothing until the operator clicks", () => {
    // Rendering is not consent. Nothing on a render path may approve.
    render(<ApprovalRequestCard entry={PENDING} runId="run-1" />);
    expect(api.approve).not.toHaveBeenCalled();
    expect(api.reject).not.toHaveBeenCalled();
  });

  it("sends the ceiling the request recorded, not one it invented", async () => {
    const onApproved = vi.fn();
    render(<ApprovalRequestCard entry={PENDING} runId="run-1" onApproved={onApproved} />);
    await userEvent.click(screen.getByRole("button", { name: /^approve/i }));

    expect(api.approve).toHaveBeenCalledTimes(1);
    expect(api.approve).toHaveBeenCalledWith("run-1", "25.000000");
    expect(onApproved).toHaveBeenCalled();
  });

  it("offers no control on example data, which has no Run to authorize", async () => {
    // Labelling a fixture is not enough when the control would act.
    render(<ApprovalRequestCard entry={PENDING} />);
    expect(screen.queryByRole("button", { name: /^approve/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^reject/i })).not.toBeInTheDocument();
  });

  it("offers no control when the request carries no ceiling", async () => {
    // Approving to an unknown limit is a blank cheque.
    render(<ApprovalRequestCard entry={requested({ action: "Fund the job" })} runId="run-1" />);
    expect(screen.queryByRole("button", { name: /^approve/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^reject/i })).not.toBeInTheDocument();
    expect(screen.getByText(/nothing to approve against/i)).toBeInTheDocument();
  });

  it("says nothing was authorized when the approval fails", async () => {
    // The dangerous failure is the ambiguous one, where the operator cannot
    // tell whether their click landed.
    api.approve.mockResolvedValueOnce({
      ok: false as const,
      error: { code: "already_approved", message: "no" },
    } as never);
    const onApproved = vi.fn();
    render(<ApprovalRequestCard entry={PENDING} runId="run-1" onApproved={onApproved} />);
    await userEvent.click(screen.getByRole("button", { name: /^approve/i }));

    expect(screen.getByText(/was not recorded, so nothing was authorized/i)).toBeInTheDocument();
    expect(onApproved).not.toHaveBeenCalled();
  });

  it("rejects run on operator click and invokes onRejected", async () => {
    const onRejected = vi.fn();
    render(<ApprovalRequestCard entry={PENDING} runId="run-1" onRejected={onRejected} />);
    await userEvent.click(screen.getByRole("button", { name: /^reject/i }));

    expect(api.reject).toHaveBeenCalledTimes(1);
    expect(api.reject).toHaveBeenCalledWith("run-1");
    expect(onRejected).toHaveBeenCalledTimes(1);
  });

  it("falls back to onApproved if onRejected is omitted", async () => {
    const onApproved = vi.fn();
    render(<ApprovalRequestCard entry={PENDING} runId="run-1" onApproved={onApproved} />);
    await userEvent.click(screen.getByRole("button", { name: /^reject/i }));

    expect(api.reject).toHaveBeenCalledTimes(1);
    expect(onApproved).toHaveBeenCalledTimes(1);
  });

  it("reports failure when rejection fails", async () => {
    api.reject.mockResolvedValueOnce({
      ok: false as const,
      error: { code: "already_resolved", message: "cannot reject" },
    } as never);
    const onRejected = vi.fn();
    render(<ApprovalRequestCard entry={PENDING} runId="run-1" onRejected={onRejected} />);
    await userEvent.click(screen.getByRole("button", { name: /^reject/i }));

    expect(screen.getByText(/The rejection was not recorded/i)).toBeInTheDocument();
    expect(onRejected).not.toHaveBeenCalled();
  });

  it("falls back from action to reason, then to summary", () => {
    const withReason = requested({
      reason: "Proposed contract draft",
      ceiling_usdc: "10.000000",
    });
    const { unmount } = render(<ApprovalRequestCard entry={withReason} runId="run-1" />);
    expect(screen.getByText("Proposed contract draft")).toBeInTheDocument();
    unmount();

    const withSummary = requested({
      summary: "Proposal summary fallback",
      amount_usdc: "15.000000",
    });
    render(<ApprovalRequestCard entry={withSummary} runId="run-1" />);
    expect(screen.getByText("Proposal summary fallback")).toBeInTheDocument();
    expect(screen.getByText("15.000000")).toBeInTheDocument();
  });

  it("renders counterfactual view when counterfactual prop is provided", () => {
    render(<ApprovalRequestCard entry={PENDING} runId="run-1" counterfactual={CHANGED} />);
    expect(screen.getByRole("button", { name: /compare without memory/i })).toBeInTheDocument();
  });

  it("renders inline counterfactual rationale when present in event data", () => {
    const withRationale = requested({
      action: "Spend with beta",
      ceiling_usdc: "20.000000",
      counterfactual_rationale: "Sibyl memory checked: Beta Labs has 96% reliability.",
    });
    render(<ApprovalRequestCard entry={withRationale} runId="run-1" />);
    expect(screen.getByText("Sibyl memory checked: Beta Labs has 96% reliability.")).toBeInTheDocument();
  });

  it("routes approval to authorizeAcpFund when run environment is base-sepolia", async () => {
    const onApproved = vi.fn();
    render(
      <ApprovalRequestCard
        entry={PENDING}
        runId="run-1"
        environment="base-sepolia"
        onApproved={onApproved}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /^approve/i }));

    expect(api.authorizeAcpFund).toHaveBeenCalledTimes(1);
    expect(api.authorizeAcpFund).toHaveBeenCalledWith("run-1", { amountUsdc: "25.000000" });
    expect(api.approve).not.toHaveBeenCalled();
    expect(onApproved).toHaveBeenCalled();
  });

  it("falls back to approveRun if authorizeAcpFund returns not_an_acp_run", async () => {
    api.authorizeAcpFund.mockResolvedValueOnce({
      ok: false as const,
      error: { code: "not_an_acp_run", message: "Not an ACP run" },
    } as never);
    const onApproved = vi.fn();
    render(
      <ApprovalRequestCard
        entry={PENDING}
        runId="run-1"
        environment="base-sepolia"
        onApproved={onApproved}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /^approve/i }));

    expect(api.authorizeAcpFund).toHaveBeenCalledTimes(1);
    expect(api.approve).toHaveBeenCalledTimes(1);
    expect(api.approve).toHaveBeenCalledWith("run-1", "25.000000");
    expect(onApproved).toHaveBeenCalled();
  });
});


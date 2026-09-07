import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { TimelineEntry } from "@/features/console/model/types";

const api = vi.hoisted(() => ({
  approve: vi.fn(async () => ({ ok: true as const, data: { event: { event_id: "e", type: "approval.granted", sequence: 5 } } })),
}));

vi.mock("@/lib/api-client", () => ({ apiClient: { approveRun: api.approve } }));

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

beforeEach(() => {
  api.approve.mockClear();
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
  });

  it("sends the ceiling the request recorded, not one it invented", async () => {
    const onApproved = vi.fn();
    render(<ApprovalRequestCard entry={PENDING} runId="run-1" onApproved={onApproved} />);
    await userEvent.click(screen.getByRole("button", { name: /approve/i }));

    expect(api.approve).toHaveBeenCalledTimes(1);
    expect(api.approve).toHaveBeenCalledWith("run-1", "25.000000");
    expect(onApproved).toHaveBeenCalled();
  });

  it("offers no control on example data, which has no Run to authorize", async () => {
    // Labelling a fixture is not enough when the control would act.
    render(<ApprovalRequestCard entry={PENDING} />);
    expect(screen.queryByRole("button", { name: /approve/i })).not.toBeInTheDocument();
  });

  it("offers no control when the request carries no ceiling", async () => {
    // Approving to an unknown limit is a blank cheque.
    render(<ApprovalRequestCard entry={requested({ action: "Fund the job" })} runId="run-1" />);
    expect(screen.queryByRole("button", { name: /approve/i })).not.toBeInTheDocument();
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
    await userEvent.click(screen.getByRole("button", { name: /approve/i }));

    expect(screen.getByText(/was not recorded, so nothing was authorized/i)).toBeInTheDocument();
    expect(onApproved).not.toHaveBeenCalled();
  });
});

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "@/lib/api-client";
import { ChatApprovalCard } from "./chat-approval-card";

vi.mock("@/lib/api-client", () => ({
  apiClient: {
    approveRun: vi.fn(),
  },
}));

describe("ChatApprovalCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders counterparty, amount USDC, rationale, and Approve Spend button", () => {
    render(
      <ChatApprovalCard
        counterpartyKey="virtuals:agent:beta"
        amountUsdc="10.000000"
        rationale="Engage Beta Labs under 10 USDC ceiling"
        runId="run_test_123"
      />,
    );

    expect(screen.getByText("Proposed Spend Approval")).toBeInTheDocument();
    expect(screen.getByText("virtuals:agent:beta")).toBeInTheDocument();
    expect(screen.getByText("$10.00 USDC")).toBeInTheDocument();
    expect(screen.getByText("Engage Beta Labs under 10 USDC ceiling")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /approve spend/i })).toBeInTheDocument();
  });

  it("calls apiClient.approveRun on Approve Spend click and updates state to approved", async () => {
    const user = userEvent.setup();
    const onApproved = vi.fn();
    vi.mocked(apiClient.approveRun).mockResolvedValueOnce({
      ok: true,
      data: {
        event: { event_id: "evt_1", type: "approval.granted", sequence: 3 },
      },
    });

    render(
      <ChatApprovalCard
        counterpartyKey="virtuals:agent:beta"
        amountUsdc="10.000000"
        rationale="Authorize contract execution"
        runId="run_test_123"
        onApproved={onApproved}
      />,
    );

    const approveButton = screen.getByRole("button", { name: /approve spend/i });
    await user.click(approveButton);

    await waitFor(() => {
      expect(apiClient.approveRun).toHaveBeenCalledWith("run_test_123", "10.000000");
    });

    expect(onApproved).toHaveBeenCalledOnce();
    expect(screen.getByText("Spend Approved")).toBeInTheDocument();
    expect(screen.getByText(/Spend of \$10\.00 USDC approved by operator\./i)).toBeInTheDocument();
  });

  it("handles approval failure gracefully with error message", async () => {
    const user = userEvent.setup();
    vi.mocked(apiClient.approveRun).mockResolvedValueOnce({
      ok: false,
      error: {
        code: "already_approved",
        message: "This request was already approved.",
      },
    });

    render(
      <ChatApprovalCard
        counterpartyKey="virtuals:agent:alpha"
        amountUsdc="15.000000"
        rationale="Already evaluated spend"
        runId="run_fail_456"
      />,
    );

    const approveButton = screen.getByRole("button", { name: /approve spend/i });
    await user.click(approveButton);

    await waitFor(() => {
      expect(screen.getByText("Approval Failed")).toBeInTheDocument();
      expect(screen.getByText("This request was already approved.")).toBeInTheDocument();
    });
  });

  it("disables approve button when runId is not provided", () => {
    render(
      <ChatApprovalCard
        counterpartyKey="virtuals:agent:beta"
        amountUsdc="20.000000"
        rationale="No run ID provided"
      />,
    );

    const button = screen.getByRole("button", { name: /approve spend/i });
    expect(button).toBeDisabled();
    expect(screen.getByText("Run context required")).toBeInTheDocument();
  });
});

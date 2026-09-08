import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { expectNoAxeViolations } from "@/test-support/axe";
import { console_ } from "@/features/console/copy";
import type { TimelineEntry } from "@/features/console/model/types";
import { stageFor } from "@/features/console/projection/stage-map";

const api = vi.hoisted(() => ({
  approve: vi.fn(async () => ({
    ok: true as const,
    data: { event: { event_id: "e", type: "approval.granted", sequence: 5 } },
  })),
  reject: vi.fn(async () => ({
    ok: true as const,
    data: { event: { event_id: "e", type: "approval.rejected", sequence: 5 } },
  })),
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
  evaluateAcpJob: vi.fn(async () => ({
    ok: true as const,
    data: {
      runId: "run-1",
      jobId: "42",
      action: "complete" as const,
      reason: "verified",
    },
  })),
}));

vi.mock("@/lib/api-client", () => ({
  apiClient: {
    approveRun: api.approve,
    rejectRun: api.reject,
    authorizeAcpFund: api.authorizeAcpFund,
    evaluateAcpJob: api.evaluateAcpJob,
  },
}));

const { EventCard } = await import("./cards/event-card");
const { ApprovalRequestCard } = await import("./cards/approval-request-card");

function makeEntry(type: string, data?: Record<string, unknown>): TimelineEntry {
  return {
    eventId: `evt_${Date.now()}_${Math.random()}`,
    sequence: 1,
    type,
    eventTime: "2026-09-08T16:00:00Z",
    stage: null,
    support: "SUPPORTED",
    summary: `Summary for ${type}`,
    data,
  };
}

describe("Challenger M4.2: Adversarial & Empirical Verification", () => {
  beforeEach(() => {
    api.approve.mockClear();
    api.reject.mockClear();
    api.authorizeAcpFund.mockClear();
    api.evaluateAcpJob.mockClear();
  });

  describe("1. Web Event Card & Transaction Card verification", () => {
    it("renders memory.commitment.confirmed with tone=cyan, title=Transaction, and live BaseScan links", async () => {
      const txHash = "0x4a5b6c7d8e9f0123456789abcdef4a5b6c7d8e9f0123456789abcdef4a5b";
      const commitment = "0x9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba";
      const explorerUrl = `https://sepolia.basescan.org/tx/${txHash}`;

      const { container } = render(
        <EventCard
          entry={makeEntry("memory.commitment.confirmed", {
            summary: "Salted memory commitment published and confirmed on Base Sepolia.",
            counterparty_key: "virtuals:agent:beta",
            memory_version: 3,
            network: "Base Sepolia",
            tx_hash: txHash,
            commitment,
            explorer_url: explorerUrl,
          })}
        />,
      );

      // Title must be "Transaction"
      expect(screen.getByText(console_.cards.transaction.title)).toBeInTheDocument();
      // Narrative confirmed
      expect(
        screen.getByText("Salted memory commitment published and confirmed on Base Sepolia."),
      ).toBeInTheDocument();

      // Tone token check: Token with color "cyan" and label "memory.commitment.confirmed"
      const token = screen.getByText("memory.commitment.confirmed");
      expect(token).toBeInTheDocument();
      expect(token.closest(".token, [class*='token']")).toBeTruthy();

      // Metadata rows
      expect(screen.getByText("virtuals:agent:beta")).toBeInTheDocument();
      expect(screen.getByText("v3")).toBeInTheDocument();
      expect(screen.getByText(commitment)).toBeInTheDocument();
      expect(screen.getByText("Base Sepolia")).toBeInTheDocument();

      // BaseScan live link
      const links = screen.getAllByRole("link");
      const baseScanLinks = links.filter((l) =>
        l.getAttribute("href") === `https://sepolia.basescan.org/tx/${txHash}`,
      );
      expect(baseScanLinks.length).toBeGreaterThanOrEqual(1);

      // Verify no a11y violations
      await expectNoAxeViolations(container);
    });

    it("falls back to https://sepolia.basescan.org/tx/... when explorer_url is omitted from data", async () => {
      const txHash = "0x1111222233334444555566667777888899990000aaaabbbbccccddddeeeeffff";
      render(
        <EventCard
          entry={makeEntry("memory.commitment.confirmed", {
            summary: "Fallback commitment",
            counterparty_key: "virtuals:agent:alpha",
            memory_version: 1,
            tx_hash: txHash,
          })}
        />,
      );

      const links = screen.getAllByRole("link");
      const baseScanLinks = links.filter((l) =>
        l.getAttribute("href") === `https://sepolia.basescan.org/tx/${txHash}`,
      );
      expect(baseScanLinks.length).toBeGreaterThanOrEqual(1);
    });

    it("renders acp.job.submitted with interactive Complete and Reject controls", async () => {
      const onApproved = vi.fn();
      render(
        <EventCard
          entry={makeEntry("acp.job.submitted", {
            provider: "0xProviderAlpha1234567890",
            deliverable: "Final audit report and benchmark metrics",
            deliverable_hash: "0xabcdef1234567890",
          })}
          runId="run-test-123"
          onApproved={onApproved}
        />,
      );

      expect(screen.getByText("ACP Deliverable")).toBeInTheDocument();
      expect(screen.getByText("Final audit report and benchmark metrics")).toBeInTheDocument();
      expect(screen.getByText("0xProviderAlpha1234567890")).toBeInTheDocument();

      const completeBtn = screen.getByRole("button", { name: /complete/i });
      const rejectBtn = screen.getByRole("button", { name: /reject/i });
      expect(completeBtn).toBeInTheDocument();
      expect(rejectBtn).toBeInTheDocument();

      // Test Complete click flow
      await userEvent.click(completeBtn);
      expect(api.evaluateAcpJob).toHaveBeenCalledTimes(1);
      expect(api.evaluateAcpJob).toHaveBeenCalledWith("run-test-123", {
        action: "complete",
        reason: "Deliverable verified against criteria and accepted by operator.",
      });
      expect(onApproved).toHaveBeenCalledTimes(1);
    });

    it("executes Reject click flow on acp.job.submitted", async () => {
      const onApproved = vi.fn();
      render(
        <EventCard
          entry={makeEntry("acp.job.submitted", {
            provider: "0xProviderAlpha1234567890",
            deliverable: "Defective output",
            deliverable_hash: "0x0000001234567890",
          })}
          runId="run-test-456"
          onApproved={onApproved}
        />,
      );

      const rejectBtn = screen.getByRole("button", { name: /reject/i });
      await userEvent.click(rejectBtn);

      expect(api.evaluateAcpJob).toHaveBeenCalledTimes(1);
      expect(api.evaluateAcpJob).toHaveBeenCalledWith("run-test-456", {
        action: "reject",
        reason: "Deliverable rejected by operator: failed verification standards.",
      });
      expect(onApproved).toHaveBeenCalledTimes(1);
    });

    it("displays error banner and suppresses onApproved when acp.job.submitted evaluation fails", async () => {
      api.evaluateAcpJob.mockResolvedValueOnce({
        ok: false as const,
        error: { code: "job_closed", message: "Job already closed" },
      } as never);

      const onApproved = vi.fn();
      render(
        <EventCard
          entry={makeEntry("acp.job.submitted", {
            provider: "0xProviderAlpha1234567890",
            deliverable: "Late report",
          })}
          runId="run-test-789"
          onApproved={onApproved}
        />,
      );

      const completeBtn = screen.getByRole("button", { name: /complete/i });
      await userEvent.click(completeBtn);

      expect(api.evaluateAcpJob).toHaveBeenCalledTimes(1);
      expect(onApproved).not.toHaveBeenCalled();
      expect(screen.getByText("Evaluation failed to record.")).toBeInTheDocument();
    });

    it("omits interactive controls in fixture mode when runId is undefined", () => {
      render(
        <EventCard
          entry={makeEntry("acp.job.submitted", {
            provider: "0xProviderAlpha1234567890",
            deliverable: "Fixture deliverable",
          })}
        />,
      );

      expect(screen.getByText("ACP Deliverable")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /complete/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /reject/i })).not.toBeInTheDocument();
    });
  });

  describe("2. Spend Approval on Base Sepolia routing", () => {
    const PENDING_APPROVAL = makeEntry("approval.requested", {
      action: "Authorize ACP spend",
      counterparty_key: "virtuals:agent:beta",
      ceiling_usdc: "50.000000",
    });

    it("routes to authorizeAcpFund when environment='base-sepolia'", async () => {
      const onApproved = vi.fn();
      render(
        <ApprovalRequestCard
          entry={PENDING_APPROVAL}
          runId="run-base-1"
          environment="base-sepolia"
          onApproved={onApproved}
        />,
      );

      await userEvent.click(screen.getByRole("button", { name: /^approve/i }));

      expect(api.authorizeAcpFund).toHaveBeenCalledTimes(1);
      expect(api.authorizeAcpFund).toHaveBeenCalledWith("run-base-1", {
        amountUsdc: "50.000000",
      });
      expect(api.approve).not.toHaveBeenCalled();
      expect(onApproved).toHaveBeenCalledTimes(1);
    });

    it("routes to authorizeAcpFund when environment='Base Sepolia'", async () => {
      const onApproved = vi.fn();
      render(
        <ApprovalRequestCard
          entry={PENDING_APPROVAL}
          runId="run-base-2"
          environment="Base Sepolia"
          onApproved={onApproved}
        />,
      );

      await userEvent.click(screen.getByRole("button", { name: /^approve/i }));

      expect(api.authorizeAcpFund).toHaveBeenCalledTimes(1);
      expect(api.authorizeAcpFund).toHaveBeenCalledWith("run-base-2", {
        amountUsdc: "50.000000",
      });
      expect(api.approve).not.toHaveBeenCalled();
    });

    it("routes to authorizeAcpFund when entry.type is acp.budget.set", async () => {
      const budgetEntry = makeEntry("acp.budget.set", {
        action: "Set budget ceiling",
        amount_usdc: "30.000000",
      });

      render(<ApprovalRequestCard entry={budgetEntry} runId="run-acp-budget" />);

      await userEvent.click(screen.getByRole("button", { name: /^approve/i }));

      expect(api.authorizeAcpFund).toHaveBeenCalledTimes(1);
      expect(api.authorizeAcpFund).toHaveBeenCalledWith("run-acp-budget", {
        amountUsdc: "30.000000",
      });
      expect(api.approve).not.toHaveBeenCalled();
    });

    it("routes to authorizeAcpFund when chain_id is 84532 in entry data", async () => {
      const chainEntry = makeEntry("approval.requested", {
        action: "Fund job on Base Sepolia",
        ceiling_usdc: "15.000000",
        chain_id: 84532,
      });

      render(<ApprovalRequestCard entry={chainEntry} runId="run-chain-id" />);

      await userEvent.click(screen.getByRole("button", { name: /^approve/i }));

      expect(api.authorizeAcpFund).toHaveBeenCalledTimes(1);
      expect(api.authorizeAcpFund).toHaveBeenCalledWith("run-chain-id", {
        amountUsdc: "15.000000",
      });
      expect(api.approve).not.toHaveBeenCalled();
    });

    it("falls back to approveRun when authorizeAcpFund returns not_found", async () => {
      api.authorizeAcpFund.mockResolvedValueOnce({
        ok: false as const,
        error: { code: "not_found", message: "Run has no associated ACP job" },
      } as never);

      const onApproved = vi.fn();
      render(
        <ApprovalRequestCard
          entry={PENDING_APPROVAL}
          runId="run-fallback-not-found"
          environment="base-sepolia"
          onApproved={onApproved}
        />,
      );

      await userEvent.click(screen.getByRole("button", { name: /^approve/i }));

      expect(api.authorizeAcpFund).toHaveBeenCalledTimes(1);
      expect(api.approve).toHaveBeenCalledTimes(1);
      expect(api.approve).toHaveBeenCalledWith("run-fallback-not-found", "50.000000");
      expect(onApproved).toHaveBeenCalledTimes(1);
    });

    it("does NOT fall back to approveRun on non-recoverable error (e.g. insufficient balance)", async () => {
      api.authorizeAcpFund.mockResolvedValueOnce({
        ok: false as const,
        error: { code: "insufficient_balance", message: "Wallet lacks USDC" },
      } as never);

      const onApproved = vi.fn();
      render(
        <ApprovalRequestCard
          entry={PENDING_APPROVAL}
          runId="run-error-no-fallback"
          environment="base-sepolia"
          onApproved={onApproved}
        />,
      );

      await userEvent.click(screen.getByRole("button", { name: /^approve/i }));

      expect(api.authorizeAcpFund).toHaveBeenCalledTimes(1);
      expect(api.approve).not.toHaveBeenCalled();
      expect(onApproved).not.toHaveBeenCalled();
      expect(
        screen.getByText(/was not recorded, so nothing was authorized/i),
      ).toBeInTheDocument();
    });

    it("routes directly to approveRun when environment is non-Base Sepolia (e.g. mainnet)", async () => {
      const onApproved = vi.fn();
      render(
        <ApprovalRequestCard
          entry={PENDING_APPROVAL}
          runId="run-mainnet"
          environment="mainnet"
          onApproved={onApproved}
        />,
      );

      await userEvent.click(screen.getByRole("button", { name: /^approve/i }));

      expect(api.approve).toHaveBeenCalledTimes(1);
      expect(api.approve).toHaveBeenCalledWith("run-mainnet", "50.000000");
      expect(api.authorizeAcpFund).not.toHaveBeenCalled();
      expect(onApproved).toHaveBeenCalledTimes(1);
    });
  });

  describe("3. Canonical stage projections", () => {
    it("maps memory.commitment.confirmed and submitted to LEARN", () => {
      expect(stageFor("memory.commitment.confirmed")).toBe("LEARN");
      expect(stageFor("memory.commitment.submitted")).toBe("LEARN");
    });

    it("maps acp.job.submitted to DELIVER and acp.job.linked to COMMIT", () => {
      expect(stageFor("acp.job.submitted")).toBe("DELIVER");
      expect(stageFor("acp.job.linked")).toBe("COMMIT");
    });
  });
});

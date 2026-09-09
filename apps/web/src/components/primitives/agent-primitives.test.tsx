import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { expectNoAxeViolations } from "@/test-support/axe";
import {
  ThinkingState,
  StreamingText,
  ToolChips,
  ApprovalCard,
  DiffTable,
  RecordsTable,
  PromptBar,
  SoundToggle,
  playInteractionSound,
  isSoundEnabled,
  setSoundEnabled,
} from "./index";

describe("ThinkingState", () => {
  it("renders accordion header and toggles expansion", () => {
    render(<ThinkingState thought={"Step 1: Analyzed token expiry.\nStep 2: Formulated fix."} />);
    expect(screen.getByText("Thought process")).toBeInTheDocument();

    const button = screen.getByRole("button", { name: /Thought process/i });
    expect(button).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(/Step 1: Analyzed token expiry/i)).toBeInTheDocument();

    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "false");
  });

  it("renders duration counter when durationSeconds is provided", () => {
    render(<ThinkingState durationSeconds={4} />);
    expect(screen.getByText("Thought for 4 seconds")).toBeInTheDocument();
  });

  it("renders live streaming indicator when isStreaming is true", () => {
    render(<ThinkingState isStreaming={true} />);
    expect(screen.getByText(/Reasoning in progress/i)).toBeInTheDocument();
  });

  it("renders stages like Coding with tool calls", () => {
    render(<ThinkingState variant="Coding" defaultExpanded={true} />);
    expect(screen.getByText("memory_recall_counterparty")).toBeInTheDocument();
    expect(screen.getByText("policy_check_limit")).toBeInTheDocument();
  });
});

describe("StreamingText", () => {
  it("renders progressive text and animated streaming caret when isStreaming is true", () => {
    const { container } = render(
      <StreamingText text="Generating answer..." isStreaming={true} />
    );
    expect(screen.getByText("Generating answer...")).toBeInTheDocument();
    const caret = container.querySelector(".stream-caret.is-streaming");
    expect(caret).toBeInTheDocument();
  });

  it("renders action buttons (copy, retry, thumbs, sources)", () => {
    render(<StreamingText text="Completed answer." isStreaming={false} />);
    expect(screen.getByRole("button", { name: "Copy text" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry response" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Helpful" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Unhelpful" })).toBeInTheDocument();
  });

  it("handles copy action to clipboard", async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    render(<StreamingText text="Copyable response" isStreaming={false} />);
    const copyBtn = screen.getByRole("button", { name: "Copy text" });
    fireEvent.click(copyBtn);

    expect(writeTextMock).toHaveBeenCalledWith("Copyable response");
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Copied" })).toBeInTheDocument();
    });
  });

  it("renders follow-up prompts and triggers onFollowUp callback", () => {
    const onFollowUp = vi.fn();
    render(
      <StreamingText
        text="Response text"
        isStreaming={false}
        followUps={["Explain reasoning"]}
        onFollowUp={onFollowUp}
      />
    );

    const followUpBtn = screen.getByText("Explain reasoning");
    fireEvent.click(followUpBtn);
    expect(onFollowUp).toHaveBeenCalledWith("Explain reasoning", 0);
  });
});

describe("ToolChips", () => {
  it("renders invocation count and expands inspection details", () => {
    const calls = [
      {
        name: "memory_recall_counterparty",
        args: { counterpartyKey: "virtuals:agent:beta" },
        result: { status: "AVAILABLE" },
      },
    ];

    render(<ToolChips calls={calls} defaultExpanded={true} isComplete={true} />);
    expect(screen.getByText("1 tool invocation")).toBeInTheDocument();
    expect(screen.getByText("Done")).toBeInTheDocument();
    expect(screen.getByText("memory_recall_counterparty")).toBeInTheDocument();

    // Expand single tool row
    const rowButton = screen.getByRole("button", { name: /memory_recall_counterparty/i });
    fireEvent.click(rowButton);
    expect(screen.getByText("Arguments:")).toBeInTheDocument();
    expect(screen.getByText("Result:")).toBeInTheDocument();
  });
});

describe("ApprovalCard", () => {
  it("renders authorization card with amount, counterparty, and counterfactual rationale", () => {
    render(
      <ApprovalCard
        amountUsdc="10.00"
        counterpartyKey="virtuals:agent:beta"
        reason="Draft exploratory engagement"
      />
    );

    expect(screen.getByText("$10.00 USDC")).toBeInTheDocument();
    expect(screen.getAllByText("virtuals:agent:beta").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Draft exploratory engagement")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Approve Spend/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Reject Proposal/i })).toBeInTheDocument();
  });

  it("handles approve action callback", async () => {
    const onApprove = vi.fn().mockResolvedValue(undefined);
    render(<ApprovalCard onApprove={onApprove} />);

    const approveBtn = screen.getByRole("button", { name: /Approve Spend/i });
    fireEvent.click(approveBtn);

    await waitFor(() => {
      expect(onApprove).toHaveBeenCalled();
      expect(screen.getByText(/Approved & Authorized/i)).toBeInTheDocument();
    });
  });

  it("handles reject action callback", async () => {
    const onReject = vi.fn().mockResolvedValue(undefined);
    render(<ApprovalCard onReject={onReject} />);

    const rejectBtn = screen.getByRole("button", { name: /Reject Proposal/i });
    fireEvent.click(rejectBtn);

    await waitFor(() => {
      expect(onReject).toHaveBeenCalled();
      expect(screen.getByText(/Rejected by Operator/i)).toBeInTheDocument();
    });
  });

  it("renders wallet blur gate overlay when requireWallet is true and wallet is disconnected", () => {
    render(<ApprovalCard requireWallet={true} />);

    expect(screen.getByTestId("wallet-gate-overlay")).toBeInTheDocument();
    expect(screen.getByText("Operator Wallet Required")).toBeInTheDocument();
    expect(screen.getByText("Connect Web3 wallet to authorize spend")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Connect Wallet/i })).toBeInTheDocument();

    // Verify action buttons are disabled while wallet is blocked
    const approveBtn = screen.getByRole("button", { name: /Approve Spend/i });
    expect(approveBtn).toBeDisabled();
    const rejectBtn = screen.getByRole("button", { name: /Reject Proposal/i });
    expect(rejectBtn).toBeDisabled();
  });
});

describe("DiffTable", () => {
  it("renders memory diff rows and allows row selection toggles", () => {
    render(<DiffTable />);
    expect(screen.getByText("Beta Labs Reliability")).toBeInTheDocument();
    expect(screen.getByText("0.78 (12 tasks)")).toBeInTheDocument();
    expect(screen.getByText("0.84 (14 tasks)")).toBeInTheDocument();

    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes.length).toBeGreaterThanOrEqual(4);
    const firstCheckbox = checkboxes[0];
    expect(firstCheckbox).toBeDefined();
    if (firstCheckbox) {
      fireEvent.click(firstCheckbox);
      expect(firstCheckbox).toHaveAttribute("aria-checked", "false");
    }
  });

  it("calls onApply with only selected keys and updates to applied state", async () => {
    const onApply = vi.fn();
    render(<DiffTable onApply={onApply} />);

    // Toggle off the first checkbox
    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[0]!);
    expect(checkboxes[0]).toHaveAttribute("aria-checked", "false");

    // Click apply
    const applyBtn = screen.getByRole("button", { name: /Apply 3 Diffs/i });
    fireEvent.click(applyBtn);

    expect(onApply).toHaveBeenCalledWith(["status", "commitment", "spend_limit"]);
  });

  it("resets user selection when rows prop changes", () => {
    const { rerender } = render(<DiffTable />);
    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[0]!);
    expect(checkboxes[0]).toHaveAttribute("aria-checked", "false");

    // Pass new rows
    const newRows = [
      {
        key: "new_key",
        field: "New Field",
        previousValue: "1",
        newValue: "2",
        status: "modified" as const,
      },
    ];
    rerender(<DiffTable rows={newRows} />);

    const newCheckboxes = screen.getAllByRole("checkbox");
    expect(newCheckboxes).toHaveLength(1);
    expect(newCheckboxes[0]).toHaveAttribute("aria-checked", "true");
  });
});

describe("RecordsTable", () => {
  it("renders records table with search filter and sorting", () => {
    render(<RecordsTable />);
    expect(screen.getByText("Alpha Studio (Agent)")).toBeInTheDocument();
    expect(screen.getByText("Beta Labs (Agent)")).toBeInTheDocument();

    // Filter by search
    const searchInput = screen.getByPlaceholderText("Search counterparties...");
    fireEvent.change(searchInput, { target: { value: "Gamma" } });
    expect(screen.getByText("Gamma Research")).toBeInTheDocument();
    expect(screen.queryByText("Alpha Studio (Agent)")).not.toBeInTheDocument();
  });
});

describe("PromptBar", () => {
  it("renders prompt bar and handles submission", () => {
    const onSubmit = vi.fn();
    render(<PromptBar onSubmit={onSubmit} />);

    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "Test prompt message" } });
    expect(textarea).toHaveValue("Test prompt message");

    const sendBtn = screen.getByRole("button", { name: "Send message" });
    fireEvent.click(sendBtn);

    expect(onSubmit).toHaveBeenCalledWith("Test prompt message");
  });

  it("allows selecting suggestion pill", () => {
    render(<PromptBar />);

    const pill = screen.getByRole("button", { name: /Why hire Beta Labs\?/i });
    fireEvent.click(pill);
    const textarea = screen.getByRole("textbox");
    expect(textarea).toHaveValue(
      "Why should we hire Beta Labs and what would it cost to draft a 10 USDC spend?"
    );
  });
});

describe("InteractionSounds & SoundToggle", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("persists sound preferences to localStorage", () => {
    expect(isSoundEnabled()).toBe(true);
    setSoundEnabled(false);
    expect(localStorage.getItem("bui-sounds")).toBe("off");
    expect(isSoundEnabled()).toBe(false);
    setSoundEnabled(true);
    expect(localStorage.getItem("bui-sounds")).toBe("on");
    expect(isSoundEnabled()).toBe(true);
  });

  it("toggles sound via SoundToggle button", () => {
    render(<SoundToggle />);
    const toggleBtn = screen.getByRole("button", { name: /Sound FX: On/i });
    expect(toggleBtn).toBeInTheDocument();

    fireEvent.click(toggleBtn);
    expect(screen.getByRole("button", { name: /Sound FX: Off/i })).toBeInTheDocument();
    expect(localStorage.getItem("bui-sounds")).toBe("off");
  });

  it("playInteractionSound executes safely without throwing", () => {
    expect(() => {
      playInteractionSound("press");
      playInteractionSound("tick");
      playInteractionSound("pulse");
      playInteractionSound("release");
      playInteractionSound("chime");
    }).not.toThrow();
  });
});

describe("Accessibility for Agent Primitives", () => {
  it("passes axe audits for agent harness components", async () => {
    const { container } = render(
      <div>
        <SoundToggle />
        <ThinkingState thought="Reasoning step" />
        <StreamingText text="Stream content" isStreaming={false} />
        <ToolChips calls={[]} isComplete={true} />
        <ApprovalCard />
        <DiffTable />
        <RecordsTable />
        <PromptBar />
      </div>
    );
    await expectNoAxeViolations(container);
  });
});

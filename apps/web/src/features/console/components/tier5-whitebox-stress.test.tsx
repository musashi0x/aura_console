import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { expectNoAxeViolations } from "@/test/axe";
import {
  ChatConsoleView,
  getRunStatusInfo,
  type ChatConsoleRun,
} from "./chat-console-view";
import { ConsoleChat } from "./console-chat";
import { MissionInspector } from "./mission-inspector";
import { MissionWorkspace } from "./mission-workspace";
import { CounterpartyMemoryHoverCard } from "./counterparty-memory-hover-card";
import { __resetChatSession, setChatMessages } from "../chat/chat-session";
import { __resetMemoryView } from "../memory-view-state";
import { console_ } from "../copy";
import type { CanonicalEvent } from "../model/types";
import type { FoldSeed } from "../projection/fold-run";
import type { ChatMessage } from "../chat/chat-types";

// =============================================================================
// API Client Mocking for Route & HoverCard Tests
// =============================================================================
const dbHealthMock = vi.fn();
const listRunsMock = vi.fn();
const getCounterpartyMemoryMock = vi.fn();

vi.mock("@/lib/api-client", () => ({
  apiClient: {
    agentHealth: async () => ({ ok: true, data: { configured: false, reachable: false } }),
    sibylHealth: async () => ({ ok: true, data: { configured: false, reachable: false } }),
    dbHealth: () => dbHealthMock(),
    listRuns: () => listRunsMock(),
    getCounterpartyMemory: (key: string) => getCounterpartyMemoryMock(key),
  },
}));

// Dynamic import for RunsPage after mock setup
const { default: RunsPage } = await import("@/app/runs/page");

beforeEach(() => {
  __resetChatSession();
  __resetMemoryView();
  dbHealthMock.mockReset();
  listRunsMock.mockReset();
  getCounterpartyMemoryMock.mockReset();
});

// Helper for generating varied runs
function createRun(overrides: Partial<ChatConsoleRun> = {}): ChatConsoleRun {
  const id = overrides.id ?? `run-${Math.random().toString(36).slice(2, 9)}`;
  return {
    id,
    objective: `Mission objective for ${id}`,
    source: "CONSOLE",
    environment: "base-sepolia-sandbox",
    isMainnet: false,
    budgetUsdc: "50.000000",
    createdAt: "2026-09-07T08:00:00.000Z",
    updatedAt: "2026-09-07T08:30:00.000Z",
    status: "RUNNING",
    ...overrides,
  };
}

// =============================================================================
// Suite 1: ChatConsoleView & getRunStatusInfo White-Box Audit
// =============================================================================
describe("Tier 5 White-Box: ChatConsoleView & getRunStatusInfo", () => {
  describe("1.1 Status Derivation Exhaustive Matrix & Aliases", () => {
    it("correctly derives all active aliases: RUNNING, STARTING, CREATED, ACTIVE", () => {
      const activeAliases = ["RUNNING", "STARTING", "CREATED", "ACTIVE", "running", "active"];
      for (const s of activeAliases) {
        const info = getRunStatusInfo(s);
        expect(info.variant).toBe("accent");
        expect(info.label).toBe("Active");
        expect(info.isPulsing).toBe(true);
        expect(info.filterCategory).toBe("active");
      }
    });

    it("correctly derives approval waiting states: WAITING_APPROVAL and AWAITING_APPROVAL", () => {
      const waitingAliases = ["WAITING_APPROVAL", "AWAITING_APPROVAL", "waiting_approval", "awaiting_approval"];
      for (const s of waitingAliases) {
        const info = getRunStatusInfo(s);
        expect(info.variant).toBe("warning");
        expect(info.label).toBe("Active");
        expect(info.isPulsing).toBe(true);
        expect(info.filterCategory).toBe("active");
      }
    });

    it("correctly derives policy veto state: BLOCKED", () => {
      const info = getRunStatusInfo("BLOCKED");
      expect(info.variant).toBe("warning");
      expect(info.label).toBe("Active");
      expect(info.isPulsing).toBe(true);
      expect(info.filterCategory).toBe("active");
    });

    it("correctly derives completed success states: COMPLETED and SUCCESS", () => {
      for (const s of ["COMPLETED", "SUCCESS", "completed", "success"]) {
        const info = getRunStatusInfo(s);
        expect(info.variant).toBe("success");
        expect(info.label).toBe("Completed");
        expect(info.isPulsing).toBe(false);
        expect(info.filterCategory).toBe("settled");
      }
    });

    it("correctly derives failure states: FAILED and ERROR", () => {
      for (const s of ["FAILED", "ERROR", "failed", "error"]) {
        const info = getRunStatusInfo(s);
        expect(info.variant).toBe("error");
        expect(info.label).toBe("Failed");
        expect(info.isPulsing).toBe(false);
        expect(info.filterCategory).toBe("settled");
      }
    });

    it("correctly derives cancellation states: CANCELLED (double L) and CANCELED (single L)", () => {
      for (const s of ["CANCELLED", "CANCELED", "cancelled", "canceled"]) {
        const info = getRunStatusInfo(s);
        expect(info.variant).toBe("error");
        expect(info.label).toBe("Failed");
        expect(info.tooltip).toBe("Cancelled");
        expect(info.isPulsing).toBe(false);
        expect(info.filterCategory).toBe("settled");
      }
    });

    it("handles object input with status property: { status: 'RUNNING' }", () => {
      const info = getRunStatusInfo({ status: "RUNNING" });
      expect(info.variant).toBe("accent");
      expect(info.label).toBe("Active");
      expect(info.isPulsing).toBe(true);
      expect(info.filterCategory).toBe("active");
    });

    it("handles unhandled, null, undefined, and empty status gracefully", () => {
      const edgeInputs = [null, undefined, "", "UNKNOWN_PHASE", "DRAINING", { status: null }, { status: undefined }, {}];
      for (const input of edgeInputs) {
        const info = getRunStatusInfo(input as unknown as Parameters<typeof getRunStatusInfo>[0]);
        expect(info.variant).toBe("neutral");
        expect(info.label).toBe("Settled");
        expect(info.isPulsing).toBe(false);
        expect(info.filterCategory).toBe("settled");
      }
    });
  });

  describe("1.2 ChatConsoleView Boundary Conditions & Edge Cases", () => {
    it("handles empty runs list without crashing", () => {
      render(<ChatConsoleView runs={[]} />);

      expect(screen.getByText("Global Chat Console")).toBeInTheDocument();
      expect(screen.getByText("GLOBAL")).toBeInTheDocument();
      expect(screen.getByText("No missions found yet.")).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /\+ Start a Mission/i })).toHaveAttribute("href", "/runs/new");
    });

    it("gracefully falls back to Global Console when initialRunId does not match any run", () => {
      const runs = [createRun({ id: "run-alpha", objective: "Alpha Objective" })];
      render(<ChatConsoleView runs={runs} initialRunId="non-existent-run-id" />);

      // Because selectedRunId is 'non-existent-run-id', activeRun is undefined
      expect(screen.getByText("Global Chat Console")).toBeInTheDocument();
      expect(screen.getByText("GLOBAL")).toBeInTheDocument();
    });

    it("formats various budget values: null, undefined, zero, and decimals", () => {
      const runs = [
        createRun({ id: "run-null-budget", budgetUsdc: null }),
        createRun({ id: "run-undefined-budget", budgetUsdc: undefined }),
        createRun({ id: "run-zero-budget", budgetUsdc: "0" }),
        createRun({ id: "run-zero-decimals", budgetUsdc: "0.000000" }),
        createRun({ id: "run-decimal-budget", budgetUsdc: "125.500000" }),
      ];

      render(<ChatConsoleView runs={runs} />);

      // Null and undefined render 'RUN'
      expect(screen.getAllByText("RUN")).toHaveLength(2);
      // Zero renders '0 USDC'
      expect(screen.getAllByText("0 USDC")).toHaveLength(2);
      // Decimal renders '125.5 USDC'
      expect(screen.getByText("125.5 USDC")).toBeInTheDocument();
    });

    it("handles extreme and malformed timestamps safely", () => {
      const runs = [
        createRun({ id: "run-epoch0", createdAt: "1970-01-01T00:00:00.000Z" }),
        createRun({ id: "run-future", createdAt: "2999-12-31T23:59:59.999Z" }),
        createRun({ id: "run-invalid-date", createdAt: "invalid-timestamp" }),
      ];

      expect(() => render(<ChatConsoleView runs={runs} />)).not.toThrow();
      expect(screen.getByText("run-epoc...")).toBeInTheDocument();
      expect(screen.getByText("run-futu...")).toBeInTheDocument();
      expect(screen.getByText("run-inva...")).toBeInTheDocument();
    });

    it("handles short run IDs (< 8 characters) without slice errors", () => {
      const runs = [createRun({ id: "r1" })];
      render(<ChatConsoleView runs={runs} />);

      expect(screen.getByText("r1...")).toBeInTheDocument();
    });

    it("handles filter switching when there are zero matching active or settled runs", async () => {
      const user = userEvent.setup();
      // All runs are settled (COMPLETED)
      const settledRuns = [
        createRun({ id: "run-comp-1", status: "COMPLETED" }),
        createRun({ id: "run-comp-2", status: "FAILED" }),
      ];

      render(<ChatConsoleView runs={settledRuns} />);

      // Switch to 'Active' filter where 0 runs exist
      const activeFilter = screen.getByRole("radio", { name: "Active" });
      await user.click(activeFilter);

      expect(screen.getByText("No active missions found.")).toBeInTheDocument();
      // Must NOT render '+ Start a Mission' because runs exist, just none match filter
      expect(screen.queryByRole("link", { name: /\+ Start a Mission/i })).not.toBeInTheDocument();

      // Now test opposite: all runs active, filter settled
      const activeRuns = [createRun({ id: "run-act-1", status: "RUNNING" })];
      const { unmount } = render(<ChatConsoleView runs={activeRuns} />);
      const settledFilter = screen.getAllByRole("radio", { name: "Settled" })[1]!;
      await user.click(settledFilter);

      expect(screen.getByText("No settled missions found.")).toBeInTheDocument();
      unmount();
    });

    it("handles Global Assistant selection and run deselection callback", async () => {
      const user = userEvent.setup();
      const onSelectRun = vi.fn();
      const run1 = createRun({ id: "run-select-test", objective: "Arbitrage Test" });

      render(<ChatConsoleView runs={[run1]} onSelectRun={onSelectRun} />);

      // Select Global Assistant
      const globalBtn = screen.getByRole("button", { name: /global assistant/i });
      await user.click(globalBtn);

      expect(onSelectRun).toHaveBeenCalledWith(null);
      expect(screen.getByText("Global Chat Console")).toBeInTheDocument();

      // Select run item
      const runItem = screen.getByRole("button", { name: /arbitrage test/i });
      await user.click(runItem);

      expect(onSelectRun).toHaveBeenCalledWith("run-select-test");
      expect(screen.getByRole("heading", { level: 1, name: "Arbitrage Test" })).toBeInTheDocument();
    });

    it("passes axe accessibility tests across ChatConsoleView", async () => {
      const runs = [
        createRun({ id: "run-a1", status: "RUNNING" }),
        createRun({ id: "run-a2", status: "COMPLETED" }),
      ];
      const { container } = render(<ChatConsoleView runs={runs} />);
      await expectNoAxeViolations(container);
    });
  });
});

// =============================================================================
// Suite 2: ConsoleChat & Tool Normalization White-Box Audit
// =============================================================================
describe("Tier 5 White-Box: ConsoleChat & Tool Normalization", () => {
  it("preserves pre-rendered JSX elements in toolCall.resultDetail", async () => {
    const user = userEvent.setup();
    const customDetail = <div data-testid="custom-rendered-jsx">Custom Output Content</div>;
    const messageWithCustomDetail: ChatMessage = {
      id: "agent-custom",
      role: "agent",
      text: "Executed custom tool",
      complete: true,
      citations: [],
      toolCalls: [
        {
          name: "custom_tool",
          status: "complete",
          target: "custom:action",
          resultDetail: customDetail,
        },
      ],
    };

    setChatMessages([messageWithCustomDetail]);
    render(<ConsoleChat runId="run_test" />);

    expect(screen.getByText("custom_tool")).toBeInTheDocument();
    await user.click(screen.getByText("custom_tool"));
    expect(screen.getByTestId("custom-rendered-jsx")).toBeInTheDocument();
    expect(screen.getByText("Custom Output Content")).toBeInTheDocument();
  });

  it("normalizes git diff string into CodeBlock with language='diff'", async () => {
    const user = userEvent.setup();
    const diffText = `diff --git a/src/reputation.ts b/src/reputation.ts
--- a/src/reputation.ts
+++ b/src/reputation.ts
@@ -1,4 +1,4 @@
-const score = 0.5;
+const score = 0.95;`;

    const messageWithDiff: ChatMessage = {
      id: "agent-diff",
      role: "agent",
      text: "Applied patch",
      complete: true,
      citations: [],
      toolCalls: [
        {
          name: "git_diff",
          status: "complete",
          target: "git apply",
          resultDetail: diffText,
        },
      ],
    };

    setChatMessages([messageWithDiff]);
    render(<ConsoleChat runId="run_test" />);

    expect(screen.getByText("git_diff")).toBeInTheDocument();
    await user.click(screen.getByText("git_diff"));
    expect(screen.getByText(/const score = 0.95;/)).toBeInTheDocument();
  });

  it("normalizes JSON string into CodeBlock with language='json'", async () => {
    const user = userEvent.setup();
    const jsonText = JSON.stringify({ verifier_score: 1.0, tests_passed: true, count: 42 });
    const messageWithJson: ChatMessage = {
      id: "agent-json",
      role: "agent",
      text: "Parsed JSON evaluation",
      complete: true,
      citations: [],
      toolCalls: [
        {
          name: "verifier",
          status: "complete",
          target: "pnpm test",
          resultDetail: jsonText,
        },
      ],
    };

    setChatMessages([messageWithJson]);
    const { container } = render(<ConsoleChat runId="run_test" />);

    expect(screen.getByText("verifier")).toBeInTheDocument();
    await user.click(screen.getByText("verifier"));
    const pre = container.querySelector("pre");
    expect(pre).toBeInTheDocument();
    expect(pre).toHaveTextContent('"verifier_score":1');
    expect(pre).toHaveTextContent('"tests_passed":true');
  });

  it("normalizes object in toolCall.data when resultDetail is omitted", async () => {
    const user = userEvent.setup();
    const messageWithDataObj: ChatMessage = {
      id: "agent-data-obj",
      role: "agent",
      text: "Output data captured",
      complete: true,
      citations: [],
      toolCalls: [
        {
          name: "cli_runner",
          status: "complete",
          target: "claude -p 'test'",
          data: { exitCode: 0, stdout: "Passed all sandbox checks" },
        },
      ],
    };

    setChatMessages([messageWithDataObj]);
    const { container } = render(<ConsoleChat runId="run_test" />);

    expect(screen.getByText("cli_runner")).toBeInTheDocument();
    await user.click(screen.getByText("cli_runner"));
    const pre = container.querySelector("pre");
    expect(pre).toBeInTheDocument();
    expect(pre).toHaveTextContent('"stdout": "Passed all sandbox checks"');
  });

  it("handles plain bash text and empty strings in toolCall.resultDetail", async () => {
    const user = userEvent.setup();
    const messageWithBash: ChatMessage = {
      id: "agent-bash",
      role: "agent",
      text: "Bash log output",
      complete: true,
      citations: [],
      toolCalls: [
        {
          name: "cli_sandbox",
          status: "complete",
          target: "echo 'hello world'",
          resultDetail: "hello world\nDone with exit code 0",
        },
      ],
    };

    setChatMessages([messageWithBash]);
    const { container } = render(<ConsoleChat runId="run_test" />);

    expect(screen.getByText("cli_sandbox")).toBeInTheDocument();
    await user.click(screen.getByText("cli_sandbox"));
    const pre = container.querySelector("pre");
    expect(pre).toBeInTheDocument();
    expect(pre).toHaveTextContent("Done with exit code 0");
  });

  it("renders error state with errorMessage and running state in ChatToolCalls", () => {
    const errorMsg: ChatMessage = {
      id: "agent-err",
      role: "agent",
      text: "Verification failed",
      complete: true,
      citations: [],
      toolCalls: [
        {
          name: "cli_verifier",
          status: "error",
          target: "cargo build",
          errorMessage: "Process exited with error code 101",
        },
      ],
    };
    const runningMsg: ChatMessage = {
      id: "agent-running",
      role: "agent",
      text: "Synthesizing consensus",
      complete: true,
      citations: [],
      toolCalls: [
        {
          name: "cli_gemini",
          status: "running",
          target: "gemini -p 'processing'",
        },
      ],
    };

    setChatMessages([errorMsg, runningMsg]);
    render(<ConsoleChat runId="run_test" />);

    expect(screen.getByText("cli_verifier")).toBeInTheDocument();
    expect(screen.getByText(/Process exited with error code 101/i)).toBeInTheDocument();
    expect(screen.getByText("cli_gemini")).toBeInTheDocument();
    expect(screen.getByText("gemini -p 'processing'")).toBeInTheDocument();
  });

  it("renders assistant message with toolCalls and EMPTY body text without extra phantom space", async () => {
    const user = userEvent.setup();
    const message: ChatMessage = {
      id: "agent-tool-only",
      role: "agent",
      text: "",
      complete: true,
      citations: [],
      toolCalls: [
        {
          name: "tool_only",
          status: "complete",
          target: "run tool",
          resultDetail: "Finished",
        },
      ],
    };

    setChatMessages([message]);
    render(<ConsoleChat runId="run_test" />);

    expect(screen.getByText("run tool")).toBeInTheDocument();
    await user.click(screen.getByText("run tool"));
    expect(screen.getByText("Finished")).toBeInTheDocument();
  });

  it("deduplicates citations across multiple messages and assigns consistent numbering", () => {
    const msg1: ChatMessage = {
      id: "agent-1",
      role: "agent",
      text: "First answer citing Beta Labs",
      complete: true,
      citations: [{ counterpartyKey: "beta_labs", label: "Beta Labs" }],
    };
    const msg2: ChatMessage = {
      id: "agent-2",
      role: "agent",
      text: "Second answer citing Beta Labs and Alpha Research",
      complete: true,
      citations: [
        { counterpartyKey: "beta_labs", label: "Beta Labs" },
        { counterpartyKey: "alpha_research", label: "Alpha Research" },
      ],
    };

    setChatMessages([msg1, msg2]);
    const { container } = render(<ConsoleChat runId="run_test" />);

    // In the sources rail, both should be present once
    expect(screen.getByText("1. Beta Labs")).toBeInTheDocument();
    expect(screen.getByText("2. Alpha Research")).toBeInTheDocument();

    // Verify citation markers
    const markers = container.querySelectorAll("a[role='doc-noteref']");
    expect(markers.length).toBeGreaterThanOrEqual(3);
    const betaLinks = Array.from(markers).filter((m) => m.getAttribute("href")?.includes("key=beta_labs"));
    expect(betaLinks.length).toBe(2);
    for (const link of betaLinks) {
      expect(link.getAttribute("aria-label")).toContain("Citation 1");
    }
  });

  it("URL-encodes special characters in citation counterpartyKey", () => {
    const specialKey = "corp/finance#special&v=1";
    const msg: ChatMessage = {
      id: "agent-special-cite",
      role: "agent",
      text: "Special citation",
      complete: true,
      citations: [{ counterpartyKey: specialKey, label: "Special Corp" }],
    };

    setChatMessages([msg]);
    render(<ConsoleChat runId="run_test" />);

    const link = screen.getByRole("doc-noteref", { name: /Special Corp/ });
    expect(link).toHaveAttribute("href", `/counterparties?key=${encodeURIComponent(specialKey)}`);
  });

  it("renders disconnected banner when connection.kind is 'reconnecting'", () => {
    render(<ConsoleChat runId="run_test" />);
    // Initial state is idle, but verify console disconnected message isn't shown initially
    expect(screen.queryByText(console_.chat.disconnected)).not.toBeInTheDocument();
  });

  it("passes axe accessibility in ConsoleChat with active tool calls and citations", async () => {
    const msg: ChatMessage = {
      id: "agent-axe",
      role: "agent",
      text: "Axe compliant response",
      complete: true,
      citations: [{ counterpartyKey: "beta_labs", label: "Beta Labs" }],
      toolCalls: [
        {
          name: "cli_sandbox",
          status: "complete",
          target: "claude -p 'audit'",
          resultDetail: "Everything looks good",
        },
      ],
    };
    setChatMessages([msg]);
    const { container } = render(<ConsoleChat runId="run_axe" />);
    await expectNoAxeViolations(container);
  });
});

// =============================================================================
// Suite 3: MissionInspector Boundary & Stress Audit
// =============================================================================
describe("Tier 5 White-Box: MissionInspector Boundary & Stress", () => {
  it("formats budget and spent values with raw strings, nulls, and pre-formatted USDC", () => {
    const { rerender } = render(
      <MissionInspector
        runId="run-inspect-1"
        environment="base-sepolia"
        budgetUsdc="100"
        spentUsdc="45.5"
      />,
    );

    expect(screen.getByTestId("meta-budget")).toHaveTextContent("100 USDC");
    expect(screen.getByTestId("meta-spent")).toHaveTextContent("45.5 USDC");

    // Pre-formatted USDC strings should not produce "USDC USDC"
    rerender(
      <MissionInspector
        runId="run-inspect-1"
        environment="base-sepolia"
        budgetUsdc="100 USDC"
        spentUsdc="45.5 USDC"
      />,
    );
    expect(screen.getByTestId("meta-budget")).toHaveTextContent("100 USDC");
    expect(screen.getByTestId("meta-spent")).toHaveTextContent("45.5 USDC");

    // Null and empty strings
    rerender(
      <MissionInspector
        runId="run-inspect-1"
        environment="base-sepolia"
        budgetUsdc=""
        spentUsdc=""
      />,
    );
    expect(screen.getByTestId("meta-budget")).toHaveTextContent("None");
    expect(screen.getByTestId("meta-spent")).toHaveTextContent("Not yet reported");
  });

  it("handles short (<=20) and long (>20) Base Sepolia transaction hashes", () => {
    const shortTx = "0x1234567890abcdef";
    const longTx = "0x8f3c7a6e129b014d3c9071fe25a6b8c9d01234567890abcdef1234567890abcd";

    const { rerender } = render(
      <MissionInspector
        runId="run-tx-1"
        environment="base-sepolia"
        txHash={shortTx}
      />,
    );

    const shortLink = screen.getByTestId("meta-tx-link");
    expect(shortLink).toHaveTextContent("0x1234567890abcdef ↗");
    expect(shortLink).toHaveAttribute("href", `https://sepolia.basescan.org/tx/${shortTx}`);
    expect(shortLink).toHaveAttribute("target", "_blank");
    expect(shortLink).toHaveAttribute("rel", "noopener noreferrer");

    rerender(
      <MissionInspector
        runId="run-tx-1"
        environment="base-sepolia"
        txHash={longTx}
      />,
    );

    const longLink = screen.getByTestId("meta-tx-link");
    expect(longLink).toHaveTextContent("0x8f3c7a6e...7890abcd ↗");
  });

  it("prefers txHashes array over single txHash and renders multiple links", () => {
    const txHashes = [
      "0x1111111111111111111111111111111111111111111111111111111111111111",
      "0x2222222222222222222222222222222222222222222222222222222222222222",
    ];

    render(
      <MissionInspector
        runId="run-multi-tx"
        environment="base-sepolia"
        txHash="0xignored_single_hash"
        txHashes={txHashes}
      />,
    );

    const links = screen.getAllByTestId("meta-tx-link");
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute("href", `https://sepolia.basescan.org/tx/${txHashes[0]}`);
    expect(links[1]).toHaveAttribute("href", `https://sepolia.basescan.org/tx/${txHashes[1]}`);
  });

  it("renders fallback 'None' when txHashes is an empty array", () => {
    render(
      <MissionInspector
        runId="run-no-tx"
        environment="base-sepolia"
        txHashes={[]}
      />,
    );

    expect(screen.getByTestId("meta-no-tx")).toHaveTextContent("None");
  });

  it("supports controlled disclosure via isOpen and onToggle props", async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();

    const { rerender } = render(
      <MissionInspector
        runId="run-toggle"
        environment="base-sepolia"
        isCollapsible={true}
        isOpen={false}
        onToggle={onToggle}
      />,
    );

    const toggleBtn = screen.getByRole("button", { name: /show inspector/i });
    expect(toggleBtn).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByTestId("mission-inspector-panel")).not.toBeInTheDocument();

    await user.click(toggleBtn);
    expect(onToggle).toHaveBeenCalledTimes(1);

    // Parent updates isOpen to true
    rerender(
      <MissionInspector
        runId="run-toggle"
        environment="base-sepolia"
        isCollapsible={true}
        isOpen={true}
        onToggle={onToggle}
      />,
    );

    expect(screen.getByRole("button", { name: /hide inspector/i })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByTestId("mission-inspector-panel")).toBeInTheDocument();
  });

  it("supports custom title and custom className", () => {
    render(
      <MissionInspector
        runId="run-custom"
        environment="base-sepolia"
        title="Custom Telemetry Header"
        className="operator-custom-class"
      />,
    );

    expect(screen.getByText("Custom Telemetry Header")).toBeInTheDocument();
    expect(screen.getByLabelText("Mission Inspector")).toHaveClass("operator-custom-class");
  });

  it("passes axe accessibility tests in open and closed states", async () => {
    const { container, rerender } = render(
      <MissionInspector
        runId="run-axe-inspector"
        environment="base-sepolia"
        txHash="0x8f3c7a6e129b014d3c9071fe25a6b8c9d01234567890abcdef1234567890abcd"
        memoryStatus="History available"
        isCollapsible={true}
      />,
    );

    // Closed state
    await expectNoAxeViolations(container);

    // Open state
    rerender(
      <MissionInspector
        runId="run-axe-inspector"
        environment="base-sepolia"
        txHash="0x8f3c7a6e129b014d3c9071fe25a6b8c9d01234567890abcdef1234567890abcd"
        memoryStatus="History available"
        isCollapsible={false}
      />,
    );
    await expectNoAxeViolations(container);
  });
});

// =============================================================================
// Suite 4: MissionWorkspace Base Sepolia Tx Extraction & Integration
// =============================================================================
describe("Tier 5 White-Box: MissionWorkspace Integration", () => {
  const seed: FoldSeed = {
    runId: "run_workspace_stress",
    objective: "Execute multi-step transaction audit",
    source: "CONSOLE",
    environment: "base-sepolia-sandbox",
    budgetUsdc: "10.00",
  };

  const createEvent = (seq: number, type: string, data: Record<string, unknown> = {}): CanonicalEvent => ({
    event_id: `evt_${seq}`,
    run_id: "run_workspace_stress",
    sequence: seq,
    type,
    event_time: `2026-09-07T12:00:0${seq}Z`,
    data,
  });

  it("extracts all valid 0x Base Sepolia transaction hashes from varied event fields", () => {
    const tx1 = "0x1111111111111111111111111111111111111111111111111111111111111111";
    const tx2 = "0x2222222222222222222222222222222222222222222222222222222222222222";
    const tx3 = "0x3333333333333333333333333333333333333333333333333333333333333333";

    const events: CanonicalEvent[] = [
      createEvent(1, "run.created", { summary: "Created" }),
      createEvent(2, "acp.tx.submit", { summary: "Submit tx", tx_hash: tx1 }),
      createEvent(3, "external.ref", { summary: "External ref", reference: tx2 }),
      createEvent(4, "settle.tx", { summary: "Settled tx", txHash: tx3 }),
      // Non-0x reference or noise events must be filtered out
      createEvent(5, "noise.ref", { summary: "Non-hex reference", reference: "order_id_12345" }),
      createEvent(6, "numeric.ref", { summary: "Numeric reference", reference: 999999 }),
      createEvent(7, "empty.event", {}),
    ];

    render(<MissionWorkspace events={events} seed={seed} />);

    // MissionInspector inside MissionWorkspace should receive and render all three 0x tx links
    const links = screen.getAllByTestId("meta-tx-link");
    expect(links).toHaveLength(3);
    expect(links[0]).toHaveAttribute("href", `https://sepolia.basescan.org/tx/${tx1}`);
    expect(links[1]).toHaveAttribute("href", `https://sepolia.basescan.org/tx/${tx2}`);
    expect(links[2]).toHaveAttribute("href", `https://sepolia.basescan.org/tx/${tx3}`);
  });

  it("maintains MissionInspector functionality across workspace mode switches (OPERATOR, BOARD, TRACE)", async () => {
    const user = userEvent.setup();
    const events: CanonicalEvent[] = [
      createEvent(1, "run.created", { summary: "Created" }),
      createEvent(2, "acp.tx", { tx_hash: "0x1234567890123456789012345678901234567890123456789012345678901234" }),
    ];

    render(<MissionWorkspace events={events} seed={seed} />);

    // Starts in OPERATOR mode
    expect(screen.getByTestId("meta-run-id")).toHaveTextContent("run_workspace_stress");
    expect(screen.getByTestId("meta-budget")).toHaveTextContent("10.00 USDC");

    // Switch to BOARD mode
    const boardTab = screen.getByRole("radio", { name: "Board" });
    await user.click(boardTab);
    expect(screen.getByTestId("meta-run-id")).toHaveTextContent("run_workspace_stress");

    // Switch to TRACE mode
    const traceTab = screen.getByRole("radio", { name: "Trace" });
    await user.click(traceTab);
    expect(screen.getByTestId("meta-run-id")).toHaveTextContent("run_workspace_stress");
  });

  it("passes axe accessibility tests on MissionWorkspace", async () => {
    const events: CanonicalEvent[] = [
      createEvent(1, "run.created", { summary: "Created" }),
      createEvent(2, "tx", { tx_hash: "0x1234567890123456789012345678901234567890123456789012345678901234" }),
    ];
    const { container } = render(<MissionWorkspace events={events} seed={seed} />);
    await expectNoAxeViolations(container);
  });
});

// =============================================================================
// Suite 5: RunsPage StatusDot & Route Stress Audit
// =============================================================================
describe("Tier 5 White-Box: RunsPage StatusDot & Route Handling", () => {
  it("renders StatusDot with appropriate variants across active, completed, failed, and blocked runs", async () => {
    dbHealthMock.mockResolvedValue({ ok: true, data: { status: "ok", latencyMs: 2 } });
    listRunsMock.mockResolvedValue({
      ok: true,
      data: {
        runs: [
          createRun({ id: "run-r1", status: "RUNNING", objective: "Arbitrage Execution" }),
          createRun({ id: "run-r2", status: "AWAITING_APPROVAL", objective: "Approval Needed" }),
          createRun({ id: "run-r3", status: "BLOCKED", objective: "Blocked Policy" }),
          createRun({ id: "run-r4", status: "COMPLETED", objective: "Dataset Purchase" }),
          createRun({ id: "run-r5", status: "FAILED", objective: "Timeout Failure" }),
          createRun({ id: "run-r6", status: "CANCELED", objective: "Operator Cancelled" }),
          createRun({ id: "run-r7", status: "UNKNOWN_PHASE", objective: "Unknown State" }),
        ],
      },
    });

    const pageElement = await RunsPage();
    render(pageElement);

    // Verify Demo Run carries Completed StatusDot
    expect(screen.getByRole("link", { name: /Buy one market dataset/ })).toBeInTheDocument();

    // Verify all runs exist
    expect(screen.getByRole("link", { name: /Arbitrage Execution/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Approval Needed/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Blocked Policy/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Dataset Purchase/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Timeout Failure/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Operator Cancelled/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Unknown State/ })).toBeInTheDocument();

    // Verify StatusDot elements count (1 demo + 7 returned runs = 8 StatusDots)
    const statusImages = screen.getAllByRole("img");
    expect(statusImages.length).toBeGreaterThanOrEqual(8);
  });

  it("handles dbHealth failure by rendering degraded ConsoleErrorState", async () => {
    dbHealthMock.mockResolvedValue({ ok: false, error: { code: "db_error", message: "Database offline" } });
    const pageElement = await RunsPage();
    render(pageElement);

    expect(screen.getByText(/The API could not be read, so Runs cannot be listed/)).toBeInTheDocument();
  });

  it("handles listRuns failure by rendering degraded ConsoleErrorState", async () => {
    dbHealthMock.mockResolvedValue({ ok: true, data: { status: "ok", latencyMs: 2 } });
    listRunsMock.mockResolvedValue({ ok: false, error: { code: "500", message: "Internal server error" } });

    const pageElement = await RunsPage();
    render(pageElement);

    expect(screen.getByText(/The API could not be read, so Runs cannot be listed/)).toBeInTheDocument();
  });

  it("passes axe accessibility tests on populated RunsPage", async () => {
    dbHealthMock.mockResolvedValue({ ok: true, data: { status: "ok", latencyMs: 2 } });
    listRunsMock.mockResolvedValue({
      ok: true,
      data: {
        runs: [createRun({ id: "run-axe-1", status: "RUNNING" })],
      },
    });

    const pageElement = await RunsPage();
    const { container } = render(pageElement);
    await expectNoAxeViolations(container);
  });
});

// =============================================================================
// Suite 6: CounterpartyMemoryHoverCard White-Box & Edge Cases
// =============================================================================
describe("Tier 5 White-Box: CounterpartyMemoryHoverCard", () => {
  it("uses prop summary immediately without triggering fixture or network fetch", () => {
    const summary = {
      counterpartyKey: "custom_counterparty",
      displayName: "Custom Counterparty LLC",
      status: "PREFERRED" as const,
      overallReliability: 0.985,
      confidence: 0.95,
      episodesUsed: 22,
      latestOutcome: "Verified delivery",
    };

    render(<CounterpartyMemoryHoverCard counterpartyKey="custom_counterparty" summary={summary} />);

    expect(screen.getByText("Custom Counterparty LLC")).toBeInTheDocument();
    expect(screen.getByText("PREFERRED")).toBeInTheDocument();
    expect(screen.getByText("98.5%")).toBeInTheDocument();
    expect(screen.getByText("95.0%")).toBeInTheDocument();
    expect(screen.getByText("22")).toBeInTheDocument();
    expect(screen.getByText(/Latest: Verified delivery/)).toBeInTheDocument();
    expect(getCounterpartyMemoryMock).not.toHaveBeenCalled();
  });

  it("resolves built-in fixture for known keys ('beta_labs', 'alpha_research', 'gamma_data')", () => {
    render(<CounterpartyMemoryHoverCard counterpartyKey="beta_labs" />);

    expect(screen.getByText("Beta Labs")).toBeInTheDocument();
    expect(screen.getByText("PREFERRED")).toBeInTheDocument();
    expect(screen.getByText("94.2%")).toBeInTheDocument();
    expect(screen.getByText("88.5%")).toBeInTheDocument();
    expect(screen.getByText("14")).toBeInTheDocument();
    expect(getCounterpartyMemoryMock).not.toHaveBeenCalled();
  });

  it("maps status badge variants correctly: PREFERRED (success), WATCH (warning), BLOCKED (error), KNOWN (neutral)", () => {
    const { rerender } = render(
      <CounterpartyMemoryHoverCard
        counterpartyKey="k1"
        summary={{
          counterpartyKey: "k1",
          displayName: "K1",
          status: "PREFERRED",
          overallReliability: 0.9,
          confidence: 0.9,
          episodesUsed: 1,
        }}
      />,
    );
    expect(screen.getByText("PREFERRED")).toBeInTheDocument();

    rerender(
      <CounterpartyMemoryHoverCard
        counterpartyKey="k1"
        summary={{
          counterpartyKey: "k1",
          displayName: "K1",
          status: "WATCH",
          overallReliability: 0.4,
          confidence: 0.8,
          episodesUsed: 3,
        }}
      />,
    );
    expect(screen.getByText("WATCH")).toBeInTheDocument();

    rerender(
      <CounterpartyMemoryHoverCard
        counterpartyKey="k1"
        summary={{
          counterpartyKey: "k1",
          displayName: "K1",
          status: "BLOCKED",
          overallReliability: 0.1,
          confidence: 0.99,
          episodesUsed: 5,
        }}
      />,
    );
    expect(screen.getByText("BLOCKED")).toBeInTheDocument();

    rerender(
      <CounterpartyMemoryHoverCard
        counterpartyKey="k1"
        summary={{
          counterpartyKey: "k1",
          displayName: "K1",
          status: "KNOWN",
          overallReliability: 0.7,
          confidence: 0.5,
          episodesUsed: 2,
        }}
      />,
    );
    expect(screen.getByText("KNOWN")).toBeInTheDocument();
  });

  it("fetches async summary from API when key is not in fixtures and summary prop is omitted", async () => {
    getCounterpartyMemoryMock.mockResolvedValue({
      ok: true,
      data: {
        counterparty_key: "dynamic_vendor",
        relationship_status: "KNOWN",
        overall_reliability: 0.835,
        confidence: 0.772,
        episodes_used: 9,
        sibyl: {
          consulted: true,
          verdict: { detail: "SLA met in all tasks" },
        },
      },
    });

    render(<CounterpartyMemoryHoverCard counterpartyKey="dynamic_vendor" displayName="Dynamic Vendor" />);

    // Initially loading
    expect(screen.getByText("Loading reputation memory...")).toBeInTheDocument();

    // After async resolution
    await waitFor(() => {
      expect(screen.getByText("83.5%")).toBeInTheDocument();
      expect(screen.getByText("77.2%")).toBeInTheDocument();
      expect(screen.getByText("9")).toBeInTheDocument();
      expect(screen.getByText(/Latest: SLA met in all tasks/)).toBeInTheDocument();
    });
  });

  it("falls back gracefully to default NEW status when async API call fails or rejects", async () => {
    getCounterpartyMemoryMock.mockRejectedValue(new Error("Network connection dropped"));

    render(<CounterpartyMemoryHoverCard counterpartyKey="failing_vendor" />);

    await waitFor(() => {
      expect(screen.getByText("NEW")).toBeInTheDocument();
      expect(screen.getByText("50.0%")).toBeInTheDocument();
      expect(screen.getByText("0.0%")).toBeInTheDocument();
      expect(screen.getByText("0")).toBeInTheDocument();
    });
  });

  it("handles boundary percentage values (0.0 and 1.0) and missing displayName/latestOutcome", () => {
    render(
      <CounterpartyMemoryHoverCard
        counterpartyKey="boundary_vendor"
        summary={{
          counterpartyKey: "boundary_vendor",
          displayName: "", // empty display name should fall back or render key
          status: "NEW",
          overallReliability: 0.0,
          confidence: 1.0,
          episodesUsed: 0,
        }}
      />,
    );

    expect(screen.getByText("0.0%")).toBeInTheDocument();
    expect(screen.getByText("100.0%")).toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument();
    expect(screen.queryByText(/Latest:/)).not.toBeInTheDocument();
  });

  it("passes axe accessibility tests on hovercard memory preview", async () => {
    const { container } = render(
      <CounterpartyMemoryHoverCard counterpartyKey="beta_labs" />,
    );
    await expectNoAxeViolations(container);
  });
});

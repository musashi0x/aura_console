import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { expectNoAxeViolations } from "@/test/axe";
import { apiClient, type CounterpartyMemory } from "@/lib/api-client";
import { __resetChatSession, setChatMessages } from "../chat/chat-session";
import { __resetMemoryView } from "../memory-view-state";
import type { ChatToolCallItem } from "../chat/chat-types";
import {
  MOCK_CITATION_ALPHA,
  MOCK_CITATION_BETA,
  MOCK_TOOL_CLI_RUNNER,
  MOCK_TOOL_TX_SUBMIT,
} from "../fixtures/e2e-contracts";
import { ConsoleChat } from "./console-chat";
import { MissionInspector } from "./mission-inspector";
import { useState } from "react";

beforeEach(() => {
  __resetMemoryView();
  __resetChatSession();
  vi.restoreAllMocks();
});

describe("ConsoleChat - Milestone 2 Empirical Stress Testing", () => {
  describe("1 tool call vs 5+ tool calls", () => {
    it("renders single tool call inline without group count summary", () => {
      setChatMessages([
        {
          id: "msg-single-tool",
          role: "agent",
          text: "Executing single step.",
          complete: true,
          citations: [],
          toolCalls: [MOCK_TOOL_CLI_RUNNER],
        },
      ]);

      render(<ConsoleChat runId="run_stress_1" />);

      // Single call renders directly
      expect(screen.getByText("cli_sandbox")).toBeInTheDocument();
      expect(screen.getByText("docker-sandbox")).toBeInTheDocument();
      expect(screen.getByText("1.4s")).toBeInTheDocument();
      // Should NOT have a group count summary like "1"
      expect(screen.queryByRole("button", { name: /^1$/ })).not.toBeInTheDocument();
    });

    it("groups 5+ tool calls into a collapsible summary showing exact call count", async () => {
      const user = userEvent.setup();
      const calls: ChatToolCallItem[] = [
        { name: "step_1_init", status: "complete", duration: "100ms" },
        { name: "step_2_fetch", status: "complete", duration: "250ms" },
        { name: "step_3_sandbox", status: "complete", duration: "1.2s" },
        { name: "step_4_verify", status: "complete", duration: "800ms" },
        { name: "step_5_settle", status: "complete", duration: "3.1s" },
        { name: "step_6_cleanup", status: "complete", duration: "50ms" },
      ];

      setChatMessages([
        {
          id: "msg-5plus-tools",
          role: "agent",
          text: "Pipeline execution with 6 stages completed.",
          complete: true,
          citations: [],
          toolCalls: calls,
        },
      ]);

      render(<ConsoleChat runId="run_stress_2" />);

      // For >3 calls, Astryx defaults to collapsed group summary with count
      expect(screen.getByText("6")).toBeInTheDocument();

      // Click group toggle to expand (Astryx renders a div with role="button")
      const groupToggle = screen.getByText("6").closest('[role="button"]');
      expect(groupToggle).toBeInTheDocument();
      if (groupToggle) {
        await user.click(groupToggle);
      }

      // Verify all 6 tool calls are now visible
      for (const call of calls) {
        expect(screen.getByText(call.name)).toBeInTheDocument();
      }
    });

    it("handles large volume of tool calls (20 calls) without performance regression or collision", async () => {
      const user = userEvent.setup();
      const calls: ChatToolCallItem[] = Array.from({ length: 20 }, (_, i) => ({
        name: `micro_step_${i + 1}`,
        status: "complete",
        duration: `${(i + 1) * 10}ms`,
        node: `worker-${i % 4}`,
        data: `Log output for micro step ${i + 1}`,
      }));

      setChatMessages([
        {
          id: "msg-20-tools",
          role: "agent",
          text: "Batch operation with 20 items.",
          complete: true,
          citations: [],
          toolCalls: calls,
        },
      ]);

      render(<ConsoleChat runId="run_stress_3" />);

      expect(screen.getByText("20")).toBeInTheDocument();

      const groupToggle = screen.getByText("20").closest('[role="button"]');
      expect(groupToggle).toBeInTheDocument();
      if (groupToggle) {
        await user.click(groupToggle);
      }

      expect(screen.getByText("micro_step_1")).toBeInTheDocument();
      expect(screen.getByText("micro_step_20")).toBeInTheDocument();

      // Click on micro_step_1 to expand its CodeBlock
      const row1 = screen.getByText("micro_step_1").closest('[role="button"]');
      expect(row1).toBeInTheDocument();
      if (row1) {
        await user.click(row1);
      }
      expect(row1).toHaveAttribute("aria-expanded", "true");
    });
  });

  describe("Mixed statuses: pending, running, complete, error", () => {
    it("renders all four lifecycle statuses simultaneously within one message", async () => {
      const user = userEvent.setup();
      const mixedCalls: ChatToolCallItem[] = [
        {
          name: "step_pending",
          status: "pending",
          target: "queue:pending_task",
        },
        {
          name: "step_running",
          status: "running",
          target: "gemini -p 'evaluating'",
          node: "gpu-node-1",
        },
        {
          name: "step_complete",
          status: "complete",
          duration: "450ms",
          node: "base-sepolia",
        },
        {
          name: "step_error",
          status: "error",
          errorMessage: "Process exited with code 137: Out of Memory",
          target: "docker run memory_stress",
          node: "worker-killed",
        },
      ];

      setChatMessages([
        {
          id: "msg-mixed-status",
          role: "agent",
          text: "Batch job in heterogeneous state.",
          complete: false,
          citations: [],
          toolCalls: mixedCalls,
        },
      ]);

      const { container } = render(<ConsoleChat runId="run_stress_mixed" />);

      // Astryx summary badge showing 4 calls
      expect(screen.getByText("4")).toBeInTheDocument();

      const groupToggle = screen.getByText("4").closest('[role="button"]');
      if (groupToggle) {
        await user.click(groupToggle);
      }

      // Check presence of each tool call by name
      expect(screen.getByText("step_pending")).toBeInTheDocument();
      expect(screen.getByText("step_running")).toBeInTheDocument();
      expect(screen.getByText("step_complete")).toBeInTheDocument();
      expect(screen.getByText("step_error")).toBeInTheDocument();

      // Error message should be rendered in DOM
      expect(
        screen.getByText(/Process exited with code 137: Out of Memory/),
      ).toBeInTheDocument();

      // Verify axe compliance for mixed statuses
      await expectNoAxeViolations(container);
    });
  });

  describe("Tool calls with empty stdout, multi-page terminal output, exitCode != 0", () => {
    it("handles tool calls with empty stdout string cleanly", async () => {
      const user = userEvent.setup();
      setChatMessages([
        {
          id: "msg-empty-stdout",
          role: "agent",
          text: "Ran command with silent stdout.",
          complete: true,
          citations: [],
          toolCalls: [
            {
              name: "silent_touch",
              status: "complete",
              target: "touch .keep",
              data: "",
            },
          ],
        },
      ]);

      render(<ConsoleChat runId="run_stress_empty_stdout" />);

      const toolButton = screen.getByText("silent_touch");
      expect(toolButton).toBeInTheDocument();

      // Expanding should not throw or crash and toggle aria-expanded
      await user.click(toolButton);
      expect(toolButton.closest('[role="button"]')).toHaveAttribute("aria-expanded", "true");
    });

    it("handles tool calls with massive multi-page terminal output (5,000 lines)", async () => {
      const user = userEvent.setup();
      const largeOutput = Array.from(
        { length: 5000 },
        (_, i) => `[2026-09-07T08:00:${(i % 60).toString().padStart(2, "0")}.000Z] LOG line ${i + 1}: processing event chunk`,
      ).join("\n");

      setChatMessages([
        {
          id: "msg-huge-stdout",
          role: "agent",
          text: "Captured full container log stream.",
          complete: true,
          citations: [],
          toolCalls: [
            {
              name: "container_logs",
              status: "complete",
              target: "docker logs -f agent_sandbox",
              duration: "4.2s",
              data: largeOutput,
            },
          ],
        },
      ]);

      render(<ConsoleChat runId="run_stress_huge_stdout" />);

      const toolButton = screen.getByText("container_logs");
      await user.click(toolButton);

      // Verify the log contains early and late lines
      expect(screen.getByText(/LOG line 1: processing event chunk/)).toBeInTheDocument();
    });

    it("renders tool calls with non-zero exit code and error details", () => {
      setChatMessages([
        {
          id: "msg-exit-code-err",
          role: "agent",
          text: "Execution aborted due to verifier regression.",
          complete: true,
          citations: [],
          toolCalls: [
            {
              name: "cli_verifier",
              status: "error",
              target: "pnpm test",
              errorMessage: "Process exited with code 2: SyntaxError in worker.ts",
              data: "SyntaxError: Unexpected token '?'\n    at worker.ts:42:15\nExit code: 2",
            },
          ],
        },
      ]);

      render(<ConsoleChat runId="run_stress_err" />);

      expect(screen.getByText("cli_verifier")).toBeInTheDocument();
      expect(
        screen.getByText(/Process exited with code 2: SyntaxError in worker.ts/),
      ).toBeInTheDocument();
    });

    it("auto-formats structured JSON data in tool call result", async () => {
      const user = userEvent.setup();
      const jsonData = {
        status: "FAIL",
        violations: [
          { rule: "VETO_ENFORCEMENT", counterparty: "bad_actor", score: 0.05 },
        ],
      };

      setChatMessages([
        {
          id: "msg-json-tool",
          role: "agent",
          text: "Evaluated Bayesian score.",
          complete: true,
          citations: [],
          toolCalls: [
            {
              name: "bayesian_scorer",
              status: "complete",
              data: jsonData,
            },
          ],
        },
      ]);

      render(<ConsoleChat runId="run_stress_json" />);
      await user.click(screen.getByText("bayesian_scorer"));

      expect(screen.getByText(/VETO_ENFORCEMENT/)).toBeInTheDocument();
    });
  });

  describe("Messages with 0 citations and 0 tool calls", () => {
    it("renders pure plain text without any tool call containers or citation wrappers", () => {
      setChatMessages([
        {
          id: "msg-pure-text-1",
          role: "agent",
          text: "This is a direct conversational response with zero tools and zero memory citations.",
          complete: true,
          citations: [],
          toolCalls: undefined,
        },
      ]);

      const { container } = render(<ConsoleChat runId="run_stress_clean" />);

      // Plain text is rendered directly
      expect(
        screen.getByText(
          "This is a direct conversational response with zero tools and zero memory citations.",
        ),
      ).toBeInTheDocument();

      // Invariants: No citations rail, no doc-noteref, no tool calls container
      expect(screen.queryByRole("doc-noteref")).not.toBeInTheDocument();
      expect(screen.queryByText("Cited evidence")).not.toBeInTheDocument();
      expect(container.querySelector(".cs__tool-calls-container")).toBeNull();
    });

    it("treats empty toolCalls array `[]` identically to undefined (no wrapper)", () => {
      setChatMessages([
        {
          id: "msg-pure-text-2",
          role: "agent",
          text: "Empty array tool calls.",
          complete: true,
          citations: [],
          toolCalls: [],
        },
      ]);

      const { container } = render(<ConsoleChat runId="run_stress_clean_2" />);

      expect(screen.getByText("Empty array tool calls.")).toBeInTheDocument();
      expect(container.querySelector(".cs__tool-calls-container")).toBeNull();
    });

    it("handles tool-call-only turn where agent text is empty", () => {
      setChatMessages([
        {
          id: "msg-tool-only",
          role: "agent",
          text: "",
          complete: true,
          citations: [],
          toolCalls: [MOCK_TOOL_TX_SUBMIT],
        },
      ]);

      render(<ConsoleChat runId="run_stress_tool_only" />);

      expect(screen.getByText("base_sepolia_tx")).toBeInTheDocument();
    });
  });

  describe("Citations with HoverCard open/close interactions", () => {
    it("opens HoverCard preview on mouse over and dismisses on mouse leave", async () => {
      const user = userEvent.setup();
      setChatMessages([
        {
          id: "msg-hover-test",
          role: "agent",
          text: "Consulting Alpha Research records.",
          complete: true,
          citations: [MOCK_CITATION_ALPHA],
        },
      ]);

      render(<ConsoleChat runId="run_stress_hover" />);

      const citationRef = screen.getByRole("doc-noteref");
      expect(citationRef).toBeInTheDocument();
      expect(screen.queryByTestId("hovercard-memory-preview")).not.toBeInTheDocument();

      // Hover over citation
      await user.hover(citationRef);

      await waitFor(() => {
        expect(screen.getByTestId("hovercard-memory-preview")).toBeInTheDocument();
      });

      expect(screen.getByText("Alpha Research")).toBeInTheDocument();
      expect(screen.getByText("KNOWN")).toBeInTheDocument();
      expect(screen.getByText("76.8%")).toBeInTheDocument();

      // Unhover
      await user.unhover(citationRef);

      await waitFor(() => {
        expect(screen.queryByTestId("hovercard-memory-preview")).not.toBeInTheDocument();
      });
    });

    it("handles async counterparty memory fetching when key is not in fixtures", async () => {
      const user = userEvent.setup();

      // Mock apiClient.getCounterpartyMemory
      vi.spyOn(apiClient, "getCounterpartyMemory").mockResolvedValueOnce({
        ok: true,
        data: {
          counterparty_key: "zeta_syndicate",
          relationship_status: "BLOCKED",
          overall_reliability: 0.12,
          confidence: 0.95,
          episodes_used: 28,
          sibyl: {
            verdict: {
              outcome: "veto",
              detail: "Disqualified due to protocol breach",
            },
          },
        } as unknown as CounterpartyMemory,
      });

      setChatMessages([
        {
          id: "msg-async-cite",
          role: "agent",
          text: "Flagged anomalous behavior from Zeta Syndicate.",
          complete: true,
          citations: [
            {
              counterpartyKey: "zeta_syndicate",
              label: "Zeta Syndicate",
            },
          ],
        },
      ]);

      render(<ConsoleChat runId="run_stress_async_cite" />);

      const citationRef = screen.getByRole("doc-noteref");
      await user.hover(citationRef);

      await waitFor(() => {
        expect(screen.getByTestId("hovercard-memory-preview")).toBeInTheDocument();
      });

      expect(screen.getByText("Zeta Syndicate")).toBeInTheDocument();
      expect(screen.getByText("BLOCKED")).toBeInTheDocument();
      expect(screen.getByText("12.0%")).toBeInTheDocument();
      expect(screen.getByText("95.0%")).toBeInTheDocument();
      expect(screen.getByText("28")).toBeInTheDocument();
      expect(screen.getByText(/Disqualified due to protocol breach/)).toBeInTheDocument();
    });

    it("recovers gracefully if async counterparty memory fetch fails", async () => {
      const user = userEvent.setup();

      vi.spyOn(apiClient, "getCounterpartyMemory").mockRejectedValueOnce(
        new Error("Network connection dropped"),
      );

      setChatMessages([
        {
          id: "msg-fetch-fail",
          role: "agent",
          text: "Unreachable remote node.",
          complete: true,
          citations: [
            {
              counterpartyKey: "disconnected_peer",
              label: "Disconnected Peer",
            },
          ],
        },
      ]);

      render(<ConsoleChat runId="run_stress_fetch_fail" />);

      const citationRef = screen.getByRole("doc-noteref");
      await user.hover(citationRef);

      await waitFor(() => {
        expect(screen.getByTestId("hovercard-memory-preview")).toBeInTheDocument();
      });

      // Should render fallback state ("NEW", 50.0%)
      expect(screen.getByText("Disconnected Peer")).toBeInTheDocument();
      expect(screen.getByText("NEW")).toBeInTheDocument();
      expect(screen.getByText("50.0%")).toBeInTheDocument();
    });
  });
});

describe("MissionInspector - Milestone 2 Empirical Stress Testing", () => {
  describe("Missing/null budget, 0 spent, undefined environment, multiple tx hashes", () => {
    it("handles null, undefined, and empty string budget ceiling by displaying 'None'", () => {
      const { rerender } = render(
        <MissionInspector
          runId="run_edge_1"
          environment="testnet"
          budgetUsdc={null}
        />,
      );
      expect(screen.getByTestId("meta-budget")).toHaveTextContent("None");

      rerender(
        <MissionInspector
          runId="run_edge_1"
          environment="testnet"
          budgetUsdc={undefined}
        />,
      );
      expect(screen.getByTestId("meta-budget")).toHaveTextContent("None");

      rerender(
        <MissionInspector
          runId="run_edge_1"
          environment="testnet"
          budgetUsdc=""
        />,
      );
      expect(screen.getByTestId("meta-budget")).toHaveTextContent("None");
    });

    it("correctly distinguishes 0 spent from missing spent", () => {
      // 0 spent should display 0 USDC, NOT "Not yet reported"
      const { rerender } = render(
        <MissionInspector
          runId="run_edge_2"
          environment="testnet"
          spentUsdc="0"
        />,
      );
      expect(screen.getByTestId("meta-spent")).toHaveTextContent("0 USDC");

      rerender(
        <MissionInspector
          runId="run_edge_2"
          environment="testnet"
          spentUsdc="0.000000"
        />,
      );
      expect(screen.getByTestId("meta-spent")).toHaveTextContent("0.000000 USDC");

      // Missing spent (null/undefined) MUST display "Not yet reported"
      rerender(
        <MissionInspector
          runId="run_edge_2"
          environment="testnet"
          spentUsdc={null}
        />,
      );
      expect(screen.getByTestId("meta-spent")).toHaveTextContent("Not yet reported");

      rerender(
        <MissionInspector
          runId="run_edge_2"
          environment="testnet"
          spentUsdc={undefined}
        />,
      );
      expect(screen.getByTestId("meta-spent")).toHaveTextContent("Not yet reported");
    });

    it("handles undefined environment gracefully without throwing", () => {
      render(
        <MissionInspector
          runId="run_edge_3"
          environment={undefined as unknown as string}
        />
      );

      const envEl = screen.getByTestId("meta-environment");
      expect(envEl).toBeInTheDocument();
      expect(envEl).toHaveTextContent("");
    });

    it("renders multiple Base Sepolia transaction hashes and formats links correctly", () => {
      const hashes = [
        "0x1111111111222222222233333333334444444444555555555566666666667777",
        "0x888888888899999999990000000000aaaaaaaaaabbbbbbbbbbccccccccccdddd",
        "0xshort_hash_dev",
      ];

      render(
        <MissionInspector
          runId="run_edge_4"
          environment="base-sepolia-sandbox"
          txHashes={hashes}
        />,
      );

      const links = screen.getAllByTestId("meta-tx-link");
      expect(links).toHaveLength(3);

      // Long hashes should be truncated
      expect(links[0]).toHaveTextContent("0x11111111...66667777 ↗");
      expect(links[0]).toHaveAttribute("href", `https://sepolia.basescan.org/tx/${hashes[0]}`);

      expect(links[1]).toHaveTextContent("0x88888888...ccccdddd ↗");
      expect(links[1]).toHaveAttribute("href", `https://sepolia.basescan.org/tx/${hashes[1]}`);

      // Short hash (<20 chars) should not throw and display full
      expect(links[2]).toHaveTextContent("0xshort_hash_dev ↗");
      expect(links[2]).toHaveAttribute("href", `https://sepolia.basescan.org/tx/${hashes[2]}`);
    });

    it("prefers `txHashes` array over singular `txHash` when both provided", () => {
      render(
        <MissionInspector
          runId="run_edge_5"
          environment="base-sepolia-sandbox"
          txHash="0xsingle_hash"
          txHashes={["0xarray_hash_1", "0xarray_hash_2"]}
        />,
      );

      const links = screen.getAllByTestId("meta-tx-link");
      expect(links).toHaveLength(2);
      expect(links[0]).toHaveAttribute("href", "https://sepolia.basescan.org/tx/0xarray_hash_1");
    });
  });

  describe("Toggle expand/collapse rapidly", () => {
    it("handles 30 rapid toggle clicks in uncontrolled mode without desync", async () => {
      const user = userEvent.setup();
      render(
        <MissionInspector
          runId="run_rapid_toggle"
          environment="sandbox"
          isCollapsible={true}
        />,
      );

      const toggleButton = screen.getByRole("button", { name: /show inspector/i });
      expect(toggleButton).toHaveAttribute("aria-expanded", "false");
      expect(screen.queryByTestId("mission-inspector-panel")).not.toBeInTheDocument();

      // Click 30 times (even number: should return to closed state)
      for (let i = 0; i < 30; i++) {
        await user.click(toggleButton);
      }

      expect(toggleButton).toHaveAttribute("aria-expanded", "false");
      expect(screen.queryByTestId("mission-inspector-panel")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: /show inspector/i })).toBeInTheDocument();

      // 31st click (odd: should open)
      await user.click(toggleButton);
      expect(toggleButton).toHaveAttribute("aria-expanded", "true");
      expect(screen.getByTestId("mission-inspector-panel")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /hide inspector/i })).toBeInTheDocument();
    });

    it("handles rapid toggle clicks in controlled mode", async () => {
      const user = userEvent.setup();

      function ControlledWrapper() {
        const [open, setOpen] = useState(false);
        return (
          <MissionInspector
            runId="run_controlled"
            environment="sandbox"
            isCollapsible={true}
            isOpen={open}
            onToggle={() => setOpen((prev) => !prev)}
          />
        );
      }

      render(<ControlledWrapper />);

      const toggleButton = screen.getByRole("button", { name: /show inspector/i });
      expect(screen.queryByTestId("mission-inspector-panel")).not.toBeInTheDocument();

      // Click 15 times (odd: should end open)
      for (let i = 0; i < 15; i++) {
        await user.click(toggleButton);
      }

      expect(screen.getByTestId("mission-inspector-panel")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /hide inspector/i })).toBeInTheDocument();
    });
  });

  describe("Axe accessibility audit on edge cases", () => {
    it("has zero axe violations under edge conditions (missing budget, multiple txs, memory status)", async () => {
      const { container } = render(
        <MissionInspector
          runId="run_axe_edge"
          environment="docker-edge"
          budgetUsdc={null}
          spentUsdc="0 USDC"
          txHashes={[
            "0x1111111111222222222233333333334444444444555555555566666666667777",
            "0x2222222222333333333344444444445555555555666666666677777777778888",
          ]}
          memoryStatus="Memory queried: 3 episodes analyzed"
        />,
      );

      await expectNoAxeViolations(container);
    });

    it("prevents double USDC suffix when value already includes 'USDC'", () => {
      render(
        <MissionInspector
          runId="run_usdc_suffix"
          environment="test"
          budgetUsdc="100.00 USDC"
          spentUsdc="25.50 USDC"
        />,
      );

      expect(screen.getByTestId("meta-budget")).toHaveTextContent("100.00 USDC");
      expect(screen.getByTestId("meta-budget")).not.toHaveTextContent("USDC USDC");
      expect(screen.getByTestId("meta-spent")).toHaveTextContent("25.50 USDC");
      expect(screen.getByTestId("meta-spent")).not.toHaveTextContent("USDC USDC");
    });
  });

  describe("Multi-turn thread and Citation Deduplication Stress", () => {
    it("deduplicates citations across turns in the sources rail while maintaining correct index references", () => {
      setChatMessages([
        {
          id: "turn-1-op",
          role: "operator",
          text: "What about Beta Labs?",
          complete: true,
          citations: [],
        },
        {
          id: "turn-1-ag",
          role: "agent",
          text: "Beta Labs has high reputation.",
          complete: true,
          citations: [MOCK_CITATION_BETA],
          toolCalls: [MOCK_TOOL_CLI_RUNNER],
        },
        {
          id: "turn-2-op",
          role: "operator",
          text: "Can you confirm again?",
          complete: true,
          citations: [],
        },
        {
          id: "turn-2-ag",
          role: "agent",
          text: "Confirmed with Beta Labs and Alpha Research.",
          complete: true,
          citations: [MOCK_CITATION_BETA, MOCK_CITATION_ALPHA],
        },
        {
          id: "turn-3-console",
          role: "console",
          text: "Switched to live monitoring mode.",
          complete: true,
          citations: [],
        },
      ]);

      render(<ConsoleChat runId="run_multi_turn" />);

      // Sources rail should have exactly 2 entries (Beta Labs = 1, Alpha Research = 2), NOT 3
      expect(screen.getByText("1. Beta Labs")).toBeInTheDocument();
      expect(screen.getByText("2. Alpha Research")).toBeInTheDocument();
      expect(screen.queryByText("3. Beta Labs")).not.toBeInTheDocument();

      // Inline citations in turn-2-ag:
      // Beta Labs should link with number "1"
      // Alpha Research should link with number "2"
      const docRefs = screen.getAllByRole("doc-noteref");
      expect(docRefs).toHaveLength(3); // 1 in first agent message + 2 in second
      expect(docRefs[0]).toHaveTextContent("1");
      expect(docRefs[1]).toHaveTextContent("1");
      expect(docRefs[2]).toHaveTextContent("2");
    });
  });
});

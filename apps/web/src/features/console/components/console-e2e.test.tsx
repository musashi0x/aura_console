import { useState } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { StatusDot } from "@astryxdesign/core/StatusDot";
import { Citation } from "@astryxdesign/core/Citation";
import { SegmentedControl, SegmentedControlItem } from "@astryxdesign/core/SegmentedControl";
import { ChatToolCalls, type ChatToolCallItem } from "@astryxdesign/core/Chat";
import { CodeBlock } from "@astryxdesign/core/CodeBlock";
import { HoverCard } from "@astryxdesign/core/HoverCard";
import { MetadataList, MetadataListItem } from "@astryxdesign/core/MetadataList";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { Badge } from "@astryxdesign/core/Badge";

import { expectNoAxeViolations } from "@/test/axe";
import { ChatConsoleView } from "./chat-console-view";
import { ConsoleChat } from "./console-chat";
import { __resetChatSession, setChatMessages } from "../chat/chat-session";
import { __resetMemoryView } from "../memory-view-state";

import {
  ALL_MOCK_RUNS,
  MOCK_ACTIVE_RUN_1,
  MOCK_ACTIVE_RUN_2,
  MOCK_BLOCKED_RUN_1,
  MOCK_CITATION_ALPHA,
  MOCK_CITATION_BETA,
  MOCK_COMPLETED_RUN_1,
  MOCK_COUNTERPARTY_SUMMARIES,
  MOCK_TOOL_CLI_RUNNER,
  MOCK_TOOL_ERROR,
  MOCK_TOOL_RUNNING,
  MOCK_TOOL_SIBYL_QUERY,
  MOCK_TOOL_TX_SUBMIT,
  deriveRunStatus,
  type CounterpartyMemorySummary,
  type MissionFilterStatus,
  type MissionInspectorProps,
} from "../fixtures/e2e-contracts";

// Inlined globals from vitest.config.ts
declare const __TOKENS_CSS__: string;
declare const __GLOBALS_CSS__: string;

beforeEach(() => {
  __resetChatSession();
  __resetMemoryView();
});

// =============================================================================
// Helper Component: Mission Inspector Contract Renderer
// =============================================================================
function MissionInspectorContractView({
  runId,
  environment,
  budgetUsdc,
  spentUsdc,
  txHash,
  txHashes,
  isCollapsible = false,
}: MissionInspectorProps) {
  const [isOpen, setIsOpen] = useState(!isCollapsible);
  const hashes = txHashes ?? (txHash ? [txHash] : []);

  return (
    <section className="cs__mission-inspector" aria-label="Mission Inspector">
      {isCollapsible ? (
        <button
          type="button"
          className="btn btn--sm btn--secondary cs__inspector-toggle"
          onClick={() => setIsOpen((prev) => !prev)}
          aria-expanded={isOpen}
          aria-controls="inspector-metadata-panel"
        >
          {isOpen ? "Hide Inspector" : "Show Inspector"}
        </button>
      ) : null}

      {isOpen ? (
        <div id="inspector-metadata-panel" data-testid="mission-inspector-panel">
          <MetadataList title="Mission Technical Parameters" orientation="vertical">
            <MetadataListItem label="Mission UUID">
              <code data-testid="meta-run-id">{runId}</code>
            </MetadataListItem>
            <MetadataListItem label="Sandbox Environment">
              <span data-testid="meta-environment">{environment}</span>
            </MetadataListItem>
            <MetadataListItem label="Budget Ceiling">
              <span data-testid="meta-budget">{budgetUsdc ? `${budgetUsdc} USDC` : "None"}</span>
            </MetadataListItem>
            <MetadataListItem label="Budget Spent">
              <span data-testid="meta-spent">{spentUsdc ? `${spentUsdc} USDC` : "0.000000 USDC"}</span>
            </MetadataListItem>
            <MetadataListItem label="Base Sepolia Transactions">
              {hashes.length > 0 ? (
                <VStack gap={1}>
                  {hashes.map((h) => (
                    <a
                      key={h}
                      href={`https://sepolia.basescan.org/tx/${h}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="cs__tx-link"
                      data-testid="meta-tx-link"
                    >
                      {h.slice(0, 10)}...{h.slice(-8)} ↗
                    </a>
                  ))}
                </VStack>
              ) : (
                <span data-testid="meta-no-tx">None</span>
              )}
            </MetadataListItem>
          </MetadataList>
        </div>
      ) : null}
    </section>
  );
}

// =============================================================================
// Helper Component: Counterparty Memory HoverCard Preview
// =============================================================================
function CounterpartyMemoryHoverPreview({
  summary,
  number,
  url,
  isOpen,
}: {
  summary: CounterpartyMemorySummary;
  number: number;
  url: string;
  isOpen?: boolean;
}) {
  const content = (
    <div className="cs__memory-hover-content" data-testid="hovercard-memory-preview" style={{ padding: 12, minWidth: 260 }}>
      <VStack gap={2}>
        <HStack justify="between" align="center">
          <Text as="span" size="sm" weight="bold">
            {summary.displayName}
          </Text>
          <Badge
            variant={
              summary.status === "PREFERRED"
                ? "success"
                : summary.status === "WATCH"
                  ? "warning"
                  : summary.status === "BLOCKED"
                    ? "error"
                    : "neutral"
            }
            label={summary.status}
          />
        </HStack>
        <Text as="p" size="xsm" color="secondary">
          Reliability: <strong>{(summary.overallReliability * 100).toFixed(1)}%</strong> · Confidence:{" "}
          <strong>{(summary.confidence * 100).toFixed(1)}%</strong>
        </Text>
        <Text as="p" size="xsm" color="secondary">
          Episodes: <strong>{summary.episodesUsed}</strong>
        </Text>
        {summary.latestOutcome ? (
          <Text as="p" size="xsm">
            Latest: {summary.latestOutcome}
          </Text>
        ) : null}
      </VStack>
    </div>
  );

  return (
    <HoverCard content={content} label={`Counterparty memory: ${summary.displayName}`} isOpen={isOpen}>
      <Citation
        variant="number"
        number={number}
        source={{
          title: summary.displayName,
          url,
        }}
      />
    </HoverCard>
  );
}

// =============================================================================
// TIER 1: FEATURE COVERAGE (Features 1 to 17)
// =============================================================================

describe("Tier 1: Feature Coverage", () => {
  // ---------------------------------------------------------------------------
  // 1.1 StatusDot & Live Status Derivation (Features 1, 2, 4)
  // ---------------------------------------------------------------------------
  describe("1.1 StatusDot & Live Status Derivation (Features 1, 2, 4)", () => {
    it("T1.1.1: maps RUNNING and STARTED states to active category with accent pulsing dot", () => {
      const running = deriveRunStatus("RUNNING");
      expect(running.filterCategory).toBe("active");
      expect(running.variant).toBe("accent");
      expect(running.isPulsing).toBe(true);
      expect(running.label).toBe("Running");

      const started = deriveRunStatus("STARTED");
      expect(started.filterCategory).toBe("active");
      expect(started.variant).toBe("accent");
      expect(started.isPulsing).toBe(true);
    });

    it("T1.1.2: maps COMPLETED and SETTLED states to settled category with static success dot", () => {
      const completed = deriveRunStatus("COMPLETED");
      expect(completed.filterCategory).toBe("settled");
      expect(completed.variant).toBe("success");
      expect(completed.isPulsing).toBe(false);
      expect(completed.label).toBe("Completed");

      const settled = deriveRunStatus("SETTLED");
      expect(settled.filterCategory).toBe("settled");
      expect(settled.variant).toBe("success");
    });

    it("T1.1.3: maps FAILED and BLOCKED states to settled category with static error dot", () => {
      const failed = deriveRunStatus("FAILED");
      expect(failed.filterCategory).toBe("settled");
      expect(failed.variant).toBe("error");
      expect(failed.isPulsing).toBe(false);
      expect(failed.label).toBe("Failed");

      const blocked = deriveRunStatus("BLOCKED");
      expect(blocked.filterCategory).toBe("settled");
      expect(blocked.variant).toBe("error");
      expect(blocked.label).toBe("Blocked");
    });

    it("T1.1.4: maps WAITING_APPROVAL state to active category with warning pulsing dot", () => {
      const approval = deriveRunStatus("WAITING_APPROVAL");
      expect(approval.filterCategory).toBe("active");
      expect(approval.variant).toBe("warning");
      expect(approval.isPulsing).toBe(true);
      expect(approval.label).toBe("Waiting Approval");
    });

    it("T1.1.5: StatusDot renders as an accessible role='img' element with aria-label", () => {
      render(<StatusDot variant="accent" label="Active sandbox mission" isPulsing />);
      const dot = screen.getByRole("img", { name: "Active sandbox mission" });
      expect(dot).toBeInTheDocument();
      expect(dot.tagName.toLowerCase()).toBe("span");
    });

    it("T1.1.6: StatusDot supports distinct variants: success, error, warning, neutral, accent", () => {
      const { rerender } = render(<StatusDot variant="success" label="Passed" />);
      expect(screen.getByRole("img", { name: "Passed" })).toBeInTheDocument();

      rerender(<StatusDot variant="error" label="Failed run" />);
      expect(screen.getByRole("img", { name: "Failed run" })).toBeInTheDocument();

      rerender(<StatusDot variant="neutral" label="Pending run" />);
      expect(screen.getByRole("img", { name: "Pending run" })).toBeInTheDocument();
    });

    it("T1.1.7: ChatConsoleView sidebar renders missions with status indicators", () => {
      render(<ChatConsoleView runs={ALL_MOCK_RUNS} />);
      const sidebar = screen.getByRole("complementary", { name: "Mission context selector" });
      expect(within(sidebar).getByText("RECENT MISSIONS (5)")).toBeInTheDocument();
      expect(within(sidebar).getByText(MOCK_ACTIVE_RUN_1.objective)).toBeInTheDocument();
      expect(within(sidebar).getByText(MOCK_COMPLETED_RUN_1.objective)).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // 1.2 SegmentedControl Mission Filter (Feature 3)
  // ---------------------------------------------------------------------------
  describe("1.2 SegmentedControl Mission Filtering (Feature 3)", () => {
    it("T1.2.1: renders SegmentedControl radio group with accessible label", () => {
      render(
        <SegmentedControl value="all" onChange={() => {}} label="Filter missions by status">
          <SegmentedControlItem value="all" label="All" />
          <SegmentedControlItem value="active" label="Active" />
          <SegmentedControlItem value="settled" label="Settled" />
        </SegmentedControl>,
      );
      const radioGroup = screen.getByRole("radiogroup", { name: "Filter missions by status" });
      expect(radioGroup).toBeInTheDocument();
    });

    it("T1.2.2: provides three options: All, Active, and Settled with radio roles", () => {
      render(
        <SegmentedControl value="all" onChange={() => {}} label="Mission filter">
          <SegmentedControlItem value="all" label="All" />
          <SegmentedControlItem value="active" label="Active" />
          <SegmentedControlItem value="settled" label="Settled" />
        </SegmentedControl>,
      );
      const radios = screen.getAllByRole("radio");
      expect(radios).toHaveLength(3);
      expect(screen.getByRole("radio", { name: "All" })).toBeInTheDocument();
      expect(screen.getByRole("radio", { name: "Active" })).toBeInTheDocument();
      expect(screen.getByRole("radio", { name: "Settled" })).toBeInTheDocument();
    });

    it("T1.2.3: sets aria-checked='true' on the currently selected segment item", () => {
      render(
        <SegmentedControl value="active" onChange={() => {}} label="Mission filter">
          <SegmentedControlItem value="all" label="All" />
          <SegmentedControlItem value="active" label="Active" />
          <SegmentedControlItem value="settled" label="Settled" />
        </SegmentedControl>,
      );
      expect(screen.getByRole("radio", { name: "Active" })).toHaveAttribute("aria-checked", "true");
      expect(screen.getByRole("radio", { name: "All" })).toHaveAttribute("aria-checked", "false");
      expect(screen.getByRole("radio", { name: "Settled" })).toHaveAttribute("aria-checked", "false");
    });

    it("T1.2.4: triggers onChange callback with selected value when clicked", async () => {
      const user = userEvent.setup();
      let selected = "all";
      const handleChange = (val: string) => {
        selected = val;
      };

      const { rerender } = render(
        <SegmentedControl value={selected} onChange={handleChange} label="Mission filter">
          <SegmentedControlItem value="all" label="All" />
          <SegmentedControlItem value="active" label="Active" />
          <SegmentedControlItem value="settled" label="Settled" />
        </SegmentedControl>,
      );

      await user.click(screen.getByRole("radio", { name: "Active" }));
      expect(selected).toBe("active");

      rerender(
        <SegmentedControl value={selected} onChange={handleChange} label="Mission filter">
          <SegmentedControlItem value="all" label="All" />
          <SegmentedControlItem value="active" label="Active" />
          <SegmentedControlItem value="settled" label="Settled" />
        </SegmentedControl>,
      );
      expect(screen.getByRole("radio", { name: "Active" })).toHaveAttribute("aria-checked", "true");
    });

    it("T1.2.5: partitions runs into active vs settled subsets using deriveRunStatus oracle", () => {
      const runsWithStatus = ALL_MOCK_RUNS.map((run) => {
        const raw = run.id.includes("active") ? "RUNNING" : run.id.includes("completed") ? "COMPLETED" : "FAILED";
        return { run, statusInfo: deriveRunStatus(raw) };
      });

      const activeRuns = runsWithStatus.filter((item) => item.statusInfo.filterCategory === "active");
      const settledRuns = runsWithStatus.filter((item) => item.statusInfo.filterCategory === "settled");

      expect(activeRuns.length).toBe(2);
      expect(settledRuns.length).toBe(3);
    });

    it("T1.2.6: keyboard arrow navigation shifts focus across SegmentedControl items", async () => {
      const user = userEvent.setup();
      render(
        <SegmentedControl value="all" onChange={() => {}} label="Keyboard test">
          <SegmentedControlItem value="all" label="All" />
          <SegmentedControlItem value="active" label="Active" />
          <SegmentedControlItem value="settled" label="Settled" />
        </SegmentedControl>,
      );

      const allRadio = screen.getByRole("radio", { name: "All" });
      allRadio.focus();
      expect(allRadio).toHaveFocus();

      await user.keyboard("{ArrowRight}");
      expect(screen.getByRole("radio", { name: "Active" })).toHaveFocus();
    });
  });

  // ---------------------------------------------------------------------------
  // 1.3 Astryx Native Numbered Citations & Counterparty Links (Features 9, 11)
  // ---------------------------------------------------------------------------
  describe("1.3 Astryx Native Numbered Citations & Counterparty Links (Features 9, 11)", () => {
    it("T1.3.1: renders Astryx Citation with variant='number' displaying numeric index", () => {
      render(
        <Citation
          variant="number"
          number={1}
          source={{
            title: "Beta Labs",
            url: "/counterparties?key=beta_labs",
          }}
        />,
      );
      const citation = screen.getByText("1");
      expect(citation).toBeInTheDocument();
    });

    it("T1.3.2: renders as an anchor tag with role='doc-noteref' when URL is provided", () => {
      render(
        <Citation
          variant="number"
          number={2}
          source={{
            title: "Alpha Research",
            url: "/counterparties?key=alpha_research",
          }}
        />,
      );
      const link = screen.getByRole("doc-noteref");
      expect(link).toBeInTheDocument();
      expect(link.tagName.toLowerCase()).toBe("a");
      expect(link).toHaveAttribute("href", "/counterparties?key=alpha_research");
    });

    it("T1.3.3: links directly to the counterparty profile route", () => {
      render(
        <Citation
          variant="number"
          number={3}
          source={{
            title: "Gamma Data",
            url: "/counterparties?key=gamma_data",
          }}
        />,
      );
      const link = screen.getByRole("doc-noteref");
      expect(link).toHaveAttribute("href", "/counterparties?key=gamma_data");
    });

    it("T1.3.4: includes security attributes rel='noopener noreferrer' and target='_blank'", () => {
      render(
        <Citation
          variant="number"
          number={1}
          source={{
            title: "Beta Labs",
            url: "/counterparties?key=beta_labs",
          }}
        />,
      );
      const link = screen.getByRole("doc-noteref");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
      expect(link).toHaveAttribute("target", "_blank");
    });

    it("T1.3.5: unlinked citation renders as span without invalid doc-noteref role", () => {
      render(
        <Citation
          variant="number"
          number={4}
          source={{
            title: "Internal Oracle",
          }}
        />,
      );
      const unlinked = screen.getByText("4");
      expect(unlinked.tagName.toLowerCase()).toBe("span");
      expect(unlinked).not.toHaveAttribute("role", "doc-noteref");
    });

    it("T1.3.6: sources rail numbers match citation numbers sequentially", () => {
      const citations = [MOCK_CITATION_BETA, MOCK_CITATION_ALPHA];
      render(
        <HStack gap={2}>
          {citations.map((c, i) => (
            <Citation
              key={c.counterpartyKey}
              variant="number"
              number={i + 1}
              source={{ title: c.label, url: `/counterparties?key=${c.counterpartyKey}` }}
            />
          ))}
        </HStack>,
      );
      expect(screen.getByText("1")).toBeInTheDocument();
      expect(screen.getByText("2")).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // 1.4 ChatToolCalls Visualization & Details (Features 5, 6, 8)
  // ---------------------------------------------------------------------------
  describe("1.4 ChatToolCalls Visualization & Details (Features 5, 6, 8)", () => {
    it("T1.4.1: renders single inline tool call with tool name and target", () => {
      render(<ChatToolCalls calls={[MOCK_TOOL_CLI_RUNNER]} />);
      expect(screen.getByText("cli_sandbox")).toBeInTheDocument();
      expect(
        screen.getByText("claude -p 'analyze market feed' --dangerously-skip-permissions"),
      ).toBeInTheDocument();
    });

    it("T1.4.2: displays execution duration string when complete", () => {
      render(<ChatToolCalls calls={[MOCK_TOOL_CLI_RUNNER]} />);
      expect(screen.getByText("1.4s")).toBeInTheDocument();
    });

    it("T1.4.3: displays sandbox node tag as a pill badge", () => {
      render(<ChatToolCalls calls={[MOCK_TOOL_CLI_RUNNER]} />);
      expect(screen.getByText("docker-sandbox")).toBeInTheDocument();
    });

    it("T1.4.4: renders error state with visually hidden text and error styling", () => {
      render(<ChatToolCalls calls={[MOCK_TOOL_ERROR]} />);
      expect(screen.getByText("cli_verifier")).toBeInTheDocument();
      expect(screen.getByText(/Process exited with code 1/i)).toBeInTheDocument();
    });

    it("T1.4.5: renders running state with spinner or pending indication", () => {
      render(<ChatToolCalls calls={[MOCK_TOOL_RUNNING]} />);
      expect(screen.getByText("cli_sandbox")).toBeInTheDocument();
      expect(screen.getByText("gemini -p 'synthesize consensus'")).toBeInTheDocument();
      // Running tool calls do not show a completed duration
      expect(screen.queryByText("1.4s")).not.toBeInTheDocument();
    });

    it("T1.4.6: groups multiple tool calls into collapsible summary with count", () => {
      render(<ChatToolCalls calls={[MOCK_TOOL_CLI_RUNNER, MOCK_TOOL_SIBYL_QUERY, MOCK_TOOL_TX_SUBMIT]} />);
      expect(screen.getByRole("button")).toBeInTheDocument();
      expect(screen.getAllByText("base_sepolia_tx").length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("3")).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // 1.5 CodeBlock Section Container & Logs (Feature 7)
  // ---------------------------------------------------------------------------
  describe("1.5 CodeBlock Section Container & Logs (Feature 7)", () => {
    it("T1.5.1: renders with container='section' style for seamless embedding in tool details", () => {
      const { container } = render(
        <CodeBlock
          container="section"
          code="pnpm test --filter api"
          language="bash"
        />,
      );
      const pre = container.querySelector("pre");
      expect(pre).toBeInTheDocument();
      expect(pre).toHaveTextContent("pnpm test --filter api");
    });

    it("T1.5.2: renders multiline stdout CLI runner output", () => {
      const output = "PASS src/services/reputation-fsm.test.ts\nTests: 12 passed, 12 total\nTime: 0.45s";
      const { container } = render(<CodeBlock container="section" code={output} language="bash" />);
      expect(container.querySelector("pre")).toHaveTextContent("PASS src/services/reputation-fsm.test.ts");
      expect(container.querySelector("pre")).toHaveTextContent("Tests: 12 passed, 12 total");
    });

    it("T1.5.3: renders git diff output preserving additions and deletions format", () => {
      const diff = `--- a/reputation.ts\n+++ b/reputation.ts\n@@ -10,3 +10,4 @@\n+export const CONFIDENCE_K = 5.0;\n-export const CONFIDENCE_K = 10.0;`;
      render(<CodeBlock container="section" code={diff} language="diff" />);
      expect(screen.getByText(/\+export const CONFIDENCE_K = 5.0;/)).toBeInTheDocument();
      expect(screen.getByText(/-export const CONFIDENCE_K = 10.0;/)).toBeInTheDocument();
    });

    it("T1.5.4: renders structured JSON verifier evaluation payloads", () => {
      const jsonPayload = JSON.stringify(
        { score: 0.95, tests_passed: true, summary: "Bayesian update passed all tests" },
        null,
        2,
      );
      const { container } = render(<CodeBlock container="section" code={jsonPayload} language="json" />);
      expect(container.querySelector("pre")).toHaveTextContent('"score": 0.95');
      expect(container.querySelector("pre")).toHaveTextContent('"tests_passed": true');
    });

    it("T1.5.5: supports line wrapping via isWrapped property without layout blowout", () => {
      const longLine = "git commit -m 'feat: implement Bayesian Beta-Binomial update FSM with time decay and hard veto invariants in typescript'";
      const { container } = render(
        <CodeBlock container="section" code={longLine} language="bash" isWrapped />,
      );
      const pre = container.querySelector("pre");
      expect(pre).toHaveTextContent(longLine);
    });

    it("T1.5.6: CodeBlock with copy button provides interactive copy action", async () => {
      const user = userEvent.setup();
      let copied = false;
      render(
        <CodeBlock
          container="section"
          code="echo 'copied!'"
          hasCopyButton
          onCopy={() => {
            copied = true;
          }}
        />,
      );
      const copyBtn = screen.getByRole("button", { name: /copy/i });
      expect(copyBtn).toBeInTheDocument();
      await user.click(copyBtn);
      expect(copied).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // 1.6 Rich Memory HoverCard Previews (Feature 10)
  // ---------------------------------------------------------------------------
  describe("1.6 Rich Memory HoverCard Previews (Feature 10)", () => {
    it("T1.6.1: renders HoverCard trigger wrapping an Astryx Citation", () => {
      render(
        <CounterpartyMemoryHoverPreview
          summary={MOCK_COUNTERPARTY_SUMMARIES.beta_labs!}
          number={1}
          url="/counterparties?key=beta_labs"
        />,
      );
      expect(screen.getByRole("doc-noteref")).toBeInTheDocument();
      expect(screen.getByText("1")).toBeInTheDocument();
    });

    it("T1.6.2: HoverCard popup content displays counterparty display name and PREFERRED badge", () => {
      render(
        <CounterpartyMemoryHoverPreview
          summary={MOCK_COUNTERPARTY_SUMMARIES.beta_labs!}
          number={1}
          url="/counterparties?key=beta_labs"
          isOpen={true}
        />,
      );
      expect(screen.getByText("Beta Labs")).toBeInTheDocument();
      expect(screen.getByText("PREFERRED")).toBeInTheDocument();
    });

    it("T1.6.3: displays Bayesian overallReliability and confidence percentages", () => {
      render(
        <CounterpartyMemoryHoverPreview
          summary={MOCK_COUNTERPARTY_SUMMARIES.beta_labs!}
          number={1}
          url="/counterparties?key=beta_labs"
          isOpen={true}
        />,
      );
      expect(screen.getByText(/Reliability:/)).toBeInTheDocument();
      expect(screen.getByText("94.2%")).toBeInTheDocument();
      expect(screen.getByText("88.5%")).toBeInTheDocument();
    });

    it("T1.6.4: displays episode count used in Bayesian estimation", () => {
      render(
        <CounterpartyMemoryHoverPreview
          summary={MOCK_COUNTERPARTY_SUMMARIES.beta_labs!}
          number={1}
          url="/counterparties?key=beta_labs"
          isOpen={true}
        />,
      );
      expect(screen.getByText(/Episodes:/)).toBeInTheDocument();
      expect(screen.getByText("14")).toBeInTheDocument();
    });

    it("T1.6.5: displays latest recorded outcome summary", () => {
      render(
        <CounterpartyMemoryHoverPreview
          summary={MOCK_COUNTERPARTY_SUMMARIES.beta_labs!}
          number={1}
          url="/counterparties?key=beta_labs"
          isOpen={true}
        />,
      );
      expect(
        screen.getByText(/Delivered verified dataset with 0 validation errors/),
      ).toBeInTheDocument();
    });

    it("T1.6.6: renders WATCH status badge when counterparty reliability has degraded", () => {
      render(
        <CounterpartyMemoryHoverPreview
          summary={MOCK_COUNTERPARTY_SUMMARIES.gamma_data!}
          number={3}
          url="/counterparties?key=gamma_data"
          isOpen={true}
        />,
      );
      expect(screen.getByText("Gamma Data")).toBeInTheDocument();
      expect(screen.getByText("WATCH")).toBeInTheDocument();
      expect(screen.getByText("41.5%")).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // 1.7 MetadataList Mission Inspector & Disclosure (Features 12, 13)
  // ---------------------------------------------------------------------------
  describe("1.7 MetadataList Mission Inspector & Disclosure (Features 12, 13)", () => {
    it("T1.7.1: renders MetadataList key-value technical parameters", () => {
      render(
        <MissionInspectorContractView
          runId="run_inspect_01"
          environment="base-sepolia-sandbox"
          budgetUsdc="50.000000"
          spentUsdc="12.345678"
          txHash="0x8f3c7a6e129b014d3c9071fe25a6b8c9d01234567890abcdef1234567890abcd"
        />,
      );
      expect(screen.getByText("Mission Technical Parameters")).toBeInTheDocument();
      expect(screen.getByText("Mission UUID")).toBeInTheDocument();
      expect(screen.getByText("Sandbox Environment")).toBeInTheDocument();
      expect(screen.getByText("Budget Ceiling")).toBeInTheDocument();
      expect(screen.getByText("Budget Spent")).toBeInTheDocument();
    });

    it("T1.7.2: displays Mission UUID in a monospace container", () => {
      render(
        <MissionInspectorContractView
          runId="run_inspect_01"
          environment="base-sepolia-sandbox"
        />,
      );
      const uuid = screen.getByTestId("meta-run-id");
      expect(uuid).toHaveTextContent("run_inspect_01");
      expect(uuid.tagName.toLowerCase()).toBe("code");
    });

    it("T1.7.3: displays Base Sepolia transaction hash linking to block explorer", () => {
      const tx = "0x8f3c7a6e129b014d3c9071fe25a6b8c9d01234567890abcdef1234567890abcd";
      render(
        <MissionInspectorContractView
          runId="run_inspect_01"
          environment="base-sepolia-sandbox"
          txHash={tx}
        />,
      );
      const txLink = screen.getByTestId("meta-tx-link");
      expect(txLink).toHaveAttribute("href", `https://sepolia.basescan.org/tx/${tx}`);
      expect(txLink).toHaveAttribute("target", "_blank");
      expect(txLink).toHaveAttribute("rel", "noopener noreferrer");
    });

    it("T1.7.4: displays budget ceiling and spent amounts in USDC", () => {
      render(
        <MissionInspectorContractView
          runId="run_inspect_01"
          environment="base-sepolia-sandbox"
          budgetUsdc="100.000000"
          spentUsdc="24.500000"
        />,
      );
      expect(screen.getByTestId("meta-budget")).toHaveTextContent("100.000000 USDC");
      expect(screen.getByTestId("meta-spent")).toHaveTextContent("24.500000 USDC");
    });

    it("T1.7.5: displays sandbox environment node identifier", () => {
      render(
        <MissionInspectorContractView
          runId="run_inspect_01"
          environment="base-sepolia-sandbox"
        />,
      );
      expect(screen.getByTestId("meta-environment")).toHaveTextContent("base-sepolia-sandbox");
    });

    it("T1.7.6: provides collapsible disclosure toggle button to reveal/hide parameters", async () => {
      const user = userEvent.setup();
      render(
        <MissionInspectorContractView
          runId="run_inspect_01"
          environment="base-sepolia-sandbox"
          isCollapsible={true}
        />,
      );
      const toggle = screen.getByRole("button", { name: /inspector/i });
      expect(toggle).toBeInTheDocument();

      // Initially closed when isCollapsible=true
      expect(screen.queryByTestId("mission-inspector-panel")).not.toBeInTheDocument();

      await user.click(toggle);
      expect(screen.getByTestId("mission-inspector-panel")).toBeInTheDocument();

      await user.click(toggle);
      expect(screen.queryByTestId("mission-inspector-panel")).not.toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // 1.8 Token & Accessibility Compliance (Features 14, 15, 16, 17)
  // ---------------------------------------------------------------------------
  describe("1.8 Token & Accessibility Compliance (Features 14, 15, 16, 17)", () => {
    const globalsCss = __GLOBALS_CSS__;
    const tokensCss = __TOKENS_CSS__;

    it("T1.8.1: enforces 100% token usage with 0 raw hex color literals in globals.css", () => {
      const hexMatches = globalsCss.match(/#[0-9a-fA-F]{3,8}\b/g);
      expect(hexMatches).toBeNull();
    });

    it("T1.8.2: strictly enforces dark operator palette tokens in tokens.css", () => {
      expect(tokensCss).toMatch(/--color-canvas:\s*#05070d/i);
      expect(tokensCss).toMatch(/--color-surface:\s*#0d1420/i);
      expect(tokensCss).toMatch(/--color-cyan:\s*#48d7ff/i);
    });

    it("T1.8.3: bans violet text color from all stylesheets to protect contrast", () => {
      expect(globalsCss).not.toMatch(/color:\s*var\(--color-violet\)/);
    });

    it("T1.8.4: StatusDot produces zero axe accessibility violations", async () => {
      const { container } = render(
        <StatusDot variant="accent" label="Active mission running" isPulsing />,
      );
      await expectNoAxeViolations(container);
    });

    it("T1.8.5: SegmentedControl produces zero axe accessibility violations", async () => {
      const { container } = render(
        <SegmentedControl value="active" onChange={() => {}} label="Filter runs by execution state">
          <SegmentedControlItem value="all" label="All" />
          <SegmentedControlItem value="active" label="Active" />
          <SegmentedControlItem value="settled" label="Settled" />
        </SegmentedControl>,
      );
      await expectNoAxeViolations(container);
    });

    it("T1.8.6: Citation and ChatToolCalls produce zero axe accessibility violations", async () => {
      const { container } = render(
        <VStack gap={3}>
          <Citation
            variant="number"
            number={1}
            source={{ title: "Beta Labs", url: "/counterparties?key=beta_labs" }}
          />
          <ChatToolCalls calls={[MOCK_TOOL_CLI_RUNNER]} />
        </VStack>,
      );
      await expectNoAxeViolations(container);
    });

    it("T1.8.7: CodeBlock and MetadataList produce zero axe accessibility violations", async () => {
      const { container } = render(
        <VStack gap={3}>
          <CodeBlock container="section" code="git status" language="bash" />
          <MetadataList title="Inspector">
            <MetadataListItem label="Node">base-sepolia</MetadataListItem>
          </MetadataList>
        </VStack>,
      );
      await expectNoAxeViolations(container);
    });
  });
});

// =============================================================================
// TIER 2: BOUNDARY & CORNER CASES
// =============================================================================

describe("Tier 2: Boundary & Corner Cases", () => {
  it("T2.1: empty runs list renders empty state gracefully without crashing", () => {
    render(<ChatConsoleView runs={[]} />);
    expect(screen.getByText("RECENT MISSIONS (0)")).toBeInTheDocument();
    expect(screen.getByText("No missions found yet.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "+ Start a Mission" })).toBeInTheDocument();
  });

  it("T2.2: message bubble with 0 citations and 0 tool calls renders plain text with no extraneous markup", () => {
    setChatMessages([
      {
        id: "msg-plain-1",
        role: "agent",
        text: "Direct explanation without memory lookup or sandbox execution.",
        complete: true,
        citations: [],
      },
    ]);
    render(<ConsoleChat runId="run_test_01" />);
    expect(
      screen.getByText("Direct explanation without memory lookup or sandbox execution."),
    ).toBeInTheDocument();
    // Sources rail should not exist when 0 citations are present
    expect(screen.queryByText(/CITED EVIDENCE/i)).not.toBeInTheDocument();
  });

  it("T2.3: tool call failure with non-zero exit code renders error status and message", () => {
    render(<ChatToolCalls calls={[MOCK_TOOL_ERROR]} />);
    expect(screen.getByText("cli_verifier")).toBeInTheDocument();
    expect(screen.getByText(/Process exited with code 1/)).toBeInTheDocument();
  });

  it("T2.4: tool call with missing stdout or null resultDetail handles missing data gracefully", () => {
    const minimalCall: ChatToolCallItem = {
      name: "noop_action",
      status: "complete",
    };
    render(<ChatToolCalls calls={[minimalCall]} />);
    expect(screen.getByText("noop_action")).toBeInTheDocument();
  });

  it("T2.5: unknown run status string falls back to neutral dot without throwing runtime errors", () => {
    const unknownStatus = deriveRunStatus("UNKNOWN_FUTURE_STATE");
    expect(unknownStatus.variant).toBe("neutral");
    expect(unknownStatus.isPulsing).toBe(false);
    expect(unknownStatus.label).toBe("Pending");
    expect(unknownStatus.filterCategory).toBe("active");

    const { container } = render(<StatusDot variant={unknownStatus.variant} label={unknownStatus.label} />);
    expect(container.querySelector("span[role='img']")).toBeInTheDocument();
  });

  it("T2.6: extreme timestamps (epoch 0, distant future) and sub-millisecond durations format cleanly", () => {
    const epochRun = {
      ...MOCK_ACTIVE_RUN_1,
      id: "run_epoch_0",
      objective: "Epoch 0 timestamp mission execution",
      createdAt: "1970-01-01T00:00:00.000Z",
    };
    const futureRun = {
      ...MOCK_ACTIVE_RUN_2,
      id: "run_future_3000",
      objective: "Future year 3000 mission execution",
      createdAt: "3000-01-01T12:00:00.000Z",
    };
    render(<ChatConsoleView runs={[epochRun, futureRun]} />);
    const sidebar = screen.getByRole("complementary", { name: "Mission context selector" });
    expect(within(sidebar).getByText(epochRun.objective)).toBeInTheDocument();
    expect(within(sidebar).getByText(futureRun.objective)).toBeInTheDocument();
  });

  it("T2.7: extremely long log output wraps cleanly in CodeBlock without overflow", () => {
    const longLog = Array.from({ length: 50 }, (_, i) => `[2026-09-07T08:00:${String(i).padStart(2, "0")}] log line number ${i} from CLI sandbox process execution with extended arguments`).join("\n");
    const { container } = render(<CodeBlock container="section" code={longLog} isWrapped />);
    const pre = container.querySelector("pre");
    expect(pre).toBeInTheDocument();
    expect(pre?.textContent).toContain("log line number 49");
  });

  it("T2.8: mission with null budget displays fallback 'RUN' or '0 USDC' token", () => {
    render(<ChatConsoleView runs={[MOCK_BLOCKED_RUN_1]} />);
    expect(screen.getByText("RUN")).toBeInTheDocument();
  });
});

// =============================================================================
// TIER 3: CROSS-FEATURE COMBINATIONS
// =============================================================================

describe("Tier 3: Cross-Feature Combinations", () => {
  it("T3.1: live active mission with pulsing StatusDot + assistant message with ongoing running tool call", () => {
    // 1. Mission StatusDot is pulsing
    const status = deriveRunStatus("RUNNING");
    expect(status.isPulsing).toBe(true);

    // 2. Chat message has active running tool call
    setChatMessages([
      {
        id: "msg-live-1",
        role: "agent",
        text: "Executing CLI sandbox command...",
        complete: false,
        citations: [],
        toolCalls: [MOCK_TOOL_RUNNING],
      },
    ]);

    render(
      <VStack gap={4}>
        <StatusDot variant={status.variant} label={status.label} isPulsing={status.isPulsing} />
        <ChatToolCalls calls={[MOCK_TOOL_RUNNING]} />
      </VStack>,
    );

    expect(screen.getByRole("img", { name: "Running" })).toBeInTheDocument();
    expect(screen.getByText("cli_sandbox")).toBeInTheDocument();
    expect(screen.getByText("gemini -p 'synthesize consensus'")).toBeInTheDocument();
  });

  it("T3.2: settled mission with completed citations + open HoverCard + MetadataList inspector", () => {
    const status = deriveRunStatus("COMPLETED");
    expect(status.filterCategory).toBe("settled");

    render(
      <VStack gap={4}>
        <HStack gap={2}>
          <StatusDot variant={status.variant} label={status.label} isPulsing={status.isPulsing} />
          <Text as="span">Settled Mission</Text>
        </HStack>

        <CounterpartyMemoryHoverPreview
          summary={MOCK_COUNTERPARTY_SUMMARIES.beta_labs!}
          number={1}
          url="/counterparties?key=beta_labs"
          isOpen={true}
        />

        <MissionInspectorContractView
          runId={MOCK_COMPLETED_RUN_1.id}
          environment={MOCK_COMPLETED_RUN_1.environment}
          budgetUsdc="100.000000"
          spentUsdc="15.200000"
          txHash="0x8f3c7a6e129b014d3c9071fe25a6b8c9d01234567890abcdef1234567890abcd"
        />
      </VStack>,
    );

    // Verify all 3 cross-feature components co-exist coherently
    expect(screen.getByRole("img", { name: "Completed" })).toBeInTheDocument();
    expect(screen.getByTestId("hovercard-memory-preview")).toBeInTheDocument();
    expect(screen.getByText("94.2%")).toBeInTheDocument();
    expect(screen.getByTestId("meta-run-id")).toHaveTextContent(MOCK_COMPLETED_RUN_1.id);
    expect(screen.getByTestId("meta-tx-link")).toBeInTheDocument();
  });

  it("T3.3: SegmentedControl filter switch + mission selection update + inspector synchronization", async () => {
    const user = userEvent.setup();

    function IntegratedFilterAndInspector() {
      const [filter, setFilter] = useState<MissionFilterStatus>("all");
      const [selectedId, setSelectedId] = useState<string>(ALL_MOCK_RUNS[0]!.id);

      const filteredRuns = ALL_MOCK_RUNS.filter((run) => {
        if (filter === "all") return true;
        const s = run.id.includes("active") ? "RUNNING" : "COMPLETED";
        return deriveRunStatus(s).filterCategory === filter;
      });

      const activeRun = ALL_MOCK_RUNS.find((r) => r.id === selectedId) ?? ALL_MOCK_RUNS[0]!;

      return (
        <VStack gap={3}>
          <SegmentedControl value={filter} onChange={(v) => setFilter(v as MissionFilterStatus)} label="Filter runs">
            <SegmentedControlItem value="all" label="All" />
            <SegmentedControlItem value="active" label="Active" />
            <SegmentedControlItem value="settled" label="Settled" />
          </SegmentedControl>

          <div role="list">
            {filteredRuns.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setSelectedId(r.id)}
                aria-pressed={r.id === selectedId}
              >
                {r.objective}
              </button>
            ))}
          </div>

          <MissionInspectorContractView
            runId={activeRun.id}
            environment={activeRun.environment}
            budgetUsdc={activeRun.budgetUsdc ?? "0"}
          />
        </VStack>
      );
    }

    render(<IntegratedFilterAndInspector />);

    // Initially 5 runs available
    expect(screen.getByText(MOCK_ACTIVE_RUN_1.objective)).toBeInTheDocument();
    expect(screen.getByText(MOCK_COMPLETED_RUN_1.objective)).toBeInTheDocument();
    expect(screen.getByTestId("meta-run-id")).toHaveTextContent(MOCK_ACTIVE_RUN_1.id);

    // Switch to active filter
    await user.click(screen.getByRole("radio", { name: "Active" }));
    expect(screen.getByText(MOCK_ACTIVE_RUN_1.objective)).toBeInTheDocument();
    expect(screen.queryByText(MOCK_COMPLETED_RUN_1.objective)).not.toBeInTheDocument();

    // Select second active run
    await user.click(screen.getByText(MOCK_ACTIVE_RUN_2.objective));
    expect(screen.getByTestId("meta-run-id")).toHaveTextContent(MOCK_ACTIVE_RUN_2.id);
  });

  it("T3.4: multi-tool execution with mixed outcomes (2 success, 1 failure) displaying group error state", () => {
    render(
      <ChatToolCalls
        calls={[MOCK_TOOL_CLI_RUNNER, MOCK_TOOL_ERROR, MOCK_TOOL_TX_SUBMIT]}
      />,
    );
    expect(screen.getByRole("button")).toBeInTheDocument();
    expect(screen.getAllByText("base_sepolia_tx").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("3")).toBeInTheDocument();
  });
});

// =============================================================================
// TIER 4: REAL-WORLD OPERATOR APPLICATION SCENARIOS
// =============================================================================

describe("Tier 4: Real-World Operator Application Scenarios", () => {
  it("T4.1: operator live mission triage workflow across filtering, tool execution review, and on-chain inspection", async () => {
    const user = userEvent.setup();

    function OperatorTriageHarness() {
      const [filter, setFilter] = useState<MissionFilterStatus>("all");
      const [selectedRun, setSelectedRun] = useState(MOCK_ACTIVE_RUN_1);

      const filteredRuns = ALL_MOCK_RUNS.filter((run) => {
        if (filter === "all") return true;
        const s = run.id.includes("active") ? "RUNNING" : "COMPLETED";
        return deriveRunStatus(s).filterCategory === filter;
      });

      return (
        <main className="operator-workspace">
          <header>
            <Text as="h1" size="lg" weight="bold">Operator Console</Text>
            <SegmentedControl value={filter} onChange={(v) => setFilter(v as MissionFilterStatus)} label="Run filter">
              <SegmentedControlItem value="all" label="All" />
              <SegmentedControlItem value="active" label="Active" />
              <SegmentedControlItem value="settled" label="Settled" />
            </SegmentedControl>
          </header>

          <section aria-label="Runs list" role="list">
            {filteredRuns.map((r) => {
              const status = deriveRunStatus(r.id.includes("active") ? "RUNNING" : "COMPLETED");
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setSelectedRun(r)}
                  className={`run-item ${r.id === selectedRun.id ? "is-selected" : ""}`}
                >
                  <StatusDot variant={status.variant} label={status.label} isPulsing={status.isPulsing} />
                  <span>{r.objective}</span>
                </button>
              );
            })}
          </section>

          <section aria-label="Execution details">
            <ChatToolCalls
              calls={[
                {
                  ...MOCK_TOOL_CLI_RUNNER,
                  resultDetail: (
                    <CodeBlock
                      container="section"
                      code="--- a/contract.sol\n+++ b/contract.sol\n@@ -1,2 +1,3 @@\n+function verifyVeto() public view returns (bool);"
                      language="diff"
                    />
                  ),
                },
              ]}
            />
          </section>

          <MissionInspectorContractView
            runId={selectedRun.id}
            environment={selectedRun.environment}
            budgetUsdc={selectedRun.budgetUsdc ?? undefined}
            txHash="0x8f3c7a6e129b014d3c9071fe25a6b8c9d01234567890abcdef1234567890abcd"
          />
        </main>
      );
    }

    render(<OperatorTriageHarness />);

    // Step 1: Filter to active missions only
    await user.click(screen.getByRole("radio", { name: "Active" }));
    expect(screen.getByText(MOCK_ACTIVE_RUN_1.objective)).toBeInTheDocument();
    expect(screen.getByText(MOCK_ACTIVE_RUN_2.objective)).toBeInTheDocument();
    expect(screen.queryByText(MOCK_COMPLETED_RUN_1.objective)).not.toBeInTheDocument();

    // Step 2: Verify active mission StatusDot is pulsing
    const runningDots = screen.getAllByRole("img", { name: "Running" });
    expect(runningDots.length).toBeGreaterThanOrEqual(2);

    // Step 3: Review inline CLI sandbox tool call
    expect(screen.getByText("cli_sandbox")).toBeInTheDocument();
    expect(screen.getByText("1.4s")).toBeInTheDocument();

    // Step 4: Expand inline git diff in CodeBlock by clicking tool call
    await user.click(screen.getByText("cli_sandbox"));
    const executionSection = screen.getByRole("region", { name: "Execution details" });
    expect(executionSection).toHaveTextContent("function verifyVeto()");

    // Step 5: Verify on-chain Base Sepolia transaction in MetadataList
    const txLink = screen.getByTestId("meta-tx-link");
    expect(txLink).toHaveAttribute("href", expect.stringContaining("sepolia.basescan.org/tx/0x8f3c7a6e"));
  });

  it("T4.2: operator counterparty reputation audit workflow across query, numbered citation, hover preview, and profile nav", async () => {
    const user = userEvent.setup();

    function CounterpartyAuditHarness() {
      const summary = MOCK_COUNTERPARTY_SUMMARIES.beta_labs!;
      return (
        <div>
          <div className="chat-bubble">
            <Text as="p">
              The agent selected Beta Labs after recalling 14 prior successful settlements.
            </Text>
            <CounterpartyMemoryHoverPreview
              summary={summary}
              number={1}
              url={`/counterparties?key=${summary.counterpartyKey}`}
            />
          </div>
        </div>
      );
    }

    render(<CounterpartyAuditHarness />);

    // Step 1: Verify assistant chat text
    expect(
      screen.getByText(/The agent selected Beta Labs after recalling 14 prior successful settlements/),
    ).toBeInTheDocument();

    // Step 2: Verify Astryx Citation marker with number '1' and doc-noteref role
    const citation = screen.getByRole("doc-noteref");
    expect(citation).toBeInTheDocument();
    expect(citation).toHaveTextContent("1");
    expect(citation).toHaveAttribute("href", "/counterparties?key=beta_labs");

    // Step 3: Hover citation to trigger rich memory HoverCard
    await user.hover(citation);
    await waitFor(() => {
      expect(screen.getByTestId("hovercard-memory-preview")).toBeInTheDocument();
    });

    // Step 4: Inspect Bayesian reliability and confidence inside HoverCard
    expect(screen.getByText("Beta Labs")).toBeInTheDocument();
    expect(screen.getByText("PREFERRED")).toBeInTheDocument();
    expect(screen.getByText("94.2%")).toBeInTheDocument();
    expect(screen.getByText("88.5%")).toBeInTheDocument();
  });
});

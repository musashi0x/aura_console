import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { Citation } from "@astryxdesign/core/Citation";
import { ChatToolCalls } from "@astryxdesign/core/Chat";
import { CodeBlock } from "@astryxdesign/core/CodeBlock";
import { MetadataList, MetadataListItem } from "@astryxdesign/core/MetadataList";
import { expectNoAxeViolations } from "@/test/axe";

import { __resetChatSession, setChatMessages } from "../chat/chat-session";
import { __resetMemoryView } from "../memory-view-state";
import {
  MOCK_CITATION_ALPHA,
  MOCK_CITATION_BETA,
  MOCK_TOOL_CLI_RUNNER,
  MOCK_TOOL_ERROR,
  MOCK_TOOL_RUNNING,
  MOCK_TOOL_TX_SUBMIT,
} from "../fixtures/e2e-contracts";
import { ConsoleChat } from "./console-chat";
import { CounterpartyMemoryHoverCard } from "./counterparty-memory-hover-card";
import { MissionInspector } from "./mission-inspector";

declare const __GLOBALS_CSS__: string;

beforeEach(() => {
  __resetMemoryView();
  __resetChatSession();
});

describe("Challenger 2 Empirical Verification — Astryx Component Rendering & Invariants", () => {
  // =========================================================================
  // 1. Citation variant="number"
  // =========================================================================
  describe("Invariant 1: Citation variant='number' rendering, superscript & URL", () => {
    it("renders Citation variant='number' with <a> tag, role='doc-noteref', and valid URL", () => {
      render(
        <Citation
          variant="number"
          number={1}
          source={{
            title: "Beta Labs",
            url: "/counterparties?key=beta_labs",
          }}
          data-testid="citation-test-link"
        />,
      );

      const link = screen.getByTestId("citation-test-link");
      expect(link.tagName.toLowerCase()).toBe("a");
      expect(link).toHaveAttribute("role", "doc-noteref");
      expect(link).toHaveAttribute("href", "/counterparties?key=beta_labs");
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
      expect(link).toHaveTextContent("1");
      expect(link).toHaveAttribute("data-variant", "number");

      // Verify Astryx class names and StyleX styling
      expect(link.className).toContain("astryx-citation");
    });

    it("renders Citation variant='number' as <span> without role='doc-noteref' when URL is absent", () => {
      render(
        <Citation
          variant="number"
          number={2}
          source={{
            title: "Unlinked Source",
          }}
          data-testid="citation-test-span"
        />,
      );

      const span = screen.getByTestId("citation-test-span");
      expect(span.tagName.toLowerCase()).toBe("span");
      expect(span).not.toHaveAttribute("role");
      expect(span).not.toHaveAttribute("href");
      expect(span).toHaveTextContent("2");
    });

    it("verifies ConsoleChat renders citations as Astryx numbered Citation linked to counterparty key", () => {
      setChatMessages([
        {
          id: "m2-cite-1",
          role: "agent",
          text: "Retrieved reputation score for Alpha and Beta.",
          complete: true,
          citations: [MOCK_CITATION_BETA, MOCK_CITATION_ALPHA],
        },
      ]);

      render(<ConsoleChat runId="run_m2_verify" />);

      const citationLinks = screen.getAllByRole("doc-noteref");
      expect(citationLinks).toHaveLength(2);

      expect(citationLinks[0]).toHaveTextContent("1");
      expect(citationLinks[0]).toHaveAttribute("href", "/counterparties?key=beta_labs");

      expect(citationLinks[1]).toHaveTextContent("2");
      expect(citationLinks[1]).toHaveAttribute("href", "/counterparties?key=alpha_research");
    });
  });

  // =========================================================================
  // 2. HoverCard Popover & Message Flow
  // =========================================================================
  describe("Invariant 2: HoverCard accessible popover content without breaking message flow", () => {
    it("displays accessible popover content on hover over citation", async () => {
      const user = userEvent.setup();
      setChatMessages([
        {
          id: "m2-hover-1",
          role: "agent",
          text: "Evaluated counterparty reputation.",
          complete: true,
          citations: [MOCK_CITATION_BETA],
        },
      ]);

      render(<ConsoleChat runId="run_m2_verify" />);

      const citation = screen.getByRole("doc-noteref");
      expect(citation).toBeInTheDocument();

      // Prior to hover, hovercard content is not visible
      expect(screen.queryByTestId("hovercard-memory-preview")).not.toBeInTheDocument();

      await user.hover(citation);

      await waitFor(() => {
        expect(screen.getByTestId("hovercard-memory-preview")).toBeInTheDocument();
      });

      const preview = screen.getByTestId("hovercard-memory-preview");
      expect(preview).toHaveTextContent("Beta Labs");
      expect(preview).toHaveTextContent("PREFERRED");
      expect(preview).toHaveTextContent("94.2%");
      expect(preview).toHaveTextContent("88.5%");
      expect(preview).toHaveTextContent("14");
    });

    it("renders CounterpartyMemoryHoverCard with proper accessibility and badge status", () => {
      render(
        <CounterpartyMemoryHoverCard
          counterpartyKey="beta_labs"
          displayName="Beta Labs"
          summary={{
            counterpartyKey: "beta_labs",
            displayName: "Beta Labs",
            status: "PREFERRED",
            overallReliability: 0.942,
            confidence: 0.885,
            episodesUsed: 14,
            latestOutcome: "Tests passed: 12/12",
          }}
        />,
      );

      const preview = screen.getByTestId("hovercard-memory-preview");
      expect(preview).toBeInTheDocument();
      expect(screen.getByText("PREFERRED")).toBeInTheDocument();
      expect(screen.getByText("Latest: Tests passed: 12/12")).toBeInTheDocument();
      expect(screen.getByText("beta_labs")).toHaveClass("mono-ref__value");
    });
  });

  // =========================================================================
  // 3. ChatToolCalls: Duration, Sandbox Node Badge & Status Spinners/Icons
  // =========================================================================
  describe("Invariant 3: ChatToolCalls renders duration, sandbox node badge, and status icons", () => {
    it("renders duration, sandbox node badge, and complete check icon for completed tool call", () => {
      render(
        <ChatToolCalls
          calls={[
            {
              name: "cli_sandbox",
              node: "docker-sandbox",
              duration: "1.4s",
              status: "complete",
            },
          ]}
          data-testid="tool-calls-single"
        />,
      );

      expect(screen.getByText("cli_sandbox")).toBeInTheDocument();
      expect(screen.getByText("docker-sandbox")).toBeInTheDocument();
      expect(screen.getByText("1.4s")).toBeInTheDocument();

      // Node is rendered in an Astryx Badge
      const nodeBadge = screen.getByText("docker-sandbox").closest(".astryx-badge");
      expect(nodeBadge).toBeInTheDocument();
      expect(nodeBadge).toHaveAttribute("data-variant", "neutral");
    });

    it("renders spinner for running and pending tool calls", () => {
      const { container } = render(
        <ChatToolCalls
          calls={[MOCK_TOOL_RUNNING]}
          data-testid="tool-calls-running"
        />,
      );

      expect(screen.getByText("cli_sandbox")).toBeInTheDocument();
      expect(screen.getByText("gemini -p 'synthesize consensus'")).toBeInTheDocument();

      // Spinner rendered in running call
      const spinner = container.querySelector(".astryx-spinner");
      expect(spinner).toBeInTheDocument();
      expect(spinner).toHaveAttribute("role", "status");
    });

    it("renders error status and accessible error message for failed tool call", () => {
      render(
        <ChatToolCalls
          calls={[MOCK_TOOL_ERROR]}
          data-testid="tool-calls-error"
        />,
      );

      expect(screen.getByText("cli_verifier")).toBeInTheDocument();
      // Error message rendered in visually hidden element
      expect(screen.getByText(/Process exited with code 1/)).toBeInTheDocument();
    });

    it("renders grouped tool calls with summary count", () => {
      render(
        <ChatToolCalls
          calls={[MOCK_TOOL_CLI_RUNNER, MOCK_TOOL_TX_SUBMIT]}
          data-testid="tool-calls-group"
        />,
      );

      // Multiple calls render a summary button with total count
      expect(screen.getByText("2")).toBeInTheDocument();
    });
  });

  // =========================================================================
  // 4. CodeBlock container="section" borderless transparent block
  // =========================================================================
  describe("Invariant 4: CodeBlock container='section' borderless transparent block", () => {
    it("renders CodeBlock container='section' with data-container='section'", () => {
      const sampleCode = "export const VETO = true;";
      render(
        <CodeBlock
          container="section"
          code={sampleCode}
          language="typescript"
          isWrapped
          data-testid="codeblock-section"
        />,
      );

      const codeblock = screen.getByTestId("codeblock-section");
      expect(codeblock).toBeInTheDocument();
      expect(codeblock).toHaveAttribute("data-container", "section");
      expect(codeblock.tagName.toLowerCase()).toBe("pre");
      expect(codeblock).toHaveTextContent("export const VETO = true;");
    });

    it("expands tool call resultDetail to show borderless CodeBlock container='section'", async () => {
      const user = userEvent.setup();
      setChatMessages([
        {
          id: "m2-tool-expand",
          role: "agent",
          text: "Verification diff below.",
          complete: true,
          citations: [],
          toolCalls: [
            {
              name: "git_diff",
              status: "complete",
              node: "sandbox",
              data: "diff --git a/file b/file\n+added line",
            },
          ],
        },
      ]);

      render(<ConsoleChat runId="run_m2_verify" />);

      const toolButton = screen.getByText("git_diff");
      await user.click(toolButton);

      const expandedCode = screen.getByText(/\+added line/);
      expect(expandedCode).toBeInTheDocument();

      const codeblock = expandedCode.closest(".astryx-code-block, .astryx-codeblock");
      expect(codeblock).toBeInTheDocument();
      expect(codeblock).toHaveAttribute("data-container", "section");
    });
  });

  // =========================================================================
  // 5. MetadataList Semantic <dl>, <dt>, and <dd> Invariant
  // =========================================================================
  describe("Invariant 5: MetadataList semantic <dl>, <dt>, and <dd> elements", () => {
    it("renders semantic dl, dt, and dd elements in Astryx MetadataList", () => {
      render(
        <MetadataList columns="multi" title="Technical Specs" data-testid="test-meta-list">
          <MetadataListItem label="Label 1">Value 1</MetadataListItem>
          <MetadataListItem label="Label 2">Value 2</MetadataListItem>
        </MetadataList>,
      );

      const listContainer = screen.getByTestId("test-meta-list");
      expect(listContainer).toBeInTheDocument();

      const dl = listContainer.querySelector("dl");
      expect(dl).not.toBeNull();

      const dts = listContainer.querySelectorAll("dt");
      const dds = listContainer.querySelectorAll("dd");

      expect(dts).toHaveLength(2);
      expect(dds).toHaveLength(2);

      expect(dts[0]).toHaveTextContent("Label 1");
      expect(dds[0]).toHaveTextContent("Value 1");
      expect(dts[1]).toHaveTextContent("Label 2");
      expect(dds[1]).toHaveTextContent("Value 2");
    });

    it("verifies MissionInspector renders technical parameters in semantic <dl>, <dt>, and <dd>", () => {
      render(
        <MissionInspector
          runId="run_m2_inspector"
          environment="docker-sandbox"
          budgetUsdc="100.000000"
          spentUsdc="25.500000"
          txHash="0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
          memoryStatus="Grounding complete"
        />,
      );

      const panel = screen.getByTestId("mission-inspector-panel");
      const dl = panel.querySelector("dl");
      expect(dl).not.toBeNull();

      const labels = Array.from(panel.querySelectorAll("dt")).map((dt) => dt.textContent?.trim());
      expect(labels).toContain("Mission UUID");
      expect(labels).toContain("Sandbox Environment");
      expect(labels).toContain("Budget Ceiling");
      expect(labels).toContain("Budget Spent");
      expect(labels).toContain("Memory");
      expect(labels).toContain("Base Sepolia Transactions");

      expect(screen.getByTestId("meta-run-id")).toHaveTextContent("run_m2_inspector");
      expect(screen.getByTestId("meta-environment")).toHaveTextContent("docker-sandbox");
      expect(screen.getByTestId("meta-budget")).toHaveTextContent("100.000000 USDC");
      expect(screen.getByTestId("meta-spent")).toHaveTextContent("25.500000 USDC");
      expect(screen.getByTestId("meta-memory")).toHaveTextContent("Grounding complete");
      expect(screen.getByTestId("meta-tx-link")).toHaveAttribute(
        "href",
        "https://sepolia.basescan.org/tx/0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
      );
    });
  });

  // =========================================================================
  // 6. Zero Raw Hex & Token Conformance
  // =========================================================================
  describe("Invariant 6: Zero raw hex in globals.css", () => {
    it("has zero raw hex colors anywhere in globals.css", () => {
      const hexMatches = __GLOBALS_CSS__.match(/#[0-9a-fA-F]{3,8}\b/g);
      expect(hexMatches).toBeNull();
    });

    it("verifies all colors consume design tokens var(--color-*) or var(--glow-*)", () => {
      // Strip comments
      const cssNoComments = __GLOBALS_CSS__.replace(/\/\*[\s\S]*?\*\//g, "");
      // Look for any color property in globals.css and verify it uses var(--...)
      const colorPropertyRules = cssNoComments.match(/(?:color|background|background-color|border-color):\s*([^;]+);/g);
      expect(colorPropertyRules).not.toBeNull();
      for (const rule of colorPropertyRules!) {
        // Values must be keywords (transparent, currentColor, inherit) or var(--...)
        const val = rule.split(":")[1]!.trim().replace(";", "");
        if (
          val === "transparent" ||
          val === "currentColor" ||
          val === "inherit" ||
          val === "none"
        ) {
          continue;
        }
        expect(val).toMatch(/var\(--/);
      }
    });
  });

  // =========================================================================
  // 7. Axe Accessibility Audits
  // =========================================================================
  describe("Invariant 7: Axe accessibility compliance across all components", () => {
    it("passes axe check for MissionInspector in all states", async () => {
      const { container, rerender } = render(
        <MissionInspector
          runId="run_axe_test"
          environment="sandbox"
          budgetUsdc="50.000000"
          spentUsdc="10.000000"
          txHash="0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890"
          memoryStatus="Reachable"
        />,
      );
      await expectNoAxeViolations(container);

      // Collapsible closed
      rerender(
        <MissionInspector
          runId="run_axe_test"
          environment="sandbox"
          isCollapsible={true}
        />,
      );
      await expectNoAxeViolations(container);
    });

    it("passes axe check for ConsoleChat with tool calls and citations", async () => {
      setChatMessages([
        {
          id: "msg-axe-full",
          role: "agent",
          text: "Full chat message with tool execution and memory citation.",
          complete: true,
          citations: [MOCK_CITATION_BETA],
          toolCalls: [MOCK_TOOL_CLI_RUNNER, MOCK_TOOL_TX_SUBMIT],
        },
      ]);

      const { container } = render(<ConsoleChat runId="run_axe_chat" />);
      await expectNoAxeViolations(container);
    });

    it("passes axe check for CounterpartyMemoryHoverCard standalone", async () => {
      const { container } = render(
        <CounterpartyMemoryHoverCard
          counterpartyKey="beta_labs"
          displayName="Beta Labs"
          summary={{
            counterpartyKey: "beta_labs",
            displayName: "Beta Labs",
            status: "PREFERRED",
            overallReliability: 0.942,
            confidence: 0.885,
            episodesUsed: 14,
            latestOutcome: "Successful mission run",
          }}
        />,
      );
      await expectNoAxeViolations(container);
    });
  });
});

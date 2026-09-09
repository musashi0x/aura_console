import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "@/lib/api-client";
import { expectNoAxeViolations } from "@/test/axe";

vi.mock("@/lib/api-client", () => ({
  apiClient: {
    approveRun: vi.fn(async () => ({
      ok: true,
      data: { event: { event_id: "evt_granted", type: "approval.granted", sequence: 2 } },
    })),
  },
}));

// Inlined by vitest.config.ts (`define`) — see cssRaw there.
declare const __GLOBALS_CSS__: string;

import { console_ } from "../copy";
import { __resetChatSession, setChatMessages } from "../chat/chat-session";
import { __resetMemoryView, getMemoryViewEnabled } from "../memory-view-state";
import {
  MOCK_CITATION_ALPHA,
  MOCK_CITATION_BETA,
  MOCK_TOOL_CLI_RUNNER,
  MOCK_TOOL_ERROR,
  MOCK_TOOL_TX_SUBMIT,
} from "../fixtures/e2e-contracts";
import { ConsoleChat } from "./console-chat";

beforeEach(() => {
  __resetMemoryView();
  __resetChatSession();
});

describe("console chat", () => {
  it("names the Run the conversation is scoped to", () => {
    render(<ConsoleChat runId="run_42" />);
    expect(screen.getByText("run_42")).toBeInTheDocument();
  });

  it("says there is nothing to ask about when no Run is selected", () => {
    render(<ConsoleChat />);
    expect(screen.getByText(/No Run selected/i)).toBeInTheDocument();
    // The composer stays usable without a Run: console commands work on every
    // surface, and only a QUESTION needs a Run to be about. Disabling the
    // field here would take the command surface away from four of the five
    // console surfaces to guard against a case the submit path already
    // handles honestly.
    expect(screen.getByLabelText("Message input")).toBeInTheDocument();
  });

  it("says grounding was never checked rather than guessing either way", () => {
    render(<ConsoleChat runId="run_42" />);
    expect(screen.getByText("GROUNDING NOT CONNECTED")).toBeInTheDocument();
    expect(screen.getByText(console_.chat.groundingUnchecked)).toBeInTheDocument();
    // MEMORY UNAVAILABLE reports the result of a retrieval that was attempted.
    // Nothing was attempted here, so borrowing that badge would report an
    // outcome the console never obtained.
    expect(screen.queryByText("MEMORY UNAVAILABLE")).not.toBeInTheDocument();
  });

  it("names the half that is missing when the check came back", () => {
    render(
      <ConsoleChat
        runId="run_42"
        grounding={{ agentReachable: false, memoryReachable: true, detail: "The agent answered 502." }}
      />,
    );
    expect(screen.getByText("GROUNDING NOT CONNECTED")).toBeInTheDocument();
    expect(screen.getByText("The agent answered 502.")).toBeInTheDocument();
  });

  it("drops the warning only when both halves actually answered", () => {
    render(
      <ConsoleChat runId="run_42" grounding={{ agentReachable: true, memoryReachable: true }} />,
    );
    // This banner used to be hardcoded, so it went on announcing that grounding
    // was not connected after an agent and a memory were both answering.
    expect(screen.queryByText("GROUNDING NOT CONNECTED")).not.toBeInTheDocument();
  });

  it("says commands still run, so a warning does not read as a dead panel", () => {
    render(
      <ConsoleChat runId="run_42" grounding={{ agentReachable: false, memoryReachable: false }} />,
    );
    // The note used to say only that no question could be answered, which
    // reads as "nothing here works" — and console commands work on every
    // surface whether or not the answering path is up.
    expect(screen.getByText(console_.chat.groundingNote)).toBeInTheDocument();
    expect(console_.chat.groundingNote).toMatch(/commands still run/i);
  });

  it("keeps warning when the agent is up but its memory is not", () => {
    render(
      <ConsoleChat runId="run_42" grounding={{ agentReachable: true, memoryReachable: false }} />,
    );
    // An agent with no memory answers from nothing, which is the failure this
    // product exists to prevent. Half a path is not a path.
    expect(screen.getByText("GROUNDING NOT CONNECTED")).toBeInTheDocument();
  });

  it("only mentions the memory toggle when the palette actually reports it off", () => {
    const { rerender } = render(<ConsoleChat runId="run_42" />);
    expect(
      screen.queryByText(/switched off in the command palette/i),
    ).not.toBeInTheDocument();

    rerender(<ConsoleChat runId="run_42" memoryEnabled={false} />);
    expect(screen.getByText(/switched off in the command palette/i)).toBeInTheDocument();
  });

  it("tells the operator the surface cannot move money", () => {
    render(<ConsoleChat runId="run_42" />);
    expect(
      screen.getByText(/cannot start or approve an economic action/i),
    ).toBeInTheDocument();
  });

  it("starts with an offer of what works, and no agent turn", () => {
    render(<ConsoleChat runId="run_42" />);
    // An empty thread used to say only "No questions asked yet", which told the
    // operator nothing they could act on. The zero state names the commands
    // that run now and marks the one that still needs the agent.
    expect(screen.getByText(console_.chat.zero.title)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: console_.palette.commands.runs }),
    ).toBeInTheDocument();
    expect(screen.getByText(console_.chat.zero.needsAgentLabel)).toBeInTheDocument();
    expect(screen.queryByText("Agent")).not.toBeInTheDocument();
  });

  it("a suggestion fills the composer rather than running on sight", async () => {
    const user = userEvent.setup();
    render(<ConsoleChat runId="run_42" />);
    await user.click(screen.getByRole("button", { name: "Toggle Memory On/Off view" }));
    // Running it on click would navigate or change a view out from under
    // someone who was still reading the list.
    expect(screen.getByLabelText("Message input")).toHaveTextContent("memory off");
    expect(getMemoryViewEnabled()).toBe(true);
  });

  it("keeps the send button unusable until a question is typed", async () => {
    const user = userEvent.setup();
    render(<ConsoleChat runId="run_42" />);

    const button = screen.getByRole("button", { name: "Send" });
    expect(button).toBeDisabled();

    await user.type(screen.getByLabelText("Message input"), "why Alpha?");
    expect(button).toBeEnabled();
  });

  it("keeps the composer at the bottom, empty thread or not", async () => {
    const user = userEvent.setup();
    const { container } = render(<ConsoleChat runId="run_42" />);
    const order = () => {
      const nodes = [...container.querySelectorAll("*")];
      return {
        composerAt: nodes.indexOf(screen.getByLabelText("Message input")),
        listAt: nodes.findIndex((n) => n.getAttribute("role") === "log"),
      };
    };

    // The place you type is the bottom of a chat, before there is anything to
    // read and after. Moving it by state relocates the control under the
    // operator between one message and the next.
    const empty = order();
    expect(empty.listAt).toBeLessThan(empty.composerAt);

    await user.type(screen.getByLabelText("Message input"), "go to runs");
    await user.click(screen.getByRole("button", { name: "Send" }));

    const withTurns = order();
    expect(withTurns.listAt).toBeLessThan(withTurns.composerAt);
  });

  it("shows no cited-evidence list until an answer actually cites a record", () => {
    render(<ConsoleChat runId="run_42" />);
    // A catalogue of available memory here would imply a retrieval that has not
    // run, and an empty rail headed "Cited evidence" is a section asserting it
    // looked and found nothing. Nothing is claimed until the stream cites.
    expect(screen.queryByText(console_.chat.sourcesTitle)).toBeNull();
  });

  it("has no axe violations", async () => {
    const { container } = render(<ConsoleChat runId="run_42" />);
    await expectNoAxeViolations(container);
  });
});

describe("the slash-command menu stays off until ARIA allows it", () => {
  it("does not put triggers on the composer input", () => {
    // With `triggers` the input becomes role="combobox" while keeping
    // aria-multiline="true", which ARIA forbids — verified by isolation against
    // @astryxdesign/core 0.5.2. Wiring it back without checking that attribute
    // ships a self-contradicting control on the one element that matters most.
    render(<ConsoleChat runId="run_42" />);
    const input = screen.getByLabelText("Message input");
    expect(input).toHaveAttribute("role", "textbox");
    expect(input).not.toHaveAttribute("aria-expanded");
  });
});

describe("the conversation is the design system's, not this repo's", () => {
  const css = __GLOBALS_CSS__;

  /**
   * Wrapping, composer stacking and bubble layout used to be asserted here
   * against hand-written CSS. ChatComposer, ChatMessageList and
   * ChatMessageBubble own all three now, and asserting a dependency's
   * stylesheet from this file would be testing someone else's code. The
   * browser sweep across every surface and width is the proof that nothing
   * overflows; what this guards is that the hand-written version does not
   * creep back in beside the one the design system provides.
   */
  it("keeps no hand-written CSS for the conversation itself", () => {
    for (const dead of [
      ".cs__chat-turn",
      ".cs__chat-composer",
      ".cs__chat-input",
      ".cs__chat-thread",
      ".cs__chat-sources",
      ".cs__chat-chip",
    ]) {
      expect(css).not.toContain(dead);
    }
  });

  it("still owns where the console puts the chat", () => {
    // The frame is theirs; the placement is ours, and it has to stay legible.
    for (const kept of [".cs__chat-surface", ".cs__chat-region", ".cs__chat-launcher"]) {
      expect(css).toContain(kept);
    }
  });
});

describe("inline agent execution visualizer (ChatToolCalls & CodeBlock)", () => {
  it("renders inline tool calls with tool name, node tag, and execution duration", () => {
    setChatMessages([
      {
        id: "msg-tool-1",
        role: "agent",
        text: "Analyzing market data in sandbox.",
        complete: true,
        citations: [],
        toolCalls: [MOCK_TOOL_CLI_RUNNER],
      },
    ]);
    render(<ConsoleChat runId="run_42" />);

    expect(screen.getByText("cli_sandbox")).toBeInTheDocument();
    expect(screen.getByText("docker-sandbox")).toBeInTheDocument();
    expect(screen.getByText("1.4s")).toBeInTheDocument();
    expect(screen.getByText("Analyzing market data in sandbox.")).toBeInTheDocument();
  });

  it("renders expandable CodeBlock resultDetail with syntax highlighting", async () => {
    const user = userEvent.setup();
    setChatMessages([
      {
        id: "msg-tool-2",
        role: "agent",
        text: "Applied worktree patch.",
        complete: true,
        citations: [],
        toolCalls: [
          {
            name: "git_diff",
            status: "complete",
            node: "sandbox-node",
            data: "--- a/reputation.ts\n+++ b/reputation.ts\n@@ -1 +1,2 @@\n+export const VETO = true;",
          },
        ],
      },
    ]);
    render(<ConsoleChat runId="run_42" />);

    expect(screen.getByText("git_diff")).toBeInTheDocument();
    await user.click(screen.getByText("git_diff"));
    expect(screen.getByText(/export const VETO = true;/)).toBeInTheDocument();
  });

  it("groups multiple tool calls into a collapsible summary", () => {
    setChatMessages([
      {
        id: "msg-tool-multi",
        role: "agent",
        text: "Completed multi-stage execution.",
        complete: true,
        citations: [],
        toolCalls: [MOCK_TOOL_CLI_RUNNER, MOCK_TOOL_TX_SUBMIT],
      },
    ]);
    render(<ConsoleChat runId="run_42" />);

    // In Astryx ChatToolCalls, multiple calls render group with count
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("renders tool call error states and error messages", () => {
    setChatMessages([
      {
        id: "msg-tool-err",
        role: "agent",
        text: "Execution failed during verification.",
        complete: true,
        citations: [],
        toolCalls: [MOCK_TOOL_ERROR],
      },
    ]);
    render(<ConsoleChat runId="run_42" />);

    expect(screen.getByText("cli_verifier")).toBeInTheDocument();
    expect(screen.getByText(/Process exited with code 1/)).toBeInTheDocument();
  });

  it("preserves clean text rendering without tool call container when no tool calls exist", () => {
    setChatMessages([
      {
        id: "msg-clean",
        role: "agent",
        text: "Plain answer without tools or memory.",
        complete: true,
        citations: [],
      },
    ]);
    render(<ConsoleChat runId="run_42" />);

    expect(screen.getByText("Plain answer without tools or memory.")).toBeInTheDocument();
    expect(screen.queryByText(/cli_/)).not.toBeInTheDocument();
  });

  it("has no axe violations when rendering messages with tool calls", async () => {
    setChatMessages([
      {
        id: "msg-tool-axe",
        role: "agent",
        text: "Tool execution result.",
        complete: true,
        citations: [],
        toolCalls: [MOCK_TOOL_CLI_RUNNER],
      },
    ]);
    const { container } = render(<ConsoleChat runId="run_42" />);
    await expectNoAxeViolations(container);
  });
});

describe("native citations and memory hovercard", () => {
  it("renders Astryx numbered Citation linking to counterparty profile", () => {
    setChatMessages([
      {
        id: "msg-cite-1",
        role: "agent",
        text: "Referenced Beta Labs reputation data.",
        complete: true,
        citations: [MOCK_CITATION_BETA],
      },
    ]);
    render(<ConsoleChat runId="run_42" />);

    const citationLink = screen.getByRole("doc-noteref");
    expect(citationLink).toBeInTheDocument();
    expect(citationLink).toHaveTextContent("1");
    expect(citationLink).toHaveAttribute("href", "/counterparties?key=beta_labs");
    expect(citationLink).toHaveAttribute("target", "_blank");
    expect(citationLink).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("displays multiple citations with sequential numbers matching sources rail", () => {
    setChatMessages([
      {
        id: "msg-cite-multi",
        role: "agent",
        text: "Compared Beta Labs and Alpha Research.",
        complete: true,
        citations: [MOCK_CITATION_BETA, MOCK_CITATION_ALPHA],
      },
    ]);
    render(<ConsoleChat runId="run_42" />);

    const links = screen.getAllByRole("doc-noteref");
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveTextContent("1");
    expect(links[1]).toHaveTextContent("2");
    expect(links[0]).toHaveAttribute("href", "/counterparties?key=beta_labs");
    expect(links[1]).toHaveAttribute("href", "/counterparties?key=alpha_research");
  });

  it("reveals rich CounterpartyMemoryHoverCard on hover", async () => {
    const user = userEvent.setup();
    setChatMessages([
      {
        id: "msg-cite-hover",
        role: "agent",
        text: "Inspected counterparty memory.",
        complete: true,
        citations: [MOCK_CITATION_BETA],
      },
    ]);
    render(<ConsoleChat runId="run_42" />);

    const citation = screen.getByRole("doc-noteref");
    await user.hover(citation);

    await waitFor(() => {
      expect(screen.getByTestId("hovercard-memory-preview")).toBeInTheDocument();
    });

    expect(screen.getByText("Beta Labs")).toBeInTheDocument();
    expect(screen.getByText("PREFERRED")).toBeInTheDocument();
    expect(screen.getByText("94.2%")).toBeInTheDocument();
    expect(screen.getByText("88.5%")).toBeInTheDocument();
    expect(screen.getByText("14")).toBeInTheDocument();
  });

  it("has no axe violations when rendering messages with citations", async () => {
    setChatMessages([
      {
        id: "msg-cite-axe",
        role: "agent",
        text: "Checking reputation memory.",
        complete: true,
        citations: [MOCK_CITATION_BETA],
      },
    ]);
    const { container } = render(<ConsoleChat runId="run_42" />);
    await expectNoAxeViolations(container);
  });
});

describe("generative-loaders text streaming effects", () => {
  it("renders agent chat response with generative-loaders TextLoader redact variant", () => {
    setChatMessages([
      {
        id: "msg-redact-1",
        role: "agent",
        text: "I'll organize the launch plan based on the research.",
        complete: false,
        citations: [],
      },
    ]);
    const { container } = render(<ConsoleChat runId="run_42" />);

    const loader = container.querySelector(".tl-loader[data-variant='redact']");
    expect(loader).toBeInTheDocument();
    expect(loader).toHaveAttribute("role", "status");
    expect(loader).toHaveAttribute("aria-live", "polite");
    expect(screen.getByText(/I'll organize the launch plan/)).toBeInTheDocument();
  });
});

describe("interactive in-chat approvals and tool start streaming", () => {
  it("renders interactive in-chat approval action card when message contains mission_propose_approval tool call", async () => {
    const user = userEvent.setup();
    setChatMessages([
      {
        id: "msg-approval-1",
        role: "agent",
        text: "I evaluated Beta Labs and drafted an approval proposal.",
        complete: true,
        citations: [],
        toolCalls: [
          {
            name: "mission_propose_approval",
            status: "complete",
            args: {
              counterpartyKey: "virtuals:agent:beta",
              amountUsdc: "10.000000",
              reason: "Draft contract and engagement with Beta Labs under 10 USDC ceiling",
              runId: "run_42",
            },
            result: {
              proposed: true,
              status: "AWAITING_APPROVAL",
              amountUsdc: "10.000000",
              counterpartyKey: "virtuals:agent:beta",
              counterfactualRationale: "Memory checked; Beta Labs has 94% reliability.",
            },
          },
        ],
      },
    ]);

    render(<ConsoleChat runId="run_42" />);

    expect(screen.getByText("Proposed Spend Approval")).toBeInTheDocument();
    expect(screen.getByText("virtuals:agent:beta")).toBeInTheDocument();
    expect(screen.getByText("$10.00 USDC")).toBeInTheDocument();
    expect(
      screen.getByText("Draft contract and engagement with Beta Labs under 10 USDC ceiling"),
    ).toBeInTheDocument();

    const approveButton = screen.getByRole("button", { name: /approve spend/i });
    expect(approveButton).toBeInTheDocument();

    await user.click(approveButton);

    await waitFor(() => {
      expect(apiClient.approveRun).toHaveBeenCalledWith("run_42", "10.000000");
    });
    expect(screen.getByText("Spend Approved")).toBeInTheDocument();
  });

  it("renders running tool call with active status from tool_start", () => {
    setChatMessages([
      {
        id: "msg-running-1",
        role: "agent",
        text: "Inspecting sandbox...",
        complete: false,
        citations: [],
        toolCalls: [
          {
            name: "cli_sandbox",
            status: "running",
            target: '{"cmd":"eval"}',
          },
        ],
      },
    ]);

    render(<ConsoleChat runId="run_42" />);

    expect(screen.getByText("cli_sandbox")).toBeInTheDocument();
  });

  it("does not render Approve Spend action card while proposal is still running", () => {
    setChatMessages([
      {
        id: "msg-running-proposal",
        role: "agent",
        text: "Evaluating spend...",
        complete: false,
        citations: [],
        toolCalls: [
          {
            name: "mission_propose_approval",
            status: "running",
            args: {
              counterpartyKey: "virtuals:agent:beta",
              amountUsdc: "10.000000",
              reason: "Awaiting backend execution",
              runId: "run_42",
            },
          },
        ],
      },
    ]);

    render(<ConsoleChat runId="run_42" />);

    // The tool call item should be rendered
    expect(screen.getByText("mission_propose_approval")).toBeInTheDocument();
    // But the interactive approval card with the Approve Spend button must NOT be offered yet
    expect(screen.queryByRole("button", { name: /approve spend/i })).not.toBeInTheDocument();
    expect(screen.queryByText("Proposed Spend Approval")).not.toBeInTheDocument();
  });

  it("does not render Approve Spend card if proposal tool call resulted in error", () => {
    setChatMessages([
      {
        id: "msg-failed-proposal",
        role: "agent",
        text: "Spend rejected by policy.",
        complete: true,
        citations: [],
        toolCalls: [
          {
            name: "mission_propose_approval",
            status: "error",
            args: {
              counterpartyKey: "virtuals:agent:beta",
              amountUsdc: "500.000000",
              reason: "Exceeds absolute spend limit",
              runId: "run_42",
            },
            result: { error: "Spend exceeds policy limit" },
          },
        ],
      },
    ]);

    render(<ConsoleChat runId="run_42" />);

    expect(screen.getByText("mission_propose_approval")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /approve spend/i })).not.toBeInTheDocument();
    expect(screen.queryByText("Proposed Spend Approval")).not.toBeInTheDocument();
  });
});

describe("route-aware chat surface grounding", () => {
  it("renders surface badge, summary, and quick active counterparty pills on Agents surface", () => {
    render(<ConsoleChat surface="Agents" />);

    expect(screen.getByTestId("chat-surface-scope")).toBeInTheDocument();
    expect(screen.getByText("COUNTERPARTIES & AGENTS")).toBeInTheDocument();
    expect(screen.getByText(/Active Registry \(Alpha, Beta, Charlie\)/)).toBeInTheDocument();
    expect(screen.getAllByText("Alpha Research (Alpha)")).toHaveLength(2);
    expect(screen.getAllByText("Agent Beta")).toHaveLength(2);
    expect(screen.getAllByText("Charlie Compute (Charlie)")).toHaveLength(2);
  });

  it("clicking a quick audit counterparty pill offers audit prompt into composer", async () => {
    const user = userEvent.setup();
    render(<ConsoleChat surface="Agents" />);

    const betaPill = screen.getByTitle("Quick audit for Agent Beta");
    expect(betaPill).toBeInTheDocument();
    await user.click(betaPill);

    expect(screen.getByLabelText("Message input")).toHaveTextContent(
      "Audit counterparty Agent Beta (virtuals:agent:beta) Bayesian prior and risk profile",
    );
  });

  it("renders Guardrails surface badge and active policy summary", () => {
    render(<ConsoleChat surface="Guardrails" />);

    expect(screen.getByText("GUARDRAILS & POLICIES")).toBeInTheDocument();
    expect(screen.getByText(/Auto-Spend: \$10.00 USDC/)).toBeInTheDocument();
  });

  it("renders Network Readiness surface badge", () => {
    render(<ConsoleChat surface="Network Readiness" />);

    expect(screen.getByText("NETWORK READINESS")).toBeInTheDocument();
    expect(screen.getByText(/Postgres · SQLite WARM\/COLD · Base Sepolia/)).toBeInTheDocument();
  });
});





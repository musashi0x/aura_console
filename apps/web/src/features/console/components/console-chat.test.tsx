import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { beforeEach, describe, expect, it } from "vitest";

import { expectNoAxeViolations } from "@/test/axe";

// Inlined by vitest.config.ts (`define`) — see cssRaw there.
declare const __GLOBALS_CSS__: string;

import { console_ } from "../copy";
import { __resetMemoryView, getMemoryViewEnabled } from "../memory-view-state";
import { ConsoleChat } from "./console-chat";

beforeEach(() => {
  __resetMemoryView();
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


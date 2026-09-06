import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { expectNoAxeViolations } from "@/test/axe";
import { routerPushes } from "@/test/setup";

import { __resetChatSession } from "../chat/chat-session";
import { console_ } from "../copy";
import { __resetMemoryView, getMemoryViewEnabled } from "../memory-view-state";
import { ConsoleShell } from "./console-shell";

/** The chat only exists inside the frame now, so the frame is what we render. */
const shell = (runRef?: string) =>
  render(
    <ConsoleShell surface="Runs" readiness="ready" runRef={runRef}>
      <h1>Runs</h1>
    </ConsoleShell>,
  );

const panel = () => screen.getByRole("complementary", { name: console_.chat.dock.label });
const queryPanel = () =>
  screen.queryByRole("complementary", { name: console_.chat.dock.label });

const closeChat = () =>
  fireEvent.click(screen.getByRole("button", { name: console_.chat.dock.close }));

/** Drive the design system's composer the way an operator does. */
const say = async (text: string) => {
  const user = userEvent.setup();
  const input = screen.getByLabelText("Message input");
  await user.click(input);
  await user.type(input, text);
  await user.click(screen.getByRole("button", { name: "Send" }));
};

beforeEach(() => {
  __resetChatSession();
  __resetMemoryView();
});

describe("the chat is a region of the console frame", () => {
  it("is open with the console, so the operator does not have to find it", () => {
    shell();
    expect(panel()).toBeInTheDocument();
  });

  it("closes, and then offers a launcher to bring it back", () => {
    shell();
    closeChat();
    expect(queryPanel()).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: console_.chat.dock.open }));
    expect(panel()).toBeInTheDocument();
  });

  it("works without a Run, because commands are not about a Run", () => {
    shell();
    expect(screen.getByLabelText("Message input")).toBeInTheDocument();
  });

  it("is scoped to the Run the surface is showing", () => {
    shell("run_42");
    expect(within(panel()).getByText("run_42")).toBeInTheDocument();
  });
});

describe("the chat drives the console", () => {
  it("navigates when the operator asks it to", async () => {
    shell();
    await say("go to policies");
    expect(routerPushes).toEqual(["/policies"]);
  });

  it("reports the action in the console's own voice, not the agent's", async () => {
    shell();
    await say("counterparties");
    expect(
      screen.getByText(console_.chat.did.navigated("Counterparties")),
    ).toBeInTheDocument();
    // Named "Console", and no agent turn exists at all: the console must not
    // put words in the agent's mouth about work the agent did not do.
    // "Console" also names the nav section, so scope this to the chat itself.
    expect(within(panel()).getByText(console_.chat.consoleRole)).toBeInTheDocument();
    expect(screen.queryByText(console_.chat.agent)).toBeNull();
  });

  it("toggles the memory view and says which way it now is", async () => {
    shell();
    await say("memory off");
    expect(getMemoryViewEnabled()).toBe(false);
    expect(screen.getByText(console_.chat.did.memory(false))).toBeInTheDocument();
    expect(routerPushes).toEqual([]);
  });

  it("never answers a question it has no agent for", async () => {
    shell();
    await say("why was provider B chosen?");
    expect(screen.getByText(console_.chat.did.cannotAnswer)).toBeInTheDocument();
    expect(screen.queryByText(console_.chat.agent)).toBeNull();
  });
});

describe("the transcript outlives the navigation it caused", () => {
  it("keeps the thread when the surface remounts", async () => {
    const first = shell();
    await say("go to policies");
    expect(screen.getByText(console_.chat.did.navigated("Policies"))).toBeInTheDocument();

    // What a chat-driven navigation does: the old surface unmounts, the new
    // one mounts its own shell. The transcript must survive that.
    first.unmount();
    shell();
    expect(panel()).toBeInTheDocument();
    expect(screen.getByText(console_.chat.did.navigated("Policies"))).toBeInTheDocument();
  });
});

describe("accessibility", () => {
  it("has no axe violations with the chat open", async () => {
    const { container } = shell("run_42");
    await expectNoAxeViolations(container);
  });
});

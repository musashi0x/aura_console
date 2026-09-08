import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  __resetChatSession,
  getActiveChatContext,
  getChatMessages,
  getChatOpen,
  getChatTouched,
  setActiveChatContext,
  setChatMessages,
  setChatOpen,
  subscribeChatSession,
} from "./chat-session";
import type { ChatMessage } from "./chat-types";

describe("chat-session context partitioning", () => {
  beforeEach(() => {
    __resetChatSession();
  });

  it("defaults active context to global", () => {
    expect(getActiveChatContext()).toBe("global");
    expect(getChatMessages()).toEqual([]);
  });

  it("updates active context and notifies listeners", () => {
    const listener = vi.fn();
    const unsub = subscribeChatSession(listener);

    setActiveChatContext("run_100");
    expect(getActiveChatContext()).toBe("run_100");
    expect(listener).toHaveBeenCalled();

    unsub();
  });

  it("partitions messages by context/runId so history does not bleed", () => {
    const msgGlobal: ChatMessage = {
      id: "msg-g",
      role: "operator",
      text: "Global question",
      complete: true,
      citations: [],
    };
    const msgRunA: ChatMessage = {
      id: "msg-a",
      role: "operator",
      text: "Run A question",
      complete: true,
      citations: [],
    };
    const msgRunB: ChatMessage = {
      id: "msg-b",
      role: "operator",
      text: "Run B question",
      complete: true,
      citations: [],
    };

    // Set messages explicitly per context
    setChatMessages([msgGlobal], "global");
    setChatMessages([msgRunA], "run_a");
    setChatMessages([msgRunB], "run_b");

    // Verify isolation via getters
    expect(getChatMessages("global")).toEqual([msgGlobal]);
    expect(getChatMessages("run_a")).toEqual([msgRunA]);
    expect(getChatMessages("run_b")).toEqual([msgRunB]);

    // Verify isolation via active context switching
    setActiveChatContext("run_a");
    expect(getChatMessages()).toEqual([msgRunA]);

    setActiveChatContext("run_b");
    expect(getChatMessages()).toEqual([msgRunB]);

    setActiveChatContext("global");
    expect(getChatMessages()).toEqual([msgGlobal]);
  });

  it("notifies context-specific listeners on target context updates", () => {
    const runAListener = vi.fn();
    const runBListener = vi.fn();

    const unsubA = subscribeChatSession(runAListener, "run_a");
    const unsubB = subscribeChatSession(runBListener, "run_b");

    setChatMessages(
      [
        {
          id: "msg-1",
          role: "operator",
          text: "Hi A",
          complete: true,
          citations: [],
        },
      ],
      "run_a",
    );

    expect(runAListener).toHaveBeenCalled();
    expect(runBListener).not.toHaveBeenCalled();

    unsubA();
    unsubB();
  });

  it("handles updater functions per context", () => {
    setChatMessages(
      [
        {
          id: "msg-1",
          role: "operator",
          text: "Initial",
          complete: true,
          citations: [],
        },
      ],
      "run_c",
    );

    setChatMessages(
      (prev) => [
        ...prev,
        {
          id: "msg-2",
          role: "agent",
          text: "Reply",
          complete: true,
          citations: [],
        },
      ],
      "run_c",
    );

    const msgs = getChatMessages("run_c");
    expect(msgs).toHaveLength(2);
    expect(msgs[0]!.id).toBe("msg-1");
    expect(msgs[1]!.id).toBe("msg-2");
  });

  it("resets all partitions and active context on __resetChatSession", () => {
    setChatMessages([{ id: "m1", role: "operator", text: "hi", complete: true, citations: [] }], "run_x");
    setActiveChatContext("run_x");
    setChatOpen(false);

    __resetChatSession();

    expect(getActiveChatContext()).toBe("global");
    expect(getChatOpen()).toBe(true);
    expect(getChatTouched()).toBe(false);
    expect(getChatMessages("run_x")).toEqual([]);
    expect(getChatMessages("global")).toEqual([]);
  });

  it("notifies context-specific listeners when __resetChatSession is called", () => {
    const runXListener = vi.fn();
    const unsub = subscribeChatSession(runXListener, "run_x");

    setChatMessages(
      [{ id: "m1", role: "operator", text: "hi", complete: true, citations: [] }],
      "run_x",
    );
    expect(runXListener).toHaveBeenCalledTimes(1);

    __resetChatSession();
    expect(runXListener).toHaveBeenCalledTimes(2);

    unsub();
  });

  it("does not bleed history when active context is switched after unpartitioned setter call", () => {
    // Set active context to run_1
    setActiveChatContext("run_1");
    setChatMessages([
      { id: "m1", role: "operator", text: "Run 1 message", complete: true, citations: [] },
    ]);

    expect(getChatMessages()).toHaveLength(1);
    expect(getChatMessages()[0]!.id).toBe("m1");

    // Switch to run_2 - should be empty and not bleed run_1 messages
    setActiveChatContext("run_2");
    expect(getChatMessages()).toEqual([]);
    expect(getChatMessages("run_2")).toEqual([]);

    // Querying run_1 explicitly still preserves its messages
    expect(getChatMessages("run_1")).toHaveLength(1);
    expect(getChatMessages("run_1")[0]!.id).toBe("m1");
  });

  it("claims unpartitioned seed only once without bleeding into subsequent contexts", () => {
    setChatMessages([
      { id: "seed-1", role: "operator", text: "Legacy seed", complete: true, citations: [] },
    ]);

    // First context claims the unpartitioned seed
    expect(getChatMessages("run_first")).toHaveLength(1);
    expect(getChatMessages("run_first")[0]!.id).toBe("seed-1");

    // Subsequent context must be empty and must not receive the seed
    expect(getChatMessages("run_second")).toEqual([]);
  });
});

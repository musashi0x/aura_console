import { describe, expect, it, vi } from "vitest";

import { openChatStream } from "./chat-transport";
import type { ChatConnection, EventStream } from "./chat-types";

/** A stand-in for EventSource that lets a test drive the stream by hand. */
function fakeStream() {
  const listeners = new Map<string, ((event: MessageEvent) => void)[]>();
  const closed = { value: false };
  const stream: EventStream = {
    addEventListener(type, listener) {
      listeners.set(type, [...(listeners.get(type) ?? []), listener]);
    },
    close() {
      closed.value = true;
    },
  };
  const emit = (type: string, data?: string) => {
    for (const listener of listeners.get(type) ?? []) {
      listener({ data } as MessageEvent);
    }
  };
  return { stream, emit, closed };
}

function harness(overrides: Partial<Parameters<typeof openChatStream>[0]> = {}) {
  const states: ChatConnection[] = [];
  const tokens: string[] = [];
  const citations: { counterpartyKey: string; label: string }[] = [];
  const done = vi.fn();
  const created: ReturnType<typeof fakeStream>[] = [];
  const pending: (() => void)[] = [];

  const handle = openChatStream({
    url: "https://example.test/api/runs/r1/chat?q=why",
    onToken: (t) => tokens.push(t),
    onCitation: (c) => citations.push(c),
    onState: (s) => states.push(s),
    onDone: done,
    createStream: () => {
      const next = fakeStream();
      created.push(next);
      return next.stream;
    },
    schedule: (run) => pending.push(run),
    retryDelayMs: 0,
    ...overrides,
  });

  return { handle, states, tokens, citations, done, created, pending };
}

describe("chat stream transport", () => {
  it("reports unavailable when the stream never opened, without retrying", () => {
    const h = harness();
    h.created[0]!.emit("error");

    expect(h.states.at(-1)).toEqual({ kind: "unavailable", detail: "stream-unreachable" });
    // A missing endpoint must not be retried in a loop: that would hide the
    // absence behind noise instead of reporting it.
    expect(h.pending).toHaveLength(0);
    expect(h.created).toHaveLength(1);
  });

  it("streams tokens and completes", () => {
    const h = harness();
    h.created[0]!.emit("token", "Alpha ");
    h.created[0]!.emit("token", "was known.");
    h.created[0]!.emit("done");

    expect(h.tokens.join("")).toBe("Alpha was known.");
    expect(h.states.map((s) => s.kind)).toContain("streaming");
    expect(h.done).toHaveBeenCalledOnce();
  });

  it("announces a mid-answer drop and reconnects", () => {
    const h = harness();
    h.created[0]!.emit("token", "partial");
    h.created[0]!.emit("error");

    expect(h.states.at(-1)).toEqual({ kind: "reconnecting", attempt: 1 });
    expect(h.pending).toHaveLength(1);

    h.pending[0]!();
    expect(h.created).toHaveLength(2);
  });

  it("gives up after the retry budget rather than reconnecting forever", () => {
    const h = harness({ maxRetries: 1 });
    h.created[0]!.emit("token", "partial");
    h.created[0]!.emit("error");
    h.pending[0]!();
    h.created[1]!.emit("error");

    expect(h.states.at(-1)).toEqual({ kind: "unavailable", detail: "stream-lost" });
  });

  it("drops a malformed citation instead of showing it as a record", () => {
    const h = harness();
    h.created[0]!.emit("citation", "{not json");
    h.created[0]!.emit("citation", JSON.stringify({ nope: true }));
    h.created[0]!.emit("citation", JSON.stringify({ counterpartyKey: "cp_1", label: "Alpha" }));

    expect(h.citations).toEqual([{ counterpartyKey: "cp_1", label: "Alpha" }]);
  });

  it("handles thought and token usage events properly", () => {
    const thoughts: string[] = [];
    const usages: unknown[] = [];
    const h = harness({
      onThought: (t) => thoughts.push(t),
      onUsage: (u) => usages.push(u),
    });

    h.created[0]!.emit("thought", "Evaluating counterparty memory...");
    h.created[0]!.emit("usage", "{invalid-json");
    h.created[0]!.emit(
      "usage",
      JSON.stringify({ promptTokens: 400, candidateTokens: 100, totalTokens: 500 }),
    );

    expect(thoughts).toEqual(["Evaluating counterparty memory..."]);
    expect(usages).toEqual([
      { promptTokens: 400, candidateTokens: 100, totalTokens: 500 },
    ]);
  });

  it("has no write path anywhere in the module", async () => {
    // The read-only guarantee is structural: EventSource can only GET, and no
    // mutating verb appears in the source. A future edit that adds one should
    // fail here rather than in review.
    const source = await import("./chat-transport?raw").then((m) => m.default as string);
    expect(source).not.toMatch(/method:\s*["'](POST|PUT|PATCH|DELETE)["']/i);
    expect(source).not.toMatch(/\bfetch\s*\(/);
  });
});

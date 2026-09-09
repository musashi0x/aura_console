import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";

import { RunStore } from "./run-store.js";
import {
  runGeminiAgentLoop,
  isGeminiAgentConfigured,
  setGeminiAgentOverride,
} from "./gemini-agent.js";

const runs = new RunStore();

type RecordedToolCall = {
  name: string;
  args: Record<string, unknown>;
  result?: unknown;
  callId?: string;
};

describe("Gemini Agent Autonomous Function-Calling Loop", () => {
  it("autonomously chains memory_recall_counterparty and mission_propose_approval for multi-step query", async () => {
    // Create a real run to verify event sourcing
    const created = await runs.createRun({
      source: "CONSOLE",
      objective: "Evaluate and engage Beta Labs",
      budgetUsdc: "50.000000",
    });
    const runId = created.id;

    const toolCalls: RecordedToolCall[] = [];
    const citations: Array<{ counterpartyKey: string; label: string }> = [];
    const tokens: string[] = [];

    const query = "Why should we hire Beta Labs and what would it cost to draft a 10 USDC spend?";

    const result = await runGeminiAgentLoop({
      query,
      runId,
      onToolCall: (call) => {
        toolCalls.push(call);
      },
      onCitation: (citation) => {
        citations.push(citation);
      },
      onToken: (token) => {
        tokens.push(token);
      },
    });

    // 1. Verify multi-turn tool chaining sequence
    expect(toolCalls.length).toBe(2);
    expect(toolCalls[0]!.name).toBe("memory_recall_counterparty");
    expect(toolCalls[0]!.args.counterpartyKey).toBe("virtuals:agent:beta");
    expect((toolCalls[0]!.result as Record<string, unknown>).retrieval).toBeDefined();

    expect(toolCalls[1]!.name).toBe("mission_propose_approval");
    expect(toolCalls[1]!.args.counterpartyKey).toBe("virtuals:agent:beta");
    expect(toolCalls[1]!.args.amountUsdc).toBe("10.000000");
    expect(toolCalls[1]!.args.runId).toBe(runId);
    expect((toolCalls[1]!.result as Record<string, unknown>).proposed).toBe(true);
    expect((toolCalls[1]!.result as Record<string, unknown>).status).toBe("AWAITING_APPROVAL");

    // 2. Verify citation was emitted for Beta Labs
    expect(citations.length).toBeGreaterThanOrEqual(1);
    expect(citations[0]!.counterpartyKey).toBe("virtuals:agent:beta");

    // 3. Verify text tokens were streamed
    expect(tokens.length).toBeGreaterThan(0);
    const fullText = tokens.join("");
    expect(fullText).toContain("Beta Labs");
    expect(fullText).toContain("10.00 USDC");
    expect(result.text).toBe(fullText);

    // 4. Verify that approval.requested event was genuinely appended to RunStore
    const events = await runs.listEvents(runId);
    const approvalEvent = events.find((e) => e.type === "approval.requested");
    expect(approvalEvent).toBeDefined();
    expect(approvalEvent?.data).toMatchObject({
      counterparty_key: "virtuals:agent:beta",
      amount_usdc: "10.000000",
      ceiling_usdc: "10.000000",
    });
  });

  it("handles navigation queries via console_navigate", async () => {
    const toolCalls: RecordedToolCall[] = [];
    const tokens: string[] = [];

    const result = await runGeminiAgentLoop({
      query: "go to missions",
      onToolCall: (c) => {
        toolCalls.push(c);
      },
      onToken: (t) => {
        tokens.push(t);
      },
    });

    expect(toolCalls).toHaveLength(1);
    expect(toolCalls[0]!.name).toBe("console_navigate");
    expect(toolCalls[0]!.args.destination).toBe("/runs");
    expect(tokens.join("")).toContain("Missions");
    expect(result.text).toContain("Missions");
  });

  it("handles system readiness queries via console_get_readiness", async () => {
    const toolCalls: RecordedToolCall[] = [];
    const tokens: string[] = [];

    const result = await runGeminiAgentLoop({
      query: "readiness",
      onToolCall: (c) => {
        toolCalls.push(c);
      },
      onToken: (t) => {
        tokens.push(t);
      },
    });

    expect(toolCalls).toHaveLength(1);
    expect(toolCalls[0]!.name).toBe("console_get_readiness");
    expect(tokens.join("")).toContain("System readiness check");
    expect(result.text).toContain("System readiness check");
  });

  it("handles guardrails query via guardrails_get_policies", async () => {
    const toolCalls: RecordedToolCall[] = [];
    const tokens: string[] = [];

    const result = await runGeminiAgentLoop({
      query: "show active guardrails",
      onToolCall: (c) => {
        toolCalls.push(c);
      },
      onToken: (t) => {
        tokens.push(t);
      },
    });

    expect(toolCalls).toHaveLength(1);
    expect(toolCalls[0]!.name).toBe("guardrails_get_policies");
    expect(tokens.join("")).toContain("Guardrail Policies");
    expect(result.text).toContain("Guardrail Policies");
  });

  it("handles memory toggle query via console_toggle_memory_view", async () => {
    const toolCalls: RecordedToolCall[] = [];
    const result = await runGeminiAgentLoop({
      query: "turn memory off",
      onToolCall: (c) => {
        toolCalls.push(c);
      },
    });

    expect(toolCalls).toHaveLength(1);
    expect(toolCalls[0]!.name).toBe("console_toggle_memory_view");
    expect(toolCalls[0]!.args.enabled).toBe(false);
    expect(result.text).toContain("Off");
  });

  it("handles single-turn counterparty query", async () => {
    const toolCalls: RecordedToolCall[] = [];
    const citations: Array<{ counterpartyKey: string; label: string }> = [];

    const result = await runGeminiAgentLoop({
      query: "Why was this counterparty chosen",
      onToolCall: (c) => {
        toolCalls.push(c);
      },
      onCitation: (c) => {
        citations.push(c);
      },
    });

    expect(toolCalls).toHaveLength(1);
    expect(toolCalls[0]!.name).toBe("memory_recall_counterparty");
    expect(citations).toHaveLength(1);
    expect(result.text).toContain("Beta was selected");
  });

  it("handles Charlie counterparty cold journal audit invoking memory_journal for base:agent:charlie", async () => {
    const toolCalls: RecordedToolCall[] = [];
    const result = await runGeminiAgentLoop({
      query: "Audit Charlie's cold journal",
      onToolCall: (call) => {
        toolCalls.push(call);
      },
    });

    expect(toolCalls).toHaveLength(1);
    expect(toolCalls[0]!.name).toBe("memory_journal");
    expect(toolCalls[0]!.args.counterpartyKey).toBe("base:agent:charlie");
    expect(result.text).toContain("Charlie Compute");
    expect(result.text).toContain("Base L2");
  });

  it("handles Charlie counterparty Bayesian audit invoking memory_recall_counterparty", async () => {
    const toolCalls: RecordedToolCall[] = [];
    const result = await runGeminiAgentLoop({
      query: "Audit counterparty Charlie (base:agent:charlie) Bayesian prior and risk profile",
      onToolCall: (call) => {
        toolCalls.push(call);
      },
    });

    expect(toolCalls).toHaveLength(1);
    expect(toolCalls[0]!.name).toBe("memory_recall_counterparty");
    expect(toolCalls[0]!.args.counterpartyKey).toBe("base:agent:charlie");
    expect(result.text).toContain("Charlie Compute");
  });

  it("handles Alpha penalty audit query explaining SLA breach in Run #98", async () => {
    const toolCalls: RecordedToolCall[] = [];
    const result = await runGeminiAgentLoop({
      query: "Why was Alpha penalized?",
      onToolCall: (call) => {
        toolCalls.push(call);
      },
    });

    expect(toolCalls).toHaveLength(1);
    expect(toolCalls[0]!.name).toBe("memory_recall_counterparty");
    expect(toolCalls[0]!.args.counterpartyKey).toBe("virtuals:agent:alpha");
    expect(result.text).toContain("Run #98");
    expect(result.text).toContain("-11 penalty");
  });

  it("respects abort signal during agent execution", async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      runGeminiAgentLoop({
        query: "go to missions",
        signal: controller.signal,
      }),
    ).rejects.toThrow("aborted");
  });

  it("respects agent configuration overrides", () => {
    setGeminiAgentOverride(null);
    const initial = isGeminiAgentConfigured();

    setGeminiAgentOverride(true);
    expect(isGeminiAgentConfigured()).toBe(true);

    setGeminiAgentOverride(false);
    expect(isGeminiAgentConfigured()).toBe(false);

    setGeminiAgentOverride(null);
    expect(isGeminiAgentConfigured()).toBe(initial);
  });

  it("emits onToolStart with name, args, and callId prior to tool execution and onToolCall", async () => {
    const events: string[] = [];
    const startedCalls: Array<{ name: string; args: Record<string, unknown>; callId: string }> = [];
    const completedCalls: RecordedToolCall[] = [];

    await runGeminiAgentLoop({
      query: "go to missions",
      onToolStart: (start) => {
        events.push(`start:${start.name}`);
        startedCalls.push(start);
      },
      onToolCall: (call) => {
        events.push(`call:${call.name}`);
        completedCalls.push(call);
      },
    });

    expect(startedCalls).toHaveLength(1);
    expect(startedCalls[0]!.name).toBe("console_navigate");
    expect(startedCalls[0]!.args.destination).toBe("/runs");
    expect(startedCalls[0]!.callId).toBeDefined();

    expect(completedCalls).toHaveLength(1);
    expect(completedCalls[0]!.name).toBe("console_navigate");
    expect(completedCalls[0]!.callId).toBe(startedCalls[0]!.callId);

    // Verify ordering: start event precedes call event
    expect(events).toEqual(["start:console_navigate", "call:console_navigate"]);
  });

  it("navigates to /chat when operator asks for chat or assistant", async () => {
    const calls: RecordedToolCall[] = [];
    await runGeminiAgentLoop({
      query: "go to chat",
      onToolCall: (call) => {
        calls.push(call);
      },
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]!.name).toBe("console_navigate");
    expect(calls[0]!.args.destination).toBe("/chat");
  });

  it("autonomously analyzes a mission by run ID chaining console_get_mission and memory_recall_counterparty", async () => {
    const created = await runs.createRun({
      source: "CONSOLE",
      objective: "Analyze counterparty liquidity dataset",
      budgetUsdc: "25.000000",
    });
    const runId = created.id;

    await runs.appendEvent({
      eventId: randomUUID(),
      eventTime: new Date(),
      runId,
      type: "candidate.scored",
      data: {
        candidates: [
          { key: "virtuals:agent:beta", score: 96, memory_note: "Preferred reliable partner" },
          { key: "virtuals:agent:alpha", score: 89, memory_note: "Penalized for delivery delay" },
        ],
      },
    });

    await runs.appendEvent({
      eventId: randomUUID(),
      eventTime: new Date(),
      runId,
      type: "decision.made",
      data: {
        counterparty_key: "virtuals:agent:beta",
        summary: "Selected highest-ranked counterparty",
      },
    });

    const toolCalls: RecordedToolCall[] = [];
    const result = await runGeminiAgentLoop({
      query: `so analyze this ${runId} to me`,
      runId,
      onToolCall: (c) => {
        toolCalls.push(c);
      },
    });

    expect(toolCalls.length).toBeGreaterThanOrEqual(2);
    expect(toolCalls[0]!.name).toBe("console_get_mission");
    expect(toolCalls[0]!.args.runId).toBe(runId);
    expect(toolCalls[1]!.name).toBe("memory_recall_counterparty");
    expect(toolCalls[1]!.args.counterpartyKey).toBe("virtuals:agent:beta");

    expect(result.text).toContain("Mission Analysis");
    expect(result.text).toContain("virtuals:agent:beta");
    expect(result.text).toContain("Score **96**");
  });
});

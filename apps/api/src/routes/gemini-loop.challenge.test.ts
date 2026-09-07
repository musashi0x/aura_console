import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { app } from "../app.js";
import {
  convertJsonSchemaToGeminiSchema,
  mcpToolsToGeminiDeclarations,
} from "../mcp/gemini-converter.js";
import { MCP_TOOLS, type McpToolDefinition } from "../mcp/tools.js";
import {
  runGeminiAgentLoop,
  setGeminiAgentOverride,
} from "../services/gemini-agent.js";
import { RunStore } from "../services/run-store.js";

const runs = new RunStore();

interface ParsedSseEvent {
  event: string;
  id?: string;
  data: string;
}

/**
 * Robust SSE parser that parses raw SSE text into structured events.
 */
function parseSseStream(rawText: string): ParsedSseEvent[] {
  const lines = rawText.split(/\r?\n/);
  const events: ParsedSseEvent[] = [];
  let currentEvent: Partial<ParsedSseEvent> = {};

  for (const line of lines) {
    if (line.trim() === "") {
      if (currentEvent.event || currentEvent.data !== undefined) {
        events.push({
          event: currentEvent.event ?? "message",
          id: currentEvent.id,
          data: currentEvent.data ?? "",
        });
        currentEvent = {};
      }
      continue;
    }

    if (line.startsWith("event:")) {
      currentEvent.event = line.slice(6).trim();
    } else if (line.startsWith("data:")) {
      const dataVal = line.slice(5).trim();
      currentEvent.data = currentEvent.data ? `${currentEvent.data}\n${dataVal}` : dataVal;
    } else if (line.startsWith("id:")) {
      currentEvent.id = line.slice(3).trim();
    }
  }

  if (currentEvent.event || currentEvent.data !== undefined) {
    events.push({
      event: currentEvent.event ?? "message",
      id: currentEvent.id,
      data: currentEvent.data ?? "",
    });
  }

  return events;
}

describe("Milestone 2 Empirical Challenge: Gemini Function Calling & Tool Chaining", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    setGeminiAgentOverride(null);
    process.env = { ...originalEnv };
  });

  // --------------------------------------------------------------------------
  // 1. Multi-turn Tool Chaining & Monotonic Run Event Store
  // --------------------------------------------------------------------------
  describe("1. Multi-turn Tool Chaining & Event Store Integrity", () => {
    it("autonomously chains memory_recall_counterparty and mission_propose_approval with monotonic sequence in Run context", async () => {
      setGeminiAgentOverride(true);

      const run = await runs.createRun({
        source: "CONSOLE",
        objective: "Multi-turn tool chaining validation",
        budgetUsdc: "100.000000",
      });
      const runId = run.id;

      const q = encodeURIComponent(
        "Why should we hire Beta Labs and what would it cost to draft a 10 USDC spend?",
      );
      const res = await app.request(`/api/runs/${runId}/chat?q=${q}`);

      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("text/event-stream");

      const body = await res.text();
      const events = parseSseStream(body);

      // Verify tool_call events exist and are streamed in the exact chaining order
      const toolCallEvents = events.filter((e) => e.event === "tool_call");
      expect(toolCallEvents.length).toBe(2);

      const tool1 = JSON.parse(toolCallEvents[0]!.data) as {
        name: string;
        args: Record<string, unknown>;
        result: Record<string, unknown>;
      };
      expect(tool1.name).toBe("memory_recall_counterparty");
      expect(tool1.args.counterpartyKey).toBe("virtuals:agent:beta");
      expect(tool1.result).toBeDefined();

      const tool2 = JSON.parse(toolCallEvents[1]!.data) as {
        name: string;
        args: Record<string, unknown>;
        result: Record<string, unknown>;
      };
      expect(tool2.name).toBe("mission_propose_approval");
      expect(tool2.args.counterpartyKey).toBe("virtuals:agent:beta");
      expect(tool2.args.amountUsdc).toBe("10.000000");
      expect(tool2.args.runId).toBe(runId);
      expect(tool2.result.proposed).toBe(true);
      expect(tool2.result.status).toBe("AWAITING_APPROVAL");

      // Verify RunStore has recorded both memory.retrieved and approval.requested
      const runEvents = await runs.listEvents(runId);
      expect(runEvents.length).toBeGreaterThanOrEqual(3);

      const types = runEvents.map((e) => e.type);
      expect(types[0]).toBe("run.created");
      expect(types).toContain("memory.retrieved");
      expect(types).toContain("approval.requested");

      // Verify STRICT sequence monotonicity: 0, 1, 2, ...
      const sequences = runEvents.map((e) => e.sequence);
      for (let i = 1; i < sequences.length; i++) {
        expect(sequences[i]!).toBeGreaterThan(sequences[i - 1]!);
        expect(sequences[i]!).toBe(sequences[i - 1]! + 1);
      }

      // Verify approval.requested event data integrity
      const approvalEvent = runEvents.find((e) => e.type === "approval.requested");
      expect(approvalEvent).toBeDefined();
      expect(approvalEvent!.data).toMatchObject({
        counterparty_key: "virtuals:agent:beta",
        amount_usdc: "10.000000",
        ceiling_usdc: "10.000000",
      });
    });

    it("chains tools for Alpha Research counterparty with parsed amount", async () => {
      setGeminiAgentOverride(true);

      const run = await runs.createRun({
        source: "CONSOLE",
        objective: "Alpha Research proposal",
        budgetUsdc: "50.000000",
      });

      const q = encodeURIComponent(
        "Why was Alpha chosen and what is the cost to draft a 25 USDC spend?",
      );
      const res = await app.request(`/api/runs/${run.id}/chat?q=${q}`);
      expect(res.status).toBe(200);

      const body = await res.text();
      const events = parseSseStream(body);

      const toolCalls = events.filter((e) => e.event === "tool_call");
      expect(toolCalls.length).toBe(2);

      const firstCall = JSON.parse(toolCalls[0]!.data);
      expect(firstCall.name).toBe("memory_recall_counterparty");
      expect(firstCall.args.counterpartyKey).toBe("virtuals:agent:alpha");

      const secondCall = JSON.parse(toolCalls[1]!.data);
      expect(secondCall.name).toBe("mission_propose_approval");
      expect(secondCall.args.counterpartyKey).toBe("virtuals:agent:alpha");
      expect(secondCall.args.amountUsdc).toBe("25.000000");

      const runEvents = await runs.listEvents(run.id);
      const approvalEvent = runEvents.find((e) => e.type === "approval.requested");
      expect(approvalEvent).toBeDefined();
      expect(approvalEvent!.data).toMatchObject({
        counterparty_key: "virtuals:agent:alpha",
        amount_usdc: "25.000000",
      });
    });

    it("chains tools in global chat (/api/chat) without runId without crashing", async () => {
      setGeminiAgentOverride(true);

      const q = encodeURIComponent(
        "Why should we hire Beta Labs and what would it cost to draft a 10 USDC spend?",
      );
      const res = await app.request(`/api/chat?q=${q}`);
      expect(res.status).toBe(200);

      const body = await res.text();
      const events = parseSseStream(body);

      const toolCalls = events.filter((e) => e.event === "tool_call");
      expect(toolCalls.length).toBe(2);
      expect(toolCalls[0]!.data).toContain("memory_recall_counterparty");
      expect(toolCalls[1]!.data).toContain("mission_propose_approval");

      // Verify tokens and done
      expect(events.some((e) => e.event === "token")).toBe(true);
      expect(events.some((e) => e.event === "done")).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // 2. SSE Stream Protocol Verification
  // --------------------------------------------------------------------------
  describe("2. SSE Stream Protocol Compliance", () => {
    it("conforms strictly to SSE specification: tool_call { name, args, result }, token, citation, and terminates with done", async () => {
      setGeminiAgentOverride(true);

      const run = await runs.createRun({
        source: "CONSOLE",
        objective: "SSE Protocol verification",
      });

      const q = encodeURIComponent(
        "Why should we hire Beta Labs and what would it cost to draft a 10 USDC spend?",
      );
      const res = await app.request(`/api/runs/${run.id}/chat?q=${q}`);
      expect(res.status).toBe(200);

      const raw = await res.text();
      const events = parseSseStream(raw);

      // Verify events stream structure
      const eventNames = events.map((e) => e.event);
      expect(eventNames).toContain("tool_call");
      expect(eventNames).toContain("citation");
      expect(eventNames).toContain("token");
      expect(eventNames[eventNames.length - 1]).toBe("done");

      // Verify tool_call payload schema: MUST contain { name, args, result }
      const toolCalls = events.filter((e) => e.event === "tool_call");
      for (const tc of toolCalls) {
        const payload = JSON.parse(tc.data);
        expect(payload).toHaveProperty("name");
        expect(typeof payload.name).toBe("string");
        expect(payload).toHaveProperty("args");
        expect(typeof payload.args).toBe("object");
        expect(payload.args).not.toBeNull();
        expect(payload).toHaveProperty("result");
      }

      // Verify citation payload schema: MUST contain { counterpartyKey, label }
      const citations = events.filter((e) => e.event === "citation");
      expect(citations.length).toBeGreaterThan(0);
      for (const cit of citations) {
        const payload = JSON.parse(cit.data);
        expect(payload).toHaveProperty("counterpartyKey");
        expect(typeof payload.counterpartyKey).toBe("string");
        expect(payload).toHaveProperty("label");
        expect(typeof payload.label).toBe("string");
      }

      // Verify token events contain non-empty text chunks
      const tokens = events.filter((e) => e.event === "token");
      expect(tokens.length).toBeGreaterThan(0);
      for (const tok of tokens) {
        expect(typeof tok.data).toBe("string");
        expect(tok.data.length).toBeGreaterThan(0);
      }

      // Verify done event is the terminal event
      const doneEvent = events.find((e) => e.event === "done");
      expect(doneEvent).toBeDefined();
      expect(doneEvent!.data).toBe("");
    });
  });

  // --------------------------------------------------------------------------
  // 3. Simulated Live Function-Calling Loop (Mock Gemini API Engine)
  // --------------------------------------------------------------------------
  describe("3. Simulated Live Function-Calling Loop (Gemini API Protocol)", () => {
    it("executes multi-turn live loop feeding functionResponse back to Gemini API", async () => {
      process.env.GEMINI_API_KEY = "mock-live-gemini-key";
      setGeminiAgentOverride(true);

      const run = await runs.createRun({
        source: "CONSOLE",
        objective: "Live Gemini API simulation",
      });

      let turnCount = 0;
      // Mock fetch to simulate Gemini API responses across turns
      vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
        turnCount++;
        const reqBody = JSON.parse((init?.body as string) ?? "{}");

        if (turnCount === 1) {
          // Verify request sent function declarations
          expect(reqBody.tools[0].functionDeclarations).toBeDefined();
          expect(reqBody.tools[0].functionDeclarations.length).toBeGreaterThan(0);

          // Return Turn 1 function call: memory_recall_counterparty
          return new Response(
            JSON.stringify({
              candidates: [
                {
                  content: {
                    parts: [
                      {
                        functionCall: {
                          name: "memory_recall_counterparty",
                          args: { counterpartyKey: "virtuals:agent:beta" },
                        },
                      },
                    ],
                  },
                },
              ],
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        }

        if (turnCount === 2) {
          // Verify Turn 2 request carried functionResponse in history
          const contents = reqBody.contents as Array<{ role?: string; parts: Array<{ functionResponse: { name: string; response: Record<string, unknown> } }> }>;
          const toolTurn = contents.find((c) => c.role === "tool");
          expect(toolTurn).toBeDefined();
          expect(toolTurn!.parts[0]!.functionResponse.name).toBe("memory_recall_counterparty");
          expect(toolTurn!.parts[0]!.functionResponse.response).toBeDefined();

          // Return Turn 2 function call: mission_propose_approval
          return new Response(
            JSON.stringify({
              candidates: [
                {
                  content: {
                    parts: [
                      {
                        functionCall: {
                          name: "mission_propose_approval",
                          args: {
                            counterpartyKey: "virtuals:agent:beta",
                            amountUsdc: "15.000000",
                            reason: "Procure dataset from Beta Labs",
                          },
                        },
                      },
                    ],
                  },
                },
              ],
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        }

        // Turn 3: Synthesize final text
        return new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: "I have reviewed Beta Labs and submitted spend proposal of 15.00 USDC.",
                    },
                  ],
                },
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      });

      const res = await app.request(`/api/runs/${run.id}/chat?q=evaluate%20and%20spend`);
      expect(res.status).toBe(200);

      const raw = await res.text();
      const events = parseSseStream(raw);

      const toolCalls = events.filter((e) => e.event === "tool_call");
      expect(toolCalls.length).toBe(2);
      expect(JSON.parse(toolCalls[0]!.data).name).toBe("memory_recall_counterparty");
      expect(JSON.parse(toolCalls[1]!.data).name).toBe("mission_propose_approval");

      // Verify RunStore recorded approval.requested from live loop
      const runEvents = await runs.listEvents(run.id);
      const approvalEvent = runEvents.find((e) => e.type === "approval.requested");
      expect(approvalEvent).toBeDefined();
      expect(approvalEvent!.data).toMatchObject({
        counterparty_key: "virtuals:agent:beta",
        amount_usdc: "15.000000",
      });

      // Verify tokens and done
      expect(events.some((e) => e.event === "token")).toBe(true);
      expect(events.some((e) => e.event === "done")).toBe(true);
    });

    it("handles model calling an unknown tool by returning error without crashing", async () => {
      process.env.GEMINI_API_KEY = "mock-live-gemini-key";
      setGeminiAgentOverride(true);

      let turnCount = 0;
      vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
        turnCount++;
        if (turnCount === 1) {
          // Model returns unknown tool call
          return new Response(
            JSON.stringify({
              candidates: [
                {
                  content: {
                    parts: [
                      {
                        functionCall: {
                          name: "unknown_nonexistent_tool",
                          args: { foo: "bar" },
                        },
                      },
                    ],
                  },
                },
              ],
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        }

        return new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [{ text: "The tool was not found, so I continued." }],
                },
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      });

      const res = await app.request("/api/chat?q=try%20unknown%20tool");
      expect(res.status).toBe(200);

      const raw = await res.text();
      const events = parseSseStream(raw);

      const toolCalls = events.filter((e) => e.event === "tool_call");
      expect(toolCalls.length).toBe(1);

      const payload = JSON.parse(toolCalls[0]!.data);
      expect(payload.name).toBe("unknown_nonexistent_tool");
      expect(payload.result).toEqual({
        error: "Tool unknown_nonexistent_tool not found in MCP catalog",
      });

      expect(events.some((e) => e.event === "done")).toBe(true);
    });

    it("handles model calling tool with malformed arguments gracefully", async () => {
      process.env.GEMINI_API_KEY = "mock-live-gemini-key";
      setGeminiAgentOverride(true);

      let turnCount = 0;
      vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
        turnCount++;
        if (turnCount === 1) {
          // Model calls mission_propose_approval with invalid parameters
          return new Response(
            JSON.stringify({
              candidates: [
                {
                  content: {
                    parts: [
                      {
                        functionCall: {
                          name: "mission_propose_approval",
                          args: {
                            counterpartyKey: "", // invalid empty key
                            amountUsdc: -10, // invalid negative amount
                            reason: "",
                          },
                        },
                      },
                    ],
                  },
                },
              ],
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        }

        return new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [{ text: "Recovered from validation error." }],
                },
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      });

      const res = await app.request("/api/chat?q=invalid%20params");
      expect(res.status).toBe(200);

      const raw = await res.text();
      const events = parseSseStream(raw);

      const toolCalls = events.filter((e) => e.event === "tool_call");
      expect(toolCalls.length).toBe(1);

      const payload = JSON.parse(toolCalls[0]!.data);
      expect(payload.name).toBe("mission_propose_approval");
      expect(payload.result).toHaveProperty("error");

      expect(events.some((e) => e.event === "done")).toBe(true);
    });

    it("handles multiple parallel tool calls in a single model turn", async () => {
      process.env.GEMINI_API_KEY = "mock-live-gemini-key";
      setGeminiAgentOverride(true);

      let turnCount = 0;
      vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
        turnCount++;
        if (turnCount === 1) {
          // Model returns TWO functionCalls in one turn
          return new Response(
            JSON.stringify({
              candidates: [
                {
                  content: {
                    parts: [
                      {
                        functionCall: {
                          name: "console_navigate",
                          args: { destination: "/runs" },
                        },
                      },
                      {
                        functionCall: {
                          name: "console_get_readiness",
                          args: {},
                        },
                      },
                    ],
                  },
                },
              ],
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        }

        return new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [{ text: "Navigated to missions and checked readiness." }],
                },
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      });

      const res = await app.request("/api/chat?q=parallel%20tools");
      expect(res.status).toBe(200);

      const raw = await res.text();
      const events = parseSseStream(raw);

      const toolCalls = events.filter((e) => e.event === "tool_call");
      expect(toolCalls.length).toBe(2);
      expect(JSON.parse(toolCalls[0]!.data).name).toBe("console_navigate");
      expect(JSON.parse(toolCalls[1]!.data).name).toBe("console_get_readiness");

      expect(events.some((e) => e.event === "done")).toBe(true);
    });

    it("safely enforces max turns limit (10) preventing infinite execution loops", async () => {
      process.env.GEMINI_API_KEY = "mock-live-gemini-key";
      setGeminiAgentOverride(true);

      const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
        // Perpetually request console_get_readiness every turn
        return new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      functionCall: {
                        name: "console_get_readiness",
                        args: {},
                      },
                    },
                  ],
                },
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      });

      const result = await runGeminiAgentLoop({
        query: "infinite loop trigger",
      });

      // Must break at maxTurns = 10 without hanging
      expect(result.turns).toBe(10);
      expect(result.toolCalls.length).toBe(10);
      const geminiFetches = fetchSpy.mock.calls.filter(([url]) =>
        String(url).includes("generativelanguage.googleapis.com"),
      );
      expect(geminiFetches.length).toBe(10);
    });
  });

  // --------------------------------------------------------------------------
  // 4. Stress Test Edge Cases: Abort Signals & Schema Converter Boundaries
  // --------------------------------------------------------------------------
  describe("4. Stress Test Edge Cases: Abort Signals & Schema Boundaries", () => {
    it("handles tool execution throwing unexpected errors gracefully", async () => {
      const throwingTool: McpToolDefinition<{ badInput?: string }> = {
        name: "faulty_throwing_tool",
        description: "A tool that throws during execution",
        parameters: z.object({ badInput: z.string().optional() }),
        execute: async () => {
          throw new Error("Catastrophic hardware fault in tool");
        },
      };

      process.env.GEMINI_API_KEY = "mock-live-gemini-key";
      setGeminiAgentOverride(true);

      let turnCount = 0;
      vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
        turnCount++;
        if (turnCount === 1) {
          return new Response(
            JSON.stringify({
              candidates: [
                {
                  content: {
                    parts: [
                      {
                        functionCall: {
                          name: "faulty_throwing_tool",
                          args: { badInput: "kaboom" },
                        },
                      },
                    ],
                  },
                },
              ],
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        }

        return new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [{ text: "Error was handled safely." }],
                },
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      });

      const recordedCalls: Array<{ name: string; args: Record<string, unknown>; result?: unknown }> = [];
      const result = await runGeminiAgentLoop({
        query: "call faulty",
        tools: [...MCP_TOOLS, throwingTool],
        onToolCall: (c) => {
          recordedCalls.push(c);
        },
      });

      expect(recordedCalls.length).toBe(1);
      expect(recordedCalls[0]!.result).toEqual({
        error: "Catastrophic hardware fault in tool",
      });
      expect(result.text).toBe("Error was handled safely.");
    });

    it("handles pre-aborted request cleanly", async () => {
      const controller = new AbortController();
      controller.abort();

      await expect(
        runGeminiAgentLoop({
          query: "go to missions",
          signal: controller.signal,
        }),
      ).rejects.toThrow("aborted by client signal");
    });

    it("handles mid-stream client abort during token generation", async () => {
      const controller = new AbortController();

      let tokensReceived = 0;
      const promise = runGeminiAgentLoop({
        query: "go to missions",
        signal: controller.signal,
        onToken: () => {
          tokensReceived++;
          if (tokensReceived === 1) {
            controller.abort();
          }
        },
      });

      await promise;
      expect(tokensReceived).toBe(1);
    });

    it("handles mid-stream client abort in chat route without emitting agent_stream_failed", async () => {
      setGeminiAgentOverride(true);
      const run = await runs.createRun({
        source: "CONSOLE",
        objective: "Abort test run",
      });

      const controller = new AbortController();
      const res = await app.request(`/api/runs/${run.id}/chat?q=go%20to%20missions`, {
        signal: controller.signal,
      });

      controller.abort();
      expect(res.status).toBe(200);
      try {
        await res.text();
      } catch {
        // stream aborted cleanly
      }
    });

    it("validates boundary inputs for Gemini schema converter", () => {
      // Null / undefined raw schema
      expect(convertJsonSchemaToGeminiSchema(null)).toEqual({ type: "OBJECT", properties: {} });
      expect(convertJsonSchemaToGeminiSchema(undefined)).toEqual({ type: "OBJECT", properties: {} });
      expect(convertJsonSchemaToGeminiSchema("string")).toEqual({ type: "OBJECT", properties: {} });
      expect(convertJsonSchemaToGeminiSchema(123)).toEqual({ type: "OBJECT", properties: {} });
      expect(convertJsonSchemaToGeminiSchema([])).toEqual({ type: "OBJECT", properties: {} });

      // Schema with unknown / missing types
      const unknownTypeSchema = {
        type: "non_standard_custom_type",
        description: "test",
      };
      const converted = convertJsonSchemaToGeminiSchema(unknownTypeSchema);
      expect(converted.type).toBeUndefined();
      expect(converted.description).toBe("test");

      // Deeply nested schemas with array of types (nullable)
      const nullableSchema = {
        type: ["string", "null"],
        description: "nullable string",
      };
      const convertedNullable = convertJsonSchemaToGeminiSchema(nullableSchema);
      expect(convertedNullable.type).toBe("STRING");
      expect(convertedNullable.nullable).toBe(true);

      // Stripping of forbidden keywords $schema and additionalProperties
      const forbiddenSchema = {
        $schema: "https://json-schema.org/draft/2020-12/schema",
        type: "object",
        additionalProperties: true,
        properties: {
          sub: {
            $schema: "sub",
            additionalProperties: false,
            type: "integer",
          },
        },
      };
      const convertedForbidden = convertJsonSchemaToGeminiSchema(forbiddenSchema) as Record<string, unknown>;
      expect(convertedForbidden.$schema).toBeUndefined();
      expect(convertedForbidden.additionalProperties).toBeUndefined();
      const subProps = (convertedForbidden.properties as Record<string, unknown>)?.sub as Record<string, unknown>;
      expect(subProps?.$schema).toBeUndefined();
      expect(subProps?.additionalProperties).toBeUndefined();
      expect(subProps?.type).toBe("INTEGER");
    });

    it("handles conversion of all registered MCP tools into valid GeminiFunctionDeclaration", () => {
      const declarations = mcpToolsToGeminiDeclarations(MCP_TOOLS);
      expect(declarations.length).toBe(MCP_TOOLS.length);

      for (const decl of declarations) {
        expect(decl.name).toBeDefined();
        expect(typeof decl.name).toBe("string");
        expect(decl.description).toBeDefined();
        expect(typeof decl.description).toBe("string");
        expect(decl.parameters).toBeDefined();
        expect(decl.parameters?.type).toBe("OBJECT");
        const params = decl.parameters as unknown as Record<string, unknown>;
        expect(params.$schema).toBeUndefined();
        expect(params.additionalProperties).toBeUndefined();
      }
    });

    it("strictly prevents agent from directly granting approvals (Human-in-the-Loop invariant)", async () => {
      setGeminiAgentOverride(true);

      const run = await runs.createRun({
        source: "CONSOLE",
        objective: "HITL Security Invariant Check",
        budgetUsdc: "100.000000",
      });

      const q = encodeURIComponent(
        "Why should we hire Beta Labs and what would it cost to draft a 10 USDC spend?",
      );
      const res = await app.request(`/api/runs/${run.id}/chat?q=${q}`);
      // Consume response stream
      await res.text();

      // Verify that the tool call resulted ONLY in approval.requested
      const runEvents = await runs.listEvents(run.id);
      const approvalRequested = runEvents.find((e) => e.type === "approval.requested");
      expect(approvalRequested).toBeDefined();

      // INVIOLABLE SECURITY INVARIANT:
      // An autonomous loop or tool execution must NEVER record approval.granted or execute financial transfers.
      // Approval granting strictly requires explicit physical operator action on POST /api/runs/:runId/approve.
      const approvalGranted = runEvents.find((e) => e.type === "approval.granted");
      expect(approvalGranted).toBeUndefined();
    });
  });
});

import type { z } from "zod";
import { describe, expect, it } from "vitest";

import {
  convertJsonSchemaToGeminiSchema,
  mcpToolToGeminiDeclaration,
  mcpToolsToGeminiDeclarations,
} from "./gemini-converter.js";
import {
  CONSOLE_DESTINATIONS,
  consoleGetMissionTool,
  consoleGetReadinessTool,
  consoleListMissionsTool,
  consoleNavigateTool,
  consoleToggleMemoryViewTool,
  guardrailsGetPoliciesTool,
  MCP_TOOLS,
  memoryListCounterpartiesTool,
  memoryRecallCounterpartyTool,
  missionProposeApprovalTool,
  type McpToolDefinition,
} from "./tools.js";

describe("MCP to Gemini Schema Converter", () => {
  it("converts all standard JSON schema primitive types to Gemini uppercase types", () => {
    const rawSchema = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      type: "object",
      additionalProperties: false,
      properties: {
        strField: { type: "string", description: "a string" },
        numField: { type: "number", description: "a number" },
        intField: { type: "integer", description: "an integer" },
        boolField: { type: "boolean", description: "a boolean" },
        arrField: { type: "array", items: { type: "string" } },
        objField: { type: "object", properties: { sub: { type: "string" } } },
      },
      required: ["strField", "numField"],
    };

    const converted = convertJsonSchemaToGeminiSchema(rawSchema);

    expect((converted as Record<string, unknown>).$schema).toBeUndefined();
    expect((converted as Record<string, unknown>).additionalProperties).toBeUndefined();
    expect(converted.type).toBe("OBJECT");
    expect(converted.required).toEqual(["strField", "numField"]);

    const props = converted.properties!;
    expect(props.strField?.type).toBe("STRING");
    expect(props.strField?.description).toBe("a string");
    expect(props.numField?.type).toBe("NUMBER");
    expect(props.intField?.type).toBe("INTEGER");
    expect(props.boolField?.type).toBe("BOOLEAN");
    expect(props.arrField?.type).toBe("ARRAY");
    expect(props.arrField?.items?.type).toBe("STRING");
    expect(props.objField?.type).toBe("OBJECT");
    expect(props.objField?.properties?.sub?.type).toBe("STRING");
  });

  it("converts console_navigate tool schema correctly", () => {
    const decl = mcpToolToGeminiDeclaration(consoleNavigateTool);
    expect(decl.name).toBe("console_navigate");
    expect(decl.description).toContain("Navigate the operator");
    expect(decl.parameters).toBeDefined();
    expect(decl.parameters?.type).toBe("OBJECT");
    expect((decl.parameters as unknown as Record<string, unknown>).$schema).toBeUndefined();
    expect((decl.parameters as unknown as Record<string, unknown>).additionalProperties).toBeUndefined();

    const destProp = decl.parameters?.properties?.destination;
    expect(destProp?.type).toBe("STRING");
    expect(destProp?.enum).toEqual(CONSOLE_DESTINATIONS);
    expect(decl.parameters?.required).toEqual(["destination"]);
  });

  it("converts console_toggle_memory_view tool schema correctly", () => {
    const decl = mcpToolToGeminiDeclaration(consoleToggleMemoryViewTool);
    expect(decl.name).toBe("console_toggle_memory_view");
    expect(decl.parameters?.type).toBe("OBJECT");
    expect(decl.parameters?.properties?.enabled?.type).toBe("BOOLEAN");
    expect(decl.parameters?.required).toBeUndefined();
  });

  it("converts console_get_readiness tool schema correctly", () => {
    const decl = mcpToolToGeminiDeclaration(consoleGetReadinessTool);
    expect(decl.name).toBe("console_get_readiness");
    expect(decl.parameters?.type).toBe("OBJECT");
    expect(decl.parameters?.properties).toEqual({});
  });

  it("converts memory_recall_counterparty tool schema correctly", () => {
    const decl = mcpToolToGeminiDeclaration(memoryRecallCounterpartyTool);
    expect(decl.name).toBe("memory_recall_counterparty");
    expect(decl.parameters?.type).toBe("OBJECT");
    expect(decl.parameters?.properties?.counterpartyKey?.type).toBe("STRING");
    expect(decl.parameters?.required).toEqual(["counterpartyKey"]);
  });

  it("converts memory_list_counterparties tool schema correctly", () => {
    const decl = mcpToolToGeminiDeclaration(memoryListCounterpartiesTool);
    expect(decl.name).toBe("memory_list_counterparties");
    expect(decl.parameters?.type).toBe("OBJECT");
  });

  it("converts console_list_missions tool schema with integer and range limits", () => {
    const decl = mcpToolToGeminiDeclaration(consoleListMissionsTool);
    expect(decl.name).toBe("console_list_missions");
    expect(decl.parameters?.type).toBe("OBJECT");
    expect(decl.parameters?.properties?.limit?.type).toBe("INTEGER");
  });

  it("converts console_get_mission tool schema correctly", () => {
    const decl = mcpToolToGeminiDeclaration(consoleGetMissionTool);
    expect(decl.name).toBe("console_get_mission");
    expect(decl.parameters?.type).toBe("OBJECT");
    expect(decl.parameters?.properties?.runId?.type).toBe("STRING");
    expect(decl.parameters?.required).toEqual(["runId"]);
  });

  it("converts guardrails_get_policies tool schema correctly", () => {
    const decl = mcpToolToGeminiDeclaration(guardrailsGetPoliciesTool);
    expect(decl.name).toBe("guardrails_get_policies");
    expect(decl.parameters?.type).toBe("OBJECT");
  });

  it("converts mission_propose_approval tool schema correctly", () => {
    const decl = mcpToolToGeminiDeclaration(missionProposeApprovalTool);
    expect(decl.name).toBe("mission_propose_approval");
    expect(decl.description).toContain("Proposes a mission spend");
    expect(decl.parameters?.type).toBe("OBJECT");
    expect((decl.parameters as unknown as Record<string, unknown>).$schema).toBeUndefined();
    expect((decl.parameters as unknown as Record<string, unknown>).additionalProperties).toBeUndefined();

    const props = decl.parameters?.properties;
    expect(props).toBeDefined();
    if (!props) throw new Error("properties expected");
    expect(props.counterpartyKey?.type).toBe("STRING");
    expect(props.reason?.type).toBe("STRING");
    expect(props.runId?.type).toBe("STRING");

    // amountUsdc is union of number and string
    expect(props.amountUsdc).toBeDefined();
    expect(props.amountUsdc?.anyOf).toBeDefined();
    expect(props.amountUsdc?.anyOf).toHaveLength(2);

    expect(decl.parameters?.required).toContain("counterpartyKey");
    expect(decl.parameters?.required).toContain("amountUsdc");
    expect(decl.parameters?.required).toContain("reason");
    expect(decl.parameters?.required).not.toContain("runId");
  });

  it("converts all MCP_TOOLS using mcpToolsToGeminiDeclarations", () => {
    const declarations = mcpToolsToGeminiDeclarations(MCP_TOOLS);
    expect(declarations).toHaveLength(MCP_TOOLS.length);

    for (const decl of declarations) {
      expect(decl.name).toBeTypeOf("string");
      expect(decl.description).toBeTypeOf("string");
      expect(decl.parameters?.type).toBe("OBJECT");
      expect((decl.parameters as unknown as Record<string, unknown>).$schema).toBeUndefined();
      expect((decl.parameters as unknown as Record<string, unknown>).additionalProperties).toBeUndefined();
    }
  });

  it("handles custom tools with null parameters safely", () => {
    const dummyTool: McpToolDefinition = {
      name: "dummy_tool",
      description: "A dummy tool without parameters",
      parameters: null as unknown as z.ZodType<unknown>,
      execute: async () => ({}),
    };

    const decl = mcpToolToGeminiDeclaration(dummyTool);
    expect(decl.name).toBe("dummy_tool");
    expect(decl.parameters?.type).toBe("OBJECT");
  });
});

import { z } from "zod";

import type { McpToolDefinition } from "./tools.js";

export type GeminiType =
  | "STRING"
  | "NUMBER"
  | "INTEGER"
  | "BOOLEAN"
  | "OBJECT"
  | "ARRAY";

export interface GeminiSchema {
  type?: GeminiType;
  description?: string;
  format?: string;
  enum?: string[];
  properties?: Record<string, GeminiSchema>;
  required?: string[];
  items?: GeminiSchema;
  nullable?: boolean;
  anyOf?: GeminiSchema[];
  oneOf?: GeminiSchema[];
  minimum?: number;
  maximum?: number;
}

export interface GeminiFunctionDeclaration {
  name: string;
  description: string;
  parameters?: GeminiSchema & { type: "OBJECT" };
}

const TYPE_MAP: Record<string, GeminiType> = {
  string: "STRING",
  number: "NUMBER",
  integer: "INTEGER",
  boolean: "BOOLEAN",
  object: "OBJECT",
  array: "ARRAY",
};

/**
 * Converts a standard JSON Schema object (from Zod 4 z.toJSONSchema) into
 * a Gemini / OpenAPI 3.0 Schema specification.
 *
 * Specifically:
 * - Maps lowercase types to UPPERCASE Gemini types (e.g. string -> STRING)
 * - Strips `$schema` and `additionalProperties` (which cause Gemini validation errors)
 * - Maps `description`, `properties`, `required`, `items`, `enum`, `format`, `anyOf`
 */
export function convertJsonSchemaToGeminiSchema(raw: unknown): GeminiSchema {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { type: "OBJECT", properties: {} };
  }

  const input = raw as Record<string, unknown>;
  const schema: GeminiSchema = {};

  // Handle type
  if (typeof input.type === "string") {
    const mapped = TYPE_MAP[input.type.toLowerCase()];
    if (mapped) {
      schema.type = mapped;
    }
  } else if (Array.isArray(input.type)) {
    const types = input.type.filter((t) => typeof t === "string") as string[];
    if (types.includes("null")) {
      schema.nullable = true;
    }
    const nonNull = types.filter((t) => t !== "null");
    if (nonNull.length > 0 && nonNull[0] && TYPE_MAP[nonNull[0].toLowerCase()]) {
      schema.type = TYPE_MAP[nonNull[0].toLowerCase()];
    }
  }

  // Handle description
  if (typeof input.description === "string") {
    schema.description = input.description;
  }

  // Handle format
  if (typeof input.format === "string") {
    schema.format = input.format;
  }

  // Handle enum
  if (Array.isArray(input.enum)) {
    schema.enum = input.enum.map((v) => String(v));
  }

  // Handle properties
  if (input.properties && typeof input.properties === "object" && !Array.isArray(input.properties)) {
    const props: Record<string, GeminiSchema> = {};
    for (const [key, val] of Object.entries(input.properties as Record<string, unknown>)) {
      props[key] = convertJsonSchemaToGeminiSchema(val);
    }
    schema.properties = props;
  }

  // Handle required
  if (Array.isArray(input.required)) {
    const req = input.required.filter((r) => typeof r === "string") as string[];
    if (req.length > 0) {
      schema.required = req;
    }
  }

  // Handle items
  if (input.items && typeof input.items === "object") {
    schema.items = convertJsonSchemaToGeminiSchema(input.items);
  }

  // Handle anyOf
  if (Array.isArray(input.anyOf)) {
    schema.anyOf = input.anyOf.map((s) => convertJsonSchemaToGeminiSchema(s));
  }

  // Handle oneOf
  if (Array.isArray(input.oneOf)) {
    schema.oneOf = input.oneOf.map((s) => convertJsonSchemaToGeminiSchema(s));
  }

  // Handle minimum / maximum
  if (typeof input.minimum === "number") {
    schema.minimum = input.minimum;
  }
  if (typeof input.maximum === "number") {
    schema.maximum = input.maximum;
  }

  // $schema and additionalProperties are intentionally stripped

  return schema;
}

/**
 * Converts an MCP tool definition into a native Gemini FunctionDeclaration.
 */
export function mcpToolToGeminiDeclaration(tool: McpToolDefinition): GeminiFunctionDeclaration {
  const jsonSchema = tool.parameters ? z.toJSONSchema(tool.parameters) : { type: "object", properties: {} };
  const converted = convertJsonSchemaToGeminiSchema(jsonSchema);

  const parameters: GeminiSchema & { type: "OBJECT" } = {
    ...converted,
    type: "OBJECT",
    properties: converted.properties ?? {},
  };

  return {
    name: tool.name,
    description: tool.description,
    parameters,
  };
}

/**
 * Converts an array of MCP tool definitions into Gemini FunctionDeclaration objects.
 */
export function mcpToolsToGeminiDeclarations(tools: McpToolDefinition[]): GeminiFunctionDeclaration[] {
  return tools.map(mcpToolToGeminiDeclaration);
}

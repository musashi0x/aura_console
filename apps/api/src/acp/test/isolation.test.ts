import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const read = (relative: string) =>
  readFile(fileURLToPath(new URL(relative, import.meta.url)), "utf8");

/**
 * The ACP runtime is a separate process. These are the two claims that make
 * that true rather than merely intended: the HTTP server never reaches into
 * `src/acp/`, and the API's own environment says nothing about ACP. If either
 * breaks, a missing wallet key starts taking the API down with it.
 */
describe("ACP runtime isolation", () => {
  it("keeps src/acp out of the HTTP server's module graph", async () => {
    for (const file of ["../../server.ts", "../../app.ts"]) {
      const source = await read(file);
      expect(source).not.toMatch(/from\s+["'].*\bacp\b/);
    }
  });

  it("keeps ACP variables out of the API environment schema", async () => {
    const source = await read("../../env.ts");

    expect(source).not.toContain("ACP_");
  });

  it("boots the API app with every ACP variable absent", async () => {
    for (const key of Object.keys(process.env)) {
      if (key.startsWith("ACP_")) delete process.env[key];
    }

    const { app } = await import("../../app.js");
    const response = await app.request("/health");

    expect(response.status).toBe(200);
  });
});

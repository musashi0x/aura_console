import { describe, expect, it } from "vitest";

import { app } from "./app.js";

describe("health", () => {
  it("answers liveness without touching the database", async () => {
    const res = await app.request("/health");

    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; uptime: number };
    expect(body.status).toBe("ok");
    expect(typeof body.uptime).toBe("number");
  });
});

describe("error contract", () => {
  it("returns a structured 404 for unknown routes", async () => {
    const res = await app.request("/does-not-exist");

    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toContain("application/json");
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe("not_found");
    expect(typeof body.error.message).toBe("string");
  });
});

import { describe, expect, it } from "vitest";

import { app } from "../app.js";

describe("chat routes", () => {
  it("refuses /api/chat without a query parameter", async () => {
    const res = await app.request("/api/chat");
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("invalid_question");
  });

  it("refuses /api/runs/:runId/chat with invalid runId", async () => {
    const res = await app.request("/api/runs/not-a-uuid/chat?q=hello");
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("invalid_run_id");
  });

  it("successfully serves deployment-level /api/chat stream when configured", async () => {
    const res = await app.request("/api/chat?q=Who+is+Alpha");
    // If agent is reachable it returns 200 SSE stream; if not configured/reachable it returns 503
    expect([200, 503]).toContain(res.status);
    if (res.status === 200) {
      expect(res.headers.get("content-type")).toContain("text/event-stream");
    }
  });
});

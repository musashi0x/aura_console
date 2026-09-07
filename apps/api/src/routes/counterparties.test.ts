import { describe, expect, it } from "vitest";

import { app } from "../app.js";

describe("POST /api/counterparties/:counterpartyKey/unblock", () => {
  it("unblocks a counterparty restoring status to WATCH", async () => {
    const res = await app.request("/api/counterparties/virtuals:agent:blocked_test/unblock", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        reason: "Operator reviewed logs and granted manual forgiveness",
        targetStatus: "WATCH",
      }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      ok: boolean;
      counterpartyKey: string;
      status: string;
      unblockedBy: string;
      reason: string;
    };
    expect(body.ok).toBe(true);
    expect(body.counterpartyKey).toBe("virtuals:agent:blocked_test");
    expect(body.status).toBe("WATCH");
    expect(body.unblockedBy).toBe("console_operator");
    expect(body.reason).toContain("Operator reviewed logs");
  });

  it("defaults to WATCH when no targetStatus is specified", async () => {
    const res = await app.request("/api/counterparties/virtuals:agent:beta/unblock", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; status: string };
    expect(body.ok).toBe(true);
    expect(body.status).toBe("WATCH");
  });

  it("rejects invalid targetStatus with 422", async () => {
    const res = await app.request("/api/counterparties/virtuals:agent:alpha/unblock", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        targetStatus: "INVALID_STATUS",
      }),
    });

    expect(res.status).toBe(422);
  });
});

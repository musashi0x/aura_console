import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "./api-client";

/**
 * The counterparty-memory client methods.
 *
 * Two things here are easy to get wrong and expensive when wrong. Every real
 * counterparty key contains colons (`virtuals:agent:alpha`), so a key that is
 * not percent-encoded builds a path the API reads as extra segments. And the
 * records endpoint answers 503 when Sibyl could not be asked — a caller that
 * turned that into an empty list would report "no memory" for a store nobody
 * managed to read, which is the collapse this endpoint exists to prevent.
 */

const KEY = "virtuals:agent:alpha";

let calls: string[];

function respond(status: number, body: unknown): void {
  vi.stubGlobal(
    "fetch",
    vi.fn((input: URL | string) => {
      calls.push(String(input));
      return Promise.resolve(
        new Response(JSON.stringify(body), {
          status,
          headers: { "content-type": "application/json" },
        }),
      );
    }),
  );
}

beforeEach(() => {
  calls = [];
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the counterparty memory client", () => {
  it("percent-encodes a key, because every real key contains colons", async () => {
    respond(200, { counterparty_key: KEY, status: "NO_HISTORY" });
    await apiClient.getCounterpartyMemory(KEY);

    expect(calls[0]).toContain("virtuals%3Aagent%3Aalpha");
    // The raw form would be read by the router as extra path segments.
    expect(calls[0]).not.toContain("virtuals:agent:alpha");
  });

  it("sends no query string when the caller narrowed nothing", async () => {
    // The server owns the default limit, and the key is the recall unless the
    // operator narrows it. Sending limit=20 here would freeze the server's
    // default into the client.
    respond(200, { items: [] });
    await apiClient.getCounterpartyMemoryRecords(KEY);

    expect(calls[0]).not.toContain("?");
  });

  it("passes a limit and a query only when given one", async () => {
    respond(200, { items: [] });
    await apiClient.getCounterpartyMemoryRecords(KEY, { limit: 5, query: "late delivery" });

    expect(calls[0]).toContain("limit=5");
    expect(calls[0]).toContain("q=late+delivery");
  });

  it("surfaces a 503 as a failure carrying Sibyl's reason, never as an empty list", async () => {
    respond(503, {
      error: { code: "sibyl_unreachable", message: "The Sibyl bridge could not be run." },
    });
    const result = await apiClient.getCounterpartyMemoryRecords(KEY);

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("a 503 must not be reported as success");
    expect(result.error.code).toBe("sibyl_unreachable");
    expect(result.error.message).toMatch(/could not be run/);
  });

  it("reports an ERROR status as a successful read, because the API did answer", async () => {
    // 200 with status ERROR is the endpoint working correctly: it looked, and
    // it is telling us it could not know. That is not a transport failure, and
    // collapsing the two would lose which one happened.
    respond(200, { counterparty_key: KEY, status: "ERROR", retryable: true });
    const result = await apiClient.getCounterpartyMemory(KEY);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("a 200 must be reported as success");
    expect(result.data.status).toBe("ERROR");
  });
});

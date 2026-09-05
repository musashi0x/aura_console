import { describe, expect, it } from "vitest";

import { app } from "../../app.js";

interface ErrorShape {
  error: { code: string; message: string };
}

async function createRun(objective = "Buy one dataset under budget") {
  const res = await app.request("/api/runs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ objective, budgetUsdc: "25.000000" }),
  });
  expect(res.status).toBe(201);
  const body = (await res.json()) as { run: { id: string } };
  return body.run;
}

function appendBody(overrides: Record<string, unknown> = {}) {
  return {
    eventId: crypto.randomUUID(),
    type: "evidence.gathered",
    eventTime: "2026-08-29T10:00:00.000Z",
    data: { source: "fixture" },
    ...overrides,
  };
}

async function append(runId: string, body: Record<string, unknown>) {
  return app.request(`/api/runs/${runId}/events`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("creating a Run", () => {
  it("persists the seed and its first event in one step", async () => {
    const run = await createRun();
    expect(run).toMatchObject({ source: "CONSOLE", environment: "non-mainnet", isMainnet: false });

    const res = await app.request(`/api/runs/${run.id}/events`);
    const body = (await res.json()) as { events: { type: string; sequence: number }[] };
    expect(body.events).toHaveLength(1);
    expect(body.events[0]).toMatchObject({ type: "run.created", sequence: 0 });
  });

  it("never reports a spent amount it was not told", async () => {
    const run = (await createRun()) as unknown as Record<string, unknown>;
    expect(run).not.toHaveProperty("spentUsdc");
    expect(run).not.toHaveProperty("status");
    expect(run.budgetUsdc).toBe("25.000000");
  });

  it("rejects a blank objective with a structured error", async () => {
    const res = await app.request("/api/runs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ objective: "   " }),
    });
    expect(res.status).toBe(422);
    expect(((await res.json()) as ErrorShape).error.code).toBe("invalid_payload");
  });

  it("rejects a body that is not JSON", async () => {
    const res = await app.request("/api/runs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not json",
    });
    expect(res.status).toBe(400);
    expect(((await res.json()) as ErrorShape).error.code).toBe("invalid_json");
  });
});

describe("reading Runs", () => {
  it("lists real rows, newest first", async () => {
    const first = await createRun("First objective");
    const second = await createRun("Second objective");

    const res = await app.request("/api/runs");
    const body = (await res.json()) as { runs: { id: string }[] };
    expect(body.runs.map((r) => r.id).slice(0, 2)).toEqual([second.id, first.id]);
  });

  it("returns an empty list only because the store is genuinely empty", async () => {
    const res = await app.request("/api/runs");
    expect(res.status).toBe(200);
    expect(((await res.json()) as { runs: unknown[] }).runs).toEqual([]);
  });

  it("distinguishes a malformed id from a missing Run", async () => {
    const malformed = await app.request("/api/runs/not-a-uuid");
    expect(malformed.status).toBe(400);
    expect(((await malformed.json()) as ErrorShape).error.code).toBe("invalid_run_id");

    const missing = await app.request(`/api/runs/${crypto.randomUUID()}`);
    expect(missing.status).toBe(404);
    expect(((await missing.json()) as ErrorShape).error.code).toBe("run_not_found");
  });

  it("does not answer an unknown Run's events with an empty list", async () => {
    const res = await app.request(`/api/runs/${crypto.randomUUID()}/events`);
    expect(res.status).toBe(404);
    expect(((await res.json()) as ErrorShape).error.code).toBe("run_not_found");
  });
});

describe("appending events", () => {
  it("allocates sequence numbers server-side, in arrival order", async () => {
    const run = await createRun();
    await append(run.id, appendBody({ type: "decision.made" }));
    await append(run.id, appendBody({ type: "outcome.recorded" }));

    const res = await app.request(`/api/runs/${run.id}/events`);
    const body = (await res.json()) as { events: { type: string; sequence: number }[] };
    expect(body.events.map((e) => e.sequence)).toEqual([0, 1, 2]);
    expect(body.events.map((e) => e.type)).toEqual([
      "run.created",
      "decision.made",
      "outcome.recorded",
    ]);
  });

  it("ignores a client-supplied sequence", async () => {
    const run = await createRun();
    const res = await append(run.id, appendBody({ sequence: 99 }));
    const body = (await res.json()) as { event: { sequence: number } };
    expect(body.event.sequence).toBe(1);
  });

  it("keeps the producer's domain time rather than arrival time", async () => {
    const run = await createRun();
    const eventTime = "2026-01-02T03:04:05.000Z";
    const res = await append(run.id, appendBody({ eventTime }));
    expect(((await res.json()) as { event: { eventTime: string } }).event.eventTime).toBe(eventTime);
  });

  it("is idempotent for a repeated event id", async () => {
    const run = await createRun();
    const body = appendBody();

    const first = await append(run.id, body);
    expect(first.status).toBe(201);
    const second = await append(run.id, body);
    expect(second.status).toBe(200);

    const events = (await (await app.request(`/api/runs/${run.id}/events`)).json()) as {
      events: unknown[];
    };
    expect(events.events).toHaveLength(2);
  });

  it("refuses to rewrite history under a reused event id", async () => {
    const run = await createRun();
    const body = appendBody();
    await append(run.id, body);

    const conflicting = await append(run.id, { ...body, data: { source: "changed" } });
    expect(conflicting.status).toBe(409);
    expect(((await conflicting.json()) as ErrorShape).error.code).toBe("event_conflict");
  });

  it("gives every concurrent append its own sequence", async () => {
    const run = await createRun();
    const results = await Promise.all(
      Array.from({ length: 8 }, (_, i) => append(run.id, appendBody({ type: `step.${i}` }))),
    );
    expect(results.every((r) => r.status === 201)).toBe(true);

    const events = (await (await app.request(`/api/runs/${run.id}/events`)).json()) as {
      events: { sequence: number }[];
    };
    const sequences = events.events.map((e) => e.sequence);
    expect(sequences).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    expect(new Set(sequences).size).toBe(sequences.length);
  });

  it("stores an unrecognised type unchanged rather than dropping it", async () => {
    const run = await createRun();
    await append(run.id, appendBody({ type: "some.future.type", data: { keep: true } }));

    const events = (await (await app.request(`/api/runs/${run.id}/events`)).json()) as {
      events: { type: string; data: unknown }[];
    };
    expect(events.events[1]).toMatchObject({
      type: "some.future.type",
      data: { keep: true },
    });
  });

  it("cannot append to a Run that does not exist", async () => {
    const res = await append(crypto.randomUUID(), appendBody());
    expect(res.status).toBe(404);
    expect(((await res.json()) as ErrorShape).error.code).toBe("run_not_found");
  });

  it("serves events after a cursor so a reconnect replays no duplicates", async () => {
    const run = await createRun();
    await append(run.id, appendBody({ type: "decision.made" }));
    await append(run.id, appendBody({ type: "outcome.recorded" }));

    const res = await app.request(`/api/runs/${run.id}/events?after=0`);
    const body = (await res.json()) as { events: { sequence: number }[] };
    expect(body.events.map((e) => e.sequence)).toEqual([1, 2]);
  });
});

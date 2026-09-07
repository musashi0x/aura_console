import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { app } from "../app.js";

/**
 * The approval endpoint is the only path in the console that authorizes a
 * spend, so what it REFUSES matters more than what it accepts. Each test here
 * is one way the product's "money is never ambient" claim could be lost.
 */

async function createRun() {
  const res = await app.request("/api/runs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ objective: "Buy one dataset" }),
  });
  const body = (await res.json()) as { run: { id: string } };
  return body.run.id;
}

async function append(runId: string, type: string, data: Record<string, unknown> = {}) {
  await app.request(`/api/runs/${runId}/events`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      eventId: randomUUID(),
      type,
      eventTime: new Date().toISOString(),
      data,
    }),
  });
}

function approve(runId: string, body: unknown = { ceiling_usdc: "25.000000" }) {
  return app.request(`/api/runs/${runId}/approve`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("approving a requested action", () => {
  it("records the operator's grant against the request it answers", async () => {
    const runId = await createRun();
    await append(runId, "approval.requested", {
      action: "Fund the job at 12 USDC",
      counterparty_key: "virtuals:agent:beta",
    });

    const res = await approve(runId);
    expect(res.status).toBe(201);

    const events = await (await app.request(`/api/runs/${runId}/events`)).json();
    const granted = (events as { events: { type: string; data: Record<string, unknown> }[] }).events
      .filter((e) => e.type === "approval.granted")
      .at(-1);

    expect(granted?.data.ceiling_usdc).toBe("25.000000");
    // The grant names the action it answers rather than whatever was posted.
    expect(granted?.data.action).toBe("Fund the job at 12 USDC");
    expect(granted?.data.granted_via).toBe("console_operator_click");
  });
});

describe("what the approval endpoint refuses", () => {
  it("will not approve an action nobody asked about", async () => {
    // Otherwise an approval could be the first anyone hears of a spend.
    const runId = await createRun();
    const res = await approve(runId);
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("no_pending_approval");
  });

  it("will not grant the same request twice", async () => {
    // Two grants for one request is how a replay authorizes a second action.
    const runId = await createRun();
    await append(runId, "approval.requested", { action: "Fund the job" });
    expect((await approve(runId)).status).toBe(201);

    const second = await approve(runId);
    expect(second.status).toBe(409);
    const body = (await second.json()) as { error: { code: string } };
    expect(body.error.code).toBe("already_approved");
  });

  it("approves again only when a fresh request was made", async () => {
    // A new request is a new question, and it deserves its own answer.
    const runId = await createRun();
    await append(runId, "approval.requested", { action: "Fund the job" });
    await approve(runId);
    await append(runId, "approval.requested", { action: "Fund the revised job" });
    expect((await approve(runId)).status).toBe(201);
  });

  it("will not approve without a ceiling, because that is a blank cheque", async () => {
    const runId = await createRun();
    await append(runId, "approval.requested", { action: "Fund the job" });
    expect((await approve(runId, {})).status).toBe(422);
    expect((await approve(runId, { ceiling_usdc: "lots" })).status).toBe(422);
  });

  it("answers 404 for a Mission that does not exist", async () => {
    expect((await approve(randomUUID())).status).toBe(404);
  });

  it("answers 400 for an id that is not a Run id", async () => {
    expect((await approve("not-a-uuid")).status).toBe(400);
  });
});

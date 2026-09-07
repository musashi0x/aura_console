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

function reject(runId: string, body: unknown = { reason: "Operator rejected the requested action" }) {
  return app.request(`/api/runs/${runId}/reject`, {
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

describe("rejecting a requested action", () => {
  it("records the operator's rejection against the request it answers", async () => {
    const runId = await createRun();
    await append(runId, "approval.requested", {
      action: "Fund the job at 12 USDC",
      counterparty_key: "virtuals:agent:beta",
      ceiling_usdc: "12.000000",
    });

    const res = await reject(runId, { reason: "Exceeds benchmark" });
    expect(res.status).toBe(201);

    const body = (await res.json()) as {
      event: { event_id: string; type: string; sequence: number };
    };
    expect(body.event.type).toBe("approval.rejected");

    const events = await (await app.request(`/api/runs/${runId}/events`)).json();
    const rejected = (events as { events: { type: string; data: Record<string, unknown> }[] }).events
      .filter((e) => e.type === "approval.rejected")
      .at(-1);

    expect(rejected?.data.reason).toBe("Exceeds benchmark");
    expect(rejected?.data.ceiling_usdc).toBe("12.000000");
    expect(rejected?.data.action).toBe("Fund the job at 12 USDC");
    expect(rejected?.data.counterparty_key).toBe("virtuals:agent:beta");
    expect(rejected?.data.granted_via).toBe("console_operator_click");
  });

  it("applies default rejection reason when no reason is provided", async () => {
    const runId = await createRun();
    await append(runId, "approval.requested", {
      action: "Fund the job at 12 USDC",
      counterparty_key: "virtuals:agent:beta",
    });

    const res = await reject(runId, {});
    expect(res.status).toBe(201);

    const events = await (await app.request(`/api/runs/${runId}/events`)).json();
    const rejected = (events as { events: { type: string; data: Record<string, unknown> }[] }).events
      .filter((e) => e.type === "approval.rejected")
      .at(-1);

    expect(rejected?.data.reason).toBe("Operator rejected the requested action");
  });
});

describe("what the rejection endpoint refuses", () => {
  it("will not reject an action nobody asked about", async () => {
    const runId = await createRun();
    const res = await reject(runId);
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("no_pending_approval");
  });

  it("will not reject the same request twice", async () => {
    const runId = await createRun();
    await append(runId, "approval.requested", { action: "Fund the job" });
    expect((await reject(runId)).status).toBe(201);

    const second = await reject(runId);
    expect(second.status).toBe(409);
    const body = (await second.json()) as { error: { code: string } };
    expect(body.error.code).toBe("already_rejected");
  });

  it("will not reject an already approved request", async () => {
    const runId = await createRun();
    await append(runId, "approval.requested", { action: "Fund the job" });
    expect((await approve(runId)).status).toBe(201);

    const res = await reject(runId);
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("already_approved");
  });

  it("will not approve an already rejected request", async () => {
    const runId = await createRun();
    await append(runId, "approval.requested", { action: "Fund the job" });
    expect((await reject(runId)).status).toBe(201);

    const res = await approve(runId);
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("already_rejected");
  });

  it("rejects again only when a fresh request was made", async () => {
    const runId = await createRun();
    await append(runId, "approval.requested", { action: "Fund the job" });
    await reject(runId);
    await append(runId, "approval.requested", { action: "Fund the revised job" });
    expect((await reject(runId)).status).toBe(201);
  });

  it("answers 404 for a Mission that does not exist", async () => {
    expect((await reject(randomUUID())).status).toBe(404);
  });

  it("answers 400 for an id that is not a Run id", async () => {
    expect((await reject("not-a-uuid")).status).toBe(400);
  });
});

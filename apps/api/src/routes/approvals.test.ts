import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { app } from "../app.js";

/**
 * The approval endpoint is the only path in the console that authorizes a
 * spend, so what it REFUSES matters more than what it accepts. Each test here
 * is one way the product's "money is never ambient" claim could be lost.
 */

/**
 * A Run whose log holds only the seed.
 *
 * `source: "AGENT"` keeps the agent's opening out of it. A CONSOLE Mission is
 * opened on creation and may already carry a pending `approval.requested`,
 * which would quietly satisfy the very precondition these tests exist to prove
 * the endpoint checks for.
 */
async function createRun() {
  const res = await app.request("/api/runs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ objective: "Buy one dataset", source: "AGENT" }),
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

  it("triggers post-approval execution: resumes run, funds job, evaluates, settles commitment, and records outcome", async () => {
    const runId = await createRun();
    await append(runId, "approval.requested", {
      action: "Fund dataset retrieval",
      counterparty_key: "virtuals:agent:beta",
    });

    const res = await approve(runId, { ceiling_usdc: "15.000000" });
    expect(res.status).toBe(201);

    const eventsRes = await app.request(`/api/runs/${runId}/events`);
    expect(eventsRes.status).toBe(200);
    const body = (await eventsRes.json()) as { events: { type: string; data: Record<string, unknown> }[] };
    const eventTypes = body.events.map((e) => e.type);

    expect(eventTypes).toContain("approval.granted");
    expect(eventTypes).toContain("run.resumed");
    expect(eventTypes).toContain("acp.job.funded");
    expect(eventTypes).toContain("evaluation.completed");
    expect(eventTypes).toContain("commitment.settled");
    expect(eventTypes).toContain("outcome.recorded");

    // Check payload details matching console UI expectations
    const funded = body.events.find((e) => e.type === "acp.job.funded")?.data;
    expect(funded?.counterparty_key).toBe("virtuals:agent:beta");
    expect(funded?.amount_usdc).toBe("15.000000");
    expect(funded?.job_state).toBe("FUNDED");

    const evaluation = body.events.find((e) => e.type === "evaluation.completed")?.data;
    expect(evaluation?.result).toBe("ACCEPTED");
    expect(evaluation?.evaluated_by).toBe("verifier_agent");

    const settled = body.events.find((e) => e.type === "commitment.settled")?.data;
    expect(settled?.amount_usdc).toBe("15.000000");
    expect(String(settled?.tx_hash)).toMatch(/^0x[a-f0-9]{64}$/);

    const outcome = body.events.find((e) => e.type === "outcome.recorded")?.data;
    expect(outcome?.result).toBe("ACCEPTED");
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

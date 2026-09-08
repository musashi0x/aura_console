import { eq, getDb, schema } from "@aura/db";
import type { AcpAgent, JobSession } from "@virtuals-protocol/acp-node-v2";
import { describe, expect, it, vi } from "vitest";

import { app } from "../../app.js";
import { RunStore } from "../../services/run-store.js";
import { parseEvaluateJobArgs } from "../evaluate-job.js";
import { AcpEvaluator } from "../outbound/evaluator.js";

const CHAIN_ID = 84_532;
const JOB_ID = "99";

const db = getDb();
const store = new RunStore();

function stubAgent() {
  const completeFn = vi.fn(async () => {});
  const rejectFn = vi.fn(async () => {});
  const session = {
    complete: completeFn,
    reject: rejectFn,
  } as unknown as JobSession;

  const agent = {
    getSession: vi.fn(() => session),
  } as unknown as Pick<AcpAgent, "getSession">;

  return { agent, session: { complete: completeFn, reject: rejectFn } };
}

async function seedAcpRun(jobId = JOB_ID) {
  const run = await store.createRun({
    objective: `ACP job ${jobId} on base-sepolia`,
    source: "AGENT",
    environment: "base-sepolia",
  });
  await db.insert(schema.acpJobs).values({ chainId: CHAIN_ID, jobId, runId: run.id });
  return run;
}

describe("parseEvaluateJobArgs", () => {
  it("parses valid arguments for completion", () => {
    const args = parseEvaluateJobArgs(["84532", "42", "complete", "verified deliverable"]);
    expect(args).toEqual({
      chainId: 84532,
      jobId: "42",
      action: "complete",
      reason: "verified deliverable",
    });
  });

  it("parses valid arguments for rejection", () => {
    const args = parseEvaluateJobArgs(["84532", "42", "reject", "missing required fields"]);
    expect(args).toEqual({
      chainId: 84532,
      jobId: "42",
      action: "reject",
      reason: "missing required fields",
    });
  });

  it("rejects invalid actions", () => {
    expect(() => parseEvaluateJobArgs(["84532", "42", "cancel", "reason"])).toThrow(
      /Action must be 'complete' or 'reject'/,
    );
  });

  it("rejects missing arguments", () => {
    expect(() => parseEvaluateJobArgs(["84532", "42"])).toThrow(/Missing argument/);
  });

  it("rejects non-numeric chain id", () => {
    expect(() => parseEvaluateJobArgs(["abc", "42", "complete", "reason"])).toThrow(
      /Chain ID must be a positive integer/,
    );
  });
});

describe("AcpEvaluator", () => {
  it("executes completion via session and records outcome events", async () => {
    const run = await seedAcpRun("101");
    const { agent, session } = stubAgent();

    const evaluator = new AcpEvaluator({ agent });
    const result = await evaluator.evaluate({
      chainId: CHAIN_ID,
      jobId: "101",
      action: "complete",
      reason: "Deliverable verified against criteria",
      runId: run.id,
    });

    expect(result.success).toBe(true);
    expect(result.action).toBe("complete");
    expect(session.complete).toHaveBeenCalledWith("Deliverable verified against criteria");
    expect(session.reject).not.toHaveBeenCalled();

    const events = await db
      .select()
      .from(schema.runEvents)
      .where(eq(schema.runEvents.runId, run.id));

    const completedEvent = events.find((e) => e.type === "acp.job.completed");
    expect(completedEvent).toBeDefined();
    expect(completedEvent?.data).toMatchObject({
      chain_id: CHAIN_ID,
      job_id: "101",
      reason: "Deliverable verified against criteria",
    });

    const outcomeEvent = events.find((e) => e.type === "outcome.recorded");
    expect(outcomeEvent).toBeDefined();
    expect(outcomeEvent?.data).toMatchObject({
      outcome: "accepted",
      result: "ACCEPTED",
    });
  });

  it("executes rejection via session and records rejection outcome", async () => {
    const run = await seedAcpRun("102");
    const { agent, session } = stubAgent();

    const evaluator = new AcpEvaluator({ agent });
    const result = await evaluator.evaluate({
      chainId: CHAIN_ID,
      jobId: "102",
      action: "reject",
      reason: "Malformed deliverable format",
      runId: run.id,
    });

    expect(result.success).toBe(true);
    expect(result.action).toBe("reject");
    expect(session.reject).toHaveBeenCalledWith("Malformed deliverable format");
    expect(session.complete).not.toHaveBeenCalled();

    const events = await db
      .select()
      .from(schema.runEvents)
      .where(eq(schema.runEvents.runId, run.id));

    const rejectedEvent = events.find((e) => e.type === "acp.job.rejected");
    expect(rejectedEvent).toBeDefined();
    expect(rejectedEvent?.data).toMatchObject({
      chain_id: CHAIN_ID,
      job_id: "102",
      reason: "Malformed deliverable format",
    });

    const outcomeEvent = events.find((e) => e.type === "outcome.recorded");
    expect(outcomeEvent).toBeDefined();
    expect(outcomeEvent?.data).toMatchObject({
      outcome: "rejected",
      result: "REJECTED",
    });
  });
});

describe("POST /api/runs/:runId/acp/evaluate", () => {
  it("evaluates complete via HTTP API", async () => {
    const run = await seedAcpRun("103");

    const res = await app.request(`/api/runs/${run.id}/acp/evaluate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "complete",
        reason: "API deliverable accepted",
      }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean; action: string };
    expect(body.success).toBe(true);
    expect(body.action).toBe("complete");

    const events = await db
      .select()
      .from(schema.runEvents)
      .where(eq(schema.runEvents.runId, run.id));

    expect(events.some((e) => e.type === "acp.job.completed")).toBe(true);
    expect(events.some((e) => e.type === "outcome.recorded")).toBe(true);
  });

  it("evaluates reject via HTTP API", async () => {
    const run = await seedAcpRun("104");

    const res = await app.request(`/api/runs/${run.id}/acp/evaluate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "reject",
        reason: "API deliverable rejected",
      }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean; action: string };
    expect(body.success).toBe(true);
    expect(body.action).toBe("reject");

    const events = await db
      .select()
      .from(schema.runEvents)
      .where(eq(schema.runEvents.runId, run.id));

    expect(events.some((e) => e.type === "acp.job.rejected")).toBe(true);
    expect(events.some((e) => e.type === "outcome.recorded")).toBe(true);
  });
});

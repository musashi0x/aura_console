import { eq, getDb, schema } from "@aura/db";
import type { AcpAgent, JobSession } from "@virtuals-protocol/acp-node-v2";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { authorizeFund } from "../routes/acp-fund-authorizations.js";
import { RunStore } from "../services/run-store.js";
import { AcpSpendExecutor } from "./spender.js";

const CHAIN_ID = 84_532;
const JOB_ID = "42";
const AUTH_EVENT_ID = "11111111-1111-4111-8111-111111111111";
const AUTHORIZED_AT = "2026-09-05T00:00:00.000Z";

const db = getDb();
const store = new RunStore();

/**
 * httpError carries its message in the response body, not on the Error, so an
 * assertion on `.message` would silently match nothing.
 */
async function expectHttpError(promise: Promise<unknown>, status: number, code: string) {
  const error = await promise.then(
    () => {
      throw new Error("expected the call to fail");
    },
    (caught: unknown) => caught as { res?: Response },
  );

  expect(error.res?.status).toBe(status);
  expect(await error.res?.clone().json()).toMatchObject({ error: { code } });
  return error;
}

const listEvents = (runId: string) =>
  db.select().from(schema.runEvents).where(eq(schema.runEvents.runId, runId));
const listIntents = () => db.select().from(schema.acpSpendIntents);

/** A session that records what it was asked to fund, without a chain. */
function stubAgent(fund: (amount: unknown) => Promise<void> = async () => {}) {
  const session = { fund: vi.fn(fund) } as unknown as JobSession;
  const agent = {
    getSession: vi.fn(() => session),
  } as unknown as Pick<AcpAgent, "getSession">;
  return { agent, session: session as unknown as { fund: ReturnType<typeof vi.fn> } };
}

async function seedAcpRun() {
  const run = await store.createRun({
    objective: `ACP job ${JOB_ID} on base-sepolia`,
    source: "AGENT",
    environment: "base-sepolia",
  });
  await db.insert(schema.acpJobs).values({ chainId: CHAIN_ID, jobId: JOB_ID, runId: run.id });
  return run;
}

describe("authorizeFund", () => {
  it("writes the authorization event and the instruction together", async () => {
    const run = await seedAcpRun();

    const { event } = await authorizeFund(run.id, {
      eventId: AUTH_EVENT_ID,
      amountUsdc: "1.250000",
      authorizedAt: AUTHORIZED_AT,
    });

    expect(event.type).toBe("acp.fund.authorized");
    expect(event.data).toMatchObject({ amount_usdc: "1.250000", job_id: JOB_ID });

    const [intent] = await listIntents();
    expect(intent?.authorizationEventId).toBe(AUTH_EVENT_ID);
    expect(intent?.amountUsdc).toBe("1.250000");
    expect(intent?.claimedAt).toBeNull();
    expect(intent?.submittedAt).toBeNull();
  });

  it("refuses a Run with no ACP job behind it", async () => {
    const run = await store.createRun({ objective: "console run", source: "CONSOLE" });

    await expectHttpError(
      authorizeFund(run.id, {
        eventId: AUTH_EVENT_ID,
        amountUsdc: "1.000000",
        authorizedAt: AUTHORIZED_AT,
      }),
      409,
      "not_an_acp_run",
    );

    expect(await listIntents()).toHaveLength(0);
  });

  it("refuses a second authorization for the same job", async () => {
    const run = await seedAcpRun();
    const base = { amountUsdc: "1.000000", authorizedAt: AUTHORIZED_AT };

    await authorizeFund(run.id, { ...base, eventId: AUTH_EVENT_ID });

    await expectHttpError(
      authorizeFund(run.id, { ...base, eventId: "22222222-2222-4222-8222-222222222222" }),
      409,
      "fund_already_authorized",
    );

    expect(await listIntents()).toHaveLength(1);
  });

  it("refuses an unknown Run", async () => {
    await expectHttpError(
      authorizeFund("33333333-3333-4333-8333-333333333333", {
        eventId: AUTH_EVENT_ID,
        amountUsdc: "1.000000",
        authorizedAt: AUTHORIZED_AT,
      }),
      404,
      "run_not_found",
    );
  });
});

describe("AcpSpendExecutor", () => {
  let run: Awaited<ReturnType<typeof seedAcpRun>>;

  beforeEach(async () => {
    run = await seedAcpRun();
  });

  it("does nothing when no operator has authorized anything", async () => {
    const { agent, session } = stubAgent();

    const result = await new AcpSpendExecutor({ agent, log: () => {} }).sweep();

    expect(result).toEqual({ claimed: 0, submitted: 0 });
    expect(session.fund).not.toHaveBeenCalled();
  });

  /**
   * The property the whole design exists for. `POST /:runId/events` accepts any
   * type, so an authorization *event* is trivially forgeable. Only the intent
   * row is an instruction.
   */
  it("ignores an authorization event that has no instruction behind it", async () => {
    const { agent, session } = stubAgent();

    await store.appendEvent({
      runId: run.id,
      eventId: AUTH_EVENT_ID,
      type: "acp.fund.authorized",
      eventTime: new Date(AUTHORIZED_AT),
      data: { chain_id: CHAIN_ID, job_id: JOB_ID, amount_usdc: "999.000000" },
    });

    const result = await new AcpSpendExecutor({ agent, log: () => {} }).sweep();

    expect(result).toEqual({ claimed: 0, submitted: 0 });
    expect(session.fund).not.toHaveBeenCalled();
  });

  it("funds an authorized amount exactly, without a float in the path", async () => {
    await authorizeFund(run.id, {
      eventId: AUTH_EVENT_ID,
      amountUsdc: "1.234567",
      authorizedAt: AUTHORIZED_AT,
    });
    const { agent, session } = stubAgent();

    const result = await new AcpSpendExecutor({ agent, log: () => {} }).sweep();

    expect(result).toEqual({ claimed: 1, submitted: 1 });
    expect(session.fund).toHaveBeenCalledTimes(1);
    expect(session.fund.mock.calls[0]?.[0]).toMatchObject({ rawAmount: 1_234_567n });
  });

  it("records the submission as its own claim, separate from the chain's", async () => {
    await authorizeFund(run.id, {
      eventId: AUTH_EVENT_ID,
      amountUsdc: "1.250000",
      authorizedAt: AUTHORIZED_AT,
    });

    await new AcpSpendExecutor({ agent: stubAgent().agent, log: () => {} }).sweep();

    const submitted = (await listEvents(run.id)).find((e) => e.type === "acp.fund.submitted");
    expect(submitted?.data).toMatchObject({
      amount_usdc: "1.250000",
      authorization_event_id: AUTH_EVENT_ID,
    });
    // No transaction hash: the SDK's fund resolves to void, so a tx_hash field
    // would be one that can never be filled.
    expect(submitted?.data).not.toHaveProperty("tx_hash");

    const [intent] = await listIntents();
    expect(intent?.submittedAt).not.toBeNull();
  });

  it("executes an authorization at most once", async () => {
    await authorizeFund(run.id, {
      eventId: AUTH_EVENT_ID,
      amountUsdc: "1.000000",
      authorizedAt: AUTHORIZED_AT,
    });
    const { agent, session } = stubAgent();
    const executor = new AcpSpendExecutor({ agent, log: () => {} });

    await executor.sweep();
    await executor.sweep();
    await executor.sweep();

    expect(session.fund).toHaveBeenCalledTimes(1);
  });

  it("never double-funds when two executors sweep at once", async () => {
    await authorizeFund(run.id, {
      eventId: AUTH_EVENT_ID,
      amountUsdc: "1.000000",
      authorizedAt: AUTHORIZED_AT,
    });
    const { agent, session } = stubAgent();

    await Promise.all([
      new AcpSpendExecutor({ agent, log: () => {} }).sweep(),
      new AcpSpendExecutor({ agent, log: () => {} }).sweep(),
    ]);

    expect(session.fund).toHaveBeenCalledTimes(1);
  });

  it("retries a failure, then records it once and stops", async () => {
    await authorizeFund(run.id, {
      eventId: AUTH_EVENT_ID,
      amountUsdc: "1.000000",
      authorizedAt: AUTHORIZED_AT,
    });
    const { agent, session } = stubAgent(async () => {
      throw new Error("insufficient allowance");
    });
    const executor = new AcpSpendExecutor({ agent, log: () => {} });

    for (let i = 0; i < 5; i += 1) await executor.sweep();

    expect(session.fund).toHaveBeenCalledTimes(3);

    const failures = (await listEvents(run.id)).filter((e) => e.type === "acp.fund.failed");
    expect(failures).toHaveLength(1);
    expect(failures[0]?.data).toMatchObject({ reason: expect.stringContaining("insufficient") });

    const [intent] = await listIntents();
    expect(intent?.submittedAt).toBeNull();
    expect(intent?.attempts).toBe(3);
    expect(intent?.lastError).toContain("insufficient allowance");
  });

  it("fails the authorization when the job has no live session", async () => {
    await authorizeFund(run.id, {
      eventId: AUTH_EVENT_ID,
      amountUsdc: "1.000000",
      authorizedAt: AUTHORIZED_AT,
    });
    const agent = { getSession: () => undefined } as unknown as Pick<AcpAgent, "getSession">;

    const result = await new AcpSpendExecutor({ agent, log: () => {} }).sweep();

    expect(result.submitted).toBe(0);
    const [intent] = await listIntents();
    expect(intent?.lastError).toContain("No active ACP session");
  });
});

import { and, eq, getDb, schema } from "@aura/db";
import type { JobRoomEntry } from "@virtuals-protocol/acp-node-v2";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AcpBridge, type BridgeLogger } from "./bridge.js";
import { translateEntry } from "./translate.js";

const CHAIN_ID = 84_532;
const OTHER_CHAIN_ID = 97;

function systemEntry(
  event: Extract<JobRoomEntry, { kind: "system" }>["event"],
  overrides: Partial<Extract<JobRoomEntry, { kind: "system" }>> = {},
): JobRoomEntry {
  return {
    kind: "system",
    onChainJobId: "42",
    chainId: CHAIN_ID,
    event,
    timestamp: 1_767_225_600_000,
    ...overrides,
  };
}

const created = { type: "job.created", jobId: "42", client: "0xc", provider: "0xp", evaluator: "0xe", expiredAt: "1767312000", hook: "0xh" } as const;
const budgetSet = { type: "budget.set", jobId: "42", amount: 1.25 } as const;
const funded = { type: "job.funded", jobId: "42", client: "0xc", amount: 1.25 } as const;

const db = getDb();

const listMappings = () => db.select().from(schema.acpJobs);
const listRuns = () => db.select().from(schema.runs);
const listEvents = (runId: string) =>
  db.select().from(schema.runEvents).where(eq(schema.runEvents.runId, runId));

function makeBridge(description: string | null = "Generate a meme", log?: BridgeLogger) {
  return new AcpBridge({
    fetchJobDescription: async () => description,
    log: log ?? (() => {}),
  });
}

describe("AcpBridge", () => {
  let bridge: AcpBridge;

  beforeEach(() => {
    bridge = makeBridge();
  });

  it("creates one Run and one mapping on first sight of a job", async () => {
    await bridge.handleEntry(systemEntry(created));

    const runs = await listRuns();
    const mappings = await listMappings();

    expect(runs).toHaveLength(1);
    expect(mappings).toHaveLength(1);
    expect(runs[0]?.source).toBe("AGENT");
    expect(runs[0]?.environment).toBe("base-sepolia");
    expect(runs[0]?.objective).toBe("Generate a meme");
    expect(mappings[0]?.runId).toBe(runs[0]?.id);
  });

  it("reuses the Run for a second entry on the same job", async () => {
    await bridge.handleEntry(systemEntry(created));
    await bridge.handleEntry(systemEntry(budgetSet));

    expect(await listRuns()).toHaveLength(1);
    expect(await listMappings()).toHaveLength(1);

    const runId = (await listRuns())[0]?.id as string;
    const types = (await listEvents(runId)).map((event) => event.type).sort();
    expect(types).toEqual(["acp.budget.set", "acp.job.created", "run.created"]);
  });

  it("maps the same job id on two chains to two Runs", async () => {
    await bridge.handleEntry(systemEntry(created));
    await bridge.handleEntry(systemEntry(created, { chainId: OTHER_CHAIN_ID }));

    expect(await listRuns()).toHaveLength(2);
    expect((await listMappings()).map((row) => row.chainId).sort((a, b) => a - b)).toEqual([
      OTHER_CHAIN_ID,
      CHAIN_ID,
    ]);
  });

  it("falls back to a deterministic objective when the job has no description", async () => {
    await makeBridge(null).handleEntry(systemEntry(created));

    expect((await listRuns())[0]?.objective).toBe("ACP job 42 on base-sepolia");
  });

  it("leaves budget_usdc null when a provider proposes a price", async () => {
    await bridge.handleEntry(systemEntry(budgetSet));

    const run = (await listRuns())[0];
    expect(run?.budgetUsdc).toBeNull();

    const event = (await listEvents(run?.id as string)).find(
      (row) => row.type === "acp.budget.set",
    );
    expect(event?.data).toMatchObject({ amount_usdc: "1.250000" });
  });

  it("appends nothing on a re-observed entry", async () => {
    const entry = systemEntry(funded);

    await bridge.handleEntry(entry);
    const runId = (await listRuns())[0]?.id as string;
    const before = (await listEvents(runId)).length;

    await bridge.handleEntry(entry);
    await bridge.handleEntry(entry);

    expect((await listEvents(runId)).length).toBe(before);
  });

  it("writes exactly one row when the same entry is handled concurrently", async () => {
    const entry = systemEntry(funded);

    await Promise.all([
      bridge.handleEntry(entry),
      bridge.handleEntry(entry),
      bridge.handleEntry(entry),
    ]);

    const runId = (await listRuns())[0]?.id as string;
    const appended = (await listEvents(runId)).filter((row) => row.type === "acp.job.funded");

    expect(appended).toHaveLength(1);
    expect(await listMappings()).toHaveLength(1);
  });

  it("appends entries for one job in arrival order with consecutive sequences", async () => {
    await Promise.all([
      bridge.handleEntry(systemEntry(created)),
      bridge.handleEntry(systemEntry(budgetSet)),
      bridge.handleEntry(systemEntry(funded)),
    ]);

    const runId = (await listRuns())[0]?.id as string;
    const events = (await listEvents(runId)).sort((a, b) => a.sequence - b.sequence);

    expect(events.map((event) => event.sequence)).toEqual([0, 1, 2, 3]);
    expect(events.map((event) => event.type)).toEqual([
      "run.created",
      "acp.job.created",
      "acp.budget.set",
      "acp.job.funded",
    ]);
  });

  it("stores the entry's domain time, not arrival time", async () => {
    await bridge.handleEntry(systemEntry(created));

    const runId = (await listRuns())[0]?.id as string;
    const event = (await listEvents(runId)).find((row) => row.type === "acp.job.created");

    expect(event?.eventTime.getTime()).toBe(1_767_225_600_000);
  });

  it("logs a failed append with the job's identity and keeps taking entries", async () => {
    const log = vi.fn();
    const failing = new AcpBridge({
      fetchJobDescription: async () => {
        throw new Error("acp api unreachable");
      },
      log,
    });

    await expect(failing.handleEntry(systemEntry(created))).resolves.toBeUndefined();

    const [level, msg, fields] = log.mock.calls.at(-1) ?? [];
    expect(level).toBe("error");
    expect(msg).toContain("failed");
    expect(fields).toMatchObject({ chainId: CHAIN_ID, jobId: "42" });
    expect(fields).toHaveProperty("eventId", translateEntry(systemEntry(created)).eventId);

    // The stream keeps flowing: a later entry for the same job still records.
    await makeBridge().handleEntry(systemEntry(budgetSet));
    expect(await listRuns()).toHaveLength(1);
  });

  it("never writes a mapping for a Run it failed to create", async () => {
    const failing = new AcpBridge({
      fetchJobDescription: async () => {
        throw new Error("acp api unreachable");
      },
      log: () => {},
    });

    await failing.handleEntry(systemEntry(created));

    expect(await listRuns()).toHaveLength(0);
    expect(await listMappings()).toHaveLength(0);
  });

  it("keeps a mapping pointing at its Run", async () => {
    await bridge.handleEntry(systemEntry(created));

    const [mapping] = await db
      .select()
      .from(schema.acpJobs)
      .where(and(eq(schema.acpJobs.chainId, CHAIN_ID), eq(schema.acpJobs.jobId, "42")));

    expect(mapping?.runId).toBe((await listRuns())[0]?.id);
  });
});

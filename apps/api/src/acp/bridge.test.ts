import { and, eq, getDb, isNull, schema } from "@aura/db";
import type { JobRoomEntry } from "@virtuals-protocol/acp-node-v2";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { RunStore } from "../services/run-store.js";
import { AcpBridge, type AcpBridgeOptions } from "./bridge.js";
import type { AcpLogger } from "./log.js";
import { translateEntry } from "./events.js";

const CHAIN_ID = 84_532;
const OTHER_CHAIN_ID = 97;
const OBJECTIVE = "ACP job 42 on base-sepolia";

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

const createdEvent = { type: "job.created", jobId: "42", client: "0xc", provider: "0xp", evaluator: "0xe", expiredAt: "1767312000", hook: "0xh" } as const;
const budgetSet = { type: "budget.set", jobId: "42", amount: 1.25 } as const;
const funded = { type: "job.funded", jobId: "42", client: "0xc", amount: 1.25 } as const;

const db = getDb();

const listMappings = () => db.select().from(schema.acpJobs);
const listRuns = () => db.select().from(schema.runs);
const listInbox = () => db.select().from(schema.acpInbox);
const listUnprocessed = () =>
  db.select().from(schema.acpInbox).where(isNull(schema.acpInbox.processedAt));
const listEvents = (runId: string) =>
  db.select().from(schema.runEvents).where(eq(schema.runEvents.runId, runId));

const makeBridge = (options: AcpBridgeOptions = {}) =>
  new AcpBridge({ log: () => {}, ...options });

describe("AcpBridge", () => {
  let bridge: AcpBridge;

  beforeEach(() => {
    bridge = makeBridge();
  });

  describe("capture", () => {
    it("writes the raw entry to the inbox before anything is derived", async () => {
      const entry = systemEntry(createdEvent);

      await bridge.handleEntry(entry);

      const [row] = await listInbox();
      expect(row?.eventId).toBe(translateEntry(entry).eventId);
      expect(row?.chainId).toBe(CHAIN_ID);
      expect(row?.jobId).toBe("42");
      expect(row?.entry).toEqual(entry);
    });

    it("marks a row processed once it reaches run_events", async () => {
      await bridge.handleEntry(systemEntry(createdEvent));

      expect(await listUnprocessed()).toHaveLength(0);
      expect((await listInbox())[0]?.attempts).toBe(0);
    });

    it("captures a duplicate delivery exactly once", async () => {
      const entry = systemEntry(funded);

      await bridge.handleEntry(entry);
      await bridge.handleEntry(entry);
      await bridge.handleEntry(entry);

      expect(await listInbox()).toHaveLength(1);

      const runId = (await listRuns())[0]?.id as string;
      const appended = (await listEvents(runId)).filter((row) => row.type === "acp.job.funded");
      expect(appended).toHaveLength(1);
    });

    it("shouts when capture itself fails, because that is the lossy case", async () => {
      const log = vi.fn();
      const broken = makeBridge({
        log,
        db: { insert: () => { throw new Error("database is down"); } } as unknown as typeof db,
      });

      await expect(broken.handleEntry(systemEntry(createdEvent))).resolves.toBeUndefined();

      const [level, , fields] = log.mock.calls.at(-1) ?? [];
      expect(level).toBe("error");
      expect(fields).toMatchObject({ lost: true, jobId: "42" });
    });
  });

  describe("projection and retry", () => {
    /** A RunStore whose appends fail, standing in for a database outage. */
    const brokenRunStore = () =>
      ({
        createRun: () => Promise.reject(new Error("append unavailable")),
        appendEvent: () => Promise.reject(new Error("append unavailable")),
      }) as unknown as RunStore;

    it("keeps the entry when projection fails, and records why", async () => {
      const failing = makeBridge({ runStore: brokenRunStore() });

      await failing.handleEntry(systemEntry(createdEvent));

      const [row] = await listInbox();
      expect(row?.processedAt).toBeNull();
      expect(row?.attempts).toBe(1);
      expect(row?.lastError).toContain("append unavailable");

      // Nothing half-written: no Run, no mapping.
      expect(await listRuns()).toHaveLength(0);
      expect(await listMappings()).toHaveLength(0);
    });

    it("projects the kept entry on a later sweep", async () => {
      const failing = makeBridge({ runStore: brokenRunStore() });
      await failing.handleEntry(systemEntry(createdEvent));
      expect(await listUnprocessed()).toHaveLength(1);

      const result = await makeBridge().sweep();

      expect(result).toEqual({ attempted: 1, projected: 1 });
      expect(await listUnprocessed()).toHaveLength(0);

      const runId = (await listRuns())[0]?.id as string;
      expect((await listEvents(runId)).map((row) => row.type)).toContain("acp.job.created");
    });

    it("sweeps a backlog in the order it was received", async () => {
      const failing = makeBridge({ runStore: brokenRunStore() });
      for (const event of [createdEvent, budgetSet, funded]) {
        await failing.handleEntry(systemEntry(event));
      }

      await makeBridge().sweep();

      const runId = (await listRuns())[0]?.id as string;
      const events = (await listEvents(runId)).sort((a, b) => a.sequence - b.sequence);
      expect(events.map((event) => event.type)).toEqual([
        "run.created",
        "acp.job.created",
        "acp.budget.set",
        "acp.job.funded",
      ]);
    });

    it("does nothing on a sweep with an empty inbox", async () => {
      await expect(bridge.sweep()).resolves.toEqual({ attempted: 0, projected: 0 });
    });

    it("leaves an already-processed row alone", async () => {
      await bridge.handleEntry(systemEntry(funded));
      const runId = (await listRuns())[0]?.id as string;
      const before = (await listEvents(runId)).length;

      await bridge.sweep();

      expect((await listEvents(runId)).length).toBe(before);
    });
  });

  describe("run identity", () => {
    it("creates one Run and one mapping on first sight of a job", async () => {
      await bridge.handleEntry(systemEntry(createdEvent));

      const runs = await listRuns();
      const mappings = await listMappings();

      expect(runs).toHaveLength(1);
      expect(runs[0]?.source).toBe("AGENT");
      expect(runs[0]?.environment).toBe("base-sepolia");
      expect(mappings).toHaveLength(1);
      expect(mappings[0]?.runId).toBe(runs[0]?.id);
    });

    it("seeds the objective from the entry alone, with no fetch on the write path", async () => {
      const fetchJobDescription = vi.fn(async () => "Generate a meme");

      await makeBridge({ fetchJobDescription }).handleEntry(systemEntry(createdEvent));

      const run = (await listRuns())[0];
      expect(run?.objective).toBe(OBJECTIVE);
      expect(run?.objective).not.toBe("Generate a meme");
    });

    it("reuses the Run for a second entry on the same job", async () => {
      await bridge.handleEntry(systemEntry(createdEvent));
      await bridge.handleEntry(systemEntry(budgetSet));

      expect(await listRuns()).toHaveLength(1);
      expect(await listMappings()).toHaveLength(1);
    });

    it("maps the same job id on two chains to two Runs", async () => {
      await bridge.handleEntry(systemEntry(createdEvent));
      await bridge.handleEntry(systemEntry(createdEvent, { chainId: OTHER_CHAIN_ID }));

      expect(await listRuns()).toHaveLength(2);
      expect((await listMappings()).map((row) => row.chainId).sort((a, b) => a - b)).toEqual([
        OTHER_CHAIN_ID,
        CHAIN_ID,
      ]);
    });

    it("keeps a mapping pointing at its Run", async () => {
      await bridge.handleEntry(systemEntry(createdEvent));

      const [mapping] = await db
        .select()
        .from(schema.acpJobs)
        .where(and(eq(schema.acpJobs.chainId, CHAIN_ID), eq(schema.acpJobs.jobId, "42")));

      expect(mapping?.runId).toBe((await listRuns())[0]?.id);
    });
  });

  describe("description enrichment", () => {
    it("records the description as its own event", async () => {
      await makeBridge({ fetchJobDescription: async () => "Generate a meme" }).handleEntry(
        systemEntry(createdEvent),
      );

      const runId = (await listRuns())[0]?.id as string;
      const described = (await listEvents(runId)).find((row) => row.type === "acp.job.described");

      expect(described?.data).toMatchObject({ description: "Generate a meme" });
      expect(described?.eventTime.getTime()).toBe(1_767_225_600_000);
    });

    it("asks the host once per job, not once per entry", async () => {
      const fetchJobDescription = vi.fn(async () => "Generate a meme");
      const enriching = makeBridge({ fetchJobDescription });

      await enriching.handleEntry(systemEntry(createdEvent));
      await enriching.handleEntry(systemEntry(budgetSet));
      await enriching.handleEntry(systemEntry(funded));

      expect(fetchJobDescription).toHaveBeenCalledTimes(1);
    });

    it("records the entry anyway when the fetch fails", async () => {
      const log: AcpLogger = () => {};
      const enriching = makeBridge({
        log,
        fetchJobDescription: async () => {
          throw new Error("acp api unreachable");
        },
      });

      await enriching.handleEntry(systemEntry(createdEvent));

      const runs = await listRuns();
      expect(runs).toHaveLength(1);
      expect(runs[0]?.objective).toBe(OBJECTIVE);

      const events = await listEvents(runs[0]?.id as string);
      expect(events.map((row) => row.type)).toContain("acp.job.created");
      expect(events.map((row) => row.type)).not.toContain("acp.job.described");
      expect(await listUnprocessed()).toHaveLength(0);
    });

    it("adds no event when the host has no description", async () => {
      await makeBridge({ fetchJobDescription: async () => null }).handleEntry(
        systemEntry(createdEvent),
      );

      const runId = (await listRuns())[0]?.id as string;
      expect((await listEvents(runId)).map((row) => row.type)).not.toContain("acp.job.described");
    });
  });

  describe("event recording", () => {
    it("leaves budget_usdc null when a provider proposes a price", async () => {
      await bridge.handleEntry(systemEntry(budgetSet));

      const run = (await listRuns())[0];
      expect(run?.budgetUsdc).toBeNull();

      const event = (await listEvents(run?.id as string)).find(
        (row) => row.type === "acp.budget.set",
      );
      expect(event?.data).toMatchObject({ amount_usdc: "1.250000" });
    });

    it("stores the entry's domain time, not arrival time", async () => {
      await bridge.handleEntry(systemEntry(createdEvent));

      const runId = (await listRuns())[0]?.id as string;
      const event = (await listEvents(runId)).find((row) => row.type === "acp.job.created");

      expect(event?.eventTime.getTime()).toBe(1_767_225_600_000);
    });

    it("appends sequentially delivered entries in arrival order", async () => {
      // How the stream actually delivers: one entry at a time.
      for (const event of [createdEvent, budgetSet, funded]) {
        await bridge.handleEntry(systemEntry(event));
      }

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

    it("lands every concurrently dispatched entry once, with distinct sequences", async () => {
      // Capture runs before the per-job queue so a hung projection cannot block
      // it, which means a racing dispatch can reach the queue out of order.
      // What still holds: each entry lands exactly once, with its own sequence.
      await Promise.all([
        bridge.handleEntry(systemEntry(createdEvent)),
        bridge.handleEntry(systemEntry(budgetSet)),
        bridge.handleEntry(systemEntry(funded)),
      ]);

      const runId = (await listRuns())[0]?.id as string;
      const events = (await listEvents(runId)).sort((a, b) => a.sequence - b.sequence);

      expect(events.map((event) => event.sequence)).toEqual([0, 1, 2, 3]);
      expect(events.map((event) => event.type).sort()).toEqual([
        "acp.budget.set",
        "acp.job.created",
        "acp.job.funded",
        "run.created",
      ]);
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
  });
});

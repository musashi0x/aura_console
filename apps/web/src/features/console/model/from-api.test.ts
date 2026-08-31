import { describe, expect, it } from "vitest";

import type { RunEvent, RunSummary } from "@/lib/api-client";

import { eventsFromApi, seedFromRun } from "./from-api";
import { foldRun } from "../projection/fold-run";

const run: RunSummary = {
  id: "run-1",
  objective: "Buy one dataset under budget",
  source: "CONSOLE",
  environment: "non-mainnet",
  isMainnet: false,
  budgetUsdc: "25.000000",
  createdAt: "2026-08-29T10:00:00.000Z",
  updatedAt: "2026-08-29T10:00:00.000Z",
};

const event = (over: Partial<RunEvent> = {}): RunEvent => ({
  eventId: "evt-1",
  runId: "run-1",
  sequence: 0,
  type: "run.created",
  eventTime: "2026-08-29T10:00:00.000Z",
  data: {},
  ...over,
});

describe("the API seed", () => {
  it("carries the Run's own identity and its declared ceiling", () => {
    expect(seedFromRun(run)).toEqual({
      runId: "run-1",
      objective: "Buy one dataset under budget",
      source: "CONSOLE",
      environment: "non-mainnet",
      budgetUsdc: "25.000000",
    });
  });

  it("keeps the origin the API reported", () => {
    // Who or what started the work is a fact about the Run. An agent is not the
    // Console, and a FIXTURE is neither: collapsing them would hide that an
    // example Run is example data in the one field that names its origin.
    // AGENT is not "the API": the API is the transport that carried the Run,
    // not the actor that opened it.
    expect(seedFromRun({ ...run, source: "AGENT" }).source).toBe("AGENT");
    expect(seedFromRun({ ...run, source: "FIXTURE" }).source).toBe("FIXTURE");
    expect(seedFromRun({ ...run, source: "CONSOLE" }).source).toBe("CONSOLE");
  });

  it("derives no status, spend or completion during transport", () => {
    const seed: Record<string, unknown> = { ...seedFromRun(run) };
    expect(seed).not.toHaveProperty("status");
    expect(seed).not.toHaveProperty("spentUsdc");
  });
});

describe("the API events", () => {
  it("feed the fold without losing an event", () => {
    const events = eventsFromApi([event(), event({ eventId: "evt-2", sequence: 1 })]);
    expect(events).toHaveLength(2);
    expect(foldRun(events, seedFromRun(run), null).lastSequence).toBe(1);
  });

  it("keeps the canonical key on every entry", () => {
    const [first] = eventsFromApi([event({ eventId: "evt-9", sequence: 4 })]);
    expect(first).toMatchObject({ event_id: "evt-9", sequence: 4, run_id: "run-1" });
  });

  it("survives an event whose payload is absent", () => {
    // A missing payload is a real answer from a producer that had nothing to
    // add. It must not throw and must not become a fabricated empty result.
    const [first] = eventsFromApi([{ ...event(), data: undefined as unknown as null }]);
    expect(first?.data).toEqual({});
  });

  it("hands the fold an unrecognised type rather than dropping it", () => {
    const events = eventsFromApi([event(), event({ eventId: "evt-x", sequence: 1, type: "some.future.type" })]);
    const view = foldRun(events, seedFromRun(run), null);
    expect(view.entries.map((entry) => entry.type)).toContain("some.future.type");
    // And it is MARKED rather than silently accepted as understood.
    const unknown = view.entries.find((entry) => entry.type === "some.future.type");
    expect(unknown?.support).toBe("UNSUPPORTED_TYPE");
  });
});

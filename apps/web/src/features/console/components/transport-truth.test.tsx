import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { RunEvent } from "@/lib/api-client";

import { RunTimeline } from "./run-timeline";
import { eventsFromApi, seedFromRun } from "../model/from-api";
import type { RunSummary } from "@/lib/api-client";

const run = (over: Partial<RunSummary> = {}): RunSummary => ({
  id: "run-1",
  objective: "Buy one market dataset",
  source: "CONSOLE",
  environment: "non-mainnet",
  isMainnet: false,
  budgetUsdc: "25.000000",
  createdAt: "2026-08-29T09:00:00.000Z",
  updatedAt: "2026-08-29T09:00:00.000Z",
  ...over,
});

const ev = (sequence: number, type: string): RunEvent => ({
  eventId: `evt-${sequence}`,
  runId: "run-1",
  sequence,
  type,
  eventTime: "2026-08-29T09:00:00.000Z",
  data: { summary: type },
});

const mount = (types: string[], over: Partial<RunSummary> = {}, fixture?: string) =>
  render(
    <RunTimeline
      events={eventsFromApi(types.map((type, i) => ev(i, type)))}
      seed={seedFromRun(run(over))}
      fixtureLabel={fixture}
    />,
  );

/**
 * A Run that has ended has no moving edge to follow. Only COMPLETED was treated
 * as terminal, so a failed or cancelled Run still claimed to be following one.
 */
describe("terminal Runs open ENDED", () => {
  it.each([
    ["run.completed", "COMPLETED"],
    ["run.failed", "FAILED"],
    ["run.cancelled", "CANCELLED"],
  ])("%s is terminal", (type) => {
    mount(["run.created", "run.started", type]);
    expect(screen.getByText("ENDED")).toBeInTheDocument();
    expect(screen.queryByText("LIVE")).not.toBeInTheDocument();
  });
});

/**
 * Without a stream there is no live edge to follow. Calling a single read
 * "LIVE" claims a subscription the Console does not have.
 */
describe("an unfinished Run is a snapshot, not a live feed", () => {
  it("says LATEST SNAPSHOT rather than LIVE", () => {
    mount(["run.created", "run.started"]);
    expect(screen.getByText("LATEST SNAPSHOT")).toBeInTheDocument();
    expect(screen.queryByText("LIVE")).not.toBeInTheDocument();
  });

  it("offers no Jump to live, because there is no live to jump to", () => {
    mount(["run.created", "run.started"]);
    expect(screen.queryByRole("button", { name: /jump to live/i })).not.toBeInTheDocument();
  });
});

/**
 * Playback that cannot advance must not offer itself. PLAYING with no
 * progression is a control that lies about what pressing it does.
 */
describe("playback is offered only when it can advance", () => {
  it("disables Play on an ended Run", () => {
    mount(["run.created", "run.completed"]);
    expect(screen.getByRole("button", { name: "Play" })).toBeDisabled();
  });

  it("disables Pause on an ended Run", () => {
    mount(["run.created", "run.completed"]);
    expect(screen.getByRole("button", { name: "Pause" })).toBeDisabled();
  });

  it("disables playback on a fixture", () => {
    mount(["run.created", "run.completed"], {}, "Example data.");
    expect(screen.getByRole("button", { name: "Play" })).toBeDisabled();
  });
});

/**
 * The footer counts events. `lastSequence` is the highest sequence NUMBER, and
 * sequences are zero-based, so it read one short of the truth on every Run.
 */
describe("the footer counts events, not sequence numbers", () => {
  it("counts a zero-based run correctly", () => {
    mount(["run.created", "run.started", "run.completed"]);
    expect(screen.getByText(/Showing 3 of 3 events/)).toBeInTheDocument();
  });

  it("counts a single-event run as one, not zero", () => {
    // lastSequence is 0 here, which rendered as "0 events" for a Run that
    // plainly has one.
    mount(["run.created"]);
    expect(screen.getByText(/Showing 1 of 1 event/)).toBeInTheDocument();
  });
});

/** Who started the work is a fact, and AGENT is not the API. */
describe("origin survives transport", () => {
  it("keeps AGENT as AGENT", () => {
    mount(["run.created"], { source: "AGENT" });
    expect(screen.getByText("AGENT")).toBeInTheDocument();
    expect(screen.queryByText("API")).not.toBeInTheDocument();
  });
});

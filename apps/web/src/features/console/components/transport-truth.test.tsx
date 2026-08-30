import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

/**
 * Playback is not implemented.
 *
 * Scrubbing works, and holding the playhead at an earlier event works. Nothing
 * advances it: there is no timer and no stream. `Play` therefore changed a
 * badge to PLAYING while the timeline sat still, and it took `Back to latest`
 * away on the way. A control that reports motion and delivers none is worse
 * than no control, so the two are removed until progression exists.
 */
describe("playback is not offered while it does not exist", () => {
  it("exposes no Play control on a Run still in progress", () => {
    mount(["run.created", "run.started"]);
    expect(screen.queryByRole("button", { name: /^play$/i })).not.toBeInTheDocument();
  });

  it("exposes no Pause control on a Run still in progress", () => {
    mount(["run.created", "run.started"]);
    expect(screen.queryByRole("button", { name: /^pause$/i })).not.toBeInTheDocument();
  });

  it("exposes no Play or Pause on an ended Run either", () => {
    mount(["run.created", "run.completed"]);
    expect(screen.queryByRole("button", { name: /^play$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^pause$/i })).not.toBeInTheDocument();
  });

  it("never claims playback is active", () => {
    const { container } = mount(["run.created", "run.started"]);
    expect(container.textContent).not.toMatch(/PLAYING|PAUSED/);
  });
});

/** What survives: scrubbing, the history label, and the way back. */
describe("scrubbing still works without playback", () => {
  it("enters HISTORY when an earlier event is selected", async () => {
    const user = userEvent.setup();
    mount(["run.created", "run.started", "decision.made"]);
    await user.click(screen.getAllByRole("button", { name: /show the run as of/i })[0]!);
    expect(screen.getByText(/HISTORY/)).toBeInTheDocument();
  });

  it("carries the timestamp, so history cannot read as current", async () => {
    const user = userEvent.setup();
    mount(["run.created", "run.started", "decision.made"]);
    await user.click(screen.getAllByRole("button", { name: /show the run as of/i })[0]!);
    expect(screen.getByText(/HISTORY · 2026-08-29/)).toBeInTheDocument();
  });

  it("returns to the latest snapshot", async () => {
    const user = userEvent.setup();
    mount(["run.created", "run.started", "decision.made"]);
    await user.click(screen.getAllByRole("button", { name: /show the run as of/i })[0]!);
    await user.click(screen.getByRole("button", { name: /back to latest/i }));
    expect(screen.getByText("LATEST SNAPSHOT")).toBeInTheDocument();
    expect(screen.queryByText(/HISTORY/)).not.toBeInTheDocument();
  });
});

/**
 * Scrubbing must always be reversible.
 *
 * The return control was removed on an ended Run, reasoning that there is no
 * live edge to go back to. There is not — but there IS an end, and without the
 * control a reader who scrubbed into HISTORY had no way out short of reloading.
 * A one-way door is worse than a slightly redundant button.
 */
describe("history is always escapable", () => {
  it("offers a way out of HISTORY on an ended Run", async () => {
    const user = userEvent.setup();
    mount(["run.created", "run.started", "run.completed"]);
    await user.click(screen.getAllByRole("button", { name: /show the run as of/i })[0]!);
    expect(screen.getByText(/HISTORY/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /back to the end/i }));
    expect(screen.getByText("ENDED")).toBeInTheDocument();
    expect(screen.queryByText(/HISTORY/)).not.toBeInTheDocument();
  });

  it("names the destination for what it is on an ended Run", () => {
    mount(["run.created", "run.completed"]);
    // Not "latest": a finished Run has an end, not a moving edge.
    expect(screen.getByRole("button", { name: /back to the end/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /back to latest/i })).not.toBeInTheDocument();
  });
});

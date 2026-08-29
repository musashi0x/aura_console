import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { expectNoAxeViolations } from "@/test/axe";

import type { CanonicalEvent } from "../model/types";
import type { FoldSeed } from "../projection/fold-run";
import { RunTimeline } from "./run-timeline";

const seed: FoldSeed = {
  runId: "run_42",
  objective: "Research three competitors",
  source: "CONSOLE",
  environment: "base-sepolia-demo",
  budgetUsdc: "1.00",
};

const ev = (sequence: number, type: string, summary: string): CanonicalEvent => ({
  event_id: `evt_${sequence}`,
  run_id: "run_42",
  sequence,
  type,
  event_time: `2026-08-29T10:00:0${sequence}Z`,
  data: { summary },
});

const events = [
  ev(1, "run.created", "Run created"),
  ev(2, "provider.discovered", "Evidence collected"),
  ev(3, "decision.context.built", "Decision context frozen"),
  ev(4, "acp.job.funded", "Economic action boundary"),
  ev(5, "outcome.normalized", "Outcome recorded"),
];

const timeline = (extra?: Partial<React.ComponentProps<typeof RunTimeline>>) =>
  render(<RunTimeline events={events} seed={seed} {...extra} />);

describe("live and history", () => {
  it("starts live and shows every event", () => {
    timeline();
    expect(screen.getByText("LIVE")).toBeInTheDocument();
    expect(screen.getByText("Outcome recorded")).toBeInTheDocument();
  });

  it("scrubbing shows history and hides later facts", async () => {
    const user = userEvent.setup();
    timeline();
    await user.click(screen.getByRole("button", { name: /show the run as of evidence collected/i }));

    // History must be labelled, never left looking like live state.
    expect(screen.getByText(/HISTORY/)).toBeInTheDocument();
    expect(screen.queryByText("Outcome recorded")).not.toBeInTheDocument();
    expect(screen.getByText("Evidence collected")).toBeInTheDocument();
  });

  it("returns to live and catches up", async () => {
    const user = userEvent.setup();
    timeline();
    await user.click(screen.getByRole("button", { name: /show the run as of evidence collected/i }));
    await user.click(screen.getByRole("button", { name: /jump to live/i }));
    expect(screen.getByText("LIVE")).toBeInTheDocument();
    expect(screen.getByText("Outcome recorded")).toBeInTheDocument();
  });

  it("disables jump to live while already live", () => {
    timeline();
    expect(screen.getByRole("button", { name: /jump to live/i })).toBeDisabled();
  });
});

describe("honest facts", () => {
  it("says spend is not yet reported rather than showing zero", () => {
    timeline();
    expect(screen.getByText("Not yet reported")).toBeInTheDocument();
    expect(screen.queryByText("0.00")).not.toBeInTheDocument();
  });

  it("labels fixture-backed content when told to", () => {
    timeline({ fixtureLabel: "Fixture data. Not a real Run." });
    expect(screen.getByText("Fixture data. Not a real Run.")).toBeInTheDocument();
  });

  it("shows the memory retrieval status explicitly", () => {
    timeline();
    expect(screen.getByText("NOT_REQUESTED")).toBeInTheDocument();
  });
});

describe("accessibility", () => {
  it("has no axe violations", async () => {
    const { container } = timeline();
    await expectNoAxeViolations(container);
  });

  it("labels the transport group and its controls", () => {
    timeline();
    const group = screen.getByRole("group", { name: /timeline transport/i });
    expect(group).toBeInTheDocument();
    for (const name of [/pause/i, /play/i, /jump to live/i]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
  });
});

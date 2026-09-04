import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { expectNoAxeViolations } from "@/test/axe";

import { console_ } from "../copy";
import { __resetMemoryView, setMemoryViewEnabled } from "../memory-view-state";
import type { CanonicalEvent } from "../model/types";
import { foldRun, type FoldSeed } from "../projection/fold-run";
import { buildSpine } from "../projection/spine";
import { RunSpine } from "./run-spine";
import { RunTimeline } from "./run-timeline";

const seed: FoldSeed = {
  runId: "run_9",
  objective: "Buy one dataset",
  source: "CONSOLE",
  environment: "base-sepolia-demo",
  budgetUsdc: "5.00",
};

const ev = (sequence: number, type: string, data?: Record<string, unknown>): CanonicalEvent => ({
  event_id: `evt_${sequence}`,
  run_id: "run_9",
  sequence,
  type,
  event_time: `2026-09-01T09:00:${String(sequence).padStart(2, "0")}Z`,
  data,
});

const events = [
  ev(1, "run.created"),
  ev(2, "provider.discovered", { summary: "Three providers" }),
  ev(3, "memory.retrieved", { summary: "Prior dealings found" }),
  ev(4, "decision.made", { summary: "Chose provider B" }),
];

const spineFor = (hideMemory = false) =>
  buildSpine(foldRun(events, seed, null).entries, { hideMemory });

const renderSpine = (hideMemory = false) =>
  render(
    <RunSpine spine={spineFor(hideMemory)} envelope={null} memoryOn={!hideMemory} />,
  );

beforeEach(() => {
  __resetMemoryView();
});

describe("causal spine", () => {
  it("cards only the stages the Run reached, in canonical order", () => {
    renderSpine();
    const headings = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
    expect(headings).toEqual([
      console_.spine.stages.EVIDENCE.label,
      console_.spine.stages.DECISION.label,
    ]);
  });

  it("keeps the whole spine legible in the rail without carding what has not happened", () => {
    renderSpine();
    const rail = screen.getByRole("list", { name: console_.spine.rail.label });
    // All five stages are still accounted for, so a reader can see where the
    // Run stopped rather than inferring it from an absence.
    expect(within(rail).getAllByRole("listitem")).toHaveLength(5);
    expect(
      within(rail).getByText(
        console_.spine.rail.reached(console_.spine.stages.EVIDENCE.label),
      ),
    ).toBeInTheDocument();
    expect(
      within(rail).getByText(
        console_.spine.rail.notReached(console_.spine.stages.OUTCOME.label),
      ),
    ).toBeInTheDocument();
  });

  it("gives every reached stage the time it was reached", () => {
    renderSpine();
    const evidence = screen.getByRole("heading", { name: console_.spine.stages.EVIDENCE.label })
      .closest("li")!;
    const time = evidence.querySelector("time")!;
    // The machine-readable attribute keeps the full instant even though the
    // visible text is split so a narrow column can break it cleanly.
    expect(time).toHaveAttribute("dateTime", "2026-09-01T09:00:02Z");
    expect(within(evidence).getByText("2026-09-01")).toBeInTheDocument();
    expect(within(evidence).getByText("09:00:02Z")).toBeInTheDocument();
  });

  it("gives an unreached stage no card at all", () => {
    renderSpine();
    // A stage that has not happened has nothing to report: no heading, and no
    // timestamp that would place it in the Run. It exists in the rail only.
    expect(
      screen.queryByRole("heading", { name: console_.spine.stages.OUTCOME.label }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", {
        name: console_.spine.inspect(console_.spine.stages.OUTCOME.label),
      }),
    ).toBeNull();
  });

  it("marks rail state in text, not only with the marker", () => {
    renderSpine();
    const rail = screen.getByRole("list", { name: console_.spine.rail.label });
    const steps = within(rail).getAllByRole("listitem");
    expect(steps[0]).toHaveAttribute("data-state", "REACHED");
    expect(steps[3]).toHaveAttribute("data-state", "NOT_REACHED");
    // The marker is decorative; the state has to survive without it.
    expect(steps[3]!.textContent).toContain(
      console_.spine.rail.notReached(console_.spine.stages.OUTCOME.label),
    );
  });

  it("keeps lifecycle events visible instead of dropping them", () => {
    renderSpine();
    expect(screen.getByText("run.created")).toBeInTheDocument();
  });

  it("renders as an ordered list, which is what a reader without JavaScript gets", () => {
    const { container } = renderSpine();
    const list = container.querySelector("ol.cs__spine-list")!;
    expect(list.tagName).toBe("OL");
    expect(list.querySelectorAll("li")).toHaveLength(2);
    expect(container.querySelector("ol.cs__spine-rail")!.tagName).toBe("OL");
  });
});

describe("evidence drawer", () => {
  it("opens on a node and shows where each fact came from", () => {
    renderSpine();
    fireEvent.click(
      screen.getByRole("button", { name: console_.spine.inspect(console_.spine.stages.EVIDENCE.label) }),
    );
    const drawer = screen.getByRole("dialog");
    expect(within(drawer).getByText("Three providers")).toBeInTheDocument();
    expect(within(drawer).getByText("provider.discovered")).toBeInTheDocument();
    expect(within(drawer).getByText("2026-09-01T09:00:02Z")).toBeInTheDocument();
  });

  it("overlays rather than sitting in the layout beside the timeline", () => {
    const { container } = renderSpine();
    fireEvent.click(
      screen.getByRole("button", { name: console_.spine.inspect(console_.spine.stages.EVIDENCE.label) }),
    );
    // The scrim is what the stylesheet keys its fixed positioning off. As a
    // layout sibling the drawer shrank the canvas it was explaining.
    expect(container.querySelector(".cs__drawer-scrim")).not.toBeNull();
  });

  it("closes on Escape", () => {
    renderSpine();
    fireEvent.click(
      screen.getByRole("button", { name: console_.spine.inspect(console_.spine.stages.EVIDENCE.label) }),
    );
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("admits when no decision context has been built", () => {
    renderSpine();
    fireEvent.click(
      screen.getByRole("button", { name: console_.spine.inspect(console_.spine.stages.DECISION.label) }),
    );
    expect(screen.getByText(console_.drawer.noEnvelope)).toBeInTheDocument();
  });

  it("has no axe violations while open", async () => {
    const { container } = renderSpine();
    fireEvent.click(
      screen.getByRole("button", { name: console_.spine.inspect(console_.spine.stages.EVIDENCE.label) }),
    );
    await expectNoAxeViolations(container);
  });
});

describe("Memory Off view", () => {
  it("says it is a view and that nothing was re-run", () => {
    renderSpine(true);
    expect(screen.getByText(console_.memoryView.banner)).toBeInTheDocument();
  });

  it("counts what it hid rather than dropping it silently", () => {
    renderSpine(true);
    expect(screen.getByText(console_.spine.hidden(1))).toBeInTheDocument();
  });

  it("reaches the timeline from the palette's own store", () => {
    setMemoryViewEnabled(false);
    render(<RunTimeline events={events} seed={seed} />);
    expect(screen.getByText(console_.memoryView.banner)).toBeInTheDocument();
  });

  it("leaves the full event list intact underneath", () => {
    setMemoryViewEnabled(false);
    const { container } = render(<RunTimeline events={events} seed={seed} />);
    // Hiding evidence from the spine must not edit the record below it.
    expect(container.querySelectorAll(".run__event")).toHaveLength(4);
  });
});

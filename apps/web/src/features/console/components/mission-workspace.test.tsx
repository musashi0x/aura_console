import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { expectNoAxeViolations } from "@/test-support/axe";

import type { CanonicalEvent } from "../model/types";
import type { FoldSeed } from "../projection/fold-run";
import { console_ } from "../copy";
import { MissionWorkspace } from "./mission-workspace";

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

const workspace = (extra?: Partial<React.ComponentProps<typeof MissionWorkspace>>) =>
  render(<MissionWorkspace events={events} seed={seed} {...extra} />);

describe("live and history", () => {
  it("opens on the newest state it knows, without claiming to be live", () => {
    // There is no stream, so a single read is the latest SNAPSHOT rather than a
    // subscription. "LIVE" promised an update that would never arrive.
    workspace();
    expect(screen.getByText("LATEST SNAPSHOT")).toBeInTheDocument();
    expect(screen.queryByText("LIVE")).not.toBeInTheDocument();
    expect(screen.getByText("Outcome recorded")).toBeInTheDocument();
  });

  it("scrubbing shows history and hides later facts", async () => {
    const user = userEvent.setup();
    workspace();
    await user.click(screen.getByRole("button", { name: /show the mission as of evidence collected/i }));

    // History must be labelled, never left looking like live state.
    expect(screen.getByText(/HISTORY/)).toBeInTheDocument();
    expect(screen.queryByText("Outcome recorded")).not.toBeInTheDocument();
    expect(screen.getByText("Evidence collected")).toBeInTheDocument();
  });

  it("returns to the latest snapshot and catches up", async () => {
    const user = userEvent.setup();
    workspace();
    await user.click(screen.getByRole("button", { name: /show the mission as of evidence collected/i }));
    await user.click(screen.getByRole("button", { name: /back to latest/i }));
    expect(screen.getByText("LATEST SNAPSHOT")).toBeInTheDocument();
    expect(screen.getByText("Outcome recorded")).toBeInTheDocument();
  });

  it("disables the return control when already at the latest", () => {
    workspace();
    expect(screen.getByRole("button", { name: /back to latest/i })).toBeDisabled();
  });
});

describe("honest facts", () => {
  it("says spend is not yet reported rather than showing zero", () => {
    workspace();
    expect(screen.getByText("Not yet reported")).toBeInTheDocument();
    expect(screen.queryByText("0.00")).not.toBeInTheDocument();
  });

  it("labels fixture-backed content when told to", () => {
    workspace({ fixtureLabel: "Fixture data. Not a real Run." });
    expect(screen.getByText("Fixture data. Not a real Run.")).toBeInTheDocument();
  });

  it("reads memory as causal information, not as an enum name", () => {
    workspace();
    // `Memory: NOT_REQUESTED` is correct and unreadable. The five
    // RetrievalStatus values are unchanged; only the wording is.
    expect(screen.getByText(console_.mission.memory.NOT_REQUESTED)).toBeInTheDocument();
    expect(screen.queryByText("NOT_REQUESTED")).not.toBeInTheDocument();
  });

  it("will not claim memory changed a decision without a counterfactual", () => {
    const { container } = workspace();
    // The most persuasive line in the product is also the easiest to fake. It
    // may only render when the counterfactual actually differs, and the
    // counterfactual is not built.
    expect(container.textContent).not.toMatch(/memory changed this decision/i);
    expect(container.textContent).not.toMatch(/recommendation unchanged/i);
  });
});

describe("mission inspector integration", () => {
  it("renders technical parameters in MissionInspector", () => {
    workspace();
    expect(screen.getByText("Mission Technical Parameters")).toBeInTheDocument();
    expect(screen.getByTestId("meta-run-id")).toHaveTextContent("run_42");
    expect(screen.getByTestId("meta-environment")).toHaveTextContent("base-sepolia-demo");
    expect(screen.getByTestId("meta-budget")).toHaveTextContent("1.00 USDC");
    expect(screen.getByTestId("meta-spent")).toHaveTextContent("Not yet reported");
    expect(screen.getByTestId("meta-memory")).toHaveTextContent(
      console_.mission.memory.NOT_REQUESTED,
    );
  });

  it("extracts and displays transaction links from event stream", () => {
    const eventsWithTx = [
      ...events,
      {
        event_id: "evt_6",
        run_id: "run_42",
        sequence: 6,
        type: "base.sepolia.tx.confirmed",
        event_time: "2026-08-29T10:00:06Z",
        data: {
          tx_hash: "0x8f3c7a6e129b014d3c9071fe25a6b8c9d01234567890abcdef1234567890abcd",
        },
      },
    ];
    render(<MissionWorkspace events={eventsWithTx} seed={seed} />);
    const link = screen.getByTestId("meta-tx-link");
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute(
      "href",
      "https://sepolia.basescan.org/tx/0x8f3c7a6e129b014d3c9071fe25a6b8c9d01234567890abcdef1234567890abcd",
    );
  });
});

describe("accessibility", () => {
  it("has no axe violations", async () => {
    const { container } = workspace();
    await expectNoAxeViolations(container);
  });

  it("labels the transport group and its controls", () => {
    workspace();
    const group = screen.getByRole("group", { name: /timeline transport/i });
    expect(group).toBeInTheDocument();
    // Back to latest is the only transport control, because it is the only one
    // that does what its label says.
    expect(screen.getByRole("button", { name: /back to latest/i })).toBeInTheDocument();
    for (const name of [/^play$/i, /^pause$/i]) {
      expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
    }
  });
});

describe("three modes over one event stream", () => {
  const openMode = async (mode: "OPERATOR" | "BOARD" | "TRACE") => {
    const user = userEvent.setup();
    await user.click(screen.getByRole("radio", { name: console_.mission.modes[mode] }));
  };

  it("opens on Operator, the mode everyone reads", () => {
    workspace();
    expect(screen.getByRole("radio", { name: console_.mission.modes.OPERATOR })).toBeChecked();
    expect(
      screen.getByRole("region", { name: console_.mission.operator.label }),
    ).toBeInTheDocument();
  });

  it("keeps the ten-stage spine out of Operator and in Trace", async () => {
    workspace();
    // The stages are system ontology. They are not deleted and not renamed;
    // they stop being the first thing an operator has to learn.
    expect(screen.queryByText(console_.spine.title)).toBeNull();
    await openMode("TRACE");
    expect(screen.getByText(console_.spine.title)).toBeInTheDocument();
  });

  it("shows the same events in every mode rather than re-reading them", async () => {
    workspace();
    expect(screen.getByText("Outcome recorded")).toBeInTheDocument();
    await openMode("TRACE");
    expect(screen.getByText("Outcome recorded")).toBeInTheDocument();
  });

  it("reports the real transport in Trace, never a stream it does not have", async () => {
    workspace();
    await openMode("TRACE");
    expect(screen.getAllByText("LATEST SNAPSHOT").length).toBeGreaterThan(0);
    expect(screen.queryByText(/live events connected/i)).toBeNull();
  });

  it("groups the same steps on the Board without inventing a task", async () => {
    workspace();
    await openMode("BOARD");
    const board = screen.getByRole("region", { name: console_.mission.board.label });
    // Four columns, and every card is one of the six steps. Board never gains
    // a card an event did not create.
    for (const column of ["QUEUED", "RUNNING", "NEEDS_YOU", "DONE"] as const) {
      expect(
        within(board).getByRole("region", { name: console_.mission.board.columns[column] }),
      ).toBeInTheDocument();
    }
    const labels = Object.values(console_.mission.rail.steps);
    const cards = within(board).getAllByRole("listitem");
    for (const card of cards) {
      expect(labels.some((label) => card.textContent?.includes(label))).toBe(true);
    }
  });

  it("has no axe violations in Board or Trace", async () => {
    const { container } = workspace();
    await openMode("BOARD");
    await expectNoAxeViolations(container);
    await openMode("TRACE");
    await expectNoAxeViolations(container);
  });
});

describe("progress rail", () => {
  it("carries all six steps and states each one in text", () => {
    workspace();
    const rail = screen.getByRole("list", { name: console_.mission.rail.label });
    expect(within(rail).getAllByRole("listitem")).toHaveLength(6);
    // Reached and not reached both stated, so neither depends on the marker.
    expect(
      within(rail).getByText(
        console_.mission.rail.reached(console_.mission.rail.steps.UNDERSTAND),
      ),
    ).toBeInTheDocument();
    expect(
      within(rail).getByText(
        console_.mission.rail.notReached(console_.mission.rail.steps.LEARN),
      ),
    ).toBeInTheDocument();
  });

  it("renders no card for a step in the future, only a rail marker", () => {
    const { container } = workspace();
    // The rail states "not reached" in text on purpose, so the marker is not
    // the only carrier. What is gone is the old rendering: a full card per
    // unreached stage, which spent a fresh Mission's viewport reporting that
    // nothing had happened.
    expect(
      screen.queryByRole("heading", { name: console_.mission.rail.steps.LEARN }),
    ).toBeNull();
    const visible = [...container.querySelectorAll("*")].filter(
      (el) => el.children.length === 0 && !el.closest(".visually-hidden"),
    );
    expect(visible.some((el) => /not reached/i.test(el.textContent ?? ""))).toBe(false);
  });

  it("offers no way to click a step nothing has happened in", () => {
    workspace();
    const rail = screen.getByRole("list", { name: console_.mission.rail.label });
    expect(
      within(rail).queryByRole("button", {
        name: console_.mission.rail.jump(console_.mission.rail.steps.LEARN),
      }),
    ).toBeNull();
    expect(
      within(rail).getByRole("button", {
        name: console_.mission.rail.jump(console_.mission.rail.steps.UNDERSTAND),
      }),
    ).toBeInTheDocument();
  });
});

describe("progressive rendering", () => {
  it("prompts instead of rendering empty stages when nothing has happened", () => {
    render(<MissionWorkspace events={[]} seed={seed} />);
    expect(screen.getByText(console_.mission.operator.emptyTitle)).toBeInTheDocument();
    // Six steps in the rail, and not one card claiming a stage is pending.
    expect(screen.queryAllByRole("heading", { level: 3 })).toHaveLength(1);
  });
});

describe("theme", () => {
  it("renders operator mode with Stone theme active in dark mode", () => {
    const { container } = workspace();
    const themedRoots = container.querySelectorAll("[data-astryx-theme]");
    expect(themedRoots.length).toBeGreaterThan(0);
    const stoneRoot = Array.from(themedRoots).find(
      (el) => el.getAttribute("data-astryx-theme") === "stone",
    );
    expect(stoneRoot).toBeDefined();
    expect(stoneRoot?.getAttribute("data-astryx-theme")).toBe("stone");
    expect(stoneRoot?.getAttribute("data-theme")).toBe("dark");
  });
});

describe("initial mode and executive overview", () => {
  it("opens on Board mode when initialMode is set to BOARD", () => {
    workspace({ initialMode: "BOARD" });
    expect(screen.getByRole("radio", { name: console_.mission.modes.BOARD })).toBeChecked();
    expect(
      screen.getByRole("region", { name: console_.mission.board.label }),
    ).toBeInTheDocument();
  });

  it("renders McpExecutiveOverview with tool calls and Sibyl impact metrics when showExecutiveOverview is true", () => {
    workspace({ showExecutiveOverview: true });
    expect(screen.getByTestId("mcp-executive-overview")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Autonomous MCP Agent & Sibyl Memory Protocol/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("memory_recall_counterparty")).toBeInTheDocument();
    expect(screen.getByText("policy_gate")).toBeInTheDocument();
    expect(screen.getByText("base_escrow")).toBeInTheDocument();
    expect(screen.getByText("memory_journal")).toBeInTheDocument();
    expect(screen.getByText("virtuals:agent:alpha")).toBeInTheDocument();
    expect(screen.getByText("virtuals:agent:beta")).toBeInTheDocument();
    expect(screen.getByText(/Treasury Safeguard/i)).toBeInTheDocument();
  });
});



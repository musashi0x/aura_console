/**
 * The labelled example Run.
 *
 * This is fixture data, not a recording of anything that happened. It exists so
 * an operator can see what a Run looks like before they have one, and every
 * surface that renders it says so: `source: "FIXTURE"` reaches the fold, and
 * the timeline carries a visible label.
 *
 * It goes through the SAME `foldRun` as a real Run. A second rendering path for
 * the example would let the example diverge from the product, which is the one
 * thing a demo must not do.
 *
 * The amounts here are reported BY the events, never computed by the Console.
 */
import type { RunSummary, RunEvent } from "@/lib/api-client";

export const EXAMPLE_RUN_ID = "run_example_0001";

export const exampleRun: RunSummary = {
  id: EXAMPLE_RUN_ID,
  objective: "Buy one market dataset under a 25 USDC ceiling",
  source: "FIXTURE",
  environment: "non-mainnet",
  isMainnet: false,
  budgetUsdc: "25.000000",
  createdAt: "2026-08-29T09:00:00.000Z",
  updatedAt: "2026-08-29T09:04:12.000Z",
};

const at = (seconds: number): string =>
  new Date(Date.parse(exampleRun.createdAt) + seconds * 1000).toISOString();

const ev = (
  n: number,
  sequence: number,
  type: string,
  seconds: number,
  summary: string,
  extra: Record<string, unknown> = {},
): RunEvent => ({
  eventId: `evt_ex_${String(n).padStart(4, "0")}`,
  runId: EXAMPLE_RUN_ID,
  sequence,
  type,
  eventTime: at(seconds),
  data: { summary, ...extra },
});

export const exampleEvents: RunEvent[] = [
  ev(1, 0, "run.created", 0, "Run opened with a 25 USDC ceiling", { budget_usdc: "25.000000" }),
  ev(2, 1, "run.started", 4, "Agent began work"),
  ev(3, 2, "provider.discovered", 12, "Three counterparties offered the dataset"),
  ev(4, 3, "memory.retrieved", 31, "Two prior settlements recalled for this counterparty"),
  ev(5, 4, "candidate.scored", 44, "Counterparties ranked by settlement record and price"),
  ev(6, 5, "policy.evaluated", 52, "Operator policy allows this counterparty class"),
  ev(7, 6, "decision.made", 58, "Selected the counterparty with the better settlement record"),
  ev(8, 7, "run.blocked", 62, "Paused: the quoted price exceeds the operator ceiling"),
  ev(9, 8, "approval.granted", 140, "Operator approved the revised quote"),
  ev(10, 9, "run.resumed", 146, "Work resumed under the approved ceiling"),
  ev(11, 10, "acp.job.funded", 168, "Job funded within the approved ceiling"),
  ev(12, 11, "evaluation.completed", 226, "Delivery verified against the objective"),
  // Spend is reported BY the event. The Console never adds anything up.
  ev(13, 12, "outcome.recorded", 240, "Dataset delivered and verified", {
    spent_usdc: "18.500000",
  }),
  ev(14, 13, "memory.episode.written", 248, "Settlement recorded against the counterparty"),
  ev(15, 14, "memory.diff.published", 250, "Relationship memory moved from v12 to v13"),
  ev(16, 15, "run.completed", 252, "Run completed"),
];

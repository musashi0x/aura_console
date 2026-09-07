import { randomUUID } from "node:crypto";

import { decisionReasons, scoreCandidates } from "./mission-scoring.js";
import { RunStore } from "./run-store.js";
import { listCounterpartiesFromSibyl } from "./sibyl.js";

/**
 * The agent's opening move on a new Mission.
 *
 * Before this existed a Mission was created and then nothing happened to it:
 * the Console rendered `run.created` and stopped, and the only way to see a
 * ranked decision was to POST the events by hand. That made the demo Missions
 * indistinguishable from real ones, which is the exact confusion this product
 * exists to prevent.
 *
 * What it does is deliberately small. It reads relationship memory, ranks who
 * could be hired, records the choice, and then STOPS at the approval boundary.
 * It funds nothing, settles nothing, and touches no chain — the next step is an
 * operator's own click on the Approval card, and there is no path from here to
 * one.
 *
 * Every honesty rule the Console relies on is enforced here rather than at the
 * point of rendering, because a surface can refuse to draw a claim but cannot
 * un-record one:
 *
 * - Memory that could not be read is reported as unread. The Mission is blocked
 *   with the reason, never scored from an empty list — a ranking over nobody
 *   would present "we could not look" as "there was no-one to hire".
 * - Only counterparties that quoted a price are ranked. A default price would
 *   compete against real quotes and the operator could not tell which was which.
 * - The scoring event carries each candidate's memory component, so the
 *   counterfactual subtracts recorded evidence instead of re-running the model.
 * - The approval request always names a ceiling. Without one the Console draws
 *   no button, which is correct: approving to an unknown limit is a blank
 *   cheque.
 */

/** What the opening concluded, for the caller's logs. Never sent to a client. */
export type MissionOpening =
  | { status: "SCORED"; chosen: string; candidates: number }
  | { status: "BLOCKED"; domain: "memory" | "market"; detail: string }
  | { status: "FAILED"; detail: string };

interface OpenMissionInput {
  runId: string;
  /** The declared ceiling, when the operator set one. */
  budgetUsdc: string | null;
}

const AUTHORIZATION_MODE = "OPERATOR_APPROVAL";

export class MissionAgent {
  constructor(private readonly runs: RunStore = new RunStore()) {}

  async openMission(input: OpenMissionInput): Promise<MissionOpening> {
    try {
      return await this.open(input);
    } catch (error) {
      /* The Run exists and its seed event is written; only the opening failed.
         Throwing here would fail a create that already succeeded, so this is
         logged and reported, and the Mission stays at `run.created`. */
      const detail = error instanceof Error ? error.message : String(error);
      console.error("[mission-agent] opening failed", error);
      return { status: "FAILED", detail };
    }
  }

  private async open({ runId, budgetUsdc }: OpenMissionInput): Promise<MissionOpening> {
    const memory = await listCounterpartiesFromSibyl();

    if (!memory.ok) {
      await this.block(runId, "memory", memory.detail, memory.code !== "not_configured");
      return { status: "BLOCKED", domain: "memory", detail: memory.detail };
    }

    const { ranked, excluded } = scoreCandidates(memory.items);
    if (ranked.length === 0) {
      const detail =
        excluded.length === 0
          ? "Relationship memory was read and holds no counterparty to rank."
          : `Relationship memory was read, but every counterparty in it was excluded: ${excluded
              .map((row) => `${row.key} — ${row.reason}`)
              .join(" ")}`;
      await this.block(runId, "market", detail, false);
      return { status: "BLOCKED", domain: "market", detail };
    }

    await this.append(runId, "memory.retrieved", {
      source: "SIBYL",
      verdict_code: "ok",
      count: memory.items.length,
      retrieval_status: "AVAILABLE",
      summary: `Recalled ${memory.items.length} counterparties from Sibyl relationship memory`,
    });

    await this.append(runId, "candidate.scored", {
      summary: `Ranked ${ranked.length} ${ranked.length === 1 ? "counterparty" : "counterparties"} on price and relationship memory`,
      candidates: ranked,
      /* Only when there were any. An empty array on every Mission would read as
         a considered-and-cleared check on Missions where nothing was excluded. */
      ...(excluded.length > 0 ? { excluded } : {}),
    });

    const winner = ranked[0]!;
    const record = memory.items.find((item) => item.counterpartyKey === winner.key)!;

    await this.append(runId, "decision.made", {
      summary: "Selected the highest-ranked counterparty",
      counterparty_key: winner.key,
      authorization_mode: AUTHORIZATION_MODE,
      reasons: decisionReasons(record),
    });

    /* The operator's declared ceiling when there is one, otherwise the price
       this counterparty actually quoted. Never a rounded-up number and never
       an unbounded one: the ceiling is what the button will authorize. */
    const ceilingUsdc = budgetUsdc ?? record.observedPriceUsdc;
    const quoted = record.observedPriceUsdc;

    await this.append(runId, "approval.requested", {
      summary: "Funding this counterparty needs an operator decision",
      action: quoted === null ? "Fund the job" : `Fund the job at ${quoted} USDC`,
      counterparty_key: winner.key,
      ceiling_usdc: ceilingUsdc,
      amount_usdc: quoted,
      /* Named so the card, and later the grant, say which ranking this
         authorization belongs to rather than the newest one on the Run. */
      authorization_mode: AUTHORIZATION_MODE,
    });

    return { status: "SCORED", chosen: winner.key, candidates: ranked.length };
  }

  private append(runId: string, type: string, data: Record<string, unknown>) {
    return this.runs.appendEvent({
      runId,
      eventId: randomUUID(),
      type,
      eventTime: new Date(),
      data,
    });
  }

  /**
   * Records why the Mission stopped.
   *
   * `run.blocked` is what the Console folds into an attention state, so the
   * operator is told the Mission is waiting on something rather than left with
   * a Mission that merely looks idle.
   */
  private block(runId: string, domain: "memory" | "market", detail: string, retryable: boolean) {
    return this.append(runId, "run.blocked", {
      summary:
        domain === "memory"
          ? "Paused: relationship memory could not be read, so nothing was ranked"
          : "Paused: no counterparty on record quoted a price",
      domain,
      detail,
      retryable,
    });
  }
}

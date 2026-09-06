import type { CanonicalStage, RunStatus, TimelineEntry } from "../model/types";
import { isTerminal } from "../model/types";

/**
 * The six steps an operator reads, over the ten canonical stages the system
 * records.
 *
 * The ten stages are not deleted and not renamed: they are the event log's own
 * vocabulary and they still drive Trace. These six are the vocabulary of the
 * product, and the mapping between them is total in one direction, so a rail
 * step can never appear that no canonical stage justifies.
 */
export type MissionStep =
  | "UNDERSTAND"
  | "REMEMBER"
  | "DECIDE"
  | "ACT"
  | "VERIFY"
  | "LEARN";

export const MISSION_STEP_ORDER: readonly MissionStep[] = [
  "UNDERSTAND",
  "REMEMBER",
  "DECIDE",
  "ACT",
  "VERIFY",
  "LEARN",
];

const STEP_BY_STAGE: Record<CanonicalStage, MissionStep> = {
  DISCOVER: "UNDERSTAND",
  MEMORY: "REMEMBER",
  SCORE: "DECIDE",
  POLICY: "DECIDE",
  DECIDE: "DECIDE",
  FUND: "ACT",
  DELIVER: "ACT",
  EVALUATE: "VERIFY",
  LEARN: "LEARN",
  COMMIT: "LEARN",
};

export const missionStepFor = (stage: CanonicalStage): MissionStep => STEP_BY_STAGE[stage];

/**
 * Where a step sits on the Board.
 *
 * `NEEDS_YOU` is not a guess about intent: it is only ever the step a Run is
 * actually halted on, and only when the Run's own status says it is halted for
 * an operator. Nothing here invents a task — a step exists because events
 * classified into it, or it is still ahead of the Run.
 */
export type MissionColumn = "QUEUED" | "RUNNING" | "NEEDS_YOU" | "DONE";

export interface MissionStepNode {
  step: MissionStep;
  reached: boolean;
  column: MissionColumn;
  entries: TimelineEntry[];
  /** The moment the step was first reached, or null while it is still ahead. */
  firstTime: string | null;
  /** Anchor for scrolling Operator to the first card in this step. */
  firstEventId: string | null;
}

export interface MissionProgress {
  nodes: MissionStepNode[];
  /** The step the Run is on, or null when it has finished or not begun. */
  current: MissionStep | null;
}

/** A Run halted for a person, as opposed to one still working. */
const WAITING_ON_OPERATOR: readonly RunStatus[] = ["WAITING_APPROVAL", "BLOCKED"];

export function buildMissionProgress(
  entries: readonly TimelineEntry[],
  status: RunStatus,
): MissionProgress {
  const byStep = new Map<MissionStep, TimelineEntry[]>();
  for (const entry of entries) {
    // Lifecycle events belong to no step. They are not dropped: Trace lists
    // every one of them, and the Run's status already carries what they mean.
    if (entry.stage === null) continue;
    const step = missionStepFor(entry.stage);
    const bucket = byStep.get(step);
    if (bucket) bucket.push(entry);
    else byStep.set(step, [entry]);
  }

  const reachedSteps = MISSION_STEP_ORDER.filter((step) => (byStep.get(step)?.length ?? 0) > 0);
  const last = reachedSteps.length > 0 ? reachedSteps[reachedSteps.length - 1]! : null;
  // A finished Run is on no step. Leaving the final step marked RUNNING would
  // say the Mission is still working after it has settled.
  const current = last !== null && !isTerminal(status) ? last : null;
  const halted = WAITING_ON_OPERATOR.includes(status);

  const nodes = MISSION_STEP_ORDER.map<MissionStepNode>((step) => {
    const held = byStep.get(step) ?? [];
    const reached = held.length > 0;
    const first = held[0] ?? null;
    const column: MissionColumn = !reached
      ? "QUEUED"
      : step !== current
        ? "DONE"
        : halted
          ? "NEEDS_YOU"
          : "RUNNING";
    return {
      step,
      reached,
      column,
      entries: held,
      firstTime: first?.eventTime ?? null,
      firstEventId: first?.eventId ?? null,
    };
  });

  return { nodes, current };
}

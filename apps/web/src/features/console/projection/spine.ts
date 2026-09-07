import type { CanonicalStage, TimelineEntry } from "../model/types";

/**
 * The five stages the operator is told a Run has:
 *
 *   EVIDENCE -> DECISION -> ECONOMIC ACTION -> OUTCOME -> MEMORY DIFF
 *
 * The fold already classifies each event into one of ten finer stages. Those
 * are the vocabulary of the event log; these five are the vocabulary of the
 * product. Keeping both, with one total mapping between them, means the spine
 * can never show a stage the log cannot justify, and an event can never land
 * in two places at once.
 */
export type SpineStage =
  | "EVIDENCE"
  | "DECISION"
  | "ECONOMIC_ACTION"
  | "OUTCOME"
  | "MEMORY_DIFF";

export const SPINE_ORDER: readonly SpineStage[] = [
  "EVIDENCE",
  "DECISION",
  "ECONOMIC_ACTION",
  "OUTCOME",
  "MEMORY_DIFF",
];

const SPINE_BY_CANONICAL: Record<CanonicalStage, SpineStage> = {
  DISCOVER: "EVIDENCE",
  MEMORY: "EVIDENCE",
  SCORE: "EVIDENCE",
  POLICY: "DECISION",
  DECIDE: "DECISION",
  FUND: "ECONOMIC_ACTION",
  COMMIT: "ECONOMIC_ACTION",
  DELIVER: "OUTCOME",
  EVALUATE: "OUTCOME",
  LEARN: "MEMORY_DIFF",
};

export const spineStageFor = (stage: CanonicalStage): SpineStage => SPINE_BY_CANONICAL[stage];

/**
 * A node is REACHED only when the visible window actually contains an event
 * for it. There is no third state that means "expected next": the Console
 * cannot know what a Run will do, and a node that pre-announced a stage would
 * be predicting economic activity that may never happen.
 */
export type SpineNodeState = "REACHED" | "NOT_REACHED";

export interface SpineNode {
  stage: SpineStage;
  state: SpineNodeState;
  entries: TimelineEntry[];
  firstSequence: number | null;
  lastSequence: number | null;
  /** The moment the stage was first reached, for the node's own time label. */
  firstTime: string | null;
  lastTime: string | null;
  /**
   * Events this stage holds that the Memory Off view is hiding. It is counted
   * and shown, never silently dropped: a stage that quietly lost its evidence
   * would misreport what the Run did.
   */
  hiddenByMemoryOff: number;
}

export interface Spine {
  nodes: SpineNode[];
  /**
   * Lifecycle and unrecognised events. They belong to no stage in the decision
   * story but are still part of the Run, so they are carried out of the fold
   * rather than discarded.
   */
  offSpine: TimelineEntry[];
  hiddenByMemoryOff: number;
}

export interface SpineOptions {
  /**
   * The Memory Off counterfactual VIEW. It hides memory-derived evidence from
   * the spine so the operator can see which nodes rest on it. It re-runs
   * nothing and re-decides nothing: the events are unchanged underneath, and
   * every hidden one stays counted.
   */
  hideMemory?: boolean;
}

export function buildSpine(
  entries: readonly TimelineEntry[],
  options: SpineOptions = {},
): Spine {
  const hideMemory = options.hideMemory === true;
  const byStage = new Map<SpineStage, TimelineEntry[]>();
  const hiddenCount = new Map<SpineStage, number>();
  const offSpine: TimelineEntry[] = [];
  let hidden = 0;

  for (const entry of entries) {
    if (entry.stage === null) {
      offSpine.push(entry);
      continue;
    }
    const stage = spineStageFor(entry.stage);
    if (hideMemory && entry.stage === "MEMORY") {
      hidden += 1;
      hiddenCount.set(stage, (hiddenCount.get(stage) ?? 0) + 1);
      continue;
    }
    const bucket = byStage.get(stage);
    if (bucket) bucket.push(entry);
    else byStage.set(stage, [entry]);
  }

  const nodes = SPINE_ORDER.map<SpineNode>((stage) => {
    const held = byStage.get(stage) ?? [];
    const first = held[0] ?? null;
    const last = held.length > 0 ? held[held.length - 1]! : null;
    return {
      stage,
      // Hidden events do not make a stage reached. Memory Off is a view of the
      // Run without that evidence, and a node standing on nothing but hidden
      // events has nothing left to stand on.
      state: held.length > 0 ? "REACHED" : "NOT_REACHED",
      entries: held,
      firstSequence: first?.sequence ?? null,
      lastSequence: last?.sequence ?? null,
      firstTime: first?.eventTime ?? null,
      lastTime: last?.eventTime ?? null,
      hiddenByMemoryOff: hiddenCount.get(stage) ?? 0,
    };
  });

  return { nodes, offSpine, hiddenByMemoryOff: hidden };
}

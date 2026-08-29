import type { CanonicalStage } from "../model/types";

/** Event type prefix to the stage it belongs to in the operator's story. */
const STAGE_BY_PREFIX: [string, CanonicalStage][] = [
  ["provider.discovery", "DISCOVER"],
  ["provider.discovered", "DISCOVER"],
  ["memory.retrieval", "MEMORY"],
  ["memory.retrieved", "MEMORY"],
  ["memory.no_history", "MEMORY"],
  ["candidate.scored", "SCORE"],
  ["policy.", "POLICY"],
  ["decision.", "DECIDE"],
  ["approval.", "DECIDE"],
  ["override.", "DECIDE"],
  ["acp.job.funded", "FUND"],
  ["acp.job", "FUND"],
  ["evaluation.", "EVALUATE"],
  ["outcome.", "DELIVER"],
  ["memory.episode", "LEARN"],
  ["memory.profile", "LEARN"],
  ["memory.diff", "LEARN"],
  ["commitment.", "COMMIT"],
];

/** null for an unrecognised type. The entry is still shown, never dropped. */
export function stageFor(type: string): CanonicalStage | null {
  for (const [prefix, stage] of STAGE_BY_PREFIX) {
    if (type.startsWith(prefix)) return stage;
  }
  return null;
}

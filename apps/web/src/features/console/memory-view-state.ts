/**
 * Memory On/Off, the counterfactual VIEW owned by the command palette (#68).
 *
 * It hides memory-derived evidence from the spine so an operator can see what
 * a decision rested on. It re-runs nothing, re-decides nothing and pays for
 * nothing; the events underneath are untouched and every hidden one stays
 * counted on the node that held it.
 *
 * Deliberately NOT persisted. The rail's collapsed state is a preference worth
 * remembering, but this one hides evidence: an operator returning days later
 * to a Run silently missing its memory events would be reading a filtered Run
 * as if it were the whole one. Every visit starts with memory on.
 *
 * A module store rather than component state because the palette sets it and
 * the timeline and chat read it, across surfaces that each mount their own
 * tree, and this repo's lint forbids seeding state from an effect.
 */
let enabled = true;
const listeners = new Set<() => void>();

export function getMemoryViewEnabled(): boolean {
  return enabled;
}

export function subscribeMemoryView(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setMemoryViewEnabled(next: boolean) {
  if (enabled === next) return;
  enabled = next;
  for (const listener of listeners) listener();
}

export function toggleMemoryView() {
  setMemoryViewEnabled(!enabled);
}

/** The server renders the unfiltered Run, which is also the client default. */
export const MEMORY_VIEW_SERVER_SNAPSHOT = true;

/** Test-only reset so one spec cannot leak a hidden-evidence view into another. */
export function __resetMemoryView() {
  enabled = true;
  for (const listener of listeners) listener();
}

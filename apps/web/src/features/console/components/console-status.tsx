import { StatusBadge } from "@/components/primitives";

import { console_ } from "../copy";

export type ReadinessState = "ready" | "degraded" | "checking";

/**
 * Readiness as a single, honest signal. `checking` exists so a surface that has
 * not finished its check never borrows `ready` in the meantime.
 */
export function ConsoleStatus({ state }: { state: ReadinessState }) {
  if (state === "checking") {
    return (
      <StatusBadge tone="pending">{console_.status.checking}</StatusBadge>
    );
  }

  return (
    <StatusBadge tone={state === "ready" ? "ready" : "error"}>
      {state === "ready" ? console_.status.ready : console_.status.degraded}
    </StatusBadge>
  );
}

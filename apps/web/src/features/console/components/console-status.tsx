import Link from "next/link";

import { StatusBadge } from "@/components/primitives";

import { console_ } from "../copy";

export type ReadinessState = "ready" | "degraded" | "checking";

/**
 * Readiness as a single, honest signal. `checking` exists so a surface that has
 * not finished its check never borrows `ready` in the meantime.
 *
 * Degraded is a LINK to the readiness detail, because a badge that reports a
 * problem and offers no way to see what broke leaves the reader with a worry
 * and no next step. Ready and checking stay inert: there is nothing to act on.
 */
export function ConsoleStatus({ state }: { state: ReadinessState }) {
  if (state === "checking") {
    return <StatusBadge tone="pending">{console_.status.checking}</StatusBadge>;
  }

  if (state === "ready") {
    return <StatusBadge tone="ready">{console_.status.ready}</StatusBadge>;
  }

  return (
    <Link className="cs__status-link" href="/system" aria-label={console_.status.degradedAction}>
      <StatusBadge tone="error">{console_.status.degraded}</StatusBadge>
    </Link>
  );
}

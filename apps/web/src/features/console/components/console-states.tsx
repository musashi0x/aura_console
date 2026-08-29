import Link from "next/link";
import type { ReactNode } from "react";

import { Button, EmptyState, MonoRef, Panel, StatusBadge } from "@/components/primitives";

import { console_ } from "../copy";

/**
 * The empty Run list. It explains what a Run is rather than just saying there
 * are none, and it only offers a destination that exists.
 */
export function ConsoleEmptyState({
  exampleAvailable,
  createAvailable,
}: {
  exampleAvailable: boolean;
  createAvailable: boolean;
}) {
  return (
    <EmptyState
      title={console_.empty.title}
      body={console_.empty.body}
      action={
        <span className="cs__actions">
          {exampleAvailable ? (
            <Link href="/runs/example" className="btn btn--primary cs__action-link">
              {console_.empty.example}
            </Link>
          ) : (
            <span className="cs__muted">
              {console_.empty.example} · {console_.empty.unavailableNote}
            </span>
          )}
          {createAvailable ? (
            <Link href="/runs/new" className="btn cs__action-link">
              {console_.empty.create}
            </Link>
          ) : (
            <span className="cs__muted">
              {console_.empty.create} · {console_.empty.unavailableNote}
            </span>
          )}
        </span>
      }
    />
  );
}

/**
 * Structure is preserved while loading. No status value is invented in the
 * meantime, because a placeholder that reads as "ready" is worse than a wait.
 */
export function ConsoleLoadingState({ label }: { label?: string }) {
  return (
    <div className="cs__loading" role="status" aria-live="polite">
      <p className="cs__loading-label">{label ?? console_.loading.label}</p>
      <span className="cs__skeleton" aria-hidden="true" />
      <span className="cs__skeleton" aria-hidden="true" />
      <span className="cs__skeleton cs__skeleton--short" aria-hidden="true" />
    </div>
  );
}

/** Names the failed dependency, the consequence, and the next action. */
export function ConsoleErrorState({
  domain,
  detail,
  retryHref,
}: {
  domain: string;
  detail: string;
  retryHref?: string;
}) {
  return (
    <Panel title={console_.degraded.title} meta={<MonoRef label="DOMAIN">{domain}</MonoRef>}>
      <p className="cs__state-badge">
        <StatusBadge tone="error">{console_.status.degraded}</StatusBadge>
      </p>
      <p className="cs__detail">{detail}</p>
      <p className="cs__detail">{console_.degraded.guidance}</p>
      {retryHref ? (
        <Link href={retryHref} className="btn cs__action-link">
          {console_.degraded.retry}
        </Link>
      ) : null}
    </Panel>
  );
}

/**
 * Unavailable memory is stated, never filled in. Substituting plausible history
 * here would be the exact failure the fail-closed memory rule exists to stop.
 */
export function ConsoleUnavailableMemory({ children }: { children?: ReactNode }) {
  return (
    <Panel>
      <p className="cs__state-badge">
        <StatusBadge tone="warning">{console_.memoryUnavailable.badge}</StatusBadge>
      </p>
      <p className="cs__detail">{console_.memoryUnavailable.body}</p>
      <p className="cs__detail">{console_.memoryUnavailable.note}</p>
      {children}
    </Panel>
  );
}

/** Live, paused, and history are separate labels and never collapse into one. */
export function ConsoleTransportLabel({
  mode,
  atTime,
}: {
  mode: "LIVE" | "PAUSED" | "HISTORY";
  atTime?: string;
}) {
  if (mode === "HISTORY") {
    return (
      <StatusBadge tone="warning">
        {console_.transport.history}
        {atTime ? ` · ${atTime}` : ""}
      </StatusBadge>
    );
  }
  return (
    <StatusBadge tone={mode === "LIVE" ? "pending" : "neutral"}>
      {mode === "LIVE" ? console_.transport.live : console_.transport.paused}
    </StatusBadge>
  );
}

export { Button };

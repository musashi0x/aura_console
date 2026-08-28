import type { ReactNode } from "react";

export type StatusTone = "neutral" | "ready" | "pending" | "warning" | "error";

/**
 * Every tone carries a glyph as well as a colour. State that depends on colour
 * alone is unreadable for a meaningful share of operators, and this is the
 * primitive that makes that impossible to forget.
 */
const GLYPH: Record<StatusTone, string> = {
  neutral: "–",
  ready: "✓",
  pending: "…",
  warning: "!",
  error: "✕",
};

export function StatusBadge({
  tone = "neutral",
  children,
}: {
  tone?: StatusTone;
  children: ReactNode;
}) {
  return (
    <span className={`status-badge status-badge--${tone}`} data-tone={tone}>
      <span aria-hidden="true" className="status-badge__glyph">
        {GLYPH[tone]}
      </span>
      {children}
    </span>
  );
}

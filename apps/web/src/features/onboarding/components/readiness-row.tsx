import type { ReadinessRow as Row } from "../types";

const STATE_TEXT: Record<Row["status"], string> = {
  checking: "Checking",
  ready: "Ready",
  unavailable: "Unavailable",
  not_checked: "Not checked",
};

// A glyph plus the word, so status never depends on colour alone.
const STATE_GLYPH: Record<Row["status"], string> = {
  checking: "…",
  ready: "✓",
  unavailable: "✕",
  not_checked: "–",
};

export function ReadinessRowItem({
  row,
  onRetry,
}: {
  row: Row;
  onRetry: (id: string) => void;
}) {
  return (
    <li className="readiness__row">
      <div className="readiness__head">
        <span className="readiness__label">{row.label}</span>
        <span className={`readiness__state readiness__state--${row.status}`}>
          <span aria-hidden="true">{STATE_GLYPH[row.status]} </span>
          {STATE_TEXT[row.status]}
        </span>
        <span className="onboarding__note">{row.domain}</span>
        {row.status === "unavailable" && row.retryable ? (
          <button type="button" className="btn" onClick={() => onRetry(row.id)}>
            Retry {row.label}
          </button>
        ) : null}
      </div>
      {row.detail ? <p className="readiness__detail">{row.detail}</p> : null}
    </li>
  );
}

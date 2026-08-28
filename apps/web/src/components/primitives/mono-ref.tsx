import type { ReactNode } from "react";

/**
 * Technical identifiers: Run IDs, event sequence, endpoints, versions, hashes.
 * This is where the terminal character belongs. Product prose stays sans.
 */
export function MonoRef({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <span className="mono-ref">
      {label ? <span className="mono-ref__label">{label}</span> : null}
      <code className="mono-ref__value">{children}</code>
    </span>
  );
}

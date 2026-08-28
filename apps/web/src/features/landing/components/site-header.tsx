import Link from "next/link";

import { landing } from "../copy";

/**
 * Minimal by design. The status comes from the same readiness check the
 * Console uses, so it reports SYSTEM DEGRADED when that check fails rather
 * than being a badge that always reassures.
 */
export function SiteHeader({ ready }: { ready: boolean }) {
  return (
    <header className="lp-header">
      <div className="lp-header__inner">
        <Link href="/" className="lp-header__brand">
          {landing.header.brand}
        </Link>
        <div className="lp-header__right">
          <span className={`lp-status lp-status--${ready ? "ready" : "degraded"}`}>
            <span aria-hidden="true" className="lp-status__glyph">
              {ready ? "✓" : "✕"}
            </span>
            {ready ? "SYSTEM READY" : "SYSTEM DEGRADED"}
          </span>
          <Link href="/runs/example" className="lp-header__cta">
            {landing.header.example}
          </Link>
        </div>
      </div>
    </header>
  );
}

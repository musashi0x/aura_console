"use client";

import Link from "next/link";
import { DrawablyBadge, DrawablyUnderline } from "drawably/react";

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
          <DrawablyBadge
            variant="outline"
            stroke={ready ? "var(--landing-ok)" : "var(--landing-bad)"}
            className={`lp-status lp-status--${ready ? "ready" : "degraded"}`}
          >
            <span aria-hidden="true" className="lp-status__glyph">
              {ready ? "✓" : "✕"}
            </span>
            {ready ? "SYSTEM READY" : "SYSTEM DEGRADED"}
          </DrawablyBadge>
          <Link href="/runs/example" className="lp-header__cta">
            <DrawablyUnderline>{landing.header.example}</DrawablyUnderline>
          </Link>
        </div>
      </div>
    </header>
  );
}

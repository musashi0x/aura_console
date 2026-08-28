import Link from "next/link";

import { StatusBadge } from "@/components/primitives";

import { landing } from "../copy";

/**
 * The status here comes from the same readiness check the Console uses. It is
 * never a decorative "all good" badge: if the database check failed, this says
 * so on the landing page too.
 */
export function SiteHeader({ ready }: { ready: boolean }) {
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link href="/" className="site-header__brand">
          {landing.header.brand}
        </Link>
        <div className="site-header__right">
          <StatusBadge tone={ready ? "ready" : "error"}>
            {ready ? "SYSTEM READY" : "SYSTEM DEGRADED"}
          </StatusBadge>
          <Link href="/runs/example" className="btn btn--quiet site-header__cta">
            {landing.header.example}
          </Link>
        </div>
      </div>
    </header>
  );
}

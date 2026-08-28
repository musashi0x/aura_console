import Link from "next/link";
import type { ReactNode } from "react";

import { StatusBadge } from "@/components/primitives";

export interface ConsoleShellProps {
  /** The destination the operator is currently on, for nav and the context bar. */
  surface: string;
  /** Real database readiness. Never a decorative badge. */
  ready: boolean;
  children: ReactNode;
}

/**
 * Three zones: a navigation rail, a context bar, and the workspace.
 *
 * There is deliberately no account menu, avatar, organisation switcher, or
 * workspace switcher. v0.1 is single-operator and unauthenticated, and a
 * control implying otherwise would be a lie about the product.
 */
const DESTINATIONS = [
  { href: "/runs", label: "Runs" },
  { href: "/counterparties", label: "Counterparties" },
  { href: "/policies", label: "Policies" },
] as const;

export function ConsoleShell({ surface, ready, children }: ConsoleShellProps) {
  return (
    <div className="cs">
      <header className="cs__bar">
        <Link href="/" className="cs__brand">
          AURA CONSOLE
        </Link>
        <span className="cs__surface" aria-live="polite">
          {surface}
        </span>
        <span className="cs__bar-right">
          <span className="cs__env">NON-MAINNET</span>
          <StatusBadge tone={ready ? "ready" : "error"}>
            {ready ? "SYSTEM READY" : "SYSTEM DEGRADED"}
          </StatusBadge>
        </span>
      </header>

      <div className="cs__body">
        <nav className="cs__nav" aria-label="Console">
          <ul className="cs__nav-list">
            {DESTINATIONS.map((destination) => (
              <li key={destination.href}>
                <Link
                  href={destination.href}
                  className="cs__nav-link"
                  aria-current={surface === destination.label ? "page" : undefined}
                >
                  {destination.label}
                </Link>
              </li>
            ))}
          </ul>
          {/* System is a secondary destination and must not compete with the
              three product destinations. */}
          <Link href="/system" className="cs__nav-secondary">
            System
          </Link>
        </nav>

        <main id="main" className="cs__main">
          {children}
        </main>
      </div>
    </div>
  );
}

import type { ReactNode } from "react";

import { ConsoleNavigation } from "./console-navigation";
import type { ReadinessState } from "./console-status";
import { ConsoleTopbar } from "./console-topbar";

export interface ConsoleShellProps {
  /** The destination the operator is on, for navigation and the context bar. */
  surface: string;
  readiness: ReadinessState;
  /** Shown in the context bar only when a Run is actually selected. */
  runRef?: string;
  children: ReactNode;
}

/**
 * Three zones: a context bar, a navigation rail, and the workspace. The shell
 * composes bounded pieces rather than owning their markup, so a state surface
 * can be tested without rendering the whole page.
 */
export function ConsoleShell({ surface, readiness, runRef, children }: ConsoleShellProps) {
  return (
    <div className="cs">
      <ConsoleTopbar surface={surface} readiness={readiness} runRef={runRef} />
      <div className="cs__body">
        <ConsoleNavigation surface={surface} />
        <main id="main" className="cs__main">
          {children}
        </main>
      </div>
    </div>
  );
}

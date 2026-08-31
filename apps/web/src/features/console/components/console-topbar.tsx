import Link from "next/link";

import { console_ } from "../copy";
import { ConsoleStatus, type ReadinessState } from "./console-status";

export function ConsoleTopbar({
  surface,
  readiness,
  runRef,
}: {
  surface: string;
  readiness: ReadinessState;
  /** Shown only when a Run is actually selected. */
  runRef?: string;
}) {
  return (
    <header className="cs__bar">
      <Link href="/" className="cs__brand">
        {console_.brand}
      </Link>
      <span className="cs__surface">{surface}</span>
      {runRef ? <code className="cs__run-ref">{runRef}</code> : null}
      <span className="cs__bar-right">
        <span className="cs__env">{console_.environment}</span>
        <ConsoleStatus state={readiness} />
      </span>
    </header>
  );
}

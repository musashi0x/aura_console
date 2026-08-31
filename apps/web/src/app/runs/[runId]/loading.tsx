import { ConsoleShell } from "@/features/console/components/console-shell";
import { ConsoleLoadingState } from "@/features/console/components/console-states";

/**
 * Shown while one Run and its events are read.
 *
 * Two requests happen here, so this segment is the slowest of the Run surfaces
 * and the one most likely to look broken without it. The label names what is
 * being read rather than saying "Loading", which tells the reader nothing about
 * whether to wait.
 */
export default function RunLoading() {
  return (
    <ConsoleShell surface="Runs" readiness="checking">
      <ConsoleLoadingState label="Reading this Run and its events…" />
    </ConsoleShell>
  );
}

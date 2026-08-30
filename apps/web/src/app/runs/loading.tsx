import { ConsoleShell } from "@/features/console/components/console-shell";
import { ConsoleLoadingState } from "@/features/console/components/console-states";

/**
 * Shown while a Run surface reads the API.
 *
 * Every Run route is an async server component, so without this a slow database
 * gave a blank page and then a finished one, with nothing in between. Task #30
 * asks for the loading state to be VISIBLE, and `ConsoleLoadingState` existed
 * and was tested while no route rendered it.
 *
 * Readiness is `checking` on purpose: the check has not answered yet. Borrowing
 * `ready` here would report a verified result the page does not have, which is
 * the exact reason `checking` exists as a third state.
 */
export default function RunsLoading() {
  return (
    <ConsoleShell surface="Runs" readiness="checking">
      <ConsoleLoadingState />
    </ConsoleShell>
  );
}

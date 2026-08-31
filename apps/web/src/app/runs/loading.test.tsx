import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import RunsLoading from "./loading";

/**
 * Acceptance criterion 4 of task #30 asks for loading, empty, terminal and
 * failure states to be VISIBLE. `ConsoleLoadingState` existed and was tested,
 * but no route rendered it: every Run surface is an async server component, so
 * a slow database showed a blank page and then a finished one.
 *
 * The readiness check has not answered yet while this is on screen, so the
 * shell must say `CHECKING`. Borrowing `SYSTEM READY` would report a verified
 * result the page does not have.
 */
describe("the Runs loading state", () => {
  it("says the readiness check is still running", () => {
    render(<RunsLoading />);
    expect(screen.getByText("CHECKING")).toBeInTheDocument();
  });

  it("never borrows a readiness result it does not have", () => {
    const { container } = render(<RunsLoading />);
    expect(container.textContent).not.toMatch(/SYSTEM READY|SYSTEM DEGRADED/);
  });

  it("announces itself politely rather than silently", () => {
    render(<RunsLoading />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("claims no Runs while it is still reading", () => {
    // "No Runs yet" during a load would be a verified empty list from a query
    // that has not returned.
    const { container } = render(<RunsLoading />);
    expect(container.textContent).not.toMatch(/no runs|0 runs/i);
  });
});

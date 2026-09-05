import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api-client", () => ({
  apiClient: { dbHealth: async () => ({ ok: true, data: { status: "ok", latencyMs: 1 } }) },
}));

const { default: ExampleRunPage } = await import("../page");

/**
 * The example Run is the surface most likely to be mistaken for a real one,
 * because everything about it works. These pin the two things that keep it
 * honest: it says it is an example, and it never claims execution.
 */
describe("the example Run", () => {
  it("renders a real timeline rather than a placeholder", async () => {
    render(await ExampleRunPage());

    expect(
      screen.getByRole("heading", { name: /Buy one market dataset under a 25 USDC ceiling/ }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/placeholder/i)).not.toBeInTheDocument();
  });

  it("says it is example data and that nothing was executed", async () => {
    render(await ExampleRunPage());

    const label = screen.getByText(/Example data/i);
    expect(label).toBeInTheDocument();
    expect(label.textContent).toMatch(/no economic action was taken/i);
  });

  it("reports spend only because an event reported it", async () => {
    render(await ExampleRunPage());
    // 18.5 is carried by outcome.recorded. The Console adds nothing up, so a
    // number here can only have come from an event.
    expect(screen.getByText(/18\.500000/)).toBeInTheDocument();
  });

  it("never presents itself as live", async () => {
    // The transport badge opened on LIVE for everything, so a fixture wore a
    // "… LIVE" badge. "Live" means following a moving edge; example data never
    // had one, and a finished Run no longer does.
    render(await ExampleRunPage());
    expect(screen.queryByText("LIVE")).not.toBeInTheDocument();
    expect(screen.getByText("ENDED")).toBeInTheDocument();
  });

  it("names its origin as a fixture rather than as an API Run", async () => {
    render(await ExampleRunPage());
    expect(screen.getByText("FIXTURE")).toBeInTheDocument();
  });

  it("does not call a lifecycle event unrecognised", async () => {
    // The fold reads run.created to derive status, so reporting it as
    // unrecognised told the operator the Console did not understand an event it
    // had just acted on.
    const { container } = render(await ExampleRunPage());
    expect(container.textContent).not.toMatch(/UNRECOGNISED/);
  });
});

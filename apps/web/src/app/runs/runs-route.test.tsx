import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const dbHealth = vi.fn();
const listRuns = vi.fn();

vi.mock("@/lib/api-client", () => ({
  apiClient: {
    dbHealth: () => dbHealth(),
    listRuns: () => listRuns(),
  },
}));

const { default: RunsPage } = await import("./page");

const run = (over: Record<string, unknown> = {}) => ({
  id: "run-1",
  objective: "Buy one market dataset",
  source: "CONSOLE",
  environment: "non-mainnet",
  isMainnet: false,
  budgetUsdc: "25.000000",
  createdAt: "2026-08-29T09:00:00.000Z",
  updatedAt: "2026-08-29T09:00:00.000Z",
  ...over,
});

beforeEach(() => {
  dbHealth.mockReset();
  listRuns.mockReset();
});

/**
 * The three outcomes of asking for a list are not interchangeable. "We could
 * not look" and "we looked and there is nothing" lead an operator to different
 * actions, and the second is only sayable once the API has answered.
 */
describe("the Runs list", () => {
  it("lists the Runs the API returned", async () => {
    dbHealth.mockResolvedValue({ ok: true, data: { status: "ok", latencyMs: 1 } });
    listRuns.mockResolvedValue({ ok: true, data: { runs: [run(), run({ id: "run-2", objective: "Second objective" })] } });

    render(await RunsPage());

    expect(screen.getByRole("link", { name: /Buy one market dataset/ })).toHaveAttribute(
      "href",
      "/runs/run-1",
    );
    expect(screen.getByRole("link", { name: /Second objective/ })).toBeInTheDocument();
  });

  it("says the store could not be read when the request fails", async () => {
    dbHealth.mockResolvedValue({ ok: true, data: { status: "ok", latencyMs: 1 } });
    listRuns.mockResolvedValue({ ok: false, error: { code: "boom", message: "no" } });

    render(await RunsPage());

    expect(screen.getByText(/Nothing is known about how many exist/i)).toBeInTheDocument();
    // The one thing it must never say when it could not look.
    expect(screen.queryByText(/Runs cannot be listed yet/i)).not.toBeInTheDocument();
  });

  it("claims an empty list only after the API answered with one", async () => {
    dbHealth.mockResolvedValue({ ok: true, data: { status: "ok", latencyMs: 1 } });
    listRuns.mockResolvedValue({ ok: true, data: { runs: [] } });

    render(await RunsPage());

    expect(screen.getByText(/one economic objective from start to finish/i)).toBeInTheDocument();
    expect(screen.queryByText(/Nothing is known/i)).not.toBeInTheDocument();
  });

  it("does not ask for Runs at all when the store is down", async () => {
    dbHealth.mockResolvedValue({ ok: false, error: { code: "db", message: "down" } });

    render(await RunsPage());

    expect(listRuns).not.toHaveBeenCalled();
    // The badge appears once in the topbar and once in the error surface. Both
    // are correct; assert the actionable one, which links to the detail.
    expect(screen.getByRole("link", { name: /System degraded/i })).toHaveAttribute(
      "href",
      "/system",
    );
  });
});

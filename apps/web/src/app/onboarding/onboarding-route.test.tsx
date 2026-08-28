import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { writeProgress } from "@/features/onboarding/acknowledgement";

import { OnboardingRoute } from "./onboarding-route";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace: vi.fn() }) }));

const ok = { ok: true as const, data: { status: "ok", latencyMs: 1, uptime: 1, timestamp: "" } };
vi.mock("@/lib/api-client", () => ({
  apiClient: { health: async () => ok, dbHealth: async () => ok },
}));

beforeEach(() => {
  push.mockReset();
});

/**
 * These cover the gap the component tests could not: the flow is only correct
 * if the route actually supplies the destinations.
 */
describe("onboarding route wiring", () => {
  it("navigates home when the operator skips", async () => {
    const user = userEvent.setup();
    render(<OnboardingRoute />);
    await user.click(screen.getByRole("button", { name: /skip for now/i }));
    expect(push).toHaveBeenCalledWith("/");
  });

  it("navigates to New Run when finishing", async () => {
    writeProgress({ step: "complete", acknowledgedAt: "2026-08-28T00:00:00Z", skippedAt: null });
    const user = userEvent.setup();
    render(<OnboardingRoute />);
    await waitFor(() => screen.getByRole("button", { name: /start a run/i }));
    await user.click(screen.getByRole("button", { name: /start a run/i }));
    expect(push).toHaveBeenCalledWith("/runs/new");
  });

  it("navigates to the example Run", async () => {
    writeProgress({ step: "complete", acknowledgedAt: "2026-08-28T00:00:00Z", skippedAt: null });
    const user = userEvent.setup();
    render(<OnboardingRoute />);
    await waitFor(() => screen.getByRole("button", { name: /view example run/i }));
    await user.click(screen.getByRole("button", { name: /view example run/i }));
    expect(push).toHaveBeenCalledWith("/runs/example");
  });
});

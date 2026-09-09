import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import BoostLandingPage from "./page";

const ok = { ok: true as const, data: { status: "ok", latencyMs: 1, uptime: 1, timestamp: "" } };
vi.mock("@/lib/api-client", () => ({
  apiClient: {
    dbHealth: async () => ok,
  },
}));

describe("BoostLandingPage route (/boost)", () => {
  it("renders LandingPage with preloader", async () => {
    const page = await BoostLandingPage();
    render(page);

    expect(
      screen.getByRole("region", { name: /aura memory preloader sequence/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 1, name: /autonomous agents that/i }),
    ).toBeInTheDocument();
  });
});

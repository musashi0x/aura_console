import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { expectNoAxeViolations } from "@/test-support/axe";
import { LandingPage } from "../components/landing-page";

describe("LandingPage architecture", () => {
  it("renders the hero headline and mission telemetry console", () => {
    render(<LandingPage ready />);
    expect(
      screen.getByRole("heading", { level: 1, name: /autonomous agents that/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/AURA CONSOLE — MISSION TELEMETRY/i)).toBeInTheDocument();
    expect(screen.getByText(/Session A \(Execution\)/i)).toBeInTheDocument();
  });

  it("renders the 5-tier dynamic storage Bento section", () => {
    const { container } = render(<LandingPage ready />);
    expect(
      screen.getByText(/5-Tier Dynamic Storage/i),
    ).toBeInTheDocument();
    expect(container.querySelector("#architecture")).toBeInTheDocument();
    expect(container.querySelector("#storage-tiers")).toBeInTheDocument();
  });

  it("renders the counterfactual decision matrix", () => {
    const { container } = render(<LandingPage ready />);
    expect(
      screen.getByText(/CAUSAL REPLAY & COUNTERFACTUAL MATRIX/i),
    ).toBeInTheDocument();
    expect(container.querySelector("#replay-matrix")).toBeInTheDocument();
  });

  it("renders the FAQ and How It Works sections", () => {
    render(<LandingPage ready />);
    expect(
      screen.getByRole("heading", { name: /frequently asked questions/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /how aura works/i }),
    ).toBeInTheDocument();
  });
});

describe("honesty and live readiness", () => {
  it("reports readiness from the real check rather than asserting it", () => {
    const { rerender } = render(<LandingPage ready />);
    expect(screen.getByText("SYSTEM READY")).toBeInTheDocument();
    rerender(<LandingPage ready={false} />);
    expect(screen.queryByText("SYSTEM READY")).not.toBeInTheDocument();
    expect(screen.getByText("SYSTEM DEGRADED")).toBeInTheDocument();
  });

  it("provides links to Console runs and GitHub repository", () => {
    render(<LandingPage ready />);
    const consoleLinks = screen.getAllByRole("link", { name: /console/i });
    expect(consoleLinks.some((l) => l.getAttribute("href") === "/runs")).toBe(true);

    const ghLinks = screen.getAllByRole("link", { name: /github/i });
    expect(
      ghLinks.some(
        (l) =>
          l.getAttribute("href") === "https://github.com/musashi0x/aura_memory",
      ),
    ).toBe(true);
  });
});

describe("accessibility", () => {
  it("has no axe violations", async () => {
    const { container } = render(<LandingPage ready />);
    await expectNoAxeViolations(container);
  });

  it("provides a skip link pointing to #main", () => {
    const { container } = render(<LandingPage ready />);
    const skipLink = container.querySelector(".skip-link");
    expect(skipLink).toBeInTheDocument();
    expect(skipLink).toHaveAttribute("href", "#main");
  });
});

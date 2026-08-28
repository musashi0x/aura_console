import { act, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { expectNoAxeViolations } from "@/test/axe";

import { landing } from "../copy";
import { LandingPage } from "./landing-page";

describe("structure", () => {
  it("presents a hero and at least four scrollable sections", () => {
    const { container } = render(<LandingPage ready />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/see what your agents/i);
    // Hero, preview, three capabilities, replay, CTA.
    expect(container.querySelectorAll("section").length).toBeGreaterThanOrEqual(5);
  });

  it("numbers the capability sections and gives each a scroll anchor", () => {
    const { container } = render(<LandingPage ready />);
    for (const index of ["01", "02", "03", "04"]) {
      const section = container.querySelector(`#section-${index}`);
      expect(section).toBeInTheDocument();
      // The number is inside its own section, not just somewhere on the page.
      expect(within(section as HTMLElement).getByText(index)).toBeInTheDocument();
    }
  });

  it("closes with the non-mainnet footer", () => {
    render(<LandingPage ready />);
    expect(screen.getByText("NON-MAINNET DEMO")).toBeInTheDocument();
    expect(screen.getByText("NO ECONOMIC ACTION EXECUTED")).toBeInTheDocument();
  });
});

describe("honesty", () => {
  it("labels the preview as static and says it is not a Run", () => {
    render(<LandingPage ready />);
    expect(screen.getByText("STATIC PREVIEW")).toBeInTheDocument();
    expect(screen.getByText(/not live data and not a run/i)).toBeInTheDocument();
  });

  it("reports system readiness from the real check rather than asserting it", () => {
    const { rerender } = render(<LandingPage ready />);
    expect(screen.getByText("SYSTEM READY")).toBeInTheDocument();
    rerender(<LandingPage ready={false} />);
    // A decorative badge would still say READY here. This one must not.
    expect(screen.queryByText("SYSTEM READY")).not.toBeInTheDocument();
    expect(screen.getByText("SYSTEM DEGRADED")).toBeInTheDocument();
  });

  it("keeps not-checked dependencies distinguishable from verified ones", () => {
    render(<LandingPage ready />);
    const section = document.querySelector("#section-03") as HTMLElement;
    expect(within(section).getAllByText("VERIFIED")).toHaveLength(2);
    expect(within(section).getAllByText("NOT CHECKED")).toHaveLength(2);
  });

  it("states that following a call to action creates nothing", () => {
    render(<LandingPage ready />);
    expect(screen.getByText(/nothing is created and no economic action runs/i)).toBeInTheDocument();
  });

  it("invents no account, pricing, or testimonial surface", () => {
    const { container } = render(<LandingPage ready />);
    const text = container.textContent ?? "";
    expect(text).not.toMatch(/sign in|log in|sign up|pricing|per month|\$\d|testimonial|trusted by/i);
  });
});

describe("links", () => {
  it("points both example actions at the example Run route", () => {
    render(<LandingPage ready />);
    for (const link of screen.getAllByRole("link", { name: /example run/i })) {
      expect(link).toHaveAttribute("href", "/runs/example");
    }
  });

  it("points the new Run action at the Run route", () => {
    render(<LandingPage ready />);
    expect(screen.getByRole("link", { name: landing.cta.primary })).toHaveAttribute(
      "href",
      "/runs/new",
    );
  });
});

describe("reduced motion", () => {
  it("never enters the pending state when the operator asks for reduced motion", async () => {
    const { setReducedMotion } = await import("@/test/setup");
    setReducedMotion(true);
    const { container } = render(<LandingPage ready />);
    expect(container.querySelectorAll('[data-reveal="pending"]')).toHaveLength(0);
  });
});

describe("reveal", () => {
  it("reveals a section that scrolls into view", async () => {
    const { fireIntersection } = await import("@/test/setup");
    const { container } = render(<LandingPage ready />);
    act(() => fireIntersection({ isIntersecting: true, top: 200 }));
    expect(container.querySelectorAll('[data-reveal="pending"]')).toHaveLength(0);
  });

  it("reveals a section the viewport jumped past without intersecting", async () => {
    const { fireIntersection } = await import("@/test/setup");
    const { container } = render(<LandingPage ready />);
    // An in-page anchor or a restored scroll position can skip an element
    // entirely. It must not be stranded at opacity 0 forever.
    act(() => fireIntersection({ isIntersecting: false, top: -900 }));
    expect(container.querySelectorAll('[data-reveal="pending"]')).toHaveLength(0);
  });

  it("keeps a section below the fold pending until it is reached", async () => {
    const { fireIntersection } = await import("@/test/setup");
    const { container } = render(<LandingPage ready />);
    act(() => fireIntersection({ isIntersecting: false, top: 1200 }));
    expect(container.querySelectorAll('[data-reveal="pending"]').length).toBeGreaterThan(0);
  });
});

describe("accessibility", () => {
  it("has no axe violations", async () => {
    const { container } = render(<LandingPage ready />);
    await expectNoAxeViolations(container);
  });

  it("gives every section an accessible name", () => {
    const { container } = render(<LandingPage ready />);
    for (const section of container.querySelectorAll("section")) {
      expect(section).toHaveAttribute("aria-labelledby");
    }
  });
});

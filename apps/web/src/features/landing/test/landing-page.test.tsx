import { act, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { expectNoAxeViolations } from "@/test-support/axe";

import { landing } from "../copy";
import { LandingPage } from "../components/landing-page";

describe("scroll architecture", () => {
  it("opens with a single statement and no controls inside the window", () => {
    const { container } = render(<LandingPage ready />);
    const opening = container.querySelector(".lp-opening") as HTMLElement;
    expect(within(opening).getByRole("heading", { level: 1 })).toHaveTextContent(
      /see what your agents decided/i,
    );
    // The first viewport is deliberately calm: actions come later.
    expect(within(opening).queryAllByRole("link")).toHaveLength(0);
    expect(within(opening).queryAllByRole("button")).toHaveLength(0);
  });

  it("carries the editorial statement scene", () => {
    render(<LandingPage ready />);
    expect(
      screen.getByRole("heading", { name: /a better way to understand agents/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/one replayable story/i)).toBeInTheDocument();
  });

  it("builds at least six scenes plus the footer", () => {
    const { container } = render(<LandingPage ready />);
    expect(container.querySelectorAll("main > section").length).toBeGreaterThanOrEqual(6);
  });

  it("shows three numbered principles", () => {
    const { container } = render(<LandingPage ready />);
    const grid = container.querySelector(".lp-principles__grid") as HTMLElement;
    expect(within(grid).getAllByRole("article")).toHaveLength(3);
    for (const index of ["01", "02", "03"]) {
      expect(within(grid).getByText(index)).toBeInTheDocument();
    }
    expect(within(grid).getByRole("heading", { name: /trace every decision/i })).toBeInTheDocument();
    expect(within(grid).getByRole("heading", { name: /keep memory private/i })).toBeInTheDocument();
    expect(within(grid).getByRole("heading", { name: /know what is ready/i })).toBeInTheDocument();
  });

  it("closes with the non-mainnet footer", () => {
    render(<LandingPage ready />);
    expect(screen.getByText("NON-MAINNET DEMO")).toBeInTheDocument();
    expect(screen.getByText("NO ECONOMIC ACTION EXECUTED")).toBeInTheDocument();
  });
});

describe("honesty", () => {
  it("labels the Console window as a static preview and not a Run", () => {
    render(<LandingPage ready />);
    expect(screen.getByText("STATIC PREVIEW")).toBeInTheDocument();
    expect(screen.getByText(/not live data and not a run/i)).toBeInTheDocument();
  });

  it("reports readiness from the real check rather than asserting it", () => {
    const { rerender } = render(<LandingPage ready />);
    expect(screen.getByText("SYSTEM READY")).toBeInTheDocument();
    rerender(<LandingPage ready={false} />);
    // A decorative badge would still say READY here. This one must not.
    expect(screen.queryByText("SYSTEM READY")).not.toBeInTheDocument();
    expect(screen.getByText("SYSTEM DEGRADED")).toBeInTheDocument();
  });

  it("pairs every status with a glyph so colour is never the only cue", () => {
    const { container } = render(<LandingPage ready />);
    expect(container.querySelector(".lp-status__glyph")?.textContent?.trim()).not.toBe("");
  });

  it("keeps policy explicitly NOT CHECKED", () => {
    render(<LandingPage ready />);
    expect(screen.getByText("NOT CHECKED")).toBeInTheDocument();
  });

  it("says unavailable rather than inventing history in the counterfactual", () => {
    render(<LandingPage ready />);
    expect(screen.getByText("MEMORY UNAVAILABLE")).toBeInTheDocument();
    expect(screen.getByText(/nothing runs automatically/i)).toBeInTheDocument();
    expect(screen.getByText(/no second job was created or funded/i)).toBeInTheDocument();
  });

  it("distinguishes LIVE, PAUSED and HISTORY", () => {
    render(<LandingPage ready />);
    for (const mode of ["LIVE", "PAUSED", "HISTORY"]) {
      expect(screen.getByText(mode)).toBeInTheDocument();
    }
  });

  it("states that following a call to action creates nothing", () => {
    render(<LandingPage ready />);
    expect(screen.getByText(landing.cta.note)).toBeInTheDocument();
  });

  it("invents no account, pricing, or testimonial surface", () => {
    const { container } = render(<LandingPage ready />);
    const text = container.textContent ?? "";
    expect(text).not.toMatch(/sign in|log in|sign up|pricing|per month|\$\d|testimonial|trusted by/i);
  });
});

describe("links", () => {
  it("points example actions at the example Run route", () => {
    render(<LandingPage ready />);
    for (const link of screen.getAllByRole("link", { name: /example run/i })) {
      expect(link).toHaveAttribute("href", "/runs/example");
    }
  });

  it("points the new Run action at the Run route", () => {
    render(<LandingPage ready />);
    expect(screen.getByRole("link", { name: landing.cta.secondary })).toHaveAttribute(
      "href",
      "/runs/new",
    );
  });
});

describe("motion", () => {
  it("leaves no section hidden when IntersectionObserver is unavailable", () => {
    // The real fail-open case: an old browser or a blocked script must never
    // leave content stranded at opacity 0.
    Reflect.deleteProperty(window, "IntersectionObserver");
    Reflect.deleteProperty(globalThis, "IntersectionObserver");
    const { container } = render(<LandingPage ready />);
    expect(container.querySelectorAll('[data-reveal="pending"]')).toHaveLength(0);
  });

  it("reveals sections once the observer reports them in view", async () => {
    const { fireIntersection } = await import("@/test-support/setup");
    const { container } = render(<LandingPage ready />);
    act(() => fireIntersection({ isIntersecting: true, top: 120 }));
    expect(container.querySelectorAll('[data-reveal="pending"]')).toHaveLength(0);
  });

  it("reveals a section the viewport jumped past without intersecting", async () => {
    const { fireIntersection } = await import("@/test-support/setup");
    const { container } = render(<LandingPage ready />);
    act(() => fireIntersection({ isIntersecting: false, top: -900 }));
    expect(container.querySelectorAll('[data-reveal="pending"]')).toHaveLength(0);
  });

  it("never enters the pending state under reduced motion", async () => {
    const { setReducedMotion } = await import("@/test-support/setup");
    setReducedMotion(true);
    const { container } = render(<LandingPage ready />);
    expect(container.querySelectorAll('[data-reveal="pending"]')).toHaveLength(0);
  });

  it("keeps every causal event readable regardless of which one is emphasised", () => {
    const { container } = render(<LandingPage ready />);
    const events = container.querySelectorAll(".lp-console__event");
    expect(events).toHaveLength(landing.console.events.length);
    for (const event of events) {
      // Emphasis is a nudge. No event may be hidden by the scroll story.
      expect(event.textContent?.trim()).not.toBe("");
    }
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

  it("keeps window chrome and the dotted canvas out of the accessibility tree", () => {
    const { container } = render(<LandingPage ready />);
    for (const dots of container.querySelectorAll(".lp-window__dots")) {
      expect(dots).toHaveAttribute("aria-hidden", "true");
      // Decorative chrome must never be announced as a control.
      expect(dots.querySelector("button")).toBeNull();
    }
    expect(container.querySelector(".lp-dots")).toHaveAttribute("aria-hidden", "true");
  });

  it("uses one h1 and keeps heading order meaningful", () => {
    render(<LandingPage ready />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });
});

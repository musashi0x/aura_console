import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { describe, expect, it } from "vitest";

// Inlined by vitest.config.ts (`define`) — see cssRaw there.
declare const __GLOBALS_CSS__: string;

import { OnboardingFlow } from "./onboarding-flow";

const css = __GLOBALS_CSS__;

/**
 * The boot-sequence pass is visual only. These assertions guard the one thing a
 * visual pass can quietly break: a decorative layer becoming load bearing, or a
 * status losing the cue that does not depend on colour.
 */
describe("boot sequence decoration", () => {
  it("names the surface without claiming any state", () => {
    render(<OnboardingFlow />);
    const banner = screen.getByText(/AURA CONSOLE \/\/ BOOT SEQUENCE/i);
    // Decoration is hidden from assistive technology: it reports nothing, so
    // reading it aloud would only add noise before the real heading.
    expect(banner).toHaveAttribute("aria-hidden", "true");
  });

  it("removes the glow entirely under reduced motion", () => {
    const start = css.indexOf(".onboarding-shell::before");
    const block = css.slice(start);
    expect(block).toMatch(
      /@media \(prefers-reduced-motion: reduce\) \{\s*\.onboarding-shell::before \{\s*display: none/,
    );
  });

  it("does not bleed sideways, which would scroll the page at 375px", () => {
    const start = css.indexOf(".onboarding-shell::before");
    const rule = css.slice(start, css.indexOf("}", start));
    const inset = /inset:\s*([^;]+);/.exec(rule)?.[1]?.trim() ?? "";
    const [, right, , left] = inset.split(/\s+/);
    // `inset` is top right bottom left. Bleeding up is the effect; bleeding
    // sideways pushed the layer past the viewport and scrolled the document.
    expect(right).not.toMatch(/^-/);
    expect(left).not.toMatch(/^-/);
  });

  it("keeps the glow behind content and out of the pointer path", () => {
    const start = css.indexOf(".onboarding-shell::before");
    const rule = css.slice(start, css.indexOf("}", start));
    // If decoration ever intercepted a click it would stop being decoration.
    expect(rule).toMatch(/pointer-events: none/);
    expect(rule).toMatch(/z-index: -1/);
  });
});

describe("readiness rows stay readable without colour", () => {
  it("carries a glyph and a word beside the status rule", async () => {
    const user = userEvent.setup();
    render(<OnboardingFlow />);
    await user.click(await screen.findByRole("button", { name: /check readiness/i }));

    const rows = await screen.findAllByRole("listitem");
    const statuses = rows.filter((row) => row.className.includes("readiness__row"));
    expect(statuses.length).toBeGreaterThan(0);

    for (const row of statuses) {
      // Every row states its status in words; the border tint is a second cue.
      expect(row.textContent).toMatch(/Checking|Ready|Unavailable|Not checked/);
    }
  });

  it("gives the not-checked state a style of its own rather than a default", () => {
    expect(css).toMatch(/\.readiness__state--not_checked \{[^}]*border-style: dashed/);
  });

  it("numbers the rows as a sequence, hidden from assistive technology", async () => {
    const user = userEvent.setup();
    render(<OnboardingFlow />);
    await user.click(await screen.findByRole("button", { name: /check readiness/i }));
    const ordinals = document.querySelectorAll(".readiness__ordinal");
    expect(ordinals.length).toBeGreaterThan(0);
    for (const ordinal of ordinals) {
      // The order is already conveyed by the list; the ordinal is atmosphere.
      expect(ordinal).toHaveAttribute("aria-hidden", "true");
    }
  });
});

describe("mobile", () => {
  it("stacks the stepper labels away at 375px without dropping them from the tree", () => {
    const start = css.indexOf(".onboarding__step-label");
    const block = css.slice(start);
    const media = block.slice(block.indexOf("@media (max-width: 40rem)"));
    // Clipped, not display:none — a screen reader still names each step.
    expect(media).toMatch(/clip-path: inset\(50%\)/);
    expect(media).not.toMatch(/\.onboarding__step-label \{[^}]*display: none/);
  });
});

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const here = path.dirname(fileURLToPath(import.meta.url));
const tokens = readFileSync(path.join(here, "tokens.css"), "utf8");
const globals = readFileSync(path.join(here, "../app/globals.css"), "utf8");

function value(name: string): string {
  const match = tokens.match(new RegExp(`--${name}:\\s*([^;]+);`));
  if (!match) throw new Error(`token --${name} is not defined`);
  return match[1]!.trim();
}

function channel(part: number): number {
  const c = part / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const clean = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(clean.slice(i, i + 2), 16));
  return 0.2126 * channel(r!) + 0.7152 * channel(g!) + 0.0722 * channel(b!);
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

describe("token layer is the single source of colour", () => {
  it("leaves no literal hex colour in the global stylesheet", () => {
    expect(globals.match(/#[0-9a-fA-F]{3,8}\b/g)).toBeNull();
  });

  it("keeps the token file as the only place raw colours are declared", () => {
    expect(tokens).toMatch(/--color-canvas:\s*#05070d/i);
  });
});

describe("contrast", () => {
  const canvas = value("color-canvas");
  const surface = value("color-surface");

  // Colours that carry text. Violet is deliberately absent: it is a glow and
  // edge accent only, because it does not reach AA at body sizes on this canvas.
  const textTones = ["color-text", "color-text-muted", "color-success", "color-warning", "color-error", "color-cyan"];

  for (const tone of textTones) {
    it(`${tone} meets WCAG AA on the canvas`, () => {
      expect(contrast(value(tone), canvas)).toBeGreaterThanOrEqual(4.5);
    });

    it(`${tone} meets WCAG AA on a surface`, () => {
      expect(contrast(value(tone), surface)).toBeGreaterThanOrEqual(4.5);
    });
  }

  it("does not use violet as a text colour anywhere", () => {
    // If this fails, either the usage or the exclusion above is wrong.
    expect(globals).not.toMatch(/color:\s*var\(--color-violet\)/);
  });
});

describe("fonts degrade without a network", () => {
  it("ends both stacks in a generic family", () => {
    expect(value("font-sans")).toMatch(/sans-serif$/);
    expect(value("font-mono")).toMatch(/monospace$/);
  });

  it("loads no webfont from the stylesheet", () => {
    expect(globals).not.toMatch(/@import\s+url|fonts\.googleapis|@font-face/);
  });
});

describe("links", () => {
  it("does not fall back to the user agent blue, which is outside the token layer", () => {
    expect(globals).toMatch(/a:not\(\.btn\)\s*\{[^}]*color:\s*var\(--color-cyan\)/);
  });
});

describe("landing surface", () => {
  it("does not let the Console cyan leak into landing links", () => {
    // The global anchor rule is Console-scoped; the landing needs its own ink
    // or the header renders cyan on an off-white canvas.
    expect(globals).toMatch(/\.lp a:not\(\.lp-btn\)\s*\{[^}]*color:\s*var\(--landing-ink\)/);
  });

  it("keeps landing buttons out of the global anchor colour", () => {
    // `a:not(.btn)` matches `.lp-btn` too and out-specifies a bare class.
    expect(globals).toMatch(/\.lp a\.lp-btn\s*\{[^}]*color:\s*var\(--landing-ink\)/);
    expect(globals).toMatch(/\.lp a\.lp-btn--primary\s*\{[^}]*color:\s*var\(--landing-surface\)/);
  });

  it("keeps Console navigation out of the global anchor colour", () => {
    // Same specificity trap as the landing buttons: `a:not(.btn)` beats a bare
    // class, so nav links would render accent cyan instead of muted.
    expect(globals).toMatch(/\.cs a\.cs__nav-link[\s\S]{0,120}color:\s*var\(--color-text-muted\)/);
  });

  it("paints the document itself on the landing route so overscroll is not dark", () => {
    // Without this the Console canvas shows through when rubber-band scrolling
    // past the top or bottom of the light page.
    expect(globals).toMatch(/html:has\(\.lp\)[\s\S]{0,80}background:\s*var\(--landing-canvas\)/);
  });

  it("keeps landing ink and muted text readable on the landing canvas", () => {
    const canvas = value("landing-canvas");
    expect(contrast(value("landing-ink"), canvas)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(value("landing-muted"), canvas)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(value("landing-ok"), canvas)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(value("landing-bad"), canvas)).toBeGreaterThanOrEqual(4.5);
  });
});

describe("reduced motion", () => {
  it("strips the backdrop and the glow", () => {
    const block = globals.slice(globals.indexOf("@media (prefers-reduced-motion: reduce)"));
    expect(block).toContain(".backdrop");
    expect(block).toContain(".panel--active");
  });
});


describe("the first-run banner belongs to the light layer", () => {
  // FirstRunGate renders on `/`, which is the bright editorial landing, but it
  // was built from the Console's `.banner` and `.btn` classes. Those resolve
  // `--fg` to the dark layer's near-white text, so "Not now" rendered at
  // 1.03:1 on the landing canvas: present in the DOM, invisible to a reader,
  // and worst on a phone where it is the only way out of the banner.
  it("draws its text from landing tokens, not Console tokens", () => {
    const block = globals.slice(globals.indexOf(".banner {"));
    const banner = block.slice(0, block.indexOf("}"));
    expect(banner).toMatch(/--landing-/);
    expect(banner).not.toMatch(/var\(--fg\)|var\(--border\)(?!-)/);
  });

  it("gives its dismiss action AA contrast against the landing surface", () => {
    // The dismiss action is the one a reader needs when they do not want the
    // tour. It must clear AA, not merely exist.
    expect(contrast(value("landing-ink"), value("landing-surface"))).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps both banner actions at the 44px touch minimum", () => {
    const block = globals.slice(globals.indexOf(".banner .btn"));
    expect(block.slice(0, 200)).toMatch(/min-height:\s*44px/);
  });
});

# Layout and visual system

## What

Global metadata, design tokens, and CSS define two distinct visual layers: a
bright editorial surface for the public landing page, and a dark operational
surface for Console UI and the embedded Run preview.

## Where

- `apps/web/src/app/layout.tsx` — `metadata`, `RootLayout`, the skip link, and
  the decorative `.backdrop`.
- `apps/web/src/styles/tokens.css` — `--color-*` Console tokens and
  `--landing-*` editorial tokens, plus spacing, radii, and type scale.
- `apps/web/src/app/globals.css` — primitive styles, onboarding styles, and the
  `.lp-*` landing styles.
- `apps/web/src/components/primitives/` — `Panel`, `StatusBadge`, `MonoRef`,
  `EmptyState`, `Button`.
- `apps/web/src/styles/test/tokens.test.ts` — asserts no literal hex outside the
  token layer, WCAG AA contrast for both layers, and no webfont fetch.
- `docs/product/visual-system.md` — the approved visual requirements.

## Approach

Every colour resolves from a token; a literal hex outside `tokens.css` is a bug
and the token test fails on it. State never depends on colour alone, so each
status pairs a glyph with its tone. Fonts fall back to system stacks with no
webfont request, so an offline demo never blocks on a font.

Violet is a glow and edge accent only. It does not reach WCAG AA as body text on
the Console canvas, and a test fails if it is used as a text colour.

Reduced motion removes glow, reveal motion, and sticky behaviour without
removing any content or state.

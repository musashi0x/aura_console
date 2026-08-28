# Landing page

## What

The root route renders a bright editorial scrolling landing page for a
returning operator. A browser that has neither acknowledged nor skipped
onboarding is redirected to `/onboarding` instead. The dark Console styling
appears only inside the embedded product preview.

## Where

- `apps/web/src/app/page.tsx` — `HomePage`; `dynamic = "force-dynamic"`; calls
  `apiClient.dbHealth()` and renders `FirstRunGate` and `LandingPage`.
- `apps/web/src/features/landing/components/landing-page.tsx` — `LandingPage`;
  composes the scenes and the decorative `.lp-dots` canvas.
- `apps/web/src/features/landing/components/site-header.tsx` — `SiteHeader`;
  takes `ready` and renders `SYSTEM READY` or `SYSTEM DEGRADED`.
- `apps/web/src/features/landing/components/opening-window.tsx` — `OpeningWindow`.
- `apps/web/src/features/landing/components/editorial-statement.tsx` — `EditorialStatement`.
- `apps/web/src/features/landing/components/principles-grid.tsx` — `PrinciplesGrid`.
- `apps/web/src/features/landing/components/console-story.tsx` — `ConsoleStory`;
  `IntersectionObserver` over hidden markers drives `activeIndex`.
- `apps/web/src/features/landing/components/console-preview.tsx` — `ConsolePreview`;
  the dark Run preview, `activeIndex` changes emphasis only.
- `apps/web/src/features/landing/components/replay-counterfactual.tsx` — `ReplayCounterfactual`.
- `apps/web/src/features/landing/components/final-cta.tsx` — `FinalCta`.
- `apps/web/src/features/landing/components/site-footer.tsx` — `SiteFooter`.
- `apps/web/src/features/landing/components/reveal.tsx` — `Reveal`; fail-open
  reveal-on-scroll.
- `apps/web/src/features/landing/copy.ts` — `landing`; every user-visible string.
- `apps/web/src/app/globals.css` — `.lp` and `.lp-*` selectors.
- `apps/web/src/styles/tokens.css` — `--landing-*` tokens.

## Relationship to onboarding

`apps/web/src/features/onboarding/components/first-run-gate.tsx` — `FirstRunGate`
reads browser-local progress through
`apps/web/src/features/onboarding/acknowledgement.ts` (`readProgress`,
`hasAcknowledged`). It redirects only when the operator has neither
acknowledged nor skipped, so a skip is respected and cannot loop. Do not change
this behaviour from landing work.

## Approach

Two visual layers. The page canvas is the editorial `--landing-*` scale; the
Console preview keeps the dark `--color-*` scale. Landing links need
`.lp a:not(.lp-btn)` and `.lp a.lp-btn` because the global `a:not(.btn)` rule
also matches `.lp-btn` and out-specifies a bare class. `html:has(.lp)` repaints
the document so overscroll does not flash the Console canvas.

Emphasis in the causal story is a nudge, never a reveal: inactive events sit at
reduced opacity, never hidden, so nothing requires scrolling or JavaScript to be
readable.

All preview content is static and labelled. Do not wire it to real data, invent
endpoints, or add auth, workspace, or economic state here; the real Run surface
is tracked separately.

## Tests

- `apps/web/src/features/landing/components/landing-page.test.tsx` — scenes,
  honesty labelling, readiness, links, motion, accessibility.
- `apps/web/src/styles/tokens.test.ts` — token hygiene, contrast, landing link
  scoping, overscroll rule.

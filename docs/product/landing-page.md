# Landing page

The landing page is the root route of Aura Console. It is the entry point for a
returning operator; a genuinely new browser is still routed through onboarding
first. It is a public product surface, not an authenticated workspace.

Implemented in [PR #4](https://github.com/musashi0x/aura_console/pull/4) under
Tracking task #64.

## Purpose

Explain, in one scroll, what Aura Console does and why an agent's decision can
be inspected and replayed. The page has to do that without implying anything the
product cannot do yet: no account, no live Run, no economic action.

## Visual direction

Two related layers, deliberately different:

| Layer | Where | Character |
|---|---|---|
| Editorial | the page canvas | Warm off-white, dotted texture, oversized typography, generous whitespace |
| Operational | inside the Console window only | Dark Antigravity Terminal surface, monospace metadata |

The contrast between them is the point. The page must not become a dark terminal
dashboard, and the Console preview must not become a light marketing card.

## Scroll architecture

Seven scenes, one per idea.

| # | Scene | Component | Content |
|---|---|---|---|
| 1 | Opening | `OpeningWindow` | A large floating window holding one statement and **no controls** |
| 2 | Statement | `EditorialStatement` | "A better way to understand agents." |
| 3 | Principles | `PrinciplesGrid` | `01` trace the decision, `02` keep memory private, `03` know what is ready |
| 4 | Console reveal | `ConsoleStory` | The dark product window enters the bright page |
| 5 | Causal story | `ConsoleStory` + `ConsolePreview` | Five events take turns being emphasised while the window is sticky |
| 6 | Replay | `ReplayCounterfactual` | LIVE / PAUSED / HISTORY, and the memory counterfactual |
| 7 | Close | `FinalCta` + `SiteFooter` | Calls to action and the non-mainnet footer |

The opening scene carries no buttons on purpose. Every action appears later,
after the story has been told.

## Component map

All under `apps/web/src/features/landing/`.

| File | Export | Responsibility |
|---|---|---|
| `components/landing-page.tsx` | `LandingPage` | Composes the scenes and the decorative canvas |
| `components/site-header.tsx` | `SiteHeader` | Mark, real readiness status, example Run link |
| `components/opening-window.tsx` | `OpeningWindow` | Scene 1 |
| `components/editorial-statement.tsx` | `EditorialStatement` | Scene 2 |
| `components/principles-grid.tsx` | `PrinciplesGrid` | Scene 3 |
| `components/console-story.tsx` | `ConsoleStory` | Scenes 4 and 5, sticky window and event emphasis |
| `components/console-preview.tsx` | `ConsolePreview` | The dark Run preview, `activeIndex` prop |
| `components/replay-counterfactual.tsx` | `ReplayCounterfactual` | Scene 6 |
| `components/final-cta.tsx` | `FinalCta` | Scene 7 actions |
| `components/site-footer.tsx` | `SiteFooter` | Non-mainnet footer |
| `components/reveal.tsx` | `Reveal` | Fail-open reveal-on-scroll wrapper |
| `copy.ts` | `landing` | Every user-visible string |

Copy lives in `copy.ts` rather than in layout components so the honesty
boundary is reviewable in one file.

Mounted by `apps/web/src/app/page.tsx`, alongside
`FirstRunGate` from `apps/web/src/features/onboarding/components/first-run-gate.tsx`.

## Token map

Landing tokens are defined in `apps/web/src/styles/tokens.css` and are separate
from the Console scale.

| Token | Value | Role |
|---|---|---|
| `--landing-canvas` | `#F3F4F1` | Page canvas |
| `--landing-surface` | `#FAFAF8` | Floating window |
| `--landing-ink` | `#111214` | Primary text |
| `--landing-muted` | `#696D73` | Secondary text |
| `--landing-line` | `rgba(17, 18, 20, 0.12)` | Hairlines and borders |
| `--landing-dot` | `rgba(17, 18, 20, 0.09)` | Dotted canvas |
| `--landing-dot-gap` | `24px` | Dot spacing |
| `--landing-shadow` | `0 30px 90px rgba(22, 27, 38, 0.13)` | Window elevation |
| `--landing-ok` | `#1F7A52` | Readiness ready |
| `--landing-bad` | `#A3323F` | Readiness degraded |

The Console success and error tones do not reach WCAG AA on an off-white
surface, which is why `--landing-ok` and `--landing-bad` exist. The dark Console
tokens are unchanged and are documented in [Visual system](visual-system.md).

Two cascade traps are handled explicitly in `apps/web/src/app/globals.css`:

- The global `a:not(.btn)` rule paints links Console cyan. Landing links are
  scoped with `.lp a:not(.lp-btn)`, and landing buttons need `.lp a.lp-btn`
  because `a:not(.btn)` also matches `.lp-btn` and out-specifies a bare class.
- The document background is the Console canvas, so `html:has(.lp)` and
  `body:has(.lp)` repaint it, otherwise overscroll flashes dark behind the
  light page.

## Typography

| Role | Size |
|---|---|
| Opening statement | `clamp(1.75rem, 3.6vw, 3.25rem)` |
| Display heading | `clamp(3rem, 7vw, 7.5rem)` |
| Small display | `clamp(2.25rem, 4.6vw, 4.5rem)` |
| Principle title | `clamp(1.5rem, 2.4vw, 2.25rem)` |
| Body | `1rem` to `1.125rem` |
| Operational metadata | `0.6875rem` to `0.75rem`, monospace |

Sans-serif carries the statements; monospace is reserved for Run IDs, event
sequence, status, and endpoints.

## Responsive rules

| Viewport | Behaviour |
|---|---|
| 1280 and above | Three-column principles, sticky Console story, window `min(72vw, 1080px)` |
| 768 to 1279 | Window `calc(100vw - 64px)`; principles drop to two columns below 1024 |
| Below 768 | Single column, window `calc(100vw - 32px)`, sticky degrades to a static stacked timeline, status rows wrap, header keeps the mark and readiness only |

Minimum interactive target height is 44px, including the brand mark.

## Motion

Allowed: opacity, small `translateY`, subtle scale, a sticky product window, and
progressive event emphasis. Not used: parallax, scroll hijacking, custom
cursors, continuous particles, or typing animations.

`Reveal` fails open. Content renders visible on the server and stays visible
without JavaScript; the pending state is applied only on the client, and only
when the operator has not requested reduced motion. It also reveals anything the
viewport has already scrolled past, because `IntersectionObserver` alone can be
skipped by an in-page anchor or a restored scroll position.

Under `prefers-reduced-motion: reduce` the reveal never enters its pending
state, the sticky window becomes static, and event emphasis is disabled. No
content or state is lost.

## Accessibility

- Skip link preserved in `apps/web/src/app/layout.tsx`.
- Every `section` carries `aria-labelledby`.
- Split headings render one span per line, so each carries an explicit
  `aria-label`; the accessible-name algorithm drops whitespace-only text nodes
  between elements and would otherwise produce "A better wayto understand
  agents."
- Window chrome dots and the dotted canvas are `aria-hidden` and are never
  controls.
- Readiness pairs a glyph with its colour; no state relies on colour alone.
- One `h1`, on the opening statement.

## Honest-data rules

The landing page must never claim what the product cannot do.

- The Console window is labelled `STATIC PREVIEW` and says "Illustrative only.
  Not live data and not a Run."
- Header readiness comes from the real `apiClient.dbHealth()` result. It reads
  `SYSTEM READY` only on success and `SYSTEM DEGRADED` otherwise.
- Policy remains `NOT CHECKED`, because no policy endpoint exists.
- The counterfactual's unavailable side says unavailable rather than inventing
  history, and states that no second job was created or funded.
- The closing note says that following either call to action creates nothing.
- No authentication, pricing, testimonials, workspaces, or invented users. A
  test greps for all of them.

## Handoff into the Console

Both landing calls to action lead into the Console shell: the header and closing
primary action open `/runs/example`, the secondary action opens `/runs/new`. The
shell takes over the visual layer at that boundary, from the bright editorial
surface to the dark operational one, and states the environment and readiness
itself. Following either action still creates nothing; both destinations render
an explicit unavailable state until the run skeleton (task #30) lands. The
Console shell is documented in [console-shell.md](../ai/web/console-shell.md).

## Known gaps

- The Console preview is static. Real Run data depends on the run skeleton
  (task #30).
- `/runs/new` and `/runs/example` render the shell with an explicit
  unavailable state; real Run surfaces are task #61.
- No browser E2E coverage yet (task #60).
- The opening window is wider than the visual reference, which sits nearer 56%
  of viewport width. `min(72vw, 1080px)` was specified directly.

## Verification evidence

- `pnpm lint`, `pnpm typecheck`, `pnpm build` pass; 107 web tests across 8 files.
- Zero horizontal overflow measured at 1440x900, 1024x768, and 390x844.
- Reduced motion forced before hydration in a real browser: 8 reveal elements,
  0 pending, no event emphasis.
- No default browser colours remain; primary button contrast 17.93:1.
- Fresh browser profile redirects `/` to `/onboarding`; a returning operator
  gets the landing page.

Screenshots: [desktop](screenshots/landing-desktop-1440.png),
[closing call to action](screenshots/landing-desktop-cta.png),
[mobile](screenshots/landing-mobile-390.png).

## Tests

- `apps/web/src/features/landing/components/landing-page.test.tsx`
- `apps/web/src/styles/tokens.test.ts`

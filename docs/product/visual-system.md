# Visual system

Aura Console uses **two related layers**. Keeping them distinct is a product
decision, not a styling preference.

The line between them is **what a surface is for**, not which app it belongs to:

```
Editorial layer:    light, spacious      -> landing, onboarding, Operator, Board, drawers
Operational layer:  dark, monospace      -> Trace, and the landing page's Run preview
```

The product layer is light and approachable; the system layer is dark and
technical. Dark is a signal that the operator is looking at raw system
information — canonical events, receipts, tool calls — rather than the ambient
temperature of the whole Console.

This is a change. The Console was dark throughout, and the canonical UX spec
still says "dark-first operational canvas"; that document needs the same
correction. What changes is which surfaces claim which scale. Both scales
already exist and neither is being redefined.

Never turn the whole page into a dark terminal dashboard, and never lighten
Trace to match Operator: a reviewer reading raw events should be able to tell
at a glance that they left the product surface.

## Operational tokens

Defined in `apps/web/src/styles/tokens.css` as `--color-*`. These are Trace's
scale, and the Run preview's on the landing page.

| Role | Value |
|---|---|
| Canvas | `#05070D` |
| Elevated surface | `#0D1420` |
| Raised surface | `#111B2A` |
| Primary text | `#F4F7FB` |
| Muted text | `#8D9AAF` |
| Cyan accent | `#48D7FF` |
| Violet accent | `#9B6CFF` |
| Success | `#51E6A6` |
| Warning | `#FFBE63` |
| Error | `#FF6B7A` |

Violet is a glow and edge accent only. It does not reach WCAG AA as body text on
this canvas, and `apps/web/src/styles/tokens.test.ts` fails if it is used as a
text colour.

## Editorial tokens

Defined as `--landing-*`. The full table and the cascade traps are in
[Landing page](landing-page.md). The prefix is historical: these tokens now
carry Operator, Board and the drawers as well as the landing page, and the
naming should follow when those surfaces are built rather than being renamed
ahead of a consumer.

| Role | Value |
|---|---|
| Canvas | `#F3F4F1` |
| Floating window | `#FAFAF8` |
| Ink | `#111214` |
| Muted | `#696D73` |
| Hairline | `rgba(17, 18, 20, 0.12)` |
| Dot | `rgba(17, 18, 20, 0.09)`, 24px spacing |
| Window shadow | `0 30px 90px rgba(22, 27, 38, 0.13)` |
| Ready | `#1F7A52` |
| Degraded | `#A3323F` |

Readiness needs its own pair because the Console success and error tones fail
AA on an off-white surface.

## Floating window

The landing opening window is `min(72vw, 1080px)` wide and at least `68svh`
tall, with a 30px radius and three decorative chrome dots. The dots are
`aria-hidden` and are never controls. The dark Run preview reuses the same
window shell with the operational token scale.

## Typography

Sans-serif for statements and explanatory copy; monospace for Run IDs, event
IDs, timestamps, endpoints, and status metadata. Landing scale is documented in
[Landing page](landing-page.md). Both stacks end in a generic family and no
webfont is fetched, so an offline demo never blocks on a font.

## Components

Reuse layout and primitive patterns selectively: split layouts, sidebar and top
navigation, command palette, cards, badges, drawers, empty and error states, and
accessible form and focus primitives. Keep Aura-specific terminology and data.
Do not import generic auth screens, testimonials, account assumptions, or fake
users.

Shared primitives live in `apps/web/src/components/primitives/`.

## Motion and accessibility

Every colour resolves from a token; a literal hex outside the token layer fails
the token test. State never depends on colour alone. Every interactive element
has a visible focus state, a keyboard path, and a minimum 44px target,
including the landing brand mark.

`prefers-reduced-motion: reduce` removes glow, reveal motion, sticky behaviour,
and event emphasis without removing any content or state. Verified in a real
browser by forcing the media query before hydration.

That guarantee is a CSS rule, so it covers CSS animation only. Anything that
animates in JavaScript — a `requestAnimationFrame` loop, canvas, WebGL, spring
physics — bypasses it entirely and has to check `matchMedia` itself. Prefer CSS
motion for that reason, and treat a JS-driven effect as owing its own
reduced-motion path before it ships.

## Borrowed motion

A third-party animation library may decorate a surface that carries no
operational claim: the landing, onboarding, a readiness check still in flight.
It may not decorate a surface that reports a Run — which now includes every
card in Operator, every column in Board, and all of Trace.

Two rules make that concrete. Continuous motion — pulsing, flowing, anything
that redraws forever — is never used anywhere in the Console, because Aura shows
recorded Runs on a non-mainnet demo and perpetual motion reads as something
executing. And borrowed CSS arrives with hardcoded colours, which the token test
rejects outright; it is rewritten against tokens or it does not land.

The evaluation, the accepted and rejected components, and the acceptance
criteria are in [React Bits](../ai/web/react-bits.md).

On the landing route `html:has(.lp)` repaints the document background, otherwise
overscroll flashes the Console canvas behind the light page.

Below 768px the landing header keeps the mark and the readiness signal only; the
example Run link is duplicated by the closing call to action and three items
wrap badly at that width.

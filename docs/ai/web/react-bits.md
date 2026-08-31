# React Bits in Aura Console

Status: evaluation and integration rules. Nothing installed.

## The short version

```text
React Bits can animate presentation.
React Bits cannot decide what happened.
```

Aura Console's whole claim is that it reports what a Run actually did and says
so plainly when it does not know. A decorative library sits on the far side of
that boundary and must never cross it.

## What transfers from the FleetScope evaluation, and what does not

The integration plan written for FleetScope assumes an Astro app with a
Rust/WASM renderer, where React arrives as isolated islands. Three of its
premises do not hold here, and they change the work:

| FleetScope | Aura Console |
|---|---|
| Astro; React must be added as islands | **Already Next.js 16 App Router on React 19.** There is no integration phase and no island wrapper to build. |
| Rust/WASM owns the graph, timeline and cursor | **There is no renderer and no graph.** `foldRun` in TypeScript is the only projection. The thing to protect is the fold, not a canvas. |
| CSS-first styling, no Tailwind | Same conclusion, different reason: colour lives in `tokens.css` and a test forbids literal hex anywhere else. |

So FleetScope's Phase 1 ("add the React integration, add React and React DOM")
is already done and is not work. What replaces it is the **Server/Client
Component boundary**, which Astro does not have and which is the real cost here.

## The boundary that actually matters: `"use client"`

Every route under `apps/web/src/app/` is a server component with
`dynamic = "force-dynamic"`. Server components ship no JavaScript. A React Bits
component is interactive, so it carries `"use client"`, and importing one from a
route pulls that subtree — and its dependencies — into the browser bundle.

Rules:

1. A React Bits component is a **leaf**. It renders decoration and receives
   already-decided values as props. It never fetches, never folds, never reads
   the ABI, never owns state another surface reads.
2. Wrap it, do not import it directly into a route. One local component per
   usage, in `apps/web/src/components/motion/`, so the dependency has exactly
   one import site and can be deleted in one edit.
3. The wrapper renders its content as **static markup first**. If the animation
   never runs — JavaScript disabled, hydration failed, reduced motion — the text
   is already on screen and readable.
4. Never `"use client"` on a route or a layout to make a decoration work.

## Two existing tests any candidate must pass

These are not aspirations. They run today and they will fail.

**`tokens.test.ts` forbids literal hex in `globals.css`:**

```ts
expect(globals.match(/#[0-9a-fA-F]{3,8}\b/g)).toBeNull();
```

Most component CSS ships hardcoded colours. Any React Bits stylesheet pasted
into `globals.css` fails this immediately. Candidate CSS must be rewritten
against `--color-*` and `--landing-*` tokens before it lands, or it does not
land.

**The global reduced-motion rule collapses durations:**

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

This covers CSS. It does **not** cover JavaScript-driven animation —
`requestAnimationFrame` loops, WebGL, canvas, spring physics. A component that
animates in JS bypasses the site's only motion guarantee and must check
`matchMedia("(prefers-reduced-motion: reduce)")` itself, or be rejected.

Prefer the `-css` variants for exactly this reason, and because there is no
Tailwind here for the Tailwind variants to hook into.

## Candidates

Scoped to surfaces that carry no operational claim.

| Component | Where | Why it is allowed there |
|---|---|---|
| `staggered-text-css` | Landing hero, one-shot | The landing is a public product surface, not a Run. |
| `dither-wave-css` **or** `ascii-waves` | Landing background texture | Behind editorial copy only. Pick one, never both. |
| `animated-list-css` | Timeline row entrance | Rows are already rendered; this animates their arrival, not their content. |
| `device-css` | Onboarding, first-run | Shows the product frame before any Run exists. |
| `preloader-css` | Readiness check in flight | Only while `readiness === "checking"`, and it must not imply a result. |

Deliberately **not** on this list: the Console shell's status badge, the
transport label, the evidence inspector, the empty and unavailable states, and
anything on `/runs` that reports a Run. Those are the claims. They stay plain.

## Rejected

`shader-card`, `silk-waves`, `shader-waves`, `vortex`, `portal`, `black-hole`,
`globe`, `particle-text`, `3d-text-reveal`, `3d-letter-swap`, `lightspeed`,
`falling-rays`, `liquid-ascii`, `infinite-gallery`, `rotating-cards`,
`warped-card`, `custom-cursor`, `glitch-text`, `simple-graph`.

Reasons, in order of how much they matter here:

1. **Motion reads as liveness.** Aura Console is a non-mainnet, single-operator
   demo that shows recorded Runs. Anything that pulses, flows or continuously
   redraws suggests something is executing. That is the one impression the
   product must never give, and it is worth more than any visual.
2. **They compete with evidence.** A shader behind an event list makes the list
   harder to read, and the list is the product.
3. **WebGL is a failure surface** with no fallback story on a page whose job is
   to be honest when it cannot do something.
4. **`glitch-text` corrupts text on purpose.** On a surface reporting errors, a
   deliberately unreadable error label is indefensible.
5. **`simple-graph` would be a second projection.** Only `foldRun` may say what
   a Run did. A decorative graph drawn from the same data is a second answer
   that will drift.

## Ownership

| Owner | Owns |
|---|---|
| React Bits | Decorative entrance and texture, on non-claim surfaces |
| `foldRun` and the manifest | What happened, in what order, and what is unknown |
| `PresentationState` | Live, playing, paused, history, ended |
| The API | Spend, status, completion — none of it computed in the browser |
| Aura's own primitives | Every control that carries a claim |

A React Bits component may never set `selectedSequence`, `RetrievalStatus`, a
transport value, or anything reaching `foldRun`.

## Acceptance criteria

A candidate ships only if all of these hold:

- It has a named purpose on a named surface.
- It is a leaf client component behind a local wrapper.
- Its content is readable with JavaScript disabled.
- Its colours are tokens, so `tokens.test.ts` still passes.
- It honours reduced motion, in CSS or by checking `matchMedia` itself.
- It hides no text and delays no claim.
- It touches no projection, cursor or status value.
- `axe` reports no new violation.
- No new horizontal overflow at 1440, 1280 and 390.
- Its licence provenance is recorded, and the key stays an environment
  reference. Never in git, `components.json`, source, or a screenshot.

## Verification

```bash
pnpm lint && pnpm typecheck && pnpm test && NEXT_PUBLIC_API_URL=http://localhost:3001 pnpm build
```

Then, for any change that ships motion, in a real browser: reduced motion on,
JavaScript off, and all three widths. Prove each new assertion fails when the
feature is deliberately broken. A green suite has twice reported success on this
codebase while the thing under test was completely broken.

## Current status

Nothing installed. No React Bits dependency is in `apps/web/package.json`, and
no licence key exists in this repository. This document is the decision record
for if and when that changes.

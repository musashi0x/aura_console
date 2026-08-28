# Aura Console product documentation

Aura Console is a single-operator, non-mainnet console for inspecting an agent
run, its evidence, the resulting decision, any economic-action boundary, and the
memory diff that changes future behavior. This folder is the
implementation-facing summary; the numbered canonical product documents remain
in the Tracking project and should be kept in sync.

## Documents

- [Product brief](product-brief.md) — audience, promise, scope, and first-success outcome.
- [Landing page](landing-page.md) — the root route: scenes, components, tokens, motion, and honesty rules.
- [Onboarding](onboarding.md) — first-visit flow, readiness, disclosure, and explicit non-goals.
- [Visual system](visual-system.md) — the two visual layers and their token scales.
- [Demo choreography](demo.md) — the shortest compelling operator walkthrough.
- [Decisions and boundaries](decisions.md) — no-auth decision, safety invariants, and deferred work.

## What is implemented today

| Surface | State |
|---|---|
| Landing page at `/` | Implemented ([PR #4](https://github.com/musashi0x/aura_console/pull/4)) |
| Onboarding at `/onboarding` | Implemented |
| `/runs/new`, `/runs/example` | Labelled placeholders, task #61 |
| Console shell and Run timeline | Not implemented, task #44 and task #30 |
| Browser E2E | Not implemented, task #60 |

## Source of truth

Tracker project: [Aura Console project 3](https://tracking-frontend-production-e046.up.railway.app/projects/3).
This repository must not claim a feature is shipped until its code, tests, and
task status agree.

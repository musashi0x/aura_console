# Aura Console product documentation

Aura Console is a single-operator, non-mainnet console for directing an
autonomous agent through one economic objective and seeing exactly what it
remembered, chose, spent and learned. This folder is the implementation-facing
summary; the numbered canonical product documents remain in the Tracking project
and should be kept in sync.

## Documents

- [Product brief](product-brief.md) — audience, promise, mental model, and scope.
- [Mission workspace](mission-workspace.md) — the Operator/Board/Trace design that replaces the Run dashboard.
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
| Console shell | Implemented ([PR #6](https://github.com/musashi0x/aura_console/pull/6)), task #44 |
| `/runs`, `/runs/new`, `/runs/example` | Implemented against the real API |
| Run timeline at `/runs/[runId]` | Implemented: folded events, scrubbable playhead, no stream |
| Mission workspace (Operator, Board, Trace) | Not built |
| Conversation cards and the composer | Not built |
| Memory drawer and counterfactual | Not built; blocked on memory retrieval, task #32 |
| Navigation rename (Missions, Agents, Network, Guardrails) | Not done |
| Editorial layer on Operator and Board | Not done |
| Browser E2E | Not implemented, task #60 |

The redesign in [Mission workspace](mission-workspace.md) is the target, not a
description of the current screen. Its
[What exists today](mission-workspace.md#what-exists-today) table is the
per-piece split, and its
[Implementation order](mission-workspace.md#implementation-order) is the
sequence.

## Source of truth

Tracker project: [Aura Console project 3](https://tracking-frontend-production-e046.up.railway.app/projects/3).
This repository must not claim a feature is shipped until its code, tests, and
task status agree.

The canonical numbered documents in the tracker were written against the Run
dashboard. `03_UX_SPEC`, `02_PRODUCT_FLOW` and `15_ANTIGRAVITY_TERMINAL_EXPERIENCE`
still describe the causal spine as the default surface, the Evidence drawer as a
stage, and a dark-first canvas. They need the same corrections recorded here.

# Web application

The web app is a Next.js App Router application. It serves the editorial
landing page at `/`, the first-run onboarding flow at `/onboarding`, the Console
shell at `/runs`, `/counterparties`, `/policies` and `/system`, and the
documentation pages under `/docs`.

The Run surfaces are backed by the real API: `/runs` lists from `GET /api/runs`,
`/runs/new` creates through `POST /api/runs`, and `/runs/[runId]` folds
`GET /api/runs/{id}/events`. A surface with no endpoint behind it —
`/counterparties` and `/policies` — still renders an explicit unavailable state
rather than an empty one, because "we could not look" is not "we looked and
there is nothing". Every Run surface reads once and labels itself
`LATEST SNAPSHOT`: the server's stream is a finite replay and the browser client
has no method that calls it.

## Topics

- [Console shell](console-shell.md) — the operator surface, its routes, the projection fold, and transport state.
- [Mission workspace](../../product/mission-workspace.md) — the Operator/Board/Trace design the Run surfaces are being rebuilt into. Partly built: the shell, the three modes, the six-step rail and the Board exist and are mounted on `/runs/[runId]`; the event-to-card renderer does not, so Operator still lists raw events. Read it before changing `/runs/[runId]`.
- [Landing page](landing.md) — the root route, its scenes, tokens, and the static-preview boundary.
- [Onboarding](onboarding.md) — first-visit routing, readiness checks, and the browser-local acknowledgement.
- [Home page](home.md) — how `/` composes the first-run gate and the landing page.
- [API client and environment](api-client.md) — typed request handling and `NEXT_PUBLIC_API_URL` validation.
- [Layout and visual system](layout-and-visuals.md) — metadata, global CSS, design tokens, and the two visual layers.
- [React Bits](react-bits.md) — what a decorative library may and may not touch.

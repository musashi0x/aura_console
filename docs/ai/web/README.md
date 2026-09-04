# Web application

The web app is a Next.js App Router application. It serves the editorial
landing page at `/`, the first-run onboarding flow at `/onboarding`, and the
Console shell at `/runs`, `/counterparties`, `/policies`, and `/system`. The
Console surfaces render honest unavailable states because the Run endpoints do
not exist yet.

## Topics

- [Console shell](console-shell.md) — the operator surface, its routes, the projection fold, and transport state.
- [Mission workspace](../../product/mission-workspace.md) — the Operator/Board/Trace design the Run surfaces are being rebuilt into. Not implemented; read it before changing `/runs/[runId]`.
- [Landing page](landing.md) — the root route, its scenes, tokens, and the static-preview boundary.
- [Onboarding](onboarding.md) — first-visit routing, readiness checks, and the browser-local acknowledgement.
- [Home page](home.md) — how `/` composes the first-run gate and the landing page.
- [API client and environment](api-client.md) — typed request handling and `NEXT_PUBLIC_API_URL` validation.
- [Layout and visual system](layout-and-visuals.md) — metadata, global CSS, design tokens, and the two visual layers.
- [React Bits](react-bits.md) — what a decorative library may and may not touch.

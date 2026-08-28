# Home page

## What

The root route composes two things: a first-run gate that redirects a genuinely
new browser to onboarding, and the editorial landing page shown to everyone
else. It also performs the real database health check that drives the header
readiness indicator.

## Where

- `apps/web/src/app/page.tsx` — `HomePage`; calls `apiClient.dbHealth()` and
  passes `ready` to `LandingPage`.
- `apps/web/src/app/page.tsx` — `dynamic = "force-dynamic"`; readiness must
  never be a build-time snapshot because the header reports it as verified.
- `apps/web/src/features/onboarding/components/first-run-gate.tsx` —
  `FirstRunGate`; redirects to `/onboarding` only when the operator has neither
  acknowledged nor skipped.
- `apps/web/src/app/layout.tsx` — `RootLayout`; skip link, decorative backdrop,
  and global styles.

## Approach

Keep readiness factual: `SYSTEM READY` only on a successful check, and
`SYSTEM DEGRADED` otherwise. `/` is a public landing surface, not an
authenticated workspace, and the gate must not be weakened into an unconditional
redirect or removed to make the landing page the universal entry.

See [Landing page](landing.md) for the page itself.

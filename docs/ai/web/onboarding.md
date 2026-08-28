# Onboarding

## What

A four-step first-run flow at `/onboarding`: welcome, verified readiness,
privacy disclosure, and handoff to a Run destination. It is client-only and
introduces no server state.

## Where

- `apps/web/src/app/onboarding/page.tsx` — `OnboardingPage`.
- `apps/web/src/app/onboarding/onboarding-route.tsx` — `OnboardingRoute`; supplies
  `onSkip` and `onFinish` so the buttons navigate in the real route.
- `apps/web/src/features/onboarding/components/onboarding-flow.tsx` —
  `OnboardingFlow`; step rendering and focus management.
- `apps/web/src/features/onboarding/onboarding-reducer.ts` —
  `onboardingReducer`, `initialState`, `canContinue`; the pure state machine.
- `apps/web/src/features/onboarding/readiness.ts` — `initialRows`, `runCheck`.
- `apps/web/src/features/onboarding/acknowledgement.ts` — `readProgress`,
  `writeProgress`, `clearProgress`, `hasAcknowledged`; browser storage only.
- `apps/web/src/features/onboarding/components/first-run-gate.tsx` —
  `FirstRunGate`; the redirect shown on `/`.
- `apps/web/src/features/onboarding/components/readiness-row.tsx` — `ReadinessRowItem`.
- `apps/web/src/features/onboarding/copy.ts` — `copy`.

## Readiness is only what was verified

`runCheck` calls `apiClient.health()` and `apiClient.dbHealth()`. Operator policy
and agent identity have no endpoint in v0.1, so `initialRows` marks them
`not_checked` with the reason shown. Never render `ready` without a successful
response, and never invent an endpoint to fill a row.

## Approach

The acknowledgement is browser-local and is called an acknowledgement, never
consent. Ticking it unlocks the action but does not advance the step. Skip is
allowed everywhere and resume returns to the same step, and `FirstRunGate`
respects a skip so the operator cannot be looped.

Four invariants are asserted in tests: never authorize spending, never execute
an economic action, never display private memory, never present unavailable
memory as valid history.

## Tests

- `apps/web/src/features/onboarding/onboarding-reducer.test.ts`
- `apps/web/src/features/onboarding/acknowledgement.test.ts`
- `apps/web/src/features/onboarding/components/onboarding-flow.test.tsx`
- `apps/web/src/features/onboarding/components/first-run-gate.test.tsx`
- `apps/web/src/app/onboarding/onboarding-route.test.tsx`

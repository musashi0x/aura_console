# Product brief

## What

Aura Console makes an agent's work inspectable. An operator can follow or replay
a Run and see the evidence, decision context, economic-action boundary, outcome,
and Memory Diff as one coherent timeline.

Aura Console v0.1 is a **single-operator demo console**. It runs against a
non-mainnet environment and has no account model.

## Audience

- Primary: the operator running a local or demo agent.
- Secondary: reviewers who need evidence that a decision was explainable and privacy-safe.
- Not the v0.1 audience: external agent clients, fleet administrators, or production finance operators.

## v0.1 promise

Agent decisions are inspectable and replayable. The first successful outcome is
opening the labelled example Run or starting the first real Run surface. The
console should communicate state clearly: live, history, paused, empty,
dependency failure, and unavailable memory are different states.

## Entry points

The root route is the [landing page](landing-page.md), and it is the entry point
for a returning operator. A genuinely new browser is routed through
[onboarding](onboarding.md) first. The landing page is a public product surface,
**not** an authenticated workspace: there is nothing to sign into.

## Scope

- Editorial landing page and Console shell.
- Readiness checks backed by real API endpoints.
- Onboarding that explains the product and hands off to a Run.
- Replayable Run timeline with frozen Decision Context and Memory Diff.
- Explicit boundaries around Virtuals ACP and any economic action.

## Implemented today

The landing page and onboarding exist. The Console shell, the real Run timeline,
and the Run destinations behind the calls to action do not; see
[the product index](README.md) for the current state of each surface.

## Out of scope

Authentication, sessions, workspaces, multi-tenancy, server-side consent
records, and automatic spending authorization are not v0.1 features. Adding them
requires an API and architecture decision, not a UI-only change.

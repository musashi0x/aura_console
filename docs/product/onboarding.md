# Onboarding

## Goal

Help a first-time operator understand Aura Console and reach a verified first
success without fabricating identity, workspace, policy, agent, or consent
state.

## Relationship to the landing page

```
First visit, nothing stored:      /  ->  /onboarding
Acknowledged or skipped:          /  ->  editorial landing page
Landing and onboarding handoff:        -> /runs/example or /runs/new
```

`FirstRunGate` redirects only when the operator has neither acknowledged nor
skipped, so skipping is respected and cannot loop. The landing page is not an
authenticated console and onboarding is not a sign-up.

The Run destinations are currently labelled placeholders; see
[the product index](README.md).

## Flow

1. Welcome: explain that this is a single-operator demo console with no sign-in.
2. Readiness: check API reachability and database readiness using `/health` and `/health/db`.
3. Disclosure: explain stored operational data, private relationship memory, and approval boundaries. Record only a browser-local acknowledgement.
4. Handoff: open the New Run or Example Run surface.

Every step can be skipped and resumed. Finish and skip navigate in the
production route, not only in component tests.

## Honest states

Policy readiness and agent identity are **Not checked** until safe
browser-readable API endpoints exist. Do not infer them from deploy-time
`AGENT_ID` or server configuration. An unavailable memory source is never
presented as valid history.

## Safety invariants

Onboarding never authorizes spending, executes an economic action, exposes
private memory, or converts missing memory into historical fact. Authentication
is explicitly absent in v0.1 and is a prerequisite for shared, hosted, or
production deployment.

## Verification

Route-level tests cover first visit, skip and resume, acknowledgement, and
handoff. Browser E2E remains a separate follow-up (Tracking task #60) so real
navigation, retry behavior, and console errors are tested in a browser harness.

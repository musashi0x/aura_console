# Decisions and boundaries

## Decision 31 — no authentication in v0.1

Aura Console v0.1 has no authentication, session, workspace, or multi-tenancy
model. It is a single-operator, non-mainnet/demo console. Authentication must be
designed as a separate backend and deployment change before shared, hosted, or
production use.

Corollary: do not add auth, accounts, or workspaces to make a UI feel more
complete. A sign-in form with no backend implies a session that does not exist.

## The root route stays the landing page

`/` is a public editorial landing page for a returning operator, and a genuinely
new browser is routed to `/onboarding` first. The landing page is not a
dashboard and not an authenticated console.

## Two visual layers

The public page is a bright editorial surface; the dark Console styling is
confined to the product preview and, later, the real Console shell. The contrast
is intentional. See [Visual system](visual-system.md).

## Static preview must be labelled

Any illustrative Run content outside a real Run surface carries an explicit
label and a note that it is not live data and not a Run. Readiness shown to an
operator must come from a real check; policy and agent identity stay
**Not checked** while no endpoint exists.

## Privacy acknowledgement is not consent

The onboarding disclosure may be acknowledged in browser storage to avoid
repeating it for the same browser. This is UX state, not a server-side consent
record or legal consent model.

## Four never-automatic rules

- Never authorize spending.
- Never execute an economic action.
- Never expose private relationship memory.
- Never treat unavailable memory as valid history.

## Scope is split per slice

Landing implementation, the visual system, the onboarding visual pass, and the
Console shell are separate pull requests. A visual change should not carry
routing or backend behaviour, and vice versa.

## Deferred work

- Console shell and replayable Run timeline (Tracking task #44).
- Run skeleton and replayable event shell (Tracking task #30).
- Replace `/runs/new` and `/runs/example` placeholders with real Run surfaces (Tracking task #61; depends on #30 and #44).
- Browser E2E for onboarding and landing, including real routing and console errors (Tracking task #60).

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

## The Console lives under its own routes, not at the root

The Console shell is served from `/runs`, `/counterparties`, `/policies`, and
`/system`. It did not take over `/`, which stays the landing page, and it did
not weaken `FirstRunGate`. Database and API readiness moved from the old root
health card to `/system`.

## The shell renders state, it does not own data

`ConsoleShell` takes `surface`, a `readiness` result, and an optional Run
reference. It computes none of them. Readiness is a real check result passed in,
never assumed, and never borrowed from a previous surface: while a check is in
flight the shell says `CHECKING` rather than `SYSTEM READY`. Every visible
string lives in `apps/web/src/features/console/copy.ts` so the claims the
product makes are reviewed in one file.

## Unavailable is not empty

A surface whose data source does not exist says so and names the task that owns
it. It never renders an empty list, because an empty list claims a verified
empty result from a query that never happened.

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

## Terminal Runs have no edge to follow

`COMPLETED`, `FAILED` and `CANCELLED` all end a Run. Each opens the timeline in
`ENDED`, and the return-to-latest control is removed rather than disabled,
because there is no latest to return to. Treating only `COMPLETED` as terminal
left a failed Run claiming to follow an edge that had stopped.

## Origin is a fact about the Run

`CONSOLE`, `AGENT` and `FIXTURE` survive from the API through the fold to the
screen. An agent-opened Run is not a Console-opened one, and neither is "the
API": the API is the transport that carried the Run, not the actor that started
it. Collapsing them hid that the example Run was example data in the one field
that names its origin.

## Deferred work

- Live updates. `GET /api/runs/{run_id}/stream` does not exist, so a Run surface
  reads its events once. The transport reports `LATEST SNAPSHOT`, never `LIVE`.
- Replay progression. The playhead can be scrubbed and held, but nothing
  advances it on a timer, so `Play` and `Pause` are disabled on a Run that has
  ended and on the example fixture. A control that says it is playing while
  nothing moves is worse than no control.
- Browser E2E for onboarding and landing, including real routing and console errors (Tracking task #60).

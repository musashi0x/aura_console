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

The public page is a bright editorial surface and the dark styling is
operational. The contrast is intentional. What changed is where the line falls:
the dark layer is no longer the whole Console, only its system layer. Operator,
Board and the drawers are editorial; Trace is dark. See
[Visual system](visual-system.md) and
[The dark layer belongs to the system layer only](#the-dark-layer-belongs-to-the-system-layer-only).

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

The routes are stable; the labels above them are not. Missions, Agents, Network
and Guardrails are the operator-facing names for those same four routes. A rail
label is not a reason to move a route.

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

## The Console is a workspace, not a Run inspector

The Run detail screen rendered Aura's implementation model as its information
architecture: five large stage cards named `Evidence`, `Decision`,
`Economic action`, `Outcome` and `Memory Diff`, each reporting `NOT REACHED`
until the corresponding stage fired. It required the operator to learn Aura's
ontology before they could read the product, and on a fresh Run it used most of
the viewport to say that nothing had happened.

The default surface is now a live working session: conversation, the cards that
conversation produces, and a compact progress rail. The ten canonical stages are
not deleted — they are system ontology, and they live in Trace. See
[Mission workspace](mission-workspace.md).

## Mission is the operator's word for a Run

`Run` stays the system word: `run_id`, `(run_id, sequence)`, `RunStatus`,
`POST /api/runs`. `Mission` is the label an operator reads. This is the same
rule that keeps `LIVE` as the projection's internal mode while the visible label
is `LATEST SNAPSHOT`. Do not rename a projection concept to change a word on
screen, and do not introduce a second identifier.

## Conversation is a mode, not a destination

`Chat` is removed from the navigation rail. A rail item called Chat implies a
place to go and talk to an assistant that is not doing the work; conversation
is the default mode **inside** every Mission, alongside Board and Trace.

The primary rail becomes Missions, Agents, Network, Guardrails, Docs.
`Example Run`, `Readiness` and `Back to landing` leave it: the example Mission
belongs in Missions with a `Demo` badge, readiness belongs to Network and its
status chip, and the landing page is reachable from the brand mark.

No `Settings` and no user menu are added. With no account model behind them they
would be navigation that opens nothing, which is the same mistake as a sign-in
form with no backend (Decision 31).

## A card is a projection, never a message

Every card in the conversation is folded from canonical events. No card is
authored by a model turn, and no card renders a value the event stream does not
contain.

This is what carries the Console's existing guarantees into a conversational
surface. No economic value computed locally, no completion inferred from
silence, only the five envelope fields exposed, unrecognised event types kept
inspectable rather than dropped — every one of those leaves through the first
card a model is allowed to write. An event type with no card yet renders as an
inspectable raw entry, the treatment `UNSUPPORTED_TYPE` already gets.

## Operator, Board and Trace are three projections of one stream

Switching mode does not re-fetch, fork state, or introduce a second ordering.
All three read `foldRun(events, seed, upToSequence)`. Board never gains its own
tasks or its own ordering; a Board card exists because an event created it.

This is the same reason live and replay share one projection: two code paths
over the same events will drift, and a Board that disagreed with the
conversation about what happened would be worse than no Board.

## Evidence is attached to a decision, not a stage

`Evidence` as a stage made it a mysterious phase of the system. It is now a
`Why this?` control on the Decision card that opens a drawer next to the claim
it supports. Nothing was cut from the evidence set — frozen objective and
candidate set, versions, candidate comparison, score components, policy results,
alternatives with rejection reasons, and the no-memory counterfactual all
survive. They moved.

## Memory is stated causally, and the causal claim must be earned

`Memory: NOT_REQUESTED` is correct and unreadable. The five `RetrievalStatus`
values are unchanged; only the wording is:

| State | Reads as |
|---|---|
| `AVAILABLE`, outcome changed | Memory changed this decision |
| `AVAILABLE`, outcome held | Memory checked, recommendation unchanged |
| `NO_HISTORY` | No previous relationship found |
| `ERROR` | Memory unavailable, historical risk unknown |
| `NOT_REQUESTED` | Memory has not been consulted for this step yet |

`Memory changed this decision` may only render when the counterfactual actually
differs. It is the most persuasive line in the product and therefore the most
tempting to fake; a memory lookup that did not change the outcome is a real
result and says so.

`NO_HISTORY` and `ERROR` still never collapse into each other, and unavailable
memory is still never treated as history.

## A control that cannot act is not rendered

`Correct memory` and `Archive relationship` are writes. They stay absent until
an endpoint and an event exist behind them, for the same reason `Play` and
`Pause` were removed rather than disabled: a control that changes a label
without changing the world is worse than no control.

## Not reached is not a state worth rendering

`NOT REACHED` is deleted as a rendering. A stage that has not happened yet gets
a hollow marker in the progress rail and no card.

The distinction it was protecting is real and stays: *we could not look* is not
*we looked and there is nothing*. That distinction belongs to a surface whose
data source failed, which is what `ConsoleUnavailableMemory` and the unavailable
states are for. A future stage is neither.

## The dark layer belongs to the system layer only

The Console was dark-first throughout. It is now split by what a surface is for:
Operator, Board and the drawers use the editorial light scale; Trace keeps the
dark monospace scale.

Dark now signals raw system information rather than setting the temperature of
the whole product. Both token scales already exist; what changes is which
surfaces claim which one. This reverses the "dark-first operational canvas"
direction in the canonical UX spec, which needs the same change.

## Deferred work

- Live updates. `GET /api/runs/{run_id}/stream` does not exist, so a Run surface
  reads its events once. The transport reports `LATEST SNAPSHOT`, never `LIVE`.
- Replay progression. The playhead can be scrubbed and held, but nothing
  advances it: there is no timer and no stream. `Play` and `Pause` are therefore
  ABSENT from the Run surface, not merely disabled. Pressing Play changed the
  badge to PLAYING over a still timeline and took `Back to latest` away with it,
  which is worse than offering nothing. The `play` and `pause` commands are gone
  from `TransportCommand`, so `PLAYING` and `PAUSED` are unreachable at compile
  time and cannot return by accident before the progression that justifies them.
  Scrubbing, the `HISTORY` label with its timestamp, and `Back to latest` all
  remain.
- Browser E2E for onboarding and landing, including real routing and console errors (Tracking task #60).

## The ACP runtime observes; it does not spend

The Virtuals ACP client runtime (`pnpm --filter @aura/api acp`) connects to the
Agent Commerce Protocol event stream and records what it sees as `run_events`.
It calls no method that moves money: not `fund`, `complete`, `reject`,
`setBudget`, `submit`, or `executeTool`, which reaches all five by name. A
provider's `budget.set` is recorded as a proposal awaiting authorization, and
authorizing it is a separate change with its own operator surface.

Creating a job is a command a person runs, and it always passes an explicit
evaluator. The SDK's default is skip-evaluation, where a provider's submit
auto-completes the job and releases escrow with nobody in the loop; that is
precisely the automatic economic action the product forbids, so the unsafe
default is refused in code rather than avoided by convention.

## An ACP job is an AGENT Run

One ACP job maps to exactly one Run, seeded `source: "AGENT"`,
`environment: "base-sepolia"`, `budget_usdc: null`. It was not opened by the
Console and the API did not open it either — origin stays a fact about the Run.

`budget_usdc` is the ceiling an operator declares. A provider's proposed price
is a different claim, so it lives in an event and never in the seed.

The runtime is its own process. "The API is up" and "the ACP stream is
connected" are two facts, and the API boots, serves, and passes its tests with
the runtime stopped. Nothing in the Console reads ACP data yet, so nothing on
screen claims an ACP timeline is complete.

## Spending is authorized in the log, executed by the runtime

The ACP runtime can now fund a job. It still decides nothing: an operator
authorizes through `POST /api/runs/:id/acp/fund-authorizations`, which writes
the `acp.fund.authorized` event and an `acp_spend_intents` row in one
transaction. The event is the record of the decision; the row is the
instruction, and it is the only thing the executor reads.

That separation is load-bearing rather than tidy. `POST /:id/events` accepts any
event type, so an authorization event is forgeable — and inert, because nothing
scans `run_events` for work to do. The four never-automatic rules survive
intact: the runtime never authorizes spending, and it executes no economic
action that a person did not already authorize.

Spending is off unless `ACP_SPEND_ENABLED=true`. With it unset the worker builds
no executor, so a running process has no path to `fund` at all.

This is the first endpoint that can lead to money moving, and v0.1 still has no
authentication — a decision taken when nothing could spend. Anyone who can reach
the API port can authorize a testnet spend. The port stays local, and
authentication is a prerequisite for anything beyond one operator on one
machine.

## ACP is a Run, not a second vocabulary

`acp.` is a storage namespace that says where a fact came from. It reaches the
screen as the Console's own language: `WAITING_APPROVAL` when a provider
proposes a price, `FUND` and `DELIVER` and `EVALUATE` stages, `BLOCKED` when
funding gave up. There is no ACP surface and no ACP component.

`spentUsdc` moves only on an observed `acp.job.funded`. A proposed price, an
operator's authorization and the runtime's own "we sent it" are three different
claims, and none of them is money that left.

Understood-but-stageless types (`acp.message`, `acp.job.expired`) render as
`SUPPORTED` without a stage. Marking them unrecognised told the operator the
Console did not understand an event it had just shown them.

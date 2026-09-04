# Mission workspace

The Console's default screen is a **live working session**, not a Run inspector.

This document is the target design. It is not implemented yet; see
[What exists today](#what-exists-today) for the honest split, and
[Implementation order](#implementation-order) for the sequence.

## Why this replaced the Run dashboard

The Run detail screen rendered Aura's internal architecture directly:
`Evidence → Decision → Economic Action → Outcome → Memory Diff`, five large
cards, each reporting `NOT REACHED` on a fresh Run. That is a correct
implementation model and the wrong product. It asks the operator to understand
Aura's ontology before they can understand what Aura does, and it spends most of
the viewport saying *nothing has happened yet*.

The stages are not wrong and they are not being deleted. They are **system
ontology**, and system ontology belongs in [Trace](#trace), not on the surface
an operator opens first.

What the operator actually arrives with is a different list of questions:

| The operator asks | The workspace answers with |
|---|---|
| What am I asking the agent to do? | The Mission objective in the header |
| What is it doing right now? | The progress rail and the newest card |
| What does it remember? | [Memory Recall card](#the-card-catalogue) and the memory drawer |
| Why did it choose this? | [Decision card](#the-card-catalogue) and `Why this?` |
| Do I need to approve anything? | [Approval card](#the-card-catalogue) |
| What came back? | [Outcome card](#the-card-catalogue) |
| Did it learn anything? | [Memory Diff card](#the-card-catalogue) |

## Mission is the user-facing name for a Run

`Run` stays the system word. It is the event stream's own vocabulary:
`run_id`, `(run_id, sequence)`, `RunStatus`, `POST /api/runs`. None of that
changes, and none of it should be renamed to fix a label.

`Mission` is what the operator reads. One Mission is one Run: one economic
objective from intent to committed memory.

This is the same rule already applied to transport, where `LIVE` is the
projection's internal mode and `LATEST SNAPSHOT` is the visible label. Do not
rename a projection concept to change a word on screen.

## Navigation

| Destination | Route | What lives there |
|---|---|---|
| Missions | `/runs` | Every Mission, running and finished. The demo Mission carries a `Demo` badge and lives here, not in a separate rail item |
| Agents | `/counterparties` | Agents Aura has worked with, and the private relationship memory about them |
| Network | `/system` | The outside world Aura can reach: Virtuals ACP, Base, Sibyl, the API and the database, with real readiness for each |
| Guardrails | `/policies` | The deterministic economic rules: spend limits, approval thresholds, denial rules |
| Docs | — | Product and system documentation |

The footer carries a **system status** chip that links to Network. It is the
same readiness result the topbar reports, not a second check.

### What is removed from the rail

- `Chat`. Conversation is not a destination; it is the default mode **inside**
  every Mission. A rail item called Chat implies a place to go and talk to an
  assistant that is not doing the work.
- `Example Run`, `Readiness`, `Back to landing`. The example Mission belongs in
  Missions with a `Demo` badge, readiness belongs to Network and its status
  chip, and the landing page is reachable from the brand mark.

### What must not be added

There is no `Settings` and no user menu, for the same reason there is no
sign-in: v0.1 is single-operator and unauthenticated (Decision 31). A user
avatar implies a session that does not exist. If a settings surface is ever
needed it has to be a real one, not a rail item that opens an empty panel.

## Three modes over one event stream

A Mission has three modes. They are **projections of the same events**, not
three systems with three states.

```text
┌─────────────────────────────────────────────────────────────┐
│ Hire a research agent                            RUNNING    │
│ $6.20 of $25   Sibyl 2 memories   Virtuals ok   Base ok     │
│ Understand ✓  Remember ✓  Decide ✓  Act ●  Verify ○  Learn ○│
├─────────────────────────────────────────────────────────────┤
│        OPERATOR          BOARD          TRACE               │
├─────────────────────────────────────────────────────────────┤
│  conversation + cards | kanban of the same | raw lifecycle  │
├─────────────────────────────────────────────────────────────┤
│ Ask Aura to investigate, compare, execute, or explain… Send │
└─────────────────────────────────────────────────────────────┘
```

| Mode | For | Renders |
|---|---|---|
| Operator | Default. Everyone | Conversation with interactive cards |
| Board | Seeing what is queued, moving, blocked, done | Kanban columns of the same events |
| Trace | Developers, reviewers, judges | Raw lifecycle events, receipts, tool calls |

Switching mode never re-fetches and never forks state. All three read the same
`foldRun(events, seed, upToSequence)` projection. That is the rule that stops
the three views disagreeing about what happened, and it is the same rule that
already stops live and replay from drifting apart.

## Operator

### Conversation generates objects, not prose

The largest change. An assistant turn that reads

> I have selected provider B based on available evidence.

is a description of work. It carries no evidence, no amount, no approval path,
and nothing to inspect. The conversation must **render the work itself**:

- Aura recalls something from Sibyl → a **Memory Recall card**.
- Aura compares options → a **Comparison card**.
- Aura reaches a recommendation → a **Decision card**.
- The action needs a human → an **Approval card**.
- Virtuals is running a job → an **Agent Job card**.
- Base settles a transaction → a **Transaction card**.
- A deliverable is evaluated → an **Outcome card**.
- Sibyl updates → a **Memory Diff card**.

Text is connective tissue between those objects. It explains and links; it never
carries a fact that only exists in the sentence.

### A card is a projection, never a message

**Every card is folded from canonical events.** No card is authored by a model,
and no card renders a number the event stream does not contain.

This is not a style rule. It is what keeps the Console's existing guarantees
alive inside a conversational surface: no economic value computed locally, no
completion inferred from silence, only the five envelope fields exposed,
unrecognised event types kept inspectable rather than dropped. If a card could
be written by a model turn, all of those guarantees would leave through it.

Practically: the renderer takes a `CanonicalEvent` (or a small contiguous group
of them) and returns a card. An event type with no card yet renders as an
inspectable raw entry — the same treatment `UNSUPPORTED_TYPE` already gets —
rather than being dropped or paraphrased.

### The card catalogue

| Card | Fired by | Must show | Must never |
|---|---|---|---|
| Memory Recall | `memory.recall.*` | What was recalled, how many records, and whether it changed the ranking | Claim history when retrieval failed |
| Comparison | candidate scoring | Candidates side by side with the components that separate them | Lead with one composite score |
| Decision | `decision.proposed` | Selected agent, authorization mode, two or three highest-impact reasons, `Why this?`, `Compare without memory` | Present a score as the answer |
| Approval | `WAITING_APPROVAL` | The exact action, the maximum spend, `Edit` and `Approve` | Approve implicitly, or on any path other than an operator click |
| Agent Job | Virtuals ACP job events | Provider, amount, job and funding state, protocol name | Imply mainnet |
| Transaction | Base events | Network, amount, state, external reference | Show a hash without saying what it settled |
| Outcome | `outcome.*` | The result, who evaluated it, the failure reason when there is one | Infer success from a job ending |
| Memory Diff | `memory.diff.*` | Before and after values aligned, direction in text and number, link to evidence | Render `no material change` as an empty card |
| Policy Gate | policy evaluation | Rule version, pass/fail rows, resulting mode | Hide a failed gate behind a passing summary |

### The composer is persistent

The composer is docked at the bottom of Operator, always. It replaces the
floating `Ask the agent` button, which put the primary way to direct a Mission
behind a click.

A Mission with no events yet shows the composer, a one-line prompt — *What
should Aura accomplish?* — and two or three suggested intents. It does not show
six empty stage cards.

## The progress rail

The header carries one compact rail:

```text
Understand ✓   Remember ✓   Decide ✓   Act ●   Verify ○   Learn ○
```

Six steps, because six is the story. The ten canonical stages remain the
system's vocabulary and remain in Trace.

| Rail step | Canonical stages |
|---|---|
| Understand | `DISCOVER` |
| Remember | `MEMORY` |
| Decide | `SCORE`, `POLICY`, `DECIDE` |
| Act | `FUND`, `DELIVER` |
| Verify | `EVALUATE` |
| Learn | `LEARN`, `COMMIT` |

Clicking a step scrolls Operator to the first card in that step. It does not
open a panel of its own, and the rail is never the primary way to read a
Mission — progressive disclosure, with the conversation as the disclosure.

A step that has not happened is a hollow marker. It is not a card, and it does
not say `NOT REACHED`.

## Evidence is not a stage

`Evidence` was a stage in the old screen, which made it a mysterious phase of
the system rather than the support for a claim. Evidence belongs **next to the
decision it supports**.

The Decision card carries a `Why this?` control. It opens a drawer:

```text
Why Atlas Agent

Marketplace reputation      88
Previous successful jobs    +8
Price within policy         $12 of $25 limit
Memory used                 2 records

Sources
  Current marketplace data          Virtuals, 14:32:09
  Mission #98                       delivered, accepted
  Mission #102                      delivered, rejected
  Sibyl memory receipt              v13
  Guardrail applied                 spend limit v4
```

The drawer contents are the existing decision-evidence set: frozen objective and
candidate set, memory/scoring/policy versions, candidate comparison, score
components, eligibility and execution policy results, alternatives with
rejection reasons, and the no-memory counterfactual. Nothing was cut; it moved
from a stage to a drawer attached to the claim.

## Memory is the most visible part of the product

`Memory: NOT_REQUESTED` is technically correct and product-dead. Memory has to
read as **causal information**, in the operator's language:

| Retrieval state | What the operator reads |
|---|---|
| `AVAILABLE`, changed the outcome | Sibyl recalled 2 previous interactions. **Memory changed this decision.** |
| `AVAILABLE`, did not change the outcome | Memory checked, recommendation unchanged |
| `NO_HISTORY` | No previous relationship found |
| `ERROR` | Memory unavailable, historical risk unknown |
| `NOT_REQUESTED` | Memory has not been consulted for this step yet |

The five retrieval states stay exactly as they are in `RetrievalStatus`. Only
the wording changes. `NO_HISTORY` and `ERROR` still never collapse into each
other, and unavailable memory is still never treated as history.

`Memory changed this decision` is the line that makes Sibyl legible without a
two-minute architecture explanation. It is also the line most likely to become a
lie, so it may only render when the counterfactual actually differs. When memory
was consulted and the outcome held, the honest line is
`Memory checked, recommendation unchanged` — which is a real result, not a
missing one.

### Memory drawer

The memory chip opens a drawer with four sections:

```text
Remembered      Provider failed one delivery
                Previous average price was $9
                Last successful interaction was 12 days ago

Used for        Risk adjustment
                Price expectation
                Counterparty ranking

Source          Mission #104
                Mission #116

Controls        Correct memory
                Archive relationship
                View original event
```

This is the operator's first-party view of their own agent's memory. It is not
the counterparty projection, and the denied set has no display path here or
anywhere else.

`Correct memory` and `Archive relationship` are writes. They need an endpoint
and an event before they are rendered as anything other than absent — a control
that cannot act is worse than a control that is not there.

### Counterfactual

The Decision card carries `Compare without memory`.

```text
With Sibyl                        Without previous memory
Atlas Agent                       Nova Research
Score 96                          Score 93

What changed
A previous Nova failure applied a 24 point risk penalty.
```

The comparison is simulated and the card says so. It creates no second economic
action, and it must be computed from recorded evidence rather than re-run.

## Board

Board is another projection of the same Mission, not a project-management
system. Four columns:

| Column | Meaning |
|---|---|
| Queued | Not started |
| Running | In flight |
| Needs you | Blocked on an operator decision |
| Done | Settled, including failed and cancelled |

```text
Find Virtuals providers      Running     Virtuals
Recall provider history      Done        Sibyl
Choose provider              Done        2 memories used
Approve $12 payment          Needs you   Base
Evaluate deliverable         Queued
```

Selecting a Board card scrolls Operator to the conversation event that produced
it. Selecting a card in Operator highlights the matching Board card. Both are
views onto one event stream, so there is no second state to keep in sync and no
way for them to disagree.

Aura is not a task tracker. Board never gains its own tasks, its own ordering,
or a card an event did not create.

## Trace

Trace is where the raw material lives: canonical lifecycle events, memory
receipts, transaction receipts, tool calls, and the full ten-stage spine.

It opens with a connection strip:

```text
Live events connected        Last event 4 seconds ago      21 events
Sibyl healthy                Virtuals connected            Base RPC healthy
```

then the event log:

```text
14:32:08  memory.recall.started
14:32:08  memory.recall.completed
14:32:09  candidate.scored
14:32:10  decision.proposed
14:32:16  action.approved
14:32:17  virtuals.job.created
```

The connection strip reports the real transport. While there is no stream it
says `LATEST SNAPSHOT` with the time of the read, never `Live events
connected` — the strip above is the shape it takes once a stream exists, not a
label to render early.

## Progressive rendering replaces empty stages

Nothing renders a placeholder for work that has not happened.

- No events: composer, prompt, suggested intents, hollow rail.
- Some events: exactly the cards those events produced.
- A step not reached: a hollow marker in the rail and no card.

`NOT REACHED` is deleted as a rendering. The distinction it was protecting —
*we could not look* versus *we looked and there is nothing* — is real and stays.
It just belongs on a surface whose data source failed, which is what
`ConsoleUnavailableMemory` and the unavailable states are for. A stage that has
not been reached yet is neither of those; it is simply the future.

## Visual layers

The Console had one dark operational layer. It now has two, split by what the
surface is for:

| Surface | Layer |
|---|---|
| Operator | Editorial. Warm off-white canvas, large type, generous whitespace, black primary text, blue accent, teal-green for verified, rounded cards, hairline borders |
| Board | Editorial. Light cards |
| Memory drawer | Editorial |
| `Why this?` drawer | Editorial |
| Trace | Operational. Dark, monospace, dense |
| Landing page | Editorial, unchanged |

The contrast is the point: **the product layer is light and approachable, the
system layer is dark and technical**. Dark is now a signal that the operator is
looking at raw system information, rather than the ambient temperature of the
whole product.

This reverses the "dark-first operational canvas" direction in the canonical UX
spec, and that document needs the same change. Both token scales already exist
in `apps/web/src/styles/tokens.css`; what changes is which surfaces claim which
scale, not the tokens themselves.

Everything the visual system already requires still holds: every colour resolves
from a token, state never depends on colour alone, focus is visible, targets are
at least 44px, and `prefers-reduced-motion` removes motion without removing
content. Continuous motion remains banned on any surface that reports a Mission.

## What this does not change

The redesign is a surface change. Every safety invariant survives it intact:

- Never authorize spending. The Approval card is the only path to an economic
  action, and it requires an operator click.
- Never execute an economic action from the conversation. The composer directs a
  Mission; it does not settle anything.
- Never expose private relationship memory beyond the first-party view.
- Never treat unavailable memory as valid history.
- No auth, no accounts, no workspaces (Decision 31).
- Non-mainnet, single-operator, and labelled as such.
- The example Mission stays labelled and goes through the same fold as a real
  one.

## What exists today

| Piece | State |
|---|---|
| Mission workspace shell | Not built. `/runs/[runId]` renders `RunTimeline` |
| Operator / Board / Trace switch | Not built |
| Persistent composer | Not built |
| Event → card renderer | Not built |
| The nine cards | Not built |
| Progress rail | Not built |
| `Why this?` drawer | Not built |
| Memory drawer | Not built; needs the memory endpoints (tracker #32) |
| Counterfactual | Not built |
| Navigation rename | Not done. The rail is Runs, Counterparties, Policies, plus Example Run, Readiness, Back to landing |
| Light Operator layer | Not done. Console surfaces use the operational scale |
| `foldRun` projection | Built and tested. The redesign reuses it unchanged |
| Retrieval states | Built. Only the wording changes |
| Run events endpoint | Built: `GET /api/runs/{id}/events` |
| Event stream | Does not exist. Every Mission is one read, labelled `LATEST SNAPSHOT` |

## Implementation order

1. Replace the `/runs/[runId]` shell with `MissionWorkspace`.
2. Add the `Operator` / `Board` / `Trace` switch.
3. Replace the floating ask control with the persistent composer.
4. Build the shared event renderer that maps canonical events to cards.
5. Add `MemoryRecallCard`, `DecisionCard`, `ApprovalCard`, `AgentJobCard`,
   `TransactionCard`, `OutcomeCard`, `MemoryDiffCard`.
6. Build Board from the same Run events.
7. Move the raw causal stages and lifecycle data into Trace.
8. Replace the Evidence stage with the contextual `Why this?` drawer.
9. Add the memory drawer with source, impact, correction and archive controls.
10. Add the counterfactual view.
11. Replace empty stage sections with progressive rendering.
12. Restyle Operator, Board and the drawers to the editorial layer, and reserve
    the dark layer for Trace.

Steps 5, 9 and 10 depend on memory retrieval (tracker #32). Everything before
them can be built against the events that already exist.

## Related

- [Product brief](product-brief.md) — audience, promise, and scope.
- [Decisions and boundaries](decisions.md) — the decisions this design records.
- [Demo choreography](demo.md) — the walkthrough this design is built to carry.
- [Visual system](visual-system.md) — the two token scales and where each applies.
- [Console shell](../ai/web/console-shell.md) — what the code does today.

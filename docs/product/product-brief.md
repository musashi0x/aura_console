# Product brief

## What

Aura Console is a **live workspace where an operator and an autonomous agent
make decisions together**: you give intent, the agent investigates, remembers,
decides, asks for approval when money is involved, acts, and then shows you
exactly what it learned.

It is not a dashboard, not a chatbot, and not a log viewer. Those are the three
things it must never collapse into, because each of them shows the work from
outside instead of letting the operator take part in it.

Aura Console v0.1 is a **single-operator demo console**. It runs against a
non-mainnet environment and has no account model.

## The mental model

Every Mission tells one story, in order:

```text
You asked
  → Aura remembered
    → Aura investigated
      → Aura chose
        → You approved
          → Agents acted
            → Money moved
              → The result arrived
                → Aura learned
```

A Mission is one economic objective from intent to committed memory. `Mission`
is the operator-facing name; `Run` remains the system's own word, and `run_id`
remains the identifier. See
[Mission workspace](mission-workspace.md) for the full design.

## Audience

- Primary: the operator directing an agent to accomplish something that costs money.
- Secondary: reviewers who need evidence that a decision was explainable, memory-driven, and privacy-safe.
- Not the v0.1 audience: external agent clients, fleet administrators, or production finance operators.

## v0.1 promise

Agent decisions are inspectable, directable, and replayable.

Three claims have to survive contact with a first-time user, without an
architecture explanation:

1. **Memory is load-bearing.** The operator can see that Sibyl changed a
   decision — or that it was consulted and did not — and can open the records
   that did it.
2. **Money is never ambient.** No economic action happens without an explicit
   operator approval carrying an amount and a limit.
3. **Uncertainty is visible.** A failed memory lookup, an unreachable
   dependency, and a genuinely empty result are three different states and never
   render as each other.

The first successful outcome is opening the demo Mission or starting a real one
and understanding what the agent did without reading a document first.

## Entry points

The root route is the [landing page](landing-page.md), and it is the entry point
for a returning operator. A genuinely new browser is routed through
[onboarding](onboarding.md) first. The landing page is a public product surface,
**not** an authenticated workspace: there is nothing to sign into.

## Scope

- Editorial landing page and Console shell.
  The shell owns navigation, the environment label, the readiness result, and
  the state vocabulary (empty, loading, degraded, unavailable memory, live,
  paused, history). It owns no data: it renders what a real check returns and
  says so plainly when a surface has no endpoint behind it.
- The Mission workspace: Operator, Board and Trace over one event stream.
- Conversation that renders interactive cards folded from canonical events.
- Memory made visible as an input and an output, including the counterfactual.
- Readiness checks backed by real API endpoints.
- Onboarding that explains the product and hands off to a Mission.
- Replayable Mission history with frozen decision context and Memory Diff.
- Explicit boundaries around Virtuals ACP and any economic action.

## Implemented today

The landing page, onboarding, the Console shell, and the Run surfaces backed by
the real API exist. The Mission workspace does not: `/runs/[runId]` still
renders a single timeline, there is no Operator/Board/Trace switch, no composer,
and no cards. See [the product index](README.md) for the state of each surface
and [Mission workspace](mission-workspace.md#what-exists-today) for the
per-piece split.

## Out of scope

Authentication, sessions, workspaces, multi-tenancy, server-side consent
records, and automatic spending authorization are not v0.1 features. Adding them
requires an API and architecture decision, not a UI-only change.

A settings surface and a user menu are out of scope for the same reason: with no
account model behind them they would be navigation that opens nothing.

# Console shell

## What

The operator surface for viewing Runs. Three zones: a topbar carrying the brand,
the environment and the readiness result, a navigation rail, and the workspace.
It is not an account dashboard: there is no login, avatar, account menu,
organisation switcher, workspace switcher, or billing, because v0.1 is
single-operator and unauthenticated.

The shell is a frame, not a data source. It never asserts a value it has not
been given: readiness comes in as a prop from a real check, and a Run reference
is shown only when one is selected.

The Run surfaces are now backed by the API. A surface that still has no endpoint
behind it renders an explicit unavailable state rather than an empty one, which
is a different claim: "we could not look" is not "we looked and there is
nothing".

## Where this is going

The Run surfaces are being rebuilt into the
[Mission workspace](../../product/mission-workspace.md): one Mission screen with
`Operator`, `Board` and `Trace` modes, a persistent composer, and a conversation
that renders cards folded from canonical events. The shell, the three modes, the
six-step rail and the Board are built; the event-to-card renderer and the cards
are not, so Operator currently lists each event as an inspectable raw entry.

Two things about that redesign matter when changing anything below.

`foldRun` is reused unchanged. All three modes read the same projection with the
same playhead argument, so the change is entirely above the fold boundary. A
patch that adds a second way to derive Run state is going the wrong way.

The navigation labels move but the routes do not. Missions, Agents, Network and
Guardrails are operator-facing names for `/runs`, `/counterparties`, `/system`
and `/policies`. `Run` stays the system word everywhere in code, the same way
`LIVE` stays the projection's mode name under the `LATEST SNAPSHOT` label.

## Routes

| Route | File | State |
|---|---|---|
| `/runs` | `apps/web/src/app/runs/page.tsx` | Lists real Runs from `GET /api/runs` |
| `/runs/[runId]` | `apps/web/src/app/runs/[runId]/page.tsx` | Folds real events from `GET /api/runs/{id}/events` |
| `/runs/new` | `apps/web/src/app/runs/new/page.tsx` | Creates a Run through `POST /api/runs` |
| `/runs/example` | `apps/web/src/app/runs/example/page.tsx` | Labelled fixture through the real fold |
| `/counterparties` | `apps/web/src/app/counterparties/page.tsx` | Shell renders an unavailable state; the projection endpoint exists but this page does not read it |
| `/policies` | `apps/web/src/app/policies/page.tsx` | Shell renders an unavailable state; `GET /api/policies/{agentId}` exists but this page does not read it |
| `/system` | `apps/web/src/app/system/page.tsx` | Live readiness, fully working |

`/` remains the landing page and `FirstRunGate` still routes a new browser to
`/onboarding`. The Console shell did not take over the root route.

## Where

- `apps/web/src/features/console/components/console-shell.tsx` — `ConsoleShell`;
  takes `surface`, `readiness`, and an optional `runRef`.
- `apps/web/src/features/console/components/console-topbar.tsx` —
  `ConsoleTopbar`; brand, environment label, Run reference, readiness.
- `apps/web/src/features/console/components/console-navigation.tsx` —
  `ConsoleNavigation`; one list: Missions, Agents, Network, Guardrails, Docs.
  The secondary list is gone. The example Mission still needs its `Demo` badge
  in Missions, and readiness still needs to reach the Network status chip.
- `apps/web/src/features/console/components/console-status.tsx` —
  `ConsoleStatus`, `ReadinessState` = `"ready" | "degraded" | "checking"`.
- `apps/web/src/features/console/components/console-states.tsx` —
  `ConsoleEmptyState`, `ConsoleLoadingState`, `ConsoleErrorState`,
  `ConsoleUnavailableMemory`, `ConsoleTransportLabel`.
- `apps/web/src/features/console/copy.ts` — `console_`; every visible string in
  the shell, so wording is reviewed in one place rather than per component.
- `apps/web/src/features/console/components/mission-workspace.tsx` —
  `MissionWorkspace`; mounted on `/runs/[runId]` with real events and on
  `/runs/example` with a labelled fixture. Both go through the same fold, so the
  example cannot diverge from the product it demonstrates. It owns the playhead
  and hands one `RunView` to all three modes.
- `apps/web/src/features/console/components/mission-operator.tsx`,
  `mission-board.tsx`, `mission-trace.tsx`, `mission-rail.tsx` — the three modes
  and the six-step rail. None of them fetch or fold; they render what
  `MissionWorkspace` already projected.
- `apps/web/src/features/console/projection/mission-rail.ts` —
  `buildMissionProgress`; the total mapping from the ten canonical stages to the
  six rail steps, and the Board column each step falls in.
- `apps/web/src/features/console/model/from-api.ts` — the only place the API's
  wire shape meets the projection's input shape.
- `apps/web/src/features/console/fixtures/example-run.ts` — the example Run.
  `source: "FIXTURE"` reaches the fold, so the origin field says so on screen.
- `apps/web/src/features/console/model/types.ts` — `RunView`, `RunStatus`,
  `RetrievalStatus`, `CanonicalStage`, `ContextEnvelope`, `CanonicalEvent`,
  `TimelineEntry`, `RunAttention`.
- `apps/web/src/features/console/projection/fold-run.ts` — `foldRun`, `FoldSeed`.
- `apps/web/src/features/console/projection/order-events.ts` — `orderEvents`,
  `dedupeEvents`.
- `apps/web/src/features/console/projection/stage-map.ts` — `stageFor`.
- `apps/web/src/features/console/presentation/presentation-state.ts` —
  `PresentationState`, `presentationReducer`, `playhead`, `isHistorical`.

## The projection is the contract

`foldRun(events, seed, upToSequence)` is the only projection. Live is
`upToSequence === null`; replay passes a playhead. That is the entire
difference, which is what stops live and replay drifting apart.

Properties held by tests: canonical order by `(run_id, sequence)` regardless of
arrival order, deduplication by `event_id`, identical output for any arrival
order, no economic value computed locally, no completion inferred from silence,
only the five envelope fields exposed, and unrecognised event types kept
inspectable rather than dropped.

## States

| State | Component | What it may claim |
|---|---|---|
| Empty | `ConsoleEmptyState` | Explains what a Run is and links only to destinations that exist |
| Loading | `ConsoleLoadingState` | `role="status"` skeletons; never a status word such as ready or healthy. Rendered by `runs/loading.tsx` and `runs/[runId]/loading.tsx` |
| Degraded | `ConsoleErrorState` | Names the failed dependency, the consequence, and a retry |
| Unavailable memory | `ConsoleUnavailableMemory` | States memory could not be read; infers no history |
| Latest snapshot / history | `ConsoleTransportLabel` | History always carries its timestamp so it cannot read as current |

`ConsoleUnavailableMemory` and the unavailable states exist because "no runs
yet" would claim a verified empty list. On `/runs` the API now answers, so an
empty list is a real empty list; on a surface with no endpoint the unavailable
state still stands. Do not swap one for the other.

## Loading

Every Run route is an async server component, so without a Suspense fallback a
slow database gave a blank page and then a finished one, with nothing between.
`ConsoleLoadingState` existed and was tested while no route rendered it.

`apps/web/src/app/runs/loading.tsx` and `runs/[runId]/loading.tsx` render the
shell with `readiness="checking"`. The check has not answered yet, so borrowing
`ready` would report a verified result the page does not have. That is the whole
reason `checking` exists as a third state rather than a default to `ready`.

The detail segment makes two requests and is the slowest, so its label names
what is being read instead of saying "Loading", which tells a reader nothing
about whether to wait.

## Transport

A Run surface reads once — not because no stream exists, but because the one
that exists is a finite replay and nothing subscribes to it. What the surface
offers reflects that.

| Control | When | What it does |
|---|---|---|
| Event row | Always | Scrubs to that event and enters `HISTORY`, labelled with the event's exact timestamp |
| `Back to latest` | Run in progress | Returns to `LATEST SNAPSHOT` |
| `Back to the end` | Terminal Run | Returns to `ENDED` at the final event |

**There is no Play and no Pause, deliberately.** Nothing advances the playhead:
no timer, no stream. Pressing Play changed a badge to `PLAYING` over a still
timeline and removed the way back, which is worse than offering nothing. The
`play` and `pause` commands are removed from `TransportCommand`, so `PLAYING`
and `PAUSED` cannot be reached: a caller that dispatches one does not typecheck.
Both remain in the `PresentationState` union as states the product will have
once the playhead can advance.

The return control is ALWAYS present. It was briefly removed on a terminal Run,
reasoning that a finished Run has no live edge to return to. It has an END, and
without the control a reader who scrubbed into `HISTORY` had no way out short of
reloading. The label names the real destination rather than implying an edge
that is still moving.

`LIVE` remains the internal mode name in `PresentationState` because it means
"no ceiling on the playhead", which is the fold's own vocabulary. The
user-facing label is `LATEST SNAPSHOT`. Do not rename the projection concept to
fix a label.

## Responsive

Above `48rem` the rail sits beside the workspace. Below it the body collapses to
one column and the rail becomes a horizontal strip with its own `overflow-x`, so
a long destination list scrolls inside the strip instead of widening the page.
A strip was chosen over a drawer because there are six destinations and no
hidden state is worth a toggle that can desynchronise. Reduced motion is handled
by the global `prefers-reduced-motion` rule, which removes shell transitions
without removing any content or state.

## Endpoints

All five exist and are mounted: `POST /api/runs`, `GET /api/runs`,
`GET /api/runs/{id}`, `GET /api/runs/{id}/events`, and
`GET /api/runs/{id}/stream`.

The stream landing did not make the Console live, and adding a client method for
it would not either. It is a **finite replay**: it writes the stored events in
sequence order, ends with `replay.complete`, and pushes nothing appended after
it started (see
[the stream is a replay](../api/runs.md#the-stream-is-a-replay-not-a-live-tail)).
So `apps/web/src/lib/api-client.ts` still has no `stream` method — its comment
saying the server has no stream is now out of date, but the conclusion it draws
is not — and a Run surface still reads its events ONCE, which is why the
transport says `LATEST SNAPSHOT` rather than `LIVE`. "Live" would claim a
subscription the Console does not have.

The counterparty and policy surfaces are the reverse case: `GET
/api/counterparties`, `GET /api/counterparties/{key}`,
`GET /api/counterparties/{key}/memory` and `GET /api/policies/{agentId}` all
exist, and neither page reads any of them. Their unavailable copy still says the
endpoint does not exist, which is now the wrong reason for the right state —
correct the copy when wiring the surface, not before.

## Screenshots

- `docs/product/screenshots/console-runs-1440.png` — rail beside the workspace.
- `docs/product/screenshots/console-runs-1024.png` — same layout, narrower workspace.
- `docs/product/screenshots/console-runs-390.png` — rail as a scrolling strip.
- `docs/product/screenshots/console-system-1440.png` — readiness from live checks.
- `docs/product/screenshots/console-system-390.png` — the same at 390px.

## Tests

- `apps/web/src/features/console/projection/fold-run.test.ts`
- `apps/web/src/features/console/presentation/presentation-state.test.ts`
- `apps/web/src/features/console/components/console-shell.test.tsx` —
  landmarks, `aria-current`, absence of account surfaces, readiness taken from
  the prop rather than assumed, every state surface, axe, responsive and motion
  rules read from `globals.css`.
- `apps/web/src/features/console/components/mission-workspace.test.tsx`
- `apps/web/src/features/console/projection/mission-rail.test.ts`

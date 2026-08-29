# Console shell

## What

The operator surface for viewing Runs. Three zones: a topbar carrying the brand,
the environment and the readiness result, a navigation rail, and the workspace.
It is not an account dashboard: there is no login, avatar, account menu,
organisation switcher, workspace switcher, or billing, because v0.1 is
single-operator and unauthenticated.

The shell is a frame, not a data source. It never asserts a value it has not
been given: readiness comes in as a prop from a real check, a Run reference is
shown only when one is selected, and every surface without an endpoint renders
an explicit unavailable state rather than an empty one.

## Routes

| Route | File | State |
|---|---|---|
| `/runs` | `apps/web/src/app/runs/page.tsx` | Shell renders; no Runs endpoint |
| `/runs/[runId]` | `apps/web/src/app/runs/[runId]/page.tsx` | Shell renders; no events endpoint |
| `/runs/new` | `apps/web/src/app/runs/new/page.tsx` | Creates a Run through `POST /api/runs` |
| `/runs/example` | `apps/web/src/app/runs/example/page.tsx` | Labelled fixture through the real fold |
| `/counterparties` | `apps/web/src/app/counterparties/page.tsx` | Shell renders; no projection |
| `/policies` | `apps/web/src/app/policies/page.tsx` | Shell renders; no policy endpoint |
| `/system` | `apps/web/src/app/system/page.tsx` | Live readiness, fully working |

`/` remains the landing page and `FirstRunGate` still routes a new browser to
`/onboarding`. The Console shell did not take over the root route.

## Where

- `apps/web/src/features/console/components/console-shell.tsx` — `ConsoleShell`;
  takes `surface`, `readiness`, and an optional `runRef`.
- `apps/web/src/features/console/components/console-topbar.tsx` —
  `ConsoleTopbar`; brand, environment label, Run reference, readiness.
- `apps/web/src/features/console/components/console-navigation.tsx` —
  `ConsoleNavigation`; primary list (Runs, Counterparties, Policies) and a
  secondary list (Example Run, Readiness, Back to landing).
- `apps/web/src/features/console/components/console-status.tsx` —
  `ConsoleStatus`, `ReadinessState` = `"ready" | "degraded" | "checking"`.
- `apps/web/src/features/console/components/console-states.tsx` —
  `ConsoleEmptyState`, `ConsoleLoadingState`, `ConsoleErrorState`,
  `ConsoleUnavailableMemory`, `ConsoleTransportLabel`.
- `apps/web/src/features/console/copy.ts` — `console_`; every visible string in
  the shell, so wording is reviewed in one place rather than per component.
- `apps/web/src/features/console/components/run-timeline.tsx` — `RunTimeline`;
  implemented and tested, currently unmounted because nothing can feed it.
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
| Loading | `ConsoleLoadingState` | `role="status"` skeletons; never a status word such as ready or healthy |
| Degraded | `ConsoleErrorState` | Names the failed dependency, the consequence, and a retry |
| Unavailable memory | `ConsoleUnavailableMemory` | States memory could not be read; infers no history |
| Live / paused / history | `ConsoleTransportLabel` | History always carries its timestamp so it cannot read as current |

`ConsoleUnavailableMemory` and the unavailable states exist because "no runs
yet" would claim a verified empty list. Nothing has been queried. Do not replace
these with empty states until a real endpoint returns a real empty result.

## Responsive

Above `48rem` the rail sits beside the workspace. Below it the body collapses to
one column and the rail becomes a horizontal strip with its own `overflow-x`, so
a long destination list scrolls inside the strip instead of widening the page.
A strip was chosen over a drawer because there are six destinations and no
hidden state is worth a toggle that can desynchronise. Reduced motion is handled
by the global `prefers-reduced-motion` rule, which removes shell transitions
without removing any content or state.

## Missing endpoints

Four of the five exist and are mounted: `POST /api/runs`, `GET /api/runs`,
`GET /api/runs/{id}` and `GET /api/runs/{id}/events`.

`GET /api/runs/{id}/stream` does not. There is deliberately no client method for
it: a method that 404s turns a known gap into a runtime failure. Until it lands,
a Run surface reads its events ONCE, so the transport says `LATEST SNAPSHOT`
rather than `LIVE`. "Live" would claim a subscription the Console does not
have.

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
- `apps/web/src/features/console/components/run-timeline.test.tsx`

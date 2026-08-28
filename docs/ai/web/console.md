# Console shell

## What

The operator surface for viewing Runs. Three zones: a context bar, a navigation
rail, and the workspace. It is not an account dashboard: there is no login,
avatar, account menu, organisation switcher, workspace switcher, or billing,
because v0.1 is single-operator and unauthenticated.

## Routes

| Route | File | State |
|---|---|---|
| `/runs` | `apps/web/src/app/runs/page.tsx` | Shell renders; no Runs endpoint |
| `/runs/[runId]` | `apps/web/src/app/runs/[runId]/page.tsx` | Shell renders; no events endpoint |
| `/runs/new` | `apps/web/src/app/runs/new/page.tsx` | Placeholder, task #61 |
| `/runs/example` | `apps/web/src/app/runs/example/page.tsx` | Placeholder, task #61 |
| `/counterparties` | `apps/web/src/app/counterparties/page.tsx` | Shell renders; no projection |
| `/policies` | `apps/web/src/app/policies/page.tsx` | Shell renders; no policy endpoint |
| `/system` | `apps/web/src/app/system/page.tsx` | Live readiness, fully working |

`/` remains the landing page and `FirstRunGate` still routes a new browser to
`/onboarding`. The Console shell did not take over the root route.

## Where

- `apps/web/src/features/console/components/console-shell.tsx` — `ConsoleShell`;
  takes `surface` and `ready`.
- `apps/web/src/features/console/components/data-unavailable.tsx` —
  `DataUnavailable`; the honest state for a surface with no data source.
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

## Unavailable is not empty

`DataUnavailable` exists because "no runs yet" would claim a verified empty
list. Nothing has been queried. Do not replace these with empty states until a
real endpoint returns a real empty result.

## Missing endpoints

The Console needs `POST /api/runs`, `GET /api/runs`, `GET /api/runs/{id}`,
`GET /api/runs/{id}/events`, and a stream. None exist; the API serves only
`/health` and `/health/db`. They belong to task #30. Do not add client methods
that would call a route that is not there.

## Tests

- `apps/web/src/features/console/projection/fold-run.test.ts`
- `apps/web/src/features/console/presentation/presentation-state.test.ts`
- `apps/web/src/features/console/components/console-shell.test.tsx`
- `apps/web/src/features/console/components/run-timeline.test.tsx`

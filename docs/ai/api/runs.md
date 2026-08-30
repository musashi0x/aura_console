# Runs and events

## What

The Run skeleton: a Run seed plus its append-only event history. This is the
data the Console projection folds. The API stores what it is told and derives
nothing, so no endpoint here reports a spent amount, a status, or a completion.

Unauthenticated, by [Decision 31](../../product/decisions.md). v0.1 is
single-operator and non-mainnet; adding auth is a later decision, not an
oversight.

## Endpoints

| Method | Path | Returns |
|---|---|---|
| `POST` | `/api/runs` | `201` with the new Run seed |
| `GET` | `/api/runs` | `200` with real rows, newest first |
| `GET` | `/api/runs/:runId` | `200`, or `404` when the Run does not exist |
| `GET` | `/api/runs/:runId/events` | `200` with events in sequence order |
| `POST` | `/api/runs/:runId/events` | `201` when appended, `200` when the append was a replay |

`GET /api/runs/:runId/events?after=<sequence>` returns only events after that
sequence, which is what lets a reconnecting client resume without replaying
events it already folded.

Errors use the shared `{ error: { code, message } }` envelope:
`invalid_json` (400), `invalid_run_id` (400), `invalid_limit` (400),
`invalid_after` (400), `run_not_found` (404), `event_conflict` (409),
`invalid_payload` (422).

A missing Run answers `404` on its events, never `200` with an empty list. An
empty list would say the Run exists and has no history.

## Storage

`packages/db/src/schema/runs.ts`.

```text
runs        id, objective, source, environment, budget_usdc, created_at, updated_at
run_events  event_id, run_id, sequence, type, event_time, data, created_at
```

Constraints that the tests rely on, not just describe:

- `unique (run_id, sequence)` — canonical order per Run.
- `event_id` primary key — one row per producer-supplied id.
- `run_events.run_id → runs.id on delete cascade`.
- `sequence >= 0`, non-blank `objective` and `type`, `budget_usdc >= 0`,
  `source in (CONSOLE, AGENT, FIXTURE)`.

`budget_usdc` is `numeric(20,6)` and crosses the wire as a string. It is a
declared ceiling, never an amount spent.

## Append semantics

`RunStore` in `apps/api/src/services/run-store.ts` owns every write. Route
handlers never allocate a sequence number, because allocation is only safe
inside the transaction that also inserts the row.

- Creating a Run inserts the `runs` row and its `run.created` event in one
  transaction, so a Run can never exist with no history.
- An append locks the `runs` row `for update`, reads `max(sequence)`, and
  inserts. The unique index is the backstop, not the mechanism. Removing the
  lock makes the concurrent-append test fail, which is how the test earns its
  place.
- A repeated `event_id` with identical content returns the stored event and
  `200`. A repeated `event_id` with different content is `409`: keeping either
  version would make history depend on delivery order.
- `event_time` comes from the producer. The server never substitutes request
  arrival time for domain time.
- An unrecognised `type` is stored and returned unchanged. The Console marks it
  `UNSUPPORTED_TYPE` rather than dropping it.

## Tests

`apps/api/src/routes/runs.test.ts` runs against a real Postgres, not a fake, so
the constraints above are exercised rather than described. The database name is
derived from `DATABASE_URL` by appending `_test`, and
`apps/api/src/test/global-setup.ts` creates and migrates it once per suite.
Set `TEST_DATABASE_URL` to override.

## What the Console does with these

`RunTimeline` is mounted against them. `/runs` lists from `GET /api/runs`,
`/runs/[runId]` folds `GET /api/runs/{id}/events`, and `/runs/new` creates
through `POST /api/runs`. `/runs/example` renders a labelled fixture through the
same fold, so the example cannot drift from the product.

`source` reaches the screen unchanged: `CONSOLE`, `AGENT` and `FIXTURE` stay
distinct, because who opened a Run is a fact about it and the API is the
transport that carried it, not the actor that started it.

## Not here yet

- `GET /api/runs/:runId/stream` — SSE with `Last-Event-ID` replay.

Its absence is visible in the product, not hidden: a Run surface reads once and
reports `LATEST SNAPSHOT` rather than `LIVE`, and there is no Play or Pause
because nothing advances the playhead. `?after=<sequence>` already exists for
the resume-without-duplicates path a stream will need, so adding one should not
require changing how events are read.

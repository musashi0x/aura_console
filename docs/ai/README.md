# Aura Console code map

Aura Console is a pnpm/Turborepo monorepo for a single-operator console, its
Hono API, and a Drizzle/Postgres data layer.

Implemented today: the editorial landing page at `/`, the first-run onboarding
flow at `/onboarding`, the Console shell at `/runs`, `/counterparties`,
`/policies`, `/system` and `/docs`, and the three health endpoints. The Run API
exists and the Run surfaces are mounted against it: Runs are created through
`POST /api/runs`, listed from `GET /api/runs`, and folded from
`GET /api/runs/{id}/events`. `GET /api/runs/{id}/stream` exists too, as an
ordered **finite replay** of stored events that ends with `replay.complete` —
not a live tail, and no client method calls it yet, which is why a Run surface
still reads once and says `LATEST SNAPSHOT`. Counterparty memory is composed
from Postgres and Sibyl behind `GET /api/counterparties/{key}/memory`.

Not implemented: authentication, any economic action, a stream that stays open
and pushes new events, the event-to-card renderer in the Mission conversation,
and any write to Sibyl through the API — the bridge is read-only on purpose.
Route-level tests for the counterparty memory endpoints are not written yet, so
treat those two routes as landed code without landed coverage. Do not invent
backend state to fill any of these gaps.

## Areas

- [Web](web/README.md) — Next.js App Router routes, the landing page, onboarding, design tokens, and the browser API client.
- [API](api/README.md) — Hono application, CORS/error handling, request logging, and health routes.
- [Database](db/README.md) — Drizzle client, environment loading, schema, and migrations.
- [Product documentation](../product/README.md) — scope, onboarding, landing page, visual direction, demo choreography, and decisions.
- [Mission workspace](../product/mission-workspace.md) — the target design for the Run surfaces. It reuses `foldRun` unchanged; the change is what renders above it.
- [Repository README](../../README.md) — local setup, scripts, environment, health checks, and CI.

## Source of truth

Tracker: [Aura Console project 3](https://tracking-frontend-production-e046.up.railway.app/projects/3).
The tracker holds the canonical numbered product documents; this map describes
the code as it exists. Where they disagree, the code is the fact and the
tracker is the intent.

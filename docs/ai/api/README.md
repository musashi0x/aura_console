# API

The API is a Hono server running on Node. It exposes liveness and database readiness, applies request logging and CORS, and returns a stable JSON error envelope.

## Topics

- [Application and server lifecycle](application.md) — middleware, routes, errors, startup, and graceful shutdown.
- [Health contract](health.md) — `/health` and `/health/db` semantics.
- [Runs and events](runs.md) — the Run skeleton, the event store, and append semantics.

## What the Console still cannot call

The Run skeleton landed, so `POST /api/runs`, `GET /api/runs`,
`GET /api/runs/{run_id}` and `GET /api/runs/{run_id}/events` now exist and are
covered by tests against a real Postgres.

One endpoint is still missing:

| Endpoint | Used by |
|---|---|
| `GET /api/runs/{run_id}/stream` | Live updates while a Run is in flight |

Until it exists, a Run surface reads its events once and says so. Do not add a
client method that would call the stream: a method that 404s is worse than an
absent one, because it turns a known gap into a runtime failure.

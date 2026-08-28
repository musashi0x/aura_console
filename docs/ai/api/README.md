# API

The API is a Hono server running on Node. It exposes liveness and database readiness, applies request logging and CORS, and returns a stable JSON error envelope.

## Topics

- [Application and server lifecycle](application.md) — middleware, routes, errors, startup, and graceful shutdown.
- [Health contract](health.md) — `/health` and `/health/db` semantics.

## Endpoints the Console needs and does not have

The Console shell is implemented and renders honest unavailable states because
these do not exist. They belong to task #30, not to frontend work.

| Endpoint | Used by |
|---|---|
| `POST /api/runs` | Run creation, the canonical entry point |
| `GET /api/runs` | The Runs list at `/runs` |
| `GET /api/runs/{run_id}` | Run detail hydration |
| `GET /api/runs/{run_id}/events` | Ordered replay and reconnect |
| `GET /api/runs/{run_id}/stream` | Live updates |

Until they exist, do not add client methods that would call them. A method that
404s is worse than an absent one, because it turns a known gap into a runtime
failure.

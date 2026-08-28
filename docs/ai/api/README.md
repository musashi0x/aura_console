# API

The API is a Hono server running on Node. It exposes liveness and database readiness, applies request logging and CORS, and returns a stable JSON error envelope.

## Topics

- [Application and server lifecycle](application.md) — middleware, routes, errors, startup, and graceful shutdown.
- [Health contract](health.md) — `/health` and `/health/db` semantics.

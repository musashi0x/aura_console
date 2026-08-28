# Health contract

## What

Health routes separate process liveness from Postgres readiness so deploy systems can distinguish “the process is running” from “the dependency chain is usable.”

## Where

- `apps/api/src/routes/health.ts` — exported `health` router, `GET /`, and `GET /db`.
- `apps/api/src/routes/health.ts` — liveness response (`status`, `uptime`, `timestamp`).
- `apps/api/src/routes/health.ts` — readiness query (`select 1`), latency measurement, and 503 failure response.
- `apps/api/src/app.test.ts` — route and error behavior tests.

## Approach

`GET /health` remains 200 when Postgres is down. `GET /health/db` returns 200 with `latencyMs` only after a real query succeeds, otherwise 503 with `database_unreachable`. Do not use either endpoint to imply authentication, policy readiness, agent identity, or economic authorization.

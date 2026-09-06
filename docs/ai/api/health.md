# Health contract

## What

Health routes separate process liveness from dependency readiness so deploy systems can distinguish “the process is running” from “the dependency chain is usable.” There is one route per dependency, because a single aggregate answer would make an unreachable Sibyl indistinguishable from an unreachable database.

## Where

- `apps/api/src/routes/health.ts` — exported `health` router, `GET /`, and `GET /db`.
- `apps/api/src/routes/health.ts` — liveness response (`status`, `uptime`, `timestamp`).
- `apps/api/src/routes/health.ts` — readiness query (`select 1`), latency measurement, and 503 failure response.
- `apps/api/src/routes/health.ts` — `GET /sibyl`, delegating to `getSibylStatus()`.
- `apps/api/src/services/sibyl.ts` — `SibylStatus` and the read-only bridge call behind it.
- `apps/api/src/app.test.ts` — route and error behavior tests.

## Approach

`GET /health` remains 200 when Postgres is down. `GET /health/db` returns 200 with `latencyMs` only after a real query succeeds, otherwise 503 with `database_unreachable`. Do not use any of these endpoints to imply authentication, policy readiness, agent identity, or economic authorization.

`GET /health/sibyl` answers **200 always**, including when Sibyl cannot be
reached. The 503 the database route uses would say the API is down when what is
down is one optional dependency, and the Console needs a body to render the
right unavailable state from. The shape carries the distinction instead:

- `configured: false` — `SIBYL_PYTHON` is unset, so this deployment has no
  runtime to ask. Nothing failed; nothing was attempted.
- `configured: true, reachable: false` — we tried and could not look. `code` and
  `detail` name the cause: `bridge_unreachable` (the process would not run, or
  its output would not parse), or one the bridge itself reported —
  `client_missing`, `db_absent`, `client_error`, `call_failed`.
- `reachable: true` — Sibyl answered, and only then do `tier`, `schemaVersion`,
  `entityCount` and the free-tier cap numbers appear.

The counts are absent rather than zeroed on the two unreachable cases. A zeroed
`entityCount` would read as "Sibyl is here and empty", which is a claim about
memory that nobody verified.

`schemaVersion` is Sibyl's **SQLite schema** version. It is not a memory
version, and using it as one would put an unversioned number where the on-chain
commit expects `counterparty_profiles.memory_version`.

Reachability is not the same question as whether Sibyl takes part in retrieval,
and this route answers only the first. There is no `retrievalEnabled` field
today; derive participation from `sibyl.consulted` on
[`GET /api/counterparties/{key}/memory`](memory.md), which reports it per
retrieval.

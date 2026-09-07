# API

The API is a Hono server running on Node. It exposes liveness and dependency readiness, the Run skeleton and its event log, the counterparty projection, operator policies, and composed counterparty memory. It applies request logging and CORS, and returns a stable JSON error envelope.

## Topics

- [Application and server lifecycle](application.md) — middleware, routes, errors, startup, and graceful shutdown.
- [Health contract](health.md) — `/health`, `/health/db` and `/health/sibyl` semantics.
- [Runs and events](runs.md) — the Run skeleton, the event store, append semantics, and the finite replay stream.
- [Counterparty memory](memory.md) — the Sibyl bridge, the verdict mapping, and the composed retrieval endpoints.
- [Model Context Protocol & Universal Chat](mcp.md) — standard MCP tool definitions, stdio/HTTP transports, and universal chat routing.
- [ACP runtime](acp.md) — the verified ACP SDK surface, the client runtime, the bridge that records its stream as Run events, and Agent Compute.

## What the Console still cannot call

Every endpoint the Console needs to render a Run now exists. `POST /api/runs`,
`GET /api/runs`, `GET /api/runs/{run_id}` and `GET /api/runs/{run_id}/events`
are covered by tests against a real Postgres.

What is missing is a *live* stream, not a stream.
`GET /api/runs/{run_id}/stream` exists and is an ordered **finite replay** that
ends with `replay.complete`; nothing pushes an event appended after it started.
There is still deliberately no `stream` method in the browser client, and adding
one would not make a Run surface live — see
[the stream is a replay](runs.md#the-stream-is-a-replay-not-a-live-tail).

Two endpoints are landed code without landed coverage:
`GET /api/counterparties/{key}/memory` and `.../memory/records` have no
route-level tests. They work, and the repository rule is that a feature is not
shipped until code, tests and task status agree — so they are described as built
and untested, which is what they are.

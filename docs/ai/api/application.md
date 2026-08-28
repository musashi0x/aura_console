# Application and server lifecycle

## What

The Hono application composes cross-cutting middleware and routes; the Node server owns the listener and graceful shutdown.

## Where

- `apps/api/src/app.ts` — exported `app`, request logger, CORS, route mounting, `notFound`, and `onError` handlers.
- `apps/api/src/server.ts` — `serve`, `shutdown`, and SIGINT/SIGTERM handlers.
- `apps/api/src/errors.ts` — `errorBody`, the JSON error envelope used by API failures.
- `apps/api/src/middleware/request-logger.ts` — request timing/logging middleware.
- `apps/api/src/env.ts` — server environment schema and startup validation.

## Approach

Unexpected errors are logged server-side while responses expose only a safe code and message. New routes should be mounted in `app.ts`, documented in the API contract, and covered by route-level tests before the UI depends on them.

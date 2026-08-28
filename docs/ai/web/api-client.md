# API client and environment

## What

The web client provides a small typed wrapper around API requests and normalizes network, HTTP, and JSON failures into one result shape.

## Where

- `apps/web/src/lib/api-client.ts` — `ApiResult`, `DbHealth`, `request`, and `apiClient.dbHealth`.
- `apps/web/src/lib/api-client.ts` — `cache: "no-store"`; health checks must reflect current state.
- `apps/web/src/lib/env.ts` — `envSchema`, `parseEnv`, and exported `env`.

## Approach

The API base URL is validated at startup/build time. Keep browser-readable readiness checks limited to endpoints that actually exist; policy and agent identity remain “Not checked” until the API contract defines safe endpoints.

# Schema and migrations

## What

Drizzle schema files describe database tables and generated SQL migrations are the reviewable deployment artifacts.

## Where

- `packages/db/src/schema/health-check.ts` — `healthChecks`, `HealthCheck`, and `NewHealthCheck`; the current baseline table.
- `packages/db/src/schema/index.ts` — schema barrel export.
- `packages/db/src/migrate.ts` — explicit migration runner.
- `packages/db/drizzle/` — committed SQL migrations and Drizzle metadata.

## Approach

Edit TypeScript schema first, run `pnpm db:generate`, review and commit the generated SQL, then run `pnpm db:migrate`. Do not document future domain tables until they exist in the schema and API contract.

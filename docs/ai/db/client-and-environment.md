# Client and environment

## What

The database package validates `DATABASE_URL`, creates one reusable Postgres pool, and exposes Drizzle helpers to the API and migration command.

## Where

- `packages/db/src/env.ts` — `loadDbEnv` and `DbEnv`.
- `packages/db/src/root-env.ts` — `loadRootEnvFile` for the shared repository `.env`.
- `packages/db/src/client.ts` — `getPool`, `getDb`, `closeDb`, and the `Database` type.
- `packages/db/src/index.ts` — public package exports consumed as `@aura/db`.

## Approach

The API never auto-migrates on boot. Pool shutdown is explicit so the server can finish connections before exit; deployment automation owns applying migrations.

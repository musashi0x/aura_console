# Aura Console code map

Aura Console is a pnpm/Turborepo monorepo for a single-operator console, its
Hono API, and a Drizzle/Postgres data layer.

Implemented today: the editorial landing page at `/`, the first-run onboarding
flow at `/onboarding`, labelled placeholders for the Run destinations, and
health endpoints. Not implemented: the Console shell, the real Run timeline,
authentication, and any economic action. Do not invent backend state to fill
those gaps.

## Areas

- [Web](web/README.md) — Next.js App Router routes, the landing page, onboarding, design tokens, and the browser API client.
- [API](api/README.md) — Hono application, CORS/error handling, request logging, and health routes.
- [Database](db/README.md) — Drizzle client, environment loading, schema, and migrations.
- [Product documentation](../product/README.md) — scope, onboarding, landing page, visual direction, demo choreography, and decisions.
- [Repository README](../../README.md) — local setup, scripts, environment, health checks, and CI.

## Source of truth

Tracker: [Aura Console project 3](https://tracking-frontend-production-e046.up.railway.app/projects/3).
The tracker holds the canonical numbered product documents; this map describes
the code as it exists. Where they disagree, the code is the fact and the
tracker is the intent.

# Aura Console

A pnpm + Turborepo monorepo: a Next.js web app, a Hono API, and Postgres through Drizzle ORM.

## Documentation

- [Product documentation](docs/product/README.md) — scope, onboarding, visual system, demo choreography, and decisions.
- [Mission workspace](docs/product/mission-workspace.md) — the target design for the Console's main screen. Read before changing the Run surfaces.
- [AI code map](docs/ai/README.md) — progressive-disclosure map from product areas to source files and symbols.

## Prerequisites

- **Node 22+** (`.nvmrc` pins the major — `nvm use`)
- **pnpm 10+** (`corepack enable` picks up the pinned version from `package.json`)
- **Docker** for local Postgres, or any reachable Postgres via `DATABASE_URL`

## Getting started

```bash
pnpm install
docker compose up -d          # Postgres on host port 5436
cp .env.example .env
pnpm db:migrate               # apply committed migrations
pnpm dev                      # web on :3000, API on :3001
pnpm agent                    # ADK agent on :8000, in a second terminal
```

`pnpm agent` is not optional if you want to use the Console. The API keeps the
chat honest by refusing to answer without a reachable agent, so with nothing on
:8000 every question returns `503 agent_unavailable` and every surface renders
the grounding warning. That is the app working as designed, but it looks
identical to an app that does nothing. Check what is actually up before
debugging anything else:

```bash
curl -s localhost:3001/health/db localhost:3001/health/sibyl localhost:3001/health/agent
```

Sibyl Memory is optional and off by default. With `SIBYL_PYTHON` unset the API
never consults it and says so; setting it opts the deployment in. It needs its
own Python 3.10+ interpreter — `/usr/bin/python3` on macOS is still 3.9 and the
install fails there:

```bash
python3.11 -m venv .venv-sibyl
.venv-sibyl/bin/pip install sibyl-memory-client
# the bridge never creates the store; the tenant must match AGENT_ID in .env
SIBYL_TENANT_ID=agent_buyer_1 .venv-sibyl/bin/python tools/sibyl_seed.py
# then uncomment SIBYL_PYTHON in .env
```

Keep that interpreter inside the repository. Pointed at a scratchpad or temp
directory it works until the directory is cleaned, and then memory goes dark
with no signal other than the Console reporting NOT CONNECTED.

[Counterparty memory](docs/ai/api/memory.md) covers what changes once it is set.

Open http://localhost:3000. A fresh browser is routed to `/onboarding`; once you
acknowledge or skip, `/` shows the landing page. The header readiness badge comes
from the real API database check, so `SYSTEM READY` means the whole chain is
wired: web → API → Postgres.

Current routes: `/` (landing), `/onboarding`, and the Console shell at `/runs`,
`/runs/new`, `/runs/example`, `/runs/[runId]`, `/counterparties`, `/policies`,
`/system` and `/docs` (with `installation`, `theming`, `skills`, `ai-agents` and
`changelog` beneath it). `/runs`, `/runs/new` and `/runs/[runId]` are backed by
the real API; `/runs/example` renders a labelled fixture through the same fold,
so the example cannot drift from the product. See the
[landing page documentation](docs/product/landing-page.md) and the
[Console shell](docs/ai/web/console-shell.md).

Ports are configurable (`WEB_PORT`, `PORT`, `POSTGRES_PORT`) because the
defaults collide with whatever else you have running.

## Layout

```
apps/
  web/                 @aura/web     Next.js 16, App Router
  api/                 @aura/api     Hono on @hono/node-server
packages/
  db/                  @aura/db      Drizzle schema, pool, migrations
  tsconfig/            @aura/tsconfig  base / node / next presets
  eslint-config/       @aura/eslint-config  shared flat config
```

Cross-package imports use the package name (`@aura/db`), never a relative path.
ESLint fails the build on any relative import that escapes a package root.

## Scripts

Every root script fans out through Turborepo.

| Script | What it does |
|---|---|
| `pnpm dev` | Runs the web and API dev servers concurrently (persistent, uncached) |
| `pnpm build` | Builds every package in dependency order, cached |
| `pnpm lint` | ESLint across all packages, warnings included (`--max-warnings 0`) |
| `pnpm typecheck` | `tsc --noEmit` across all packages |
| `pnpm test` | Vitest suites |
| `pnpm db:generate` | Generates a SQL migration from the Drizzle schema |
| `pnpm db:migrate` | Applies pending migrations |

Scope any of them to one package with `pnpm --filter @aura/api <script>`.

## Environment

One `.env` at the repository root feeds every server-side entrypoint (API,
migrations, drizzle-kit); `apps/web/next.config.ts` loads the same file so Next
sees it too. `.env.example` documents each variable. Values already present in
the process environment always win, which is what makes CI and containers work.

Both apps validate their environment with Zod at startup and exit non-zero
naming the offending variable — a missing `DATABASE_URL` is a five-second
failure, not a mystery error under load.

## Changing the schema

```bash
# 1. edit packages/db/src/schema/*.ts
pnpm db:generate      # writes SQL into packages/db/drizzle/
git add packages/db/drizzle
pnpm db:migrate       # applies it
```

**Commit the generated SQL.** The migration is the reviewable artifact; the
TypeScript schema is its source.

The API never auto-migrates on boot, and `drizzle-kit push` is for local
experiments only. Migrations are applied by an explicit command so that N
replicas can never race to rewrite the schema during a deploy.

## Health endpoints

| Endpoint | Behavior |
|---|---|
| `GET /health` | Liveness. Answers 200 even when Postgres is down. |
| `GET /health/db` | Readiness. 200 with `latencyMs`, or 503 when Postgres is unreachable. |
| `GET /health/sibyl` | Sibyl Memory readiness. Always 200: `reachable: false` carries the reason and no numbers, because the API is fine when one dependency is not, and a zeroed entity count would read as "no history". |

Errors are always JSON: `{ "error": { "code": "...", "message": "..." } }`.
Stack traces and connection strings stay server-side.

## CI

`.github/workflows/ci.yml` runs install (frozen lockfile), lint, typecheck,
build, test, and migrations against a `postgres:17` service container on every
pull request and every push to `main`.

# Aura Console

A pnpm + Turborepo monorepo: a Next.js web app, a Hono API, and Postgres through Drizzle ORM.

## Sibyl Labs Hackathon — 2-Minute Quickstart & Verification Guide

> **Theme**: *Build with Agents That Don't Forget*  
> **Repository**: [musashi0x/aura_console](https://github.com/musashi0x/aura_console)  
> **Commit Tracking**: On-screen Git SHA and live ticking UTC clock rendered in the Console topbar and `/health`.

### 1. The Load-Bearing Deletion Test (Pass/Fail Gate)
Sibyl relationship memory is strictly load-bearing. Without Sibyl, the buyer agent halts in `run.blocked` rather than making blind financial commitments:

```bash
# Run both halves side-by-side:
pnpm demo:deletion-test
```
- **Half A (`SIBYL_PYTHON=""`)**: Mission fails closed (`run.created -> run.blocked`), citing missing Sibyl dependency.
- **Half B (`SIBYL_PYTHON` active)**: Recalls persistent memory, scores candidates, and opens approval (`run.created -> candidate.scored -> decision.made -> approval.requested`).

### 2. The Fresh-Session Restart Protocol (State Survival Proof)
Proves that state survives process termination and complete database wipe. Memory lives in persistent Sibyl SQLite (`~/.sibyl-memory/memory.db`):

```bash
# Wipes Postgres event store completely; leaves Sibyl memory.db intact:
pnpm demo:restart
```

### 3. Cryptographic Memory Commitment on Base Sepolia
Every Bayesian reputation update is committed to Base Sepolia as a salted cryptographic hash (`keccak256(canonical || salt)`). The salt is stored exclusively in Sibyl's REFERENCE tier, allowing public verification without leaking private history:

```bash
# Verify commitment against Sibyl WARM and REFERENCE tiers:
pnpm memory:verify virtuals:agent:alpha 1
```

### 4. Five Sibyl Dynamic Storage Tiers in Aura

| Tier | Sibyl Call | What Aura Stores | Read Back Where | Visible How |
|---|---|---|---|---|
| **HOT** | `set_state("run:<id>")` / `get_state` | Live mission context, active execution stage, pending ceilings | API restart recovery | Mission Trace timeline |
| **WARM** | `set_entity("counterparty", key)` | Counterparty relationship profile, reliability, FSM status | `listCounterpartiesFromSibyl` before scoring | CandidateScoredCard, Counterparties view |
| **COLD** | `write_event(evaluated, acted)` | Immutable mission episode log with provenance actors | `readMemoryJournal` / `GET /api/memory/journal` | Trace "Memory journal", MCP tool `memory_journal` |
| **REFERENCE** | `set_reference("commitment:<key>:v<n>")` | Cryptographic salts & policy guardrails snapshot | Base commitment verification script | `pnpm memory:verify`, Policy Gate card |
| **ARCHIVE** | `archive_entity("counterparty", key)` | Blocked / decommissioned counterparties with audit trail | Counterparty catalog query | Status badge `BLOCKED` / `ARCHIVED`, manual unblock UI |

---

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
docker compose up -d          # Postgres on host port 5433
cp .env.example .env
pnpm db:migrate               # apply committed migrations
pnpm dev                      # web on :3000, API on :3001
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

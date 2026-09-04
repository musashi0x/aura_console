# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

pnpm only (a `preinstall` guard rejects npm/yarn). Node 22+, pnpm 10+.

```bash
pnpm install
docker compose up -d       # Postgres on host port 5433
cp .env.example .env
pnpm db:migrate
pnpm dev                   # web :3000, API :3001

pnpm lint                  # eslint --max-warnings 0 everywhere
pnpm typecheck             # tsc --noEmit everywhere
pnpm test                  # vitest run everywhere
pnpm build
```

Scope to one package: `pnpm --filter @aura/api test`, `--filter @aura/web`, `--filter @aura/db`.

Single test file or case:

```bash
pnpm --filter @aura/web exec vitest run src/features/console/projection/fold-run.test.ts
pnpm --filter @aura/api exec vitest run -t "appends an event"
```

Schema change flow — the generated SQL is the reviewable artifact, commit it:

```bash
# edit packages/db/src/schema/*.ts
pnpm db:generate           # writes packages/db/drizzle/*.sql
git add packages/db/drizzle
pnpm db:migrate
```

The API never auto-migrates on boot; `drizzle-kit push` is local experiments only.

## Layout

```
apps/web    @aura/web   Next.js 16 App Router, React 19
apps/api    @aura/api   Hono on @hono/node-server
packages/db @aura/db    Drizzle schema, pool, migrations, env loading
packages/{tsconfig,eslint-config}   shared presets
```

Cross-package imports use the package name (`@aura/db`). ESLint errors on any relative import escaping a package root. `verbatimModuleSyntax` + `consistent-type-imports` are on: type imports must be inline `import { type X }`. API source is NodeNext ESM — relative imports carry the `.js` extension.

## Architecture

**Event-sourced Runs.** `runs` holds only the seed (objective, source, environment, budget ceiling); everything that happens is an append-only `run_events` row. No column in `runs` is derived from event history. Sequence numbers are allocated server-side inside the same transaction that inserts the row — `RunStore` (`apps/api/src/services/run-store.ts`) is the only writer, route handlers never allocate one. `event_id` is producer-supplied so a retried append is idempotent; `event_time` is producer domain time, never arrival time.

**One projection.** `foldRun(events, seed, upToSequence)` in `apps/web/src/features/console/projection/` is the sole read model. Live is `upToSequence === null`, replay passes a playhead — that is the entire difference between the two, and keeping it that way is what stops them drifting. The fold sorts by `(sequence, event_time, event_id)` and dedupes by `event_id` rather than trusting arrival order. `model/from-api.ts` is the only place the API wire shape meets the fold's input shape; the example fixture goes through the same fold with `source: "FIXTURE"`.

**Data flow.** Server components in `apps/web/src/app/**` fetch through `apps/web/src/lib/api-client.ts`, which returns a discriminated `ApiResult<T>` and never throws. `ConsoleShell` takes `surface`, `readiness`, and an optional run ref as props — it renders state, it never fetches. Feature code lives under `apps/web/src/features/<feature>/`; every visible string sits in that feature's `copy.ts`.

**Env.** One root `.env` feeds API, migrations, drizzle-kit, and (via `next.config.ts`) the web app. `loadRootEnvFile()` walks up to find it and never overrides an already-set process var. Both apps validate with Zod at module load and `process.exit(1)` naming the offending variable.

**Errors.** API responses are always `{ error: { code, message } }` via `errorBody`/`httpError` (`apps/api/src/errors.ts`). Unexpected errors log server-side and return a bare `internal_error`.

## Product invariants

These are load-bearing claims about honesty, not style preferences. Docs: `docs/product/decisions.md`, `docs/ai/README.md`.

- **Unavailable ≠ empty.** A surface with no endpoint behind it renders an explicit unavailable state. An empty list claims a verified empty result from a query that never happened.
- **No inferred readiness.** While a check is in flight the shell says `CHECKING`, never a borrowed `SYSTEM READY`.
- **No stream exists.** `GET /api/runs/{id}/stream` is not implemented, so there is deliberately no client method for it, and the transport label is `LATEST SNAPSHOT`, never `LIVE`. `play`/`pause` are removed from `TransportCommand` so `PLAYING`/`PAUSED` are unreachable at compile time until a playhead can actually advance.
- **Never automatic:** authorize spending, execute an economic action, expose private relationship memory, or treat unavailable memory as valid history. The API sends no derived economic value; USDC amounts move as strings so floating point cannot rewrite them.
- **No auth in v0.1.** Single-operator, non-mainnet. Do not add sign-in, accounts, or workspaces to make a UI feel complete.
- **Origin survives the whole chain.** `CONSOLE` / `AGENT` / `FIXTURE` reach the screen intact; the API is transport, not an actor.
- Do not invent backend state to fill a gap. Not implemented: run stream, replay progression, auth, browser E2E.

## Tests

- API (`apps/api`): node env, real Postgres. `global-setup.ts` creates and migrates a `_test`-suffixed database derived from `DATABASE_URL` — the suite can never reach the dev database. `setup.ts` truncates `runs` (cascading to `run_events`) before each test. `fileParallelism: false` because files share one pool and schema.
- Web (`apps/web`): jsdom, Testing Library, axe. `src/test/setup.ts` supplies a deterministic `localStorage`, `matchMedia` (`setReducedMotion`), and `IntersectionObserver`; use those helpers rather than re-stubbing.
- `src/styles/tokens.test.ts` fails on any literal hex outside `tokens.css`, on WCAG AA contrast regressions, and on a webfont fetch. Every colour resolves from a token; violet is glow/edge accent only, never text.

## Docs

`docs/ai/` is a progressive-disclosure map from product area to files and symbols — read the relevant page before changing a feature, and update it in the same change. `docs/product/` holds scope and decisions. The tracker is the intent, the code is the fact.

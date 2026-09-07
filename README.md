# Aura Console

> **Aura Console** is an autonomous agent command console where human operators and AI agents collaborate under strict financial guardrails, powered by **Sibyl Memory** (`~/.sibyl-memory/memory.db`) to remember past counterparty performance, enforce dynamic reputation FSM states, and commit cryptographic proof to **Base Sepolia**. Built for autonomous procurement, AI service agreements, and agent-to-agent transactions that must never forget failure.

---

## Sibyl Labs Hackathon — 2-Minute Judge Evaluation Guide

* **Theme**: *Build with Agents That Don't Forget* (Deadline: Wed 10 Sep 2026 23:59 UTC)
* **Repository**: [https://github.com/musashi0x/aura_console](https://github.com/musashi0x/aura_console) (MIT License)
* **Demo Video**: [Demo Walkthrough (4:00)]() | Recorded on Commit `0e5190e`
  - `0:00–0:20`: The problem & architecture overview
  - `0:20–1:40`: Session A — Autonomous candidate scoring, spend approval, seller failure, and Sibyl episode write-back
  - `1:40–2:10`: **Continuous Unedited Restart Boundary** — Process kill, database drop, Sibyl `memory.db` survival
  - `2:10–3:10`: Session B — Fresh cold-start process picks different counterparty because Sibyl remembered
  - `3:10–3:35`: Multi-Agent Coordination — Fresh Claude Code session queries Aura's MCP memory tools
  - `3:35–4:00`: Base Sepolia cryptographic commitment & event trace audit

---

### 1. Run in Five Commands

```bash
pnpm install
docker compose up -d           # Postgres on host port 5433
cp .env.example .env
pnpm db:migrate                # apply committed migrations
pnpm demo:seed && pnpm dev     # Web on :3010, API on :3011
```

* **Sibyl Python Bridge Setup**:
  ```bash
  python3.11 -m venv .venv-sibyl
  .venv-sibyl/bin/pip install sibyl-memory-client
  SIBYL_TENANT_ID=agent_buyer_1 .venv-sibyl/bin/python tools/sibyl_seed.py
  ```
* **Reset to Fresh State**:
  ```bash
  pnpm demo:reset
  ```

---

### 2. The Load-Bearing Deletion Test (Pass/Fail Gate)
Sibyl relationship memory is strictly load-bearing on the critical path. Without Sibyl, the buyer agent fails-closed into `run.blocked` rather than making blind financial commitments:

```bash
# Run both halves side-by-side:
pnpm demo:deletion-test
```
- **Half A (`SIBYL_PYTHON=""`)**: Mission halts in `run.blocked`, citing missing Sibyl dependency.
- **Half B (`SIBYL_PYTHON` active)**: Recalls persistent memory, scores candidates, and opens approval (`run.created -> candidate.scored -> decision.made -> approval.requested`).

---

### 3. The Fresh-Session Restart Protocol (State Survival Proof)
Proves that relationship memory survives complete process termination and database wipe. Memory lives exclusively in persistent Sibyl SQLite (`~/.sibyl-memory/memory.db`):

```bash
# Wipes Postgres event store completely; leaves Sibyl memory.db intact:
pnpm demo:restart
```
On camera: the API reconnects, the Console topbar updates its `startedAt` timestamp, and Session B loads zero historical Missions but recalls counterparty reliability from Sibyl.

---

### 4. Where Memory is Read and Written

| Tier | Sibyl Call | Source Code Location | What Aura Stores | Read Back Where |
|---|---|---|---|---|
| **HOT** | `set_state` / `get_state` | `tools/sibyl_bridge.py`, `apps/api/src/services/sibyl.ts` | Live mission context, active execution stage, pending ceilings | API restart recovery & Mission Trace |
| **WARM** | `set_entity` / `get_entity` | `tools/sibyl_bridge.py`, `apps/api/src/services/sibyl.ts` | Counterparty relationship profile, reliability, FSM status | `MissionAgent.openMission`, `listCounterpartiesFromSibyl` |
| **COLD** | `write_event` / `read_events` | `tools/sibyl_bridge.py`, `apps/api/src/services/sibyl.ts` | Immutable mission episode log with provenance actors | `readMemoryJournal`, `GET /api/memory/journal`, MCP tool `memory_journal` |
| **REFERENCE** | `set_reference` / `get_reference` | `tools/sibyl_bridge.py`, `apps/api/src/services/sibyl.ts` | Cryptographic salts & policy guardrail snapshots | `apps/api/src/services/memory-commitment.ts`, Policy Gate card |
| **ARCHIVE** | `archive_entity` | `tools/sibyl_bridge.py`, `apps/api/src/services/sibyl.ts` | Blocked / decommissioned counterparties with audit trail | Counterparty catalog query, manual unblock UI |

---

### 5. How Memory Made This Possible
Every autonomous counterparty engagement in Aura is decided by ranking candidates over Sibyl Memory records. Without memory, the agent halts. With memory, previous task failures penalize unreliable actors, directly altering who wins the procurement auction and projecting a counterfactual diff card (`Memory changed this decision by -0.35`). Once settled, the new memory version is committed to Base Sepolia as a cryptographic commitment hash.

---

### 6. Partner Stacks

* **Base Sepolia (L2)**:
  - Memory Commitment Service: [`apps/api/src/services/memory-commitment.ts`](apps/api/src/services/memory-commitment.ts)
  - Cryptographic verification: Salt stored in Sibyl REFERENCE tier; commitment verifiable with `pnpm memory:verify virtuals:agent:alpha 1`.
  - Transaction Broadcast: Verified Base Sepolia calldata commitment hash.
* **Virtuals Protocol (ACP)**:
  - Agent-to-Agent Commerce: [`apps/api/src/acp`](apps/api/src/acp) client runtime, job inbox projection, and operator spend authorization.

---

### 7. Known Limits
- **Storage Cap**: Free-tier local Sibyl SQLite capped at 5 MB (sufficient for thousands of counterparty profiles).
- **Scope**: Single-operator console (non-mainnet testnet environment).
- **Features**: Paid-tier Sibyl features (`learn`, `lint`) are not required and not used.

---

### 8. Prior Work Declaration
> This repository was created on 26 Aug 2026 as "Aura Console", before the hackathon build window opened. Work that predates 1 Sep 2026: the monorepo skeleton, landing page, onboarding, Console shell, the event-sourced Run API, the product design pack, and a read-only Sibyl Memory bridge with fixture data.  
> Built during the window (1–10 Sep): the Mission workspace, the MCP tool layer (`tools.ts`, `server.ts`, `stdio.ts`), the Gemini native function-calling loop, the Mission agent scoring from Sibyl, episode write-back and the Bayesian reputation loop, the five-tier memory usage (HOT, WARM, COLD, REFERENCE, ARCHIVE), the Beautiful UI agent harness with synthesized Web Audio (`InteractionSounds.tsx`), the Base memory commitment verifier, the demo instrumentation (`ConsoleTopbar` live clock and commit badge), and the scripted deletion/restart protocols. Full commit history is preserved in `git log`.

---

### 9. Team
- **Harry Phan** — Core Architecture, Memory Tiers, MCP Loop, and UI Primitives
- **Rick** — Partner Stacks (Base Sepolia, Virtuals ACP)
- **Lia** — Narration, Documentation, and Submission Delivery

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

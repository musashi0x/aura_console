# Aura Console

> **Aura Console** is an autonomous agent command console where human operators and AI agents collaborate under strict financial guardrails, powered by **Sibyl Memory** (`~/.sibyl-memory/memory.db`) to remember past counterparty performance, enforce dynamic reputation FSM states, and commit cryptographic proof to **Base Sepolia**. Built for autonomous procurement, AI service agreements, and agent-to-agent transactions that must never forget failure.

---

## Sibyl Labs Hackathon — 2-Minute Judge Evaluation Guide

* **Theme**: *Build with Agents That Don't Forget* (Deadline: Wed 10 Sep 2026 23:59 UTC)
* **Repository**: [https://github.com/musashi0x/aura_memory](https://github.com/musashi0x/aura_memory) (MIT License)
* **Demo Video**: [Demo Walkthrough (4:00)]() | Recorded on Freeze Tag `hackathon-freeze-1` (Commit `e789de7`)
  - `0:00–0:20`: The problem & core architecture overview
  - `0:20–1:40`: Session A — Autonomous candidate scoring, spend approval, seller failure, and Sibyl episode write-back
  - `1:40–2:10`: **Continuous Unedited Restart Boundary** — Process kill, database drop, Sibyl `memory.db` survival
  - `2:10–3:10`: Session B — Fresh cold-start process picks different counterparty because Sibyl remembered
  - `3:10–3:35`: Multi-Agent Coordination — External Claude Code session queries Aura's MCP memory tools
  - `3:35–4:00`: Base Sepolia cryptographic commitment & event trace audit

---

### 1. Quickstart (Run in Five Commands)

```bash
pnpm install
docker compose up -d           # Postgres on host port 5433
cp .env.example .env
pnpm db:migrate                # apply committed migrations
pnpm demo:seed && pnpm dev     # Web on :3000 (configurable via WEB_PORT), API on :3001
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

### 2. Core Architecture

Aura Console coordinates autonomous procurement agents under strict financial guardrails, backed by persistent relationship memory, an immutable event store, and on-chain cryptographic proof:

* **Web Frontend (`@aura/web`)**: Next.js 16 App Router application styled with the Astryx Stone design system (`#111015` canvas, `#1b1b1f` surface), Beautiful UI streaming primitives (`ThinkingState`, `StreamingText`, `ToolChips`, `ApprovalCard`, `DiffTable`, `PromptBar`), synthesized Web Audio cues (`InteractionSounds`), real-time SSE execution stream, and live ticking clock + commit badge in `ConsoleTopbar`.
* **Backend API (`@aura/api`)**: Node.js/TypeScript running Hono HTTP server, Model Context Protocol (MCP) server, native Gemini 2.5 function-calling loop, PostgreSQL event store for immutable run event logs (`runs` and `run_events`), Base Sepolia cryptographic memory commitment pipeline, and Python Sibyl memory bridge.
* **Database (`@aura/db`)**: Drizzle ORM managing relational schema, connection pooling, and migrations for PostgreSQL.
* **Sibyl Memory (`~/.sibyl-memory/memory.db`)**: Persistent relationship memory database providing 5-tier storage (HOT, WARM, COLD, REFERENCE, ARCHIVE) across autonomous agent sessions.

---

### 3. 5-Tier Dynamic Storage Map

| Tier | Sibyl Call | Source Code Location | What Aura Stores | Read Back Where |
|---|---|---|---|---|
| **HOT** | `set_state` / `get_state` | `tools/sibyl_bridge.py`, `apps/api/src/services/sibyl.ts` | Live mission context, active execution stage, pending spend ceilings | API restart recovery & Mission Trace |
| **WARM** | `set_entity` / `get_entity` | `tools/sibyl_bridge.py`, `apps/api/src/services/sibyl.ts` | Counterparty relationship profile, reliability score, Bayesian confidence, FSM status | `MissionAgent.openMission`, `listCounterpartiesFromSibyl`, `authorizeFromRetrieval` |
| **COLD** | `write_event` / `read_events` | `tools/sibyl_bridge.py`, `apps/api/src/services/sibyl.ts` | Immutable mission episode log with provenance actors (`buyer_agent`, `verifier_agent`, `operator`) | `readMemoryJournal`, `GET /api/memory/journal`, MCP tool `memory_journal` |
| **REFERENCE** | `set_reference` / `get_reference` | `tools/sibyl_bridge.py`, `apps/api/src/services/sibyl.ts` | Cryptographic salts (`commitment:<key>:v<version>`) & policy guardrail snapshots | `apps/api/src/services/memory-commitment.ts`, `commitMemoryToBaseSepolia`, `pnpm memory:verify` |
| **ARCHIVE** | `archive_entity` | `tools/sibyl_bridge.py`, `apps/api/src/services/sibyl.ts` | Blocked / decommissioned counterparties with full audit trail | Counterparty catalog query, manual unblock UI |

---

### 4. Load-Bearing Deletion Test Commands (Pass/Fail Gate)

Sibyl relationship memory is strictly load-bearing on the critical path. Without Sibyl, the buyer agent fails-closed into `run.blocked` rather than making blind financial commitments:

```bash
# Run both halves side-by-side:
pnpm demo:deletion-test
```
- **Half A (`SIBYL_PYTHON=""`)**: Mission halts in `run.blocked`, citing missing Sibyl dependency (`[run.created, run.blocked]`).
- **Half B (`SIBYL_PYTHON` active)**: Recalls persistent memory, scores candidates, and opens approval (`[run.created, memory.retrieved, candidate.scored, decision.made, approval.requested]`).

---

### 5. Camera One-Take Restart Protocol (State Survival Proof)

Proves that relationship memory survives complete process termination and database wipe. Memory lives exclusively in persistent Sibyl SQLite (`~/.sibyl-memory/memory.db`):

```bash
# Wipes Postgres event store completely; leaves Sibyl memory.db intact:
pnpm demo:restart
```
On camera:
1. `pnpm demo:restart` truncates `runs` and `run_events` via CASCADE and restarts the API process.
2. The UI topbar shows the active commit hash and a fresh ticking UTC clock.
3. Session B cold-starts with zero historical runs in PostgreSQL, yet immediately recalls counterparty reputation and past failure episodes from Sibyl SQLite.

---

### 6. Counterfactual Divergence

Every autonomous counterparty engagement in Aura is decided by ranking candidates over Sibyl Memory records:
- **Session A**: Operator posts a mission. Candidates `virtuals:agent:alpha` and `virtuals:agent:beta` are evaluated. Alpha initially holds a higher base score (0.50) and is selected. Spend is approved (0.20 USDC ceiling). Alpha delivers an invalid payload (missing JSON schema requirements). The outcome is recorded as a failure via `record_episode`. Alpha's reliability in Sibyl drops from 0.50 to 0.33. Memory diff is rendered, and the new memory state is committed to Base Sepolia.
- **Process Restart Boundary**: PostgreSQL event store is wiped with `pnpm demo:restart`.
- **Session B**: The exact same objective is posted to a fresh API process. The agent queries Sibyl WARM memory. Because Alpha's reliability was penalized (0.33), Beta Labs (0.67) wins the procurement auction.
- **Counterfactual Projection**: The UI renders an active counterfactual diff badge: `"Memory changed this decision by -0.35"`. The counterfactual model projects what would have happened in a stateless world (Alpha would have won without memory), mathematically demonstrating memory's causal impact on financial execution.

---

### 7. Partner Stacks

* **Base Sepolia (L2)** — *Verified Production Memory Commitment*:
  - Memory Commitment Service: [`apps/api/src/services/memory-commitment.ts`](apps/api/src/services/memory-commitment.ts)
  - Canonical JSON serialization and salted Keccak256 hash generation (`keccak256(canonicalJson(profile) + ":" + salt)`).
  - Salt stored strictly in Sibyl REFERENCE tier (`commitment:<key>:v<version>`).
  - Zero-value self-transaction broadcasting the 32-byte hash calldata to Base Sepolia (with deterministic offline hash fallback if testnet RPC is unavailable).
  - Independent CLI verification:
    ```bash
    # State inspection (exit 0)
    pnpm memory:verify virtuals:agent:beta 1
    # Adversarial mismatch check (exit 1)
    pnpm memory:verify virtuals:agent:beta 1 0x0000000000000000000000000000000000000000000000000000000000000000
    # Authentic cryptographic match (exit 0)
    pnpm memory:verify virtuals:agent:beta 1 <hash>
    ```
* **Virtuals Protocol (ACP)** — *Single-Stack Fallback Posture*:
  - Agent-to-Agent Commerce client runtime evaluated in `origin/feat/acp_job` ([`apps/api/src/acp`](apps/api/src/acp)).
  - Single-Stack Fallback Posture: In accordance with hackathon guidelines (`docs/hackathon/04-partner-stacks-plan.md` §1.4), to ensure 100% test integrity, zero flakiness, and deterministic testnet execution without external sandbox registration or third-party bot dependencies during judging, Aura locks into the verified Base Sepolia single-stack posture for cryptographic memory commitments.

---

### 8. Multi-Agent Coordination via MCP

Aura implements a Model Context Protocol (MCP) server (`apps/api/src/mcp/server.ts`, `tools.ts`, `stdio.ts`), enabling external agents (Claude Code, Cursor, peer worker agents) and internal Gemini agents to coordinate over shared relationship memory:
* **`memory_recall_counterparty`**:
  - Input: `{ counterpartyKey: string }`
  - Reads Sibyl WARM tier to inspect counterparty reliability scores, Bayesian confidence, and relationship FSM status.
* **`memory_journal`**:
  - Input: `{ counterpartyKey?: string, limit?: number }`
  - Reads Sibyl COLD tier (`readMemoryJournal` / `read_events`) to inspect immutable episode provenance logs and cite specific task failure evidence.
* **`mission_propose_approval`**:
  - Input: `{ counterpartyKey: string, amountUsdc: number, reason: string, runId?: string }`
  - Proposes spend against active policy ceilings while strictly maintaining the Human-in-the-Loop approval invariant (agent proposes; human operator signs).
* **Native Gemini 2.5 Function-Calling Loop**:
  - Automatically converts MCP tool definitions into Gemini `FunctionDeclaration` objects (`apps/api/src/mcp/gemini-converter.ts`), enabling multi-turn autonomous tool chaining (e.g. recalling past memory → inspecting journal → proposing spend approval) with live SSE stream telemetry (`thought`, `tool_call`, `token`, `usage`, `done`).

---

### 9. Known Limits

- **Storage Cap**: Free-tier local Sibyl SQLite capped at 5 MB (sufficient for thousands of counterparty profiles; tests use isolated temporary stores to prevent host cap collisions).
- **Single Operator & Testnet Scope**: Designed as a single-operator console on Base Sepolia testnet without multi-tenant authentication (Decision 31).
- **Stream Replay**: Stream playback is event-sourced from PostgreSQL and SSE, not a live cluster tail.
- **Paid-Tier Features**: Sibyl paid-tier features (`learn`, `lint`) are not required and not used.

---

### 10. Prior Work Declaration

> This repository was created on 26 Aug 2026 as "Aura Console", before the hackathon build window opened. Work that predates 1 Sep 2026: the monorepo skeleton, landing page, onboarding, Console shell, the event-sourced Run API, the product design pack, and a read-only Sibyl Memory bridge with fixture data.  
> Built during the window (1–10 Sep): the Mission workspace, the MCP tool layer (`tools.ts`, `server.ts`, `stdio.ts`), the Gemini native function-calling loop (`gemini-agent.ts`, `gemini-converter.ts`), the Mission agent scoring from Sibyl (`mission-agent.ts`), episode write-back and the Bayesian reputation loop, the five-tier memory usage (HOT, WARM, COLD, REFERENCE, ARCHIVE), the Beautiful UI agent harness with synthesized Web Audio (`InteractionSounds.tsx`), the Base memory commitment verifier (`apps/api/src/services/memory-commitment.ts`, `scripts/verify-memory-commitment.ts`), the demo instrumentation (`ConsoleTopbar` live clock and commit badge), and the scripted deletion/restart protocols. Full commit history is preserved in `git log`. No code from other hackathons was reused.

---

### 11. Team Roles & Contributions

- **Harry Phan** — Core Architecture, Memory Tiers, MCP Loop, UI Primitives & Astryx Stone Theme
- **Rick** — Partner Stacks (Base Sepolia Memory Commitment, Virtuals ACP Evaluation)
- **Lia** — Narration, Documentation, Submission Delivery & Verification

---

### Build-in-Public Social Copy

* **Post 1 — Build Log (Tue/Wed)**:
  > Building Aura Console for the @sibylcap hackathon. The agent ranks counterparties from Sibyl Memory before it spends; if memory can't be read it refuses to score rather than pretending nobody is there. Today: episode write-back + a Bayesian reputation loop, all in a local SQLite file. Repo: https://github.com/musashi0x/aura_memory #SibylHackathon

* **Post 2 — The Demo & Restart Boundary (Wed/Thu)**:
  > Kill the API, drop the database, keep one file. A fresh process picks a different counterparty because Sibyl remembered the one that failed. Memory version committed to @base Sepolia. 4-minute demo walkthrough · Repo: https://github.com/musashi0x/aura_memory · #SibylHackathon #Base


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

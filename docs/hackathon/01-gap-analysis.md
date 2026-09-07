# Gap analysis — 7 Sep 2026

## 1. The rules that decide the outcome

Pulled from [hack.sibyllabs.org](https://hack.sibyllabs.org/), its `/rules` and
`/submissions` pages on 7 Sep.

**Gate (pass/fail, majority panel vote, ties fail):** Sibyl Memory must be
load-bearing. The deletion test: remove the memory calls and the core function
breaks. Three concrete requirements:

1. The demo video shows **cold-start recall in one continuous unedited segment
   with an on-screen timestamp or commit hash**.
2. The README says **where memory is written and read**, findable within two
   minutes.
3. The repository shows memory calls on the critical path.

Explicit disqualifiers: thin wrappers, decorative integrations, package imports
without execution, "writes every message to a memory API but never reads it
back to change what it does", wrapper projects built primarily around an
existing agent framework, fabricated PMF evidence.

**Rubric (100):** memory load-bearing 40 ("recall is competitive; coordination
and dynamic-storage patterns top the band"), innovation 25, technical execution
20 ("survives a second run and a curious judge"), pitch 15. PMF bonus up to 10,
default 0, needs a publicly verifiable artifact checkable in five minutes.
Final = (rubric + PMF) × multiplier.

**Multiplier:** +15% for the first verified partner stack, +10% for the second,
cap ×1.25. Base counts with a deployed action visible in the demo: "a wallet
operation, an x402 payment, a B20 read, or a contract interaction". Virtuals
counts with "an ACP job, a registered or transacting agent, or another
Virtuals-native integration exercised in the demo". Claimed but non-functional
stacks forfeit the bonus.

**Submission:** public repo (MIT or Apache-2.0, real commit history), 2–5 minute
demo video, README (purpose, memory location, partner stacks, a "how memory made
this possible" note, a Prior Work declaration), demo video posted publicly plus
at least one build-log post tagging @sibylcap and any claimed partners. Teams
1–5. Sep 10, 23:59 UTC.

## 2. What exists, and on which branch

Three lines of work have never been run together. Verified on 7 Sep by reading
each branch and running typecheck and tests where possible.

| Line | Head | State | What it adds |
|---|---|---|---|
| `origin/main` | `1f9c258` (7 Sep) | typecheck clean; API 14 files pass, web 33 files pass | Landing, onboarding, Console shell, Mission workspace (Operator/Board/Trace), event-sourced Runs, approval endpoint with a required ceiling, read-only Sibyl bridge with tenant + verdict mapping, composed counterparty memory, MCP server (9 tools incl. `memory_recall_counterparty`, `mission_propose_approval`) over stdio and HTTP, Gemini native function-calling loop, counterfactual folded from `candidate.scored` |
| Main checkout, `work/deploy-and-sibyl-tenant` | `38ad88b` (7 Sep), **5 commits ahead, not pushed**, plus ~2,700 uncommitted lines | typecheck clean; web 37 files pass; **API has 17 failing tests** | `MissionAgent` opens a Mission by reading Sibyl and scoring (recall on the critical path); `MissionExecutionService` runs a sandboxed AI CLI, verifies the result, and **writes the episode back to Sibyl** through new bridge commands `record_episode` and `update_counterparty`; Bayesian reputation FSM (`reputation-fsm.ts`); manual unblock; Mission terminal streaming; `/runs/:id/logs`; `memory-diffs` and `episodes` routes; PROJECT.md / TEST_READY.md; stone theme, mission inspector, `candidate-scored-card`, `run-created-card` (uncommitted) |
| `origin/feat/acp_job` | `fd9f083` (5 Sep, musashi0x), 19 commits, 86 files | 10 test files, never run against a live agent | Virtuals ACP client runtime on Base Sepolia: local-key `viem` adapter, worker process, inbox capture → `run_events` projection, `acp_jobs`/`acp_inbox`/`acp_spend_intents` tables and 3 migrations, operator fund authorization endpoint, `never-automatic` test, 523-line `docs/ai/api/acp.md` |
| `ai_cli_sandbox_reputation`, `feat/stone-theme-and-ai-chat` | `d79f19c`, `9b69050` (7 Sep) | not assessed | Chain-of-thought and token metering in chat, "align execution settlement with Base and add Virtuals ACP/Base RPC readiness", Astryx components. Overlaps the uncommitted work above |

Other facts that matter:

- License is MIT. 52 commits from 4 authors since 26 Aug. The repo predates the
  1 Sep build window, so the Prior Work declaration is mandatory.
- The local Sibyl store (`~/.sibyl-memory/memory.db`, tenant `agent_buyer_1`,
  client 0.8.0, free tier, 1.7 MB of 5 MB) holds 5 counterparties and a COLD
  journal of real `record_episode` events written today at 10:38 ICT. Write-back
  is real, not a fixture.
- Sibyl 0.8.0 free tier exposes `set_state`/`get_state` (HOT), `set_entity`
  (WARM), `write_event`/`read_events` (COLD), `set_reference`/`get_reference`
  (REFERENCE), `archive_entity` (ARCHIVE), `search` across tiers with verdicts.
  `learn`, `lint` and skill proposals are **paid-tier only** and must not be
  claimed.
- The main checkout's `example-run.ts` fixture **dropped `memory_adjustment`**
  from `candidate.scored`, so the demo Mission's counterfactual now folds to
  `UNAVAILABLE`. Real Missions still carry it (`mission-scoring.ts`).
- No hosted deployment is linked (Railway CLI: "No linked project"). Task #77 is
  still todo. Everything runs locally; the API needs Node 22 plus a Python 3.11
  venv for the bridge.
- Tracker project 3: #31 (real ACP job) in review, #32 (Sibyl retrieval) and
  #34 (Memory Diff) in progress, #35 (Base commitment) and #36 (restart
  divergence) todo, #54 (video + deck) backlog, #78 (Missions list) todo but the
  list is wired in code.

## 3. Gap table

| # | Gap | Why it costs points | Fix | Doc |
|---|---|---|---|---|
| G1 | No single branch runs the whole story | A judge's "second run" fails at step one; the video cannot be honest about one commit | Integrate to `main`, green CI, tag the freeze | [02](02-integration-plan.md) |
| G2 | The fresh-session moment is not instrumented | Gate requirement 1: continuous segment with on-screen commit hash/timestamp | Commit hash + UTC clock in the Console topbar; a `demo:restart` script that kills the API and worker and starts them again; run Session B against a fresh Postgres so recall can only come from Sibyl | [03](03-memory-load-bearing-plan.md), [05](05-demo-script.md) |
| G3 | README has no memory map | Gate requirement 2 | A "Where memory is read and written" table with file and function names | [06](06-submission-checklist.md) |
| G4 | Deletion test not scripted | Gate; judges will try it | `SIBYL_PYTHON` unset already makes the Mission agent block with a memory reason. Document and script it | [03](03-memory-load-bearing-plan.md) |
| G5 | Only WARM and COLD tiers are used | "Dynamic-storage patterns top the band" | HOT state for the live Mission, REFERENCE for the guardrail snapshot a decision used, ARCHIVE on BLOCKED | [03](03-memory-load-bearing-plan.md) |
| G6 | No coordination between agents | Same rubric line | Second agent (a fresh Claude Code session) recalls Aura's memory through the repo's own MCP server; verifier agent writes provenance into the journal | [03](03-memory-load-bearing-plan.md) |
| G7 | 17 failing API tests on the integration line | Technical execution; CI red on the submitted SHA | Fix during integration; do not submit with red CI | [02](02-integration-plan.md) |
| G8 | No partner stack has run live | ×1.00 instead of ×1.25 | Register Virtuals sandbox agents, run one job through the existing worker; add the Base memory-commitment tx | [04](04-partner-stacks-plan.md) |
| G9 | Demo fixture lost its memory component | "Memory changed this decision" cannot render on the example Mission | Restore `memory_adjustment` in the fixture, or record the video on a real Mission only | [02](02-integration-plan.md) |
| G10 | Memory Diff card and memory drawer not built (#34) | The "Aura learned" beat is currently a raw event row | Minimum: a Memory Diff card folded from the write-back event with before/after reliability and status; skip the drawer controls | [03](03-memory-load-bearing-plan.md) |
| G11 | Two-runtime setup (Node + Python) is fragile for a judge | Technical execution | `docker compose` profile that builds the API image already used for Railway, plus `pnpm demo:reset` and `pnpm demo:seed` | [06](06-submission-checklist.md) |
| G12 | No PMF evidence | Bonus stays 0 | Only add if real; a public waitlist with real signups is the cheapest honest artifact | [06](06-submission-checklist.md) |
| G13 | No public posts | Submission requirement | Two posts, one with the video, tagging @sibylcap @base @virtuals_io | [06](06-submission-checklist.md) |
| G14 | Prior work undeclared | Submission requirement; risk of disqualification | Declaration text drafted in the checklist | [06](06-submission-checklist.md) |

## 4. Where the score lands

Rough, to prioritise rather than to predict.

| Line | Today (if judged as-is on `origin/main`) | After this plan |
|---|---:|---:|
| Gate | Fails: no fresh-session recall on camera, no memory map, the branch that writes memory is unpushed | Passes |
| Memory (40) | 22 — recall with honest states, but no write-back on `main` | 34–38 — write-back, five tiers, coordination, counterfactual |
| Innovation (25) | 16 | 20–22 — counterfactual + verdict states + committed private memory |
| Execution (20) | 10 — three branches, red tests off `main` | 16–18 — one branch, green CI, reset script, docker path |
| Pitch (15) | 5 — no video | 12 |
| PMF (+10) | 0 | 0–3 |
| Multiplier | ×1.00 | ×1.15 (Base only) to ×1.25 (Base + Virtuals) |
| **Total** | **gate fail** | **~(82–90 + 0–3) × 1.15–1.25 ≈ 95–116** |

The single biggest swing is the multiplier, and it is also the highest-risk
item because it depends on Virtuals sandbox registration and a funded testnet
wallet, neither of which is in the team's control. Start it tonight; decide on
Tuesday noon whether to keep Virtuals or ship Base only.

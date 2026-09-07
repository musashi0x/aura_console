# Sibyl Labs hackathon: submission plan for Aura Console

**Event:** [Sibyl Labs Hackathon — Build with Agents That Don't Forget](https://hack.sibyllabs.org/)
**Deadline:** Wed 10 Sep 2026, 23:59 UTC (Thu 11 Sep, 06:59 ICT). Judging 11–12 Sep. Winners 13–15 Sep.
**Written:** Mon 7 Sep 2026, 18:30 ICT. Time left: about 3.5 working days.

This folder is the plan for getting Aura Console from "three unmerged
branches that each prove part of the story" to a submission that passes the
memory gate and scores in the top band. It is planning only. Nothing in here
claims a feature is shipped that the code does not ship.

## The verdict in one paragraph

**Not demo-ready today, and closer than it looks.** Every load-bearing piece
exists somewhere in the repository: Sibyl recall on the decision path, honest
memory states, an operator approval that names a ceiling, real write-back of
episodes into Sibyl after an outcome, a Bayesian reputation loop, an MCP server
that exposes memory to other agents, and a Virtuals ACP runtime on Base
Sepolia. The problem is that they live on three divergent lines that have
never run together, the gate moment (a fresh process recalling what it learned,
on camera, with a commit hash on screen) is not scripted or instrumented, no
partner stack has run against a live network, and the README does not let a
judge find the memory read and write within two minutes. See
[01-gap-analysis.md](01-gap-analysis.md).

## How the rubric maps onto this repo

| Rubric line | Points | Where Aura earns it | Plan |
|---|---:|---|---|
| Gate: memory is load-bearing | pass/fail | The Mission agent ranks counterparties from Sibyl and **blocks** when Sibyl cannot be read. Delete the memory layer and Missions stop. | [03](03-memory-load-bearing-plan.md) |
| Memory is load-bearing | 40 | Recall + write-back + verdict-aware states already. To reach the top of the band ("coordination and dynamic-storage patterns"): use all five tiers on the critical path and let a second agent read the same store over MCP. | [03](03-memory-load-bearing-plan.md) |
| Innovation & originality | 25 | Memory as a *decision input with a counterfactual*, honest "could not look" vs "nothing there", private memory committed to Base as a hash. Nobody else's agent shows what it would have decided without memory. | [03](03-memory-load-bearing-plan.md), [04](04-partner-stacks-plan.md) |
| Technical execution | 20 | Event-sourced runs, tests against real Postgres, CI. Must survive a judge's second run: one branch, green tests, a reset script, a five-command setup. | [02](02-integration-plan.md), [06](06-submission-checklist.md) |
| Pitch & presentation | 15 | One Mission, nine beats, the restart on camera. | [05](05-demo-script.md) |
| PMF bonus | +10 | Only real, publicly verifiable evidence counts. Default is 0. | [06](06-submission-checklist.md) |
| Partner multiplier | ×1.15 / ×1.25 | Virtuals ACP job (branch exists, never run live) and a Base action (memory commitment tx). | [04](04-partner-stacks-plan.md) |

## Documents

1. [Gap analysis](01-gap-analysis.md) — what exists on which branch, what the gate and rubric need, what is missing.
2. [Integration plan](02-integration-plan.md) — how the three code lines become one green `main` by Tuesday evening.
3. [Memory load-bearing plan](03-memory-load-bearing-plan.md) — the deletion test, the fresh-session protocol, five tiers, coordination, and the README memory map.
4. [Partner stacks plan](04-partner-stacks-plan.md) — Virtuals ACP sandbox job and the Base memory commitment.
5. [Demo script](05-demo-script.md) — the 2–5 minute video, beat by beat, and the recording rules.
6. [Submission checklist](06-submission-checklist.md) — README sections, prior-work declaration, posts, form, deadline.
7. [Schedule](07-schedule.md) — day by day to the deadline, owners, cut lines, go/no-go gates.

## Sync

- Tracker: [Aura Console, project 3](https://tracking-frontend-production-e046.up.railway.app/projects/3). Hackathon tasks carry the `[HACK]` prefix; this plan is uploaded there as `16_HACKATHON_SUBMISSION_PLAN.md`.
- Repo: this folder. The product docs under `docs/product/` describe the target design; the code map under `docs/ai/` describes `origin/main`. Neither describes the unmerged branches, which is why [01-gap-analysis.md](01-gap-analysis.md) does.
- Rule that still applies: the repo must not claim a feature is shipped until code, tests and tracker status agree.

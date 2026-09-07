# Integration plan — one green `main` by Tue 8 Sep, 18:00 ICT

## Goal

One branch, `main`, that contains recall, write-back, the reputation loop, the
MCP layer and the ACP runtime, with `pnpm lint && pnpm typecheck && pnpm build
&& pnpm test` green in CI. Tag it `hackathon-freeze-1`. Every later change is a
small PR onto it. The video is recorded on a SHA that CI has passed.

## Rules for the next three days

1. **No new feature branches off anything but `main`.** The three-line split is
   the reason nothing runs end to end today.
2. **Push before you sleep.** `work/deploy-and-sibyl-tenant` at `38ad88b` is
   five commits ahead of its remote and only exists on one laptop. Push it now,
   unchanged, as a backup even if it is not mergeable yet.
3. **Red CI blocks the video.** A demo recorded on a commit whose tests fail is
   a demo a curious judge can break.
4. **Code is the fact, tracker is the intent.** When a doc and the code
   disagree, fix the doc in the same PR.

## Order of operations

### Step 0 — backup (tonight, 15 min)

```bash
cd /Users/harryphan/Documents/dev/aura_memory
git push origin work/deploy-and-sibyl-tenant
git stash push -u -m "hack-uncommitted-ui-$(date +%s)"   # capture the ~2,700 uncommitted lines
git stash list --format='%H %gs' | head -1                # record the SHA, apply later with `git stash apply <sha>`
git push origin ai_cli_sandbox_reputation feat/stone-theme-and-ai-chat
```

The uncommitted working tree contains **untracked copies of files that already
exist on `origin/main`** (`apps/api/src/mcp/`, `routes/mcp.ts`,
`services/gemini-agent.ts`, `.mcp.json`, the adversarial and challenge tests).
Somebody copied the MCP work in by hand instead of merging. Those copies must be
deleted before merging, or the merge will report add/add conflicts on every one
of them.

### Step 1 — bring `origin/main` into the reputation line (Tue morning, 2–3 h)

On `work/deploy-and-sibyl-tenant`:

1. Remove the untracked MCP copies listed above.
2. `git merge origin/main`. Expected conflict hotspots: `apps/api/src/app.ts`
   (route mounting), `routes/runs.ts`, `routes/approvals.ts`, `routes/chat.ts`,
   `services/run-store.ts`, `services/sibyl.ts` (the branch added
   `SibylCounterparty`/`SibylEpisode` types and write commands),
   `tools/sibyl_bridge.py` (read-only docstring vs new write commands — keep the
   write commands, rewrite the docstring honestly), `.env.example`
   (`POSTGRES_PORT` 5433 vs 5436), `README.md`, `pnpm-lock.yaml`.
3. Run `pnpm --filter @aura/api test`. **Seventeen tests fail on this line
   today**, before the merge; do not attribute them to the merge. Known groups:
   - `approvals.test.ts` and `approvals.adversarial.test.ts`: "returns 409 when
     no events exist besides run.created" and "will not approve an action nobody
     asked about". Likely cause: `MissionAgent.openMission` now appends scoring
     and `approval.requested` events right after `run.created`, so a Run is no
     longer empty after creation. Fix the tests to create Runs with the agent
     disabled (or a `source: "FIXTURE"` seed that the agent skips), not the
     invariant.
   - `runs.test.ts` sequencing and idempotency tests: same root cause (the seed
     Run now has more than one event).
   - `mcp/tools.test.ts` `mission_propose_approval` cases: same.
   - Counterparty unblock route: `422` mapping for an invalid `targetStatus`.
4. Commit the merge. Push.

### Step 2 — commit the UI work as its own commit (Tue morning, 1 h)

Apply the stash, delete the duplicated MCP files again if the stash restored
them, run `pnpm --filter @aura/web test` (37 files passed before the merge) and
`pnpm typecheck`, commit as `feat(web): stone theme, mission inspector,
candidate and run cards`. If it does not go green within the hour, keep only
`candidate-scored-card.tsx`, `run-created-card.tsx`, `mission-inspector.tsx` and
the fixture change, and drop the theme.

### Step 3 — restore the fixture's memory component (15 min)

`apps/web/src/features/console/fixtures/example-run.ts` lost the
`candidates[].memory_adjustment` payload on `candidate.scored`. Put it back
exactly as `origin/main` has it, so the labelled demo Mission can render
`Memory changed this decision`. The counterfactual test file
(`projection/counterfactual.test.ts`) will tell you if it is right.

### Step 4 — open the PR to `main` (Tue midday)

PR title: `feat: recall, write-back and the reputation loop on one branch`.
Require CI green. Merge with a merge commit (history matters to the judges:
"real commit history").

### Step 5 — merge the ACP runtime (Tue afternoon, 3–4 h, ACP author)

`origin/feat/acp_job` branched before `main` gained migration `0002`
(`0002_sad_lucky_pierre.sql`), and it adds its own `0002_short_mother_askani`,
`0003_productive_red_hulk`, `0004_gorgeous_stryfe`. **The journal will conflict
and the numbering must be regenerated**: after merging `main` into the branch,
delete the three ACP migration files and their snapshots, run
`pnpm db:generate` once to emit a single new migration from the merged schema,
and check it with `pnpm db:migrate` against a scratch database. Other
hotspots: `packages/eslint-config/base.js` (the `../../` exception),
`turbo.json` (`ui: "tui"`), `fold-run.ts` and `stage-map.ts` (ACP event maps),
`docs/product/decisions.md` (both sides appended sections; keep both).

Acceptance: `pnpm test` green including `src/acp/test/never-automatic.test.ts`
and `isolation.test.ts`; the API still boots with every `ACP_*` variable unset.

### Step 6 — tag and record the SHA (Tue 18:00)

```bash
git tag -a hackathon-freeze-1 -m "Integrated line for the Sibyl hackathon video"
git push origin main hackathon-freeze-1
git rev-parse --short HEAD   # this is the hash that goes on screen
```

Later fixes get `hackathon-freeze-2`, and so on. The README's "Demo commit"
line names the last one.

### Step 7 — decide about the chat extras (Wed, only if Step 5 is done)

`ai_cli_sandbox_reputation` (chain-of-thought, token metering, Base RPC
readiness) is nice-to-have. Cherry-pick only the Base/Virtuals readiness
commit if [04](04-partner-stacks-plan.md) needs it; leave the rest.

## Proposed owners

Names come from git authorship and tracker assignment, not from anyone's
agreement; adjust tonight.

| Work | Proposed | Why |
|---|---|---|
| Steps 0–4, 6 | Harry | Author of the reputation line and most of `main` |
| Step 5 | musashi0x (Rick in the tracker, assignee of #31) | Author of `feat/acp_job` |
| Test triage in Step 1 | whoever is second free | The failing groups are independent |

## What must not happen during integration

- Do not "fix" a red test by weakening a never-automatic guarantee (approve
  without a pending request, fund without an intent row, AUTO on `ERROR`).
- Do not let the bridge silently create `memory.db`; the `db_absent` check
  stays.
- Do not rewrite migration `0002_sad_lucky_pierre` that `main` has already
  applied on the developers' databases.
- Do not squash. The judges read commit history.

# Schedule — Mon 7 Sep evening to the deadline

Times are ICT (UTC+7). Deadline is Thu 11 Sep 06:59 ICT; internal cut-off
Thu 03:00 ICT. Owners are proposals from git authorship and tracker
assignments (Harri = Harry, Rick, Lia in project 3); confirm tonight.

## Cut lines, decided now

**Never cut** (the gate and the top of the memory band):
one integrated branch · fresh-session restart on camera · commit hash on
screen · deletion test in the README · write-back · Memory Diff card ·
counterfactual · README memory map · the video · two posts · Prior Work
declaration.

**Cut in this order if Wednesday runs out:**
1. x402 (never started).
2. Hosted Railway deploy (task #77) — the judges run locally from the README.
3. Memory drawer controls (`Correct memory`, `Archive relationship`).
4. Editorial restyle of Operator/Board.
5. Virtuals ACP (if the sandbox is not working by Tue noon; keep Base).
6. HOT-state resume on restart (keep REFERENCE and ARCHIVE; they are cheaper).
7. The coordination beat with a second Claude Code session (keep the MCP tools).

## Mon 7 Sep, evening

| When | What | Owner |
|---|---|---|
| 19:00 | Read this plan; agree owners and cut lines in one call | all |
| 19:30 | Push `work/deploy-and-sibyl-tenant`, stash and record the uncommitted UI, push the two side branches ([02 §Step 0](02-integration-plan.md)) | Harry |
| 19:30 | Register Virtuals sandbox agents (buyer, Alpha, Beta); faucet the buyer wallet with Base Sepolia ETH + USDC ([04 §1](04-partner-stacks-plan.md)) | Rick |
| 20:00 | Confirm hackathon registration and the build-page link; join the Discord | Lia |
| 20:30 | Sync this plan to the tracker (done by this session); create `[HACK]` tasks; assign | Harry |

**Gate 0 (Mon 21:00):** backups pushed; owners assigned; registration confirmed.

## Tue 8 Sep — integration day

| When | What | Owner |
|---|---|---|
| 09:00–12:00 | Merge `origin/main` into the reputation line; fix the 17 failing API tests; commit the UI work; restore the fixture's `memory_adjustment` ([02 §1–3](02-integration-plan.md)) | Harry |
| 09:00–12:00 | Merge `main` into `feat/acp_job`, regenerate the migration, get its tests green; write the two seller scripts ([04 §1](04-partner-stacks-plan.md)) | Rick |
| 09:00–12:00 | Draft the README top section and the Prior Work declaration; draft Post 1 ([06](06-submission-checklist.md)) | Lia |
| **12:00** | **Gate 1: Virtuals go/no-go.** Is a sandbox job creatable from the buyer wallet? If not, drop Virtuals and move Rick to the Base commitment | all |
| 13:00–15:00 | PR the reputation line to `main`; CI green; merge | Harry |
| 13:00–17:00 | Merge the ACP branch to `main`; first sandbox job end to end with a funded Approve click | Rick |
| 15:00–18:00 | Bridge tier commands (`set_state`, `get_state`, `set_reference`, `get_reference`, `archive_entity`), `memory.retrieved` carries `source` + verdict, commit hash + clock in the topbar, `pnpm demo:restart` / `demo:reset` / `demo:seed` / `demo:deletion-test` ([03 §2–4](03-memory-load-bearing-plan.md)) | Harry |
| 18:00 | Tag `hackathon-freeze-1`; Post 1 goes out with a real screenshot | Harry, Lia |

**Gate 1b (Tue 18:00):** `main` green; a Mission runs Session A → restart →
Session B locally with the winner changing. If not, Wednesday morning is
integration, not features.

## Wed 9 Sep — proof and polish

| When | What | Owner |
|---|---|---|
| 09:00–13:00 | Base memory commitment tx + Transaction card + `pnpm memory:verify` ([04 §2A](04-partner-stacks-plan.md)) | Rick |
| 09:00–13:00 | Memory Diff card folded from the write-back event ([03 §6](03-memory-load-bearing-plan.md)); `memory_journal` MCP tool; actor provenance in `write_event` | Harry |
| 09:00–13:00 | README memory map verified file by file; Known limits; Partner stacks section skeleton | Lia |
| 13:00–15:00 | Operator evaluate command for ACP jobs; evaluation → write-back join; Network chips backed by real checks ([04 §1, §4](04-partner-stacks-plan.md)) | Rick |
| 13:00–15:00 | Dry run of the full script with a timer; fix whatever breaks the one-take segment ([05](05-demo-script.md)) | Harry, Lia |
| 15:00–18:00 | Tag `hackathon-freeze-2`; record take 1 and take 2 | Harry (driver), Lia (narration) |
| 18:00–20:00 | Second-run test: fresh clone in a temp directory on a second laptop, follow only the README; fix the README, not the tester | Rick |

**Gate 2 (Wed 20:00):** a watchable take exists on a green SHA; README passes
the fresh-clone test.

## Thu 10 Sep (ICT) — the last day before the UTC deadline

| When | What | Owner |
|---|---|---|
| 09:00–12:00 | Fix list from the takes; re-record only if the one-take segment has a mistake | Harry |
| 09:00–12:00 | Partner stacks section with real hashes and agent names; Prior Work declaration finalised; `docs/product/README.md` and `demo.md` status tables updated to the freeze commit | Lia |
| 12:00–14:00 | Export, upload unlisted, review on a phone, publish; Post 2 | Lia |
| 14:00–16:00 | Tag `hackathon-freeze-3` if anything changed; CI green; README hash matches the video | Harry |
| 16:00 | Build page filled: repo, video, team, stacks, memory note. **Mark ready.** Screenshot to the tracker | all |
| 16:00–03:00 (Fri) | Buffer. Nothing new. Tracker statuses synced; decisions recorded in `docs/product/decisions.md` | — |

**Gate 3 (Thu 16:00 ICT, 09:00 UTC):** submission marked ready with 15 hours of
slack. Anything after this is a fix, not a feature.

## Risks and what to do about them

| Risk | Signal | Response |
|---|---|---|
| Virtuals sandbox rejects an EOA buyer or rate-limits | Job creation fails Tue morning | Gate 1: drop Virtuals, keep Base; remove the ACP chip from Network |
| Migration conflict eats the afternoon | `pnpm db:migrate` fails after the ACP merge | Regenerate one migration from the merged schema; never hand-edit the journal |
| The 17 failing tests hide a real regression | A never-automatic test fails after the fix | Stop; the invariant wins; re-read `run-store.ts` before touching the test |
| One-take segment keeps breaking | Restart takes longer than 40 s or the topbar does not reconnect | Pre-warm Docker; script the restart; accept a 60 s segment |
| Free-tier cap | `atOrAboveCap: true` in `/health/sibyl` | `pnpm demo:reset` archives old test counterparties before recording |
| A teammate's branch is not pushed | `git branch -r --contains <sha>` empty | Push tonight; Gate 0 |
| The judge cannot build the Python bridge | Fresh-clone test fails at the venv step | Add the Docker path for the API (the Railway Dockerfile already carries both runtimes) |

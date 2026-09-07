# Submission checklist

**Deadline: Wed 10 Sep 2026, 23:59 UTC = Thu 11 Sep, 06:59 ICT.** Internal
cut-off: Wed 10 Sep, 20:00 UTC (Thu 03:00 ICT), so a failed upload has three
hours of slack. Registration closed 31 Aug; confirm the team is registered and
has the private build-page link before doing anything else tonight.

## The build page (no separate form)

Registered teams get a private link to a build page. Fields, from
`/submissions`:

1. **Public repository** — `https://github.com/musashi0x/aura_memory`, MIT.
   "Clean commits and a README with complete setup and run instructions."
2. **Demo video** (2–5 min) — problem, audience, product, mechanics, and a
   fresh session recalling earlier state.
3. **Team and stack** — every builder; every Base or Virtuals stack used.
4. **Memory implementation note** — "what your agent persists, recalls, and
   uses to make decisions."

Mark the submission ready before the deadline. Screenshot the confirmation.

## README, rewritten for a judge with two minutes

The current README is a developer setup guide. Keep it, but put a new top
section above it. Sections, in this order:

1. **What Aura Console is** (three sentences) and who it is for.
2. **Demo video** link, commit hash it was recorded on, and chapter timestamps.
3. **Run it in five commands** — `pnpm install`, `docker compose up -d`,
   `cp .env.example .env`, `pnpm db:migrate`, `pnpm demo:seed && pnpm dev`.
   Then the Sibyl venv line. Then `pnpm demo:reset` to start over. A judge's
   second run must work from these lines alone; test them on a machine that
   has never run the project (a fresh clone in a temp directory at minimum,
   ideally a teammate's laptop).
4. **Where memory is read and written** — the table from
   [03 §7](03-memory-load-bearing-plan.md), verified against the code.
5. **The deletion test** — the two commands from [03 §2](03-memory-load-bearing-plan.md).
6. **The fresh-session proof** — what `pnpm demo:restart` wipes and what it keeps.
7. **How memory made this possible** (the note the rules ask for) — four
   sentences: the decision is a ranking over Sibyl records; without them the
   agent blocks; with them the winner changes and the counterfactual shows by
   how much; the new memory version is committed to Base as a hash.
8. **Partner stacks** — exactly what ran: sandbox agent names, job id, fund tx
   hash, commitment tx hash, explorer links. Nothing that did not run.
9. **Known limits** — free-tier 5 MB cap; single operator, no auth; Base
   Sepolia only; the stream is a replay, not a live tail; `learn`/`lint` are
   paid-tier Sibyl features and are not used.
10. **Prior Work declaration** — see below.
11. **Team** — names and roles.

## Prior Work declaration (draft)

> This repository was created on 26 Aug 2026 as "Aura Console", before the
> build window opened. Work that predates 1 Sep 2026: the monorepo skeleton,
> landing page, onboarding, Console shell, the event-sourced Run API, the
> product design pack, and a read-only Sibyl Memory bridge with fixture data.
> Built during the window (1–10 Sep): the Mission workspace, the MCP tool layer
> and Gemini function-calling loop, the Mission agent that scores from Sibyl,
> episode write-back and the Bayesian reputation loop, the five-tier memory
> usage, the Virtuals ACP runtime, the Base memory commitment, the demo
> instrumentation and the README. Full history is in `git log`; the freeze
> tags `hackathon-freeze-*` mark the demo commits. No code from other
> hackathons was reused.

Correct the two lists against `git log --since=2026-09-01` before publishing.

## Build-in-public posts (two required)

Platform is not specified; X is where @sibylcap lives, so use X and mirror to
Discord (`discord.gg/csya975jMa`). Tag `@sibylcap` on both, `@base` and
`@virtuals_io` on any post that claims those stacks.

**Post 1 — build log (Tue or Wed).** One screenshot of the Memory Diff card or
the Trace with Sibyl verdicts. Draft:

> Building Aura Console for the @sibylcap hackathon. The agent ranks
> counterparties from Sibyl Memory before it spends; if memory can't be read it
> refuses to score rather than pretending nobody is there. Today: episode
> write-back + a Bayesian reputation loop, all in a local SQLite file. Repo:
> <link>

**Post 2 — the demo (Wed or Thu).** The video, with the one-take restart
called out:

> Kill the API, drop the database, keep one file. A fresh process picks a
> different counterparty because Sibyl remembered the one that failed. Memory
> version committed to @base Sepolia, job settled through @virtuals_io ACP.
> 4-minute demo: <link> · Repo: <link> · #SibylHackathon

Keep the post links; they go on the build page.

## PMF bonus (up to +10, default 0)

Counts only with a publicly verifiable artifact checkable in five minutes:
a waitlist, design partners, real usage, or pilots. Market-size claims earn
nothing; fabricated evidence disqualifies, including after payout.

Honest options, cheapest first:

- A waitlist form linked from the landing page's final CTA, with the live
  count visible on the page. Only worth doing if the team will actually share
  it (Discord, X, the Virtuals builders channel) and real people sign up.
- One or two named design partners (agent teams that would use a spend
  console) with a public statement. Only if such a conversation already
  exists.
- Otherwise claim 0. A clean 0 costs nothing; a thin claim costs credibility
  on every other line.

## Repository hygiene before the freeze

- [ ] `LICENSE` is MIT (it is). Add the SPDX line to `package.json`.
- [ ] `.env.example` documents every variable the demo needs, including the
      `ACP_*` set and `GIT_SHA`.
- [ ] `docs/product/README.md` "What is implemented today" and
      `docs/product/demo.md` "What is demonstrable today" match the freeze
      commit. Both are stale today.
- [ ] Tracker docs #19, #20, #37 get a one-line "superseded by Mission
      workspace; see repo docs" note (task #71), or are left alone with the
      note in the README's docs section.
- [ ] No secrets in history: grep for private keys before pushing the ACP env.
- [ ] CI green on the freeze SHA; badge in the README.

## Final-hour checklist (Thu 11 Sep, 02:00–03:00 ICT)

- [ ] Video public, plays, under 5:00, chapters in description.
- [ ] Post 1 and Post 2 live, links copied.
- [ ] README on `main` matches the video's commit hash.
- [ ] Build page: repo, video, team, stacks, memory note. Marked ready.
- [ ] Screenshot of the ready state saved to the tracker task.

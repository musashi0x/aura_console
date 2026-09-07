# Demo script — 2 to 5 minutes, one Mission, one restart

Target length 4:00. The rules want: the problem, the audience, the product,
how it works, and **a fresh session recalling earlier state in one continuous
unedited segment with an on-screen timestamp or commit hash**. Judges score
pitch on whether the load-bearing memory moment is unmistakable.

This script follows `docs/product/demo.md`'s nine beats and its two rules:
never claim memory changed a decision unless the counterfactual differs, and
never present a card as something the agent said.

## Screen setup

- Left 70%: the Console at `/runs/<id>` in Operator mode, light layer.
- Right 30%: a terminal with a large font. It shows `git rev-parse --short
  HEAD`, `date -u`, and the process commands. The Console topbar also shows
  the commit hash and UTC clock (see [03 §3](03-memory-load-bearing-plan.md)),
  so the hash is on screen even when the terminal is hidden.
- Browser at 125% zoom. No notifications. Reset script run before each take.

## Beats and narration

**0:00–0:20 — The problem (talking head or title cards).**
"Autonomous agents spend money and forget who burned them. Aura is a console
where an operator and an agent decide together, and the agent's memory of
past counterparties is the input that changes the decision. Memory lives in
Sibyl: a local SQLite file, no vector database. This is Base Sepolia, single
operator, and every number you'll see comes from an event, not from a model."

**0:20–1:40 — Session A: learn from a real outcome.**
1. Start a Mission: "Research three competitors, ceiling 25 USDC."
2. Memory Recall card: "Sibyl recalled 0 previous interactions" for Alpha and
   Beta (or the seeded fixture — say which). Point at `NO_HISTORY`: "That is
   'we looked and there is nothing'. If Sibyl were down you'd see a different
   state, and the agent would refuse to score."
3. Comparison and Decision card: Alpha wins on price. "Both unknown, cheaper
   wins. Memory checked, recommendation unchanged."
4. Approval card: "Fund ACP job — ceiling 0.20 USDC." Click Approve. "Nothing
   settles without this click; the API refuses an approval nobody asked for."
5. Agent Job card moves to FUNDED (Virtuals ACP on Base Sepolia); the seller
   delivers; the operator evaluation rejects it: missing required JSON fields.
6. Outcome card: FAILED_EVALUATION, provider failure, not infrastructure.
7. Memory Diff card: Alpha reliability 0.50 → 0.33, status NEW → WATCH,
   Sibyl event id shown. "That record now lives in a file on disk."
8. Transaction card: "Memory v2 committed to Base Sepolia" with the hash and
   the explorer link. "The hash, not the memory. Anyone can verify it changed;
   nobody can read it."

**1:40–2:10 — The restart boundary. One take, no cuts, from here to 3:10.**
In the terminal, read the commit hash and UTC time aloud. Run
`pnpm demo:restart`. Narrate what it does: "Kill the API, the worker and the
agent. Drop the Postgres volume, so the event store is gone. The only thing
that survives is `memory.db`." Show the Console reconnect, the new process
start time in the topbar, and `/runs` listing zero Missions.

**2:10–3:10 — Session B: a fresh process decides differently.**
1. Post the same objective.
2. Memory Recall card: "Sibyl recalled 1 previous interaction. Memory changed
   this decision." Trace shows `memory.retrieved` with `source: SIBYL`,
   `verdict: ok`.
3. Decision card: Beta selected. Press `Compare without memory`: Alpha would
   have won; the recorded penalty is named. "This is computed from the
   scoring event, not re-run."
4. Policy Gate card: "Guardrails v4, same as Session A" — read from Sibyl's
   REFERENCE tier. "The rules did not move. The memory did."
5. Terminal: `sibyl memory recall virtuals:agent:alpha` (or the bridge
   `recall` command) prints the same record the card shows.

**3:10–3:35 — Coordination: another agent reads the same memory.**
Open a fresh Claude Code session in the repo. Ask: "Which counterparty should
Aura avoid and why?" Show the `memory_recall_counterparty` tool call and the
answer citing the episode. "Different process, different model, same file."

**3:35–3:55 — Trace, and what we did not do.**
Switch to Trace: the raw events, the Sibyl verdicts, the tx hashes. "Nothing
on the product surface was written by a model. Cards are folded from events."
One sentence on the deletion test: "Unset `SIBYL_PYTHON` and Missions block.
Try it; the command is in the README."

**3:55–4:10 — Close.**
Who it is for (operators who let agents spend), what is next, repo link,
commit hash again.

## What not to say

- Do not say "live" about anything that is a single read (`LATEST SNAPSHOT`
  is the honest label until a stream exists).
- Do not say memory changed the decision in Session A. It did not.
- Do not call the fixture counterparties real history; if the seeded records
  are used, say "seeded, labelled `source: fixture`".
- Do not imply mainnet or a real payment.
- Do not narrate Board or the landing page unless there is time left; they
  are not the proof.

## Recording checklist

- [ ] Recorded on a tagged, CI-green SHA; hash visible in the topbar.
- [ ] `pnpm demo:reset` run before every take; Session A starts from a Sibyl
      store with **no** Alpha episode (fresh seed) so the Memory Diff is real.
- [ ] Segment 1:40–3:10 is one take. Keep the raw file.
- [ ] Two full takes minimum; pick the one where the narration is calmer.
- [ ] Captions or clear audio; judges may watch muted.
- [ ] Export at 1080p, under 5 minutes, and time-stamp the chapters in the
      description.
- [ ] Upload unlisted first, check playback, then public (YouTube) and post on X
      tagging @sibylcap, @base, @virtuals_io.

## Fallback cut (if partner stacks fail)

Drop beats 4–5 and 8 of Session A: the operator approves, execution runs in the
sandbox (the AI CLI runner), the verifier fails Alpha, memory is written. The
restart, Session B, the counterfactual and the coordination beat are unchanged.
The video is then about 3:20 and still passes the gate.

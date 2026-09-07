# Memory load-bearing plan

The 40-point line and the pass/fail gate. Everything here is about making the
claim "this agent decides differently because it remembers" true, visible, and
impossible to fake.

## 1. What is already true (keep, and say it out loud)

- **Recall is on the critical path.** `MissionAgent.openMission`
  (`apps/api/src/services/mission-agent.ts`, reputation line) reads
  `listCounterpartiesFromSibyl()` before scoring. If Sibyl cannot be read the
  Mission is **blocked with the memory reason**, never scored from an empty
  list. That is the deletion test, already enforced in code.
- **Write-back is real.** `MissionExecutionService` calls the bridge's
  `record_episode`, which does `set_entity` on the counterparty (WARM) and
  `write_event` (COLD) in `tools/sibyl_bridge.py`. The local store has today's
  events to prove it.
- **The verdict travels.** `ok / no_match / empty_store / gated / abstained_on /
  negation_abstain` reach the API as `AVAILABLE / NO_HISTORY / ERROR`, and
  `ERROR` can never reach `AUTO` (`memory-authorization.ts`). "We could not
  look" is never rendered as "there is nothing". Judges who read the Sibyl
  docs will recognise the verdict codes; almost no other entry will surface
  them.
- **Tenant is explicit.** Every bridge call reads as `AGENT_ID`; a missing
  tenant is a refusal, not a default.
- **The counterfactual is computed from recorded evidence.**
  `projection/counterfactual.ts` subtracts `memory_adjustment` from the scoring
  event; it never re-runs the model.

## 2. The deletion test, scripted

Judges are told to try it. Make it a one-liner and put it in the README.

```bash
# Terminal 1: API with memory removed
SIBYL_PYTHON= pnpm --filter @aura/api dev
# Terminal 2
curl -s -X POST localhost:3001/api/runs -H 'content-type: application/json' \
  -d '{"objective":"Hire a research agent","budgetUsdc":"25"}'
curl -s localhost:3001/api/runs/<id>/events | jq '.events[].type'
# expected: run.created, run.blocked  (data.summary names Sibyl as the missing dependency)
```

With `SIBYL_PYTHON` set the same POST yields `run.created`,
`memory.retrieved`, `candidate.scored`, `decision.made`,
`approval.requested`. Verify the exact event names on the integrated branch
before writing the README; the reputation line renamed some.

Add `pnpm demo:deletion-test` as a script that runs both halves and prints the
two event lists side by side.

## 3. The fresh-session protocol (the gate moment)

The rules want one continuous unedited segment showing a cold start recalling
earlier state, with an on-screen timestamp or commit hash. Design it so the
recall can only have come from Sibyl:

```text
Session A
  1. POST /api/runs  "Research three competitors, ceiling 25 USDC"
  2. Agent recalls (NO_HISTORY for a new counterparty, or the seeded fixture), scores, asks for approval
  3. Operator approves on the Approval card (the only path to money)
  4. Execution runs, verifier fails Alpha's deliverable
  5. record_episode → Sibyl: Alpha reliability drops, status WATCH, journal event written
  6. Memory Diff card renders before/after

Restart boundary (on camera, one take)
  7. `pnpm demo:restart`  — kills the API, the ACP worker, and the ADK agent;
     `docker compose down -v postgres && up -d && pnpm db:migrate`  — wipes the
     event store; memory.db is untouched
  8. Console topbar shows the new API process start time and the commit hash

Session B
  9. Same objective posted again
 10. Agent recalls Alpha as WATCH with one failure — from Sibyl, because Postgres is empty
 11. Beta wins; Decision card says "Memory changed this decision"
 12. Compare without memory → Alpha would have won
```

Wiping Postgres between sessions is the strongest possible proof: the only
durable state that survived is the Sibyl file. Say so on camera.

Instrumentation to build (small):

- **Commit hash and UTC clock in the Console topbar.** `GET /health` already
  exists; add `commit` (from `GIT_SHA` env or `git rev-parse` at build) and
  `startedAt` to its body and render both in `console-topbar.tsx`. This alone
  satisfies the on-screen requirement without a second window.
- **`pnpm demo:restart`** and **`pnpm demo:reset`** scripts in `package.json`
  (kill processes, recreate Postgres, migrate, optionally re-seed the fixture).
- **`memory.recall` event carries the source.** Known gap #3 in
  `docs/ai/api/memory.md`: `memory.retrieved` has no `source` or
  `sibyl_verdict_code`. Add both so Trace shows `source: SIBYL, verdict: ok`
  in Session B. Two fields, big payoff on camera.

## 4. Five tiers on the critical path ("dynamic-storage patterns")

Today only WARM (`set_entity`) and COLD (`write_event`) are written. Each tier
below has a job that a judge can see doing work, and each is a few lines in the
bridge plus one call site. Free tier supports all of them.

| Tier | Sibyl call | What Aura stores | Read back where | Visible how |
|---|---|---|---|---|
| HOT | `set_state("run:<run_id>", …)` / `get_state` | Live Mission context: phase, chosen counterparty, pending approval ceiling | On API start, `get_state` for any Run not terminal → emit `run.resumed` with `resumed_from: "sibyl_hot_state"` | Trace shows the resume event after the restart; the Console does not have to re-derive from Postgres |
| WARM | `set_entity("counterparty", key)` (exists) | Relationship profile, episodes, FSM status | `listCounterpartiesFromSibyl` before scoring (exists) | Memory Recall card, Agents page |
| COLD | `write_event(evaluated=…, acted=…)` (exists) | Every episode and decision as a journal line | `read_events` behind `GET /api/memory/journal` (new) and the `events` bridge command (exists) | Trace "Memory journal" strip; the MCP tool `memory_journal` for other agents |
| REFERENCE | `set_reference("guardrails:v<policy_version>", policy)` | The exact policy the decision was evaluated under | Session B `get_reference` and shows "same guardrails v4 as Session A" on the Policy Gate card | Proves the decision changed because of memory, not because the rules moved |
| ARCHIVE | `archive_entity("counterparty", key, reason)` when the FSM reaches BLOCKED; manual unblock restores by `set_entity` | Retired counterparties with the audit reason | `sibyl memory list` shows it under archive; the Agents page badges it | The existing manual-unblock UI becomes an archive/restore story |

Implementation notes:

- Add `set_state`, `get_state`, `set_reference`, `get_reference`,
  `archive_entity` commands to `tools/sibyl_bridge.py`, each with the same
  `ok/code/detail` envelope. Update the docstring: the bridge is no longer
  read-only, and the honest statement is "every write is caused by a recorded
  Run event and names it".
- Keep the write path out of any HTTP handler that a request can reach
  directly; writes happen inside `MissionExecutionService` after a verifier
  result, exactly as `record_episode` does today.
- Free-tier cap is 5 MB and the store is at 1.7 MB. HOT state is rewritten in
  place, so it does not grow. Journal lines are small. Fine for the week; note
  it in the README as a known limit.

## 5. Coordination (the other half of the top band)

Two patterns, both cheap because the repo already has an MCP server.

**Pattern A — a second agent reads Aura's memory over MCP (do this).** In the
video, after Session B, open a fresh Claude Code (or Cursor) session with
`.mcp.json` and ask: "Which counterparty should Aura avoid and why?" The
assistant calls `memory_recall_counterparty` on the API's MCP server and
answers from the Sibyl record with the verdict. That is a different process,
a different model vendor, and a different session, all reading one file-based
memory. Add a `memory_journal` tool (COLD `read_events`) so it can also cite
the exact episode.

**Pattern B — writer provenance.** The verifier agent's evaluation and the
buyer agent's decision are two actors. Put `actor` into the `acted` field of
every `write_event` (`buyer_agent`, `verifier_agent`, `operator`) so the
journal reads as a coordination log. One field.

**Not this week:** a second tenant sharing the store. Tenant isolation is a
privacy story, not a coordination story, and adding a tenant means a second
`AGENT_ID` and auth the product explicitly does not have (Decision 31).

## 6. The Memory Diff card (task #34, minimum version)

The "Aura learned" beat is the emotional close of Session A and the setup for
Session B. Build the minimum:

- The write-back path already emits an event (`memory.episode.written` in the
  fixture vocabulary). Make it carry `before` and `after` for
  `overall_reliability`, `confidence`, `relationship_status`, plus the episode
  id and the Sibyl `event_id` returned by `record_episode`.
- Fold it into a `memory-diff-card.tsx` next to `candidate-scored-card.tsx`:
  three aligned rows, direction in text and number, a link to the evidence
  event. No drawer, no `Correct memory`, no `Archive relationship` control
  (a control that cannot act is not rendered).
- The Sibyl `event_id` on the card is what makes it verifiable: `sibyl memory
  recall <key>` in a terminal shows the same record.

## 7. README memory map (gate requirement 2)

Table to paste into the README, to be corrected against the integrated branch:

| Moment | Read or write | Tier | File · function |
|---|---|---|---|
| Mission opens: who could be hired | read | WARM | `apps/api/src/services/mission-agent.ts` · `MissionAgent.open` → `services/sibyl.ts` · `listCounterpartiesFromSibyl` → `tools/sibyl_bridge.py` · `entities` |
| Decision explains one counterparty | read | WARM | `services/sibyl-memory.ts` · `recallCounterparty` → bridge `recall` (`search_entities`, verdict refined by `refine_zero`) |
| Approval gate | read | WARM | `services/memory-authorization.ts` · `authorizeFromRetrieval` |
| Outcome learned | write | WARM + COLD | `services/mission-execution.ts` → bridge `record_episode` (`set_entity`, `write_event`) |
| Live Mission context | write/read | HOT | bridge `set_state` / `get_state` (new) |
| Guardrail snapshot | write/read | REFERENCE | bridge `set_reference` / `get_reference` (new) |
| Blocked counterparty | write | ARCHIVE | bridge `archive_entity` (new) |
| Other agents | read | WARM + COLD | `apps/api/src/mcp/tools.ts` · `memory_recall_counterparty`, `memory_list_counterparties`, `memory_journal` (new) |

## 8. Acceptance checklist for this plan

- [ ] `pnpm demo:deletion-test` prints a blocked Mission without Sibyl and a scored one with it.
- [ ] Session A → `pnpm demo:restart` (Postgres wiped) → Session B changes the winner, in one take, with the commit hash on screen.
- [ ] Trace shows `memory.retrieved` with `source: SIBYL` and the verdict code in Session B.
- [ ] `sibyl memory list` (or the bridge `status` command) shows entries in state, entities, journal, reference and archive after one full run.
- [ ] A fresh Claude Code session answers a counterparty question from the MCP tools.
- [ ] Memory Diff card renders before/after with the Sibyl event id.
- [ ] README memory map matches the code (every file and function name checked).

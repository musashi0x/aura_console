# Counterparty memory

## What

Relationship memory for one counterparty, composed from two sources and served
read-only. Postgres owns the memory version, the salted diff and the scored
profile. Sibyl Memory owns recall — records an operator wrote about a
counterparty, searched over a local SQLite store through a Python bridge.

Sibyl **augments** the Postgres read. It does not replace it and does not
precede it. Replacing it would delete the version, the salt and the diff, which
are the inputs to the on-chain commit; consulting it first would let a Sibyl hit
suppress the scored profile, and would let a Sibyl refusal *shorten* a lookup —
the exact inversion the verdict mapping below exists to prevent.

## Where

- `apps/api/src/routes/memory.ts` — the two endpoints, mounted on
  `/api/counterparties` alongside the AD-04 projection.
- `apps/api/src/services/memory-store.ts` — `retrievePostgres`,
  `retrieveWithProvenance`, and `compose`, which holds the matrix.
- `apps/api/src/services/sibyl-memory.ts` — `recallCounterparty`,
  `VERDICT_OUTCOME`, `invalidIdentifierReason`. One recall, folded to one state.
- `apps/api/src/services/sibyl.ts` — `recallEntities` and the process boundary:
  one timeout, one error vocabulary, one closed verdict union.
- `tools/sibyl_bridge.py` — the read-only bridge. `recall` is the command these
  endpoints use.
- `apps/api/src/services/memory-authorization.ts` — the gate that consumes the
  composed status.

## Endpoints

| Method | Path | Returns |
|---|---|---|
| `GET` | `/api/counterparties/:key/memory` | `200` for every well-formed key, including `ERROR` and including a counterparty nobody has heard of |
| `GET` | `/api/counterparties/:key/memory/records` | `200` with the recall set and its verdict, or `503` when Sibyl could not be asked |

### `GET /api/counterparties/{key}/memory`

The composed state a decision reads. Fetched once per counterparty per Run.

```json
{
  "counterparty_key": "virtuals:agent:alpha",
  "status": "AVAILABLE",
  "source": "BOTH",
  "retryable": null,
  "memory_version": 13,
  "episodes_used": 4,
  "relationship_status": "PREFERRED",
  "overall_reliability": 82,
  "task_fit": 74,
  "confidence": 61,
  "postgres": { "outcome": "AVAILABLE", "reason": null },
  "sibyl": {
    "consulted": true,
    "record_count": 1,
    "verdict": { "code": "ok", "detail": "…", "returned": 1 },
    "code": null,
    "detail": "Sibyl matched records in memory and returned them."
  }
}
```

`source` is `POSTGRES | SIBYL | BOTH | NEITHER`. `retryable` is a boolean only
on `ERROR` and `null` otherwise — `false` on a healthy result would read as "do
not bother". Every profile field is `null` unless `status` is `AVAILABLE`: the
`ERROR` variant has never carried a profile and must not start.

`postgres.reason` is `no_row | version_zero | no_profile | query_failed`, naming
which read came back empty rather than merging three different silences.

**No record bodies.** This is the path that authorizes a spend; arbitrary Sibyl
JSON has no business on it. The drawer endpoint carries bodies instead.

`400 invalid_counterparty_key` for a key that is malformed or that Sibyl's own
identifier rules would reject. Everything else is `200`.

**Never 404**, even for a counterparty that does not exist. A 404 would force
the caller to infer "no history" from an HTTP error, which is precisely the
collapse this endpoint exists to prevent. This deliberately diverges from
`GET /api/counterparties/{key}`, which *does* 404 — there, an empty projection
would be a claim about identity; here, the absence of history **is** the answer.

**Never 503.** Same reason `/health/sibyl` stays 200: the API is fine, one
dependency is not, and the Console needs a body to render the correct
unavailable state from.

### `GET /api/counterparties/{key}/memory/records`

The recall set with bodies, for a human opening the memory drawer. Sibyl is its
only source.

`limit` is an integer 1–50, default 20 (`400 invalid_limit`). `q` is an optional
refinement of 1–200 characters (`400 invalid_query`); absent, the counterparty
key is the query. It is absent by design rather than defaulted to `""` — the key
is the recall, and a refinement is the operator narrowing it.

This one **does** 503 when Sibyl could not be asked: `sibyl_not_configured` when
no runtime is set, `sibyl_unreachable` for every other failure to look. With
Sibyl as the only source, a `200` carrying `items: []` would be indistinguishable
from a store that genuinely holds nothing.

A Sibyl that *did* answer comes back `200` — including when it refused. The body
carries `outcome` beside the verdict so a refusal cannot be read as an absence
even by a caller that ignores the verdict.

## The verdict mapping

Sibyl stamps exactly one verdict on every result. `ok` is the only one that
accompanies a non-empty result; the other five are causes of an empty one. This
is how each becomes a retrieval state:

| Sibyl verdict | Retrieval state | `retryable` | Because |
|---|---|---|---|
| `ok` (with records) | `AVAILABLE` | — | Sibyl returned records |
| `empty_store` | `NO_HISTORY` | — | We looked; the store is genuinely empty |
| `no_match` | `NO_HISTORY` | — | We looked; nothing matched this counterparty |
| `abstained_on` | `ERROR` | `false` | Sibyl declined to answer |
| `negation_abstain` | `ERROR` | `false` | Sibyl declined to answer |
| `gated` | `ERROR` | `false` | Sibyl's gate rejected the candidates |
| *missing or unrecognised* | `ERROR` | `false` | A code we do not understand is not a clean bill of health |
| `ok` with zero records | `ERROR` | `false` | Sibyl guarantees `ok` accompanies non-empty, so this is a contract we cannot read |
| key rejected by the identifier rules | `ERROR` | `false` | We never looked, so we have not learned that there is nothing |
| `bridge_unreachable` | `ERROR` | `true` | The process would not run; a second attempt might |
| `db_absent`, `client_missing`, `client_error`, `bridge_contract` | `ERROR` | `false` | Somebody has to change something before the answer can change |

### Why the three abstentions are `ERROR` and not `NO_HISTORY`

This is the single most important line in the integration, so it is stated once
and not softened anywhere downstream.

An abstention is Sibyl **refusing to answer**. That is "we could not look". It
is not "we looked and there is nothing". Folded into `NO_HISTORY`, a refusal
would reach an operator as *No previous relationship found* — a clean bill of
health that nobody issued — and it would take the approval path reserved for a
first, genuinely unknown dealing with a stranger. The operator would then
approve a spend on the strength of a sentence the system invented.

As `ERROR` it cannot. `authorizeFromRetrieval` denies on `ERROR` unless the
operator's versioned policy sets `memory_error_override_allowed`, which softens
it only as far as `REQUIRE_APPROVAL`. `AUTO` is unreachable from `ERROR` on
every path.

They are not retryable because the same query meets the same gate. A retry loop
would spend the operator's time to be refused in exactly the same words.

The collapse to three states is what a decision needs; it is not what an
operator needs. So the verdict code and its sentence travel out intact on every
response, whatever the status: three states must never cost us which of the six
causes fired.

### Which verdicts are reachable today

Four of the eleven rows above are dead code on the current call path. Say so
plainly rather than implying the mapping is exercised.

`tools/sibyl_bridge.py`'s `recall` calls `MemoryClient.search_entities()` and
nothing else. That method is documented in the client as a *policy-free
primitive* — no abstention, no relevance gate — and stamps only `ok` or
`no_match`. So:

- `empty_store` needs `verdicts.refine_zero(client, results)`, one extra probe
  that upgrades a bare `no_match` when the store is genuinely empty. The bridge
  does not call it. An empty store therefore reports `no_match` today. Both map
  to `NO_HISTORY`, so no state is wrong — but the *carried cause* is, and
  carrying the precise cause is the point.
- `abstained_on`, `negation_abstain` and `gated` are produced only by
  `sibyl_memory_client.multi_record.multi_record_search()`, which is a
  module-level function, not a `MemoryClient` method, and not in the package's
  `__all__`. Nothing here calls it, and making a non-exported internal
  load-bearing would be a dependency on private API.

The mapping is implemented in full anyway, and that is deliberate: it must be
total, so a client upgrade that starts stamping a code we have not seen lands on
`ERROR` rather than on a silent `NO_HISTORY`.

## Composition

### Sibyl must be consulted before it can fail

With `SIBYL_PYTHON` unset — the documented default, and every deployment that
has not opted in — Sibyl is `NOT_CONSULTED`. That is not an error, because
nothing claimed to look. The Postgres result passes through unchanged, exactly
as it did before this integration, and the response still says
`sibyl.consulted: false` with the reason, so a pass-through can never be read as
Sibyl agreeing.

Once `SIBYL_PYTHON` is set the deployment has asked for Sibyl, and a Sibyl that
cannot answer is a memory failure.

### The matrix

Rows are the Postgres outcome, columns Sibyl's.

| | Sibyl `AVAILABLE` | Sibyl `NO_HISTORY` | Sibyl `ERROR` |
|---|---|---|---|
| **Postgres `AVAILABLE`** | ① `AVAILABLE`, `source: BOTH` | ② `AVAILABLE`, `source: POSTGRES` | ③ `ERROR` |
| **Postgres `NO_HISTORY`** | ④ `NO_HISTORY`, `source: SIBYL` \* | ⑤ `NO_HISTORY`, `source: NEITHER` | ⑥ `ERROR` |
| **Postgres `ERROR`** | ⑦ `ERROR` | ⑧ `ERROR` | ⑨ `ERROR` |

**The governing rule:** `ERROR` from any consulted source dominates, and
`AVAILABLE` composes only over the sources that answered. Adding a second source
may raise the bar on an action; it may never lower it.

In ①, every scored field is Postgres's, unmodified. Sibyl contributes its record
count and its verdict in the provenance and nothing else — no Sibyl value is
merged into `overall_reliability`, `task_fit`, `confidence`, the version or the
relationship status.

③ is `ERROR` rather than a degraded `AVAILABLE` because `authorizeFromRetrieval`
is the single gate on money and its guarantee holds by being enforced on the
status, in one branch. Moving it into a second "degraded" boolean makes it
something a later caller can forget to read — and a `gated` verdict would then
be invisible on every counterparty that has Postgres history, which is most of
them once the system is running.

⑥ is the cell that matters most: a fresh database plus a broken Sibyl must not
read as a clean new counterparty.

`retryable` is the OR over the failing consulted sources, because a retry that
could change any input could change the composite. A thrown Postgres query is
`true`; so is a bridge that would not run.

\* **④ diverges from the written decision, deliberately.** The decision makes ④
`AVAILABLE` with `memory_version: null`, guarded by a clause in
`memory-authorization.ts` that stops a null version reaching `AUTO`. That clause
is not written. Without it, an `AVAILABLE` here would be strictly *more*
permissive than the Postgres-only result it replaced: with no
`minimum_reliability` configured, a Sibyl-only recall would clear an automatic
spend it cannot name a version for. So the status stays `NO_HISTORY` while the
recall is reported honestly through `source: "SIBYL"` and a non-zero
`record_count` — friction raised, never lowered. The branch is marked in
`compose()`; flip it when the authorization clause lands.

## Key mapping

| | Value | Why |
|---|---|---|
| tenant | `AGENT_ID`, sent to the bridge as `SIBYL_TENANT_ID` | Tenant is Sibyl's isolation boundary. The bridge refuses to read without one rather than falling back to Sibyl's default, where another deployment's silence would read as this operator's absence of history |
| category | the fixed literal `counterparty` | `search_entities(category=…)` matches exactly, so the category decides what shares a corpus. One literal keeps every counterparty searchable against every other; using the protocol would shard memory by protocol |
| name | the `counterparty_key` **verbatim** | Any transform is a second identifier to keep in sync, and a collision would attach one counterparty's memory to another |

Sibyl's `validate_identifier` rules are mirrored in `invalidIdentifierReason()`
and applied in Node before a process is spawned: non-empty, at most 1024
characters, no code point below `0x20` or equal to `0x7F`, no `..`, and none of
`< > | ; " \``. Colons are **legal**, which is why `virtuals:agent:alpha`
crosses unchanged.

A key beginning with `--` is legal and is *not* rejected: the bridge stops
reading flags at a bare `--`, and the query is passed after it. Rejecting it in
Node instead would have left the parser able to mistake data for a flag the next
time something else called it. Before that separator existed, `?q=--limit` bound
`--category` as a flag value, dropped the category filter and answered from every
category in the store — one counterparty's record bodies rendered as another's.

A key that fails is `400` at the endpoint and `ERROR` inside a retrieval — never
`NO_HISTORY`. A request is not a retrieval: a caller that asked with a malformed
key deserves to be told which rule it broke rather than handed a memory state.

## Not built, on purpose

- **Any write through the bridge.** It is read-only, and stays that way: a
  console that can write memory is a console that can invent history. The one
  writer, `tools/sibyl_seed.py`, is run by hand and no request can reach it.
- **Writing Sibyl recall into `counterparty_episodes`** to make retrieval
  "work". This is the tempting shortcut, and it fabricates first-party economic
  history from an unversioned store — which would then flow into `memory_diffs`
  and into the salted version committed on-chain. `NO_HISTORY` on a fresh
  database is honest and stays until a real episode writer exists.
- **Sibyl-derived versions, salts or diffs.** `schema_version()` is the SQLite
  schema version, not a memory version, and must never be used as one.
- **Blending Sibyl into the scores.** A blended score has no version, so it can
  be neither diffed nor committed.
- **A sixth `RetrievalStatus`.** The five are fixed by
  [decisions](../../product/decisions.md); the new situation is expressed by
  `source` plus the provenance, inside the existing five.
- **Caching recall across Runs.** A cached hit would outlive a Sibyl failure and
  quietly satisfy cell ⑥ with stale data.
- **Auto-creating the database.** `MemoryClient.local` would create the file;
  the bridge's existence check is the only thing keeping "no memory here" from
  becoming "an empty memory".

## Known gaps

Named rather than hidden, and none of them is fixed by this document.

1. **No route-level tests.** Neither endpoint is covered. The repository rule is
   that a feature is not shipped until code, tests and task status agree, so
   treat these as built and unverified. `apps/api/src/routes/memory.test.ts`
   exists but covers the AD-04 projection, policies and chat — not these.
2. **`refine_zero` is not called**, so `empty_store` never fires — see *Which
   verdicts are reachable today*.
3. **The Run event payloads were not extended.** `chat.ts` calls the composed
   `retrieve()`, so the timeline reflects the composition, but
   `memory.retrieved`, `memory.no_history` and `memory.retrieval.failed` still
   carry no `source`, no `sibyl_verdict_code` and no `failed_source`. A Run
   timeline therefore shows the composed *state* without the composed *reason*.
4. **`/health/sibyl` has no `retrievalEnabled` field.** Reachability and
   participation in retrieval are separately true; only the first is reported
   there. `sibyl.consulted` on the memory endpoint answers the second.

## Setup

Sibyl is optional and off by default. It needs its own Python 3.10+ interpreter
— `sibyl-memory-client` declares `Requires-Python: >=3.10`, and macOS still
ships `/usr/bin/python3` as 3.9, where the install fails.

```bash
python3.11 -m venv .venv-sibyl
.venv-sibyl/bin/pip install sibyl-memory-client
# the bridge never creates the store, and the tenant must match AGENT_ID in .env
SIBYL_TENANT_ID=agent_buyer_1 .venv-sibyl/bin/python tools/sibyl_seed.py
```

Then uncomment `SIBYL_PYTHON=.venv-sibyl/bin/python` in `.env`. `SIBYL_DB_PATH`
(default `~/.sibyl-memory/memory.db`), `SIBYL_BRIDGE` and `SIBYL_TIMEOUT_MS`
have working defaults. The API sends its `AGENT_ID` to the bridge as
`SIBYL_TENANT_ID`; seeding under a different tenant leaves the fixture in the
store and invisible to every recall, which reports the clean `no_match` of a
counterparty with no history.

The fixture writes its entities under the counterparty keys
`virtuals:agent:alpha` and `virtuals:agent:beta`, because the entity name *is*
the key: retrieval passes `counterparty_key` through verbatim, so a fixture
named anything else can never be recalled. To read one back by hand:

```bash
SIBYL_DB_PATH=~/.sibyl-memory/memory.db SIBYL_TENANT_ID=agent_buyer_1 \
  .venv-sibyl/bin/python tools/sibyl_bridge.py recall \
  --category counterparty --limit 5 -- virtuals:agent:alpha
``` `.venv-sibyl/` is gitignored.

Confirm the wiring with `GET /health/sibyl` before reading memory: `configured:
false` means the variable is unset, and `reachable: false` carries the reason.

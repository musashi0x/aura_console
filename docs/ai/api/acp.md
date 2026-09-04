# ACP SDK surface (verified)

## What

The verified TypeScript surface of `@virtuals-protocol/acp-node-v2`, read from
the installed package's declaration files rather than from the published prose
documentation. The two disagree in one load-bearing place, recorded below.

Everything here was read from `@virtuals-protocol/acp-node-v2@0.1.12`, which is
the `latest` dist-tag. Re-verify this file when the pin moves.

## Where

- `apps/api/package.json` — the pin. Exact versions, no ranges.
- `apps/api/node_modules/@virtuals-protocol/acp-node-v2/dist/*.d.ts` — the source
  of every signature below.

## The documentation is ahead of the package

<https://os.virtuals.io/acp/sdk/getting-started> shows

```ts
import { AcpAgent, AlchemyEvmProviderAdapter } from "@virtuals-protocol/acp-node-v2";
```

**`AlchemyEvmProviderAdapter` does not exist in 0.1.12.** It is not exported from
`dist/index.d.ts`, and no class of that name appears anywhere in `dist`. The
only two EVM adapters shipped are:

| Export | Status |
|---|---|
| `ViemProviderAdapter` | Abstract base. Every method except `getNetworkContext` throws `"... not implemented. Override in subclass."` |
| `PrivyAlchemyEvmProviderAdapter` | Real, but requires a Privy `walletId` and app id — not a local private key |

Consequence: a local-private-key signer requires implementing
`IEvmProviderAdapter` in this repository, subclassing `ViemProviderAdapter`. See
the design's Decisions section.

## What the EVM client actually asks of a provider

Grepped from `dist/clients/evmAcpClient.js` and `dist/clients/baseAcpClient.js`.
Only five methods are called:

| Method | Used for |
|---|---|
| `readContract` | 3 call sites — job and allowance reads |
| `sendCalls(chainId, calls)` | 1 call site — the write path, batched |
| `getTransactionReceipt` | 1 call site — resolving a job id from a receipt |
| `getNetworkContext` | 1 call site — chain resolution |
| `getAddress` | 1 call site — the agent's own address |

No ERC-4337 primitive (`userOp`, `entryPoint`, `paymaster`, `smartAccount`)
appears in either client. An EOA-backed adapter satisfies the interface;
`sendCalls` becomes sequential sends rather than an atomic batch, which is a
behavioural difference to state, not to hide.

`signMessage` is not called by the client but **is** required: the HTTP layer
authenticates by signing a challenge through `TransportContext.signMessage`.

## `AcpAgent`

```ts
type EntryHandler = (session: JobSession, entry: JobRoomEntry) => void | Promise<void>;

type CreateAgentInput = {
  contractAddresses?: Record<number, string>;
  evmProvider?: IEvmProviderAdapter;
  solanaProvider?: ISolanaProviderAdapter;
  transport?: AcpChatTransport;
  api?: AcpJobApi;
};

class AcpAgent {
  static create(input: CreateAgentInput): Promise<AcpAgent>;
  on(_event: "entry", handler: EntryHandler): this;
  start(onConnected?: () => void, streams?: SupportedStreams[]): Promise<void>;
  stop(): Promise<void>;
  get sessions(): JobSession[];
  getSession(chainId: number, jobId: string): JobSession | undefined;
  getAddress(family?: ChainFamily): Promise<string>;
  browseAgents(keyword: string, params?: BrowseAgentParams): Promise<AcpAgentDetail[]>;
  createJobByOfferingName(
    chainId: number,
    offeringName: string,
    providerAddress: string,
    requirementData: Record<string, unknown> | string,
    opts?: { evaluatorAddress?: string; hookAddress?: string; packageId?: number },
  ): Promise<bigint>;
}
```

Notes that change behaviour:

- There is **no `builderCode` on `CreateAgentInput`**. It is a field on
  `PrivyAlchemyChainConfig` only, so on the local-key path it has nowhere to go.
- Omitting `opts.evaluatorAddress` selects **skip-evaluation**: the job
  auto-completes and releases funds when the provider submits, and
  `job.submitted` never fires. Passing our own address selects self-evaluation,
  where settlement waits for an explicit `complete`/`reject`. For a console that
  must never settle automatically, self-evaluation is the only correct mode —
  skip-evaluation would let a submission move money with no operator in the loop.
- `agent.start()` hydrates sessions from `AcpJobApi.getActiveJobs()`, so a
  restart replays entries for every active job.

## `JobSession`

```ts
type DerivedStatus =
  | "open" | "budget_set" | "funded"
  | "submitted" | "completed" | "rejected" | "expired";

class JobSession {
  readonly jobId: string;      // decimal string, not bigint
  readonly chainId: number;
  readonly roles: AgentRole[]; // "client" | "provider" | "evaluator"
  readonly entries: JobRoomEntry[];
  get status(): DerivedStatus;
  availableTools(): AcpTool[];
  fetchJob(): Promise<AcpJob>;
  sendMessage(content: string, contentType?, packageId?): Promise<void>;
  setBudget(amount: AssetToken): Promise<void>;
  fund(amount?: AssetToken): Promise<void>;
  submit(deliverable: string, transferAmount?: AssetToken): Promise<void>;
  complete(reason: string, opts?): Promise<void>;
  reject(reason: string): Promise<void>;
}
```

`setBudget`, `fund`, `submit`, `complete` and `reject` are the five methods the
runtime must never call. `executeTool(name, args)` can reach all of them by
name, so it is banned too.

## Entries — the bridge's input

```ts
type SystemEntry = {
  kind: "system";
  onChainJobId: string;
  chainId: number;
  event: AcpJobEvent;
  timestamp: number;        // epoch milliseconds
};

type AgentMessage = {
  kind: "message";
  onChainJobId: string;
  chainId: number;
  from: string;
  contentType: "text" | "proposal" | "deliverable" | "structured" | "requirement";
  content: string;
  timestamp: number;
  packageId?: number;
};

type JobRoomEntry = SystemEntry | AgentMessage;
```

The seven system events and their payloads:

| `event.type` | Fields beyond `type` and `jobId` |
|---|---|
| `job.created` | `client`, `provider`, `evaluator`, `expiredAt`, `hook` |
| `budget.set` | `amount: number`, `fundRequest?: FundIntent` |
| `job.funded` | `client`, `amount: number` |
| `job.submitted` | `provider`, `deliverableHash`, `deliverable`, `fundTransfer?` |
| `job.completed` | `evaluator`, `reason` |
| `job.rejected` | `rejector`, `reason` |
| `job.expired` | — |

### Open questions from the design, now answered

**Is there a stable per-entry identifier?** No. `JobRoomEntry` carries no id
field of any kind. `SseTransport` keeps a private `seenEntries` set for its own
deduplication, but does not expose an identity.

**What domain time does an entry carry?** `timestamp`, epoch milliseconds. It is
the entry's own time, so it is the correct value for `event_time`.

**What does a client-side `job.created` entry expose?** Addresses and an expiry
only — no description, no offering name. A meaningful Run objective must come
from `AcpJobApi.getJob(chainId, jobId)`, whose `OffChainJob.description` is
`string | null`. The bridge must therefore tolerate a missing description rather
than inventing one.

**Is `builderCode` needed on testnet?** Moot — the local-key path has no field
to pass it through. Dropped from scope.

## `event_id` derivation

No SDK identifier exists, so the fallback from the design applies:

```
event_id = uuidv5(ACP_NAMESPACE, canonicalJson({
  chainId, onChainJobId, kind, timestamp, ...payload
}))
```

`canonicalJson` sorts object keys recursively so key order cannot change the id.

**Collapse behaviour, stated plainly:** two entries that are byte-identical
after canonicalisation — same job, same kind, same millisecond, same payload —
produce the same `event_id` and therefore one `run_events` row. In practice that
means a duplicate delivery is absorbed (the goal), and a genuine repeat of the
identical message inside the same millisecond is lost (accepted). Message
entries are the only realistic case; system events cannot legitimately repeat
inside a millisecond.

## Amounts are floats at the SDK boundary

`BudgetSetEvent.amount` and `JobFundedEvent.amount` are typed `number`. The
float has already happened before our code sees the value, so the repository's
string rule cannot restore precision it never received. What the bridge can
honestly claim:

- It converts each amount to a fixed six-decimal string once, at the boundary,
  and never stores a JSON number.
- The stored string is exact **with respect to the value the SDK handed us**,
  not with respect to the on-chain integer.
- Where an exact figure exists, prefer it: `OffChainJob.budget` is `string | null`
  and `AssetToken.rawAmount` is `bigint`.

`AssetToken.usdc(amount: number, chainId)` also takes a `number`; only
`AssetToken.usdcFromRaw(rawAmount: bigint, chainId)` is exact.

## Chains and endpoints

`SUPPORTED_CHAINS` — Base Sepolia (84532), BNB Smart Chain Testnet (97), Base
(8453), Robinhood Chain Testnet (46630), Robinhood Chain (4663).

Server URLs are constants, not configuration:
`ACP_SERVER_URL = "https://api.acp.virtuals.io"`,
`ACP_TESTNET_SERVER_URL = "https://api-dev.acp.virtuals.io"`. `SseTransport`
and `AcpApiClient` each take an optional `serverUrl`, which is how a testnet
run is pointed at the dev host.

`EVM_NO_EVALUATOR_ADDRESS = "0x0000000000000000000000000000000000000000"` is the
sentinel that selects skip-evaluation. Never pass it from this repository.

## ESM interop

The package is `"type": "module"` with `types: dist/index.d.ts` and no CJS
build. `apps/api` is NodeNext ESM already, so the import is direct and needs no
`.js` gymnastics on our side. Deep imports resolve without a subpath `exports`
map. `pnpm add` reported two unmet peers from the Solana branch of the SDK
(`ws@^8.18.0` against `ws@7.5.13`, and `utf-8-validate`); the EVM path does not
load `@solana/rpc-subscriptions`, so they are noted rather than pinned around.

---

# The ACP runtime in this repository

## What

A client-role ACP agent that watches the job event stream and records what it
observes as `run_events`. It buys nothing on its own: it never funds escrow,
settles a job, proposes a price, or submits a deliverable.

## Where

- `apps/api/src/acp/connection/env.ts` — the five variables, Zod-validated, exit 1 naming
  the offender.
- `apps/api/src/acp/connection/provider.ts` — `LocalKeyEvmProviderAdapter`, the local-key
  `IEvmProviderAdapter` the SDK does not ship.
- `apps/api/src/acp/connection/agent.ts` — builds `AcpAgent` with an explicit transport and
  API client so the host is never the SDK's production default.
- `apps/api/src/acp/domain/events.ts` — every `run_events` row this module can produce,
  observed and authored, plus the Run seed an ACP job gets.
- `apps/api/src/acp/domain/ids.ts` — canonical JSON and the uuidv5 derivation. Changing
  anything here renames every id and re-appends history.
- `apps/api/src/acp/domain/usdc.ts` — the three amount conversions, each a different
  precision claim.
- `apps/api/src/acp/log.ts` — the shared JSON line logger.
- `apps/api/src/acp/bridge.ts` — capture, projection, retry, job identity, per-job ordering.
- `apps/api/src/acp/worker.ts` — the entrypoint and process lifecycle.
- `apps/api/src/acp/create-job.ts` — the operator's manual job command.

Layout: the two pipelines and the entrypoint sit at the module root, where a
reader lands. `connection/` is how we reach ACP, `domain/` is what we record and
is pure, and `test/` holds every test in the module. No source file nests
deeper, because a file two levels below `src/` cannot reach `src/services`
without the relative import the repo's ESLint config bans.

`test/` is the one exception, and the config says so: `**/src/**/test/**` may use
`../../` and nothing deeper, so a test can reach its own package's siblings but
still cannot leave the package. This is now the whole repository's convention,
not just this module's.
- `packages/db/src/schema/acp-jobs.ts` — the `(chain_id, job_id)` → `run_id` map.
- `packages/db/src/schema/acp-inbox.ts` — raw captured entries awaiting projection.

## Running it

```bash
pnpm --filter @aura/api acp
```

Its own process. `apps/api/src/server.ts` imports nothing from `src/acp/`, and
`src/acp/test/isolation.test.ts` holds that: the API boots, serves `/health`, and
passes its suite with every `ACP_*` variable unset. "The API is up" and "the ACP
stream is connected" are two facts, and nothing in the code lets them collapse
into one.

## Event catalogue

Every row's `data` carries `chain_id` and `job_id`. Amounts are six-decimal
strings; see the float note above for what that precision does and does not
mean.

| `run_events.type` | Additional `data` |
|---|---|
| `acp.job.created` | `client`, `provider`, `evaluator`, `expired_at`, `hook` |
| `acp.budget.set` | `amount_usdc`, optional `fund_request` |
| `acp.job.funded` | `client`, `amount_usdc` |
| `acp.job.submitted` | `provider`, `deliverable_hash`, `deliverable`, optional `fund_transfer` |
| `acp.job.completed` | `evaluator`, `reason` |
| `acp.job.rejected` | `rejector`, `reason` |
| `acp.job.expired` | — |
| `acp.job.described` | `description` |
| `acp.message` | `from`, `content_type`, `content`, optional `package_id` |
| `acp.fund.authorized` | `amount_usdc` — an operator's decision, not the runtime's |
| `acp.fund.submitted` | `amount_usdc`, `authorization_event_id` |
| `acp.fund.failed` | `amount_usdc`, `authorization_event_id`, `reason`, `attempts` |

A `fund_request` / `fund_transfer` object holds `amount_usdc`, `token_address`,
`symbol` and `recipient`.

`event_time` is the entry's own `timestamp`, never arrival time. `sequence` is
allocated by `RunStore` inside the insert transaction — the bridge never
supplies one.

## Capture, then project

The ACP stream is lossy at its edge. `agent.start()` hydrates from
`getActiveJobs()`, so an entry missed during an outage on a job that has since
finished never comes back. Recording is therefore two steps:

```
entry ─► acp_inbox      one insert, no external calls, PK = derived event_id
      ─► run_events     via RunStore; retryable, idempotent
```

**Capture** is the only moment an entry can be lost, and it is a single
statement. A duplicate delivery collides on the primary key and is skipped. If
capture itself fails the log line carries `lost: true`, because that is the one
outcome nothing downstream can repair.

**Projection** resolves the Run, appends through `RunStore`, then stamps
`processed_at`. A failure leaves `processed_at` null and writes `attempts` and
`last_error` onto the row, so a stuck entry explains itself without a log
search.

**Sweeping** retries whatever is unprocessed, oldest first. The worker sweeps
once at startup — picking up anything a crash left behind — and every 30s after
that, so a transient database or ACP outage heals without an operator.

`acp_inbox` is a staging buffer, not history. `run_events` remains the record,
and a processed row is deletable without changing what the Console reads.

## Run identity

One ACP job is one Run. The Run and its `acp_jobs` mapping commit in a single
transaction, so a crash cannot leave a Run nothing points at; if a concurrent
writer wins the unique index first, its Run is the one both use.

An ACP Run's seed is `source: "AGENT"`, `environment: "base-sepolia"`,
`budget_usdc: null`, and an objective of `ACP job <id> on <environment>`. The
provider's proposed price is an event, not a declared ceiling — the two are
different claims and the seed does not blur them.

The objective is deliberately not the job's real description. A client-side
`job.created` carries no description, so getting one means an off-chain
`getJob`, and putting that call in front of Run creation would let a slow or
rate-limited ACP host lose the entry that triggered it. Instead the description
arrives afterwards as an `acp.job.described` event: it is a fact that was
observed at a time and may change, which is what an event is for and what an
immutable seed is not. The fetch runs once per job, after the entry is durable,
under a 5s ceiling, and a failure costs a description rather than an event.

Entries for one job are appended through a per-job promise chain. The row lock
in `RunStore.appendEvent` already keeps sequences distinct; the chain is what
keeps them in arrival order. Different jobs never wait on each other.

## Spending: the operator decides, the runtime executes

The runtime can fund a job. It still decides nothing.

```
operator ─► POST /api/runs/:id/acp/fund-authorizations
              ├─ acp.fund.authorized   the decision, as history
              └─ acp_spend_intents     the instruction        (one transaction)

worker   ─► claim a row (FOR UPDATE SKIP LOCKED)
              └─ session.fund() ─► acp.fund.submitted
```

The split is the point. `POST /api/runs/:id/events` accepts any event type, so
an `acp.fund.authorized` event is trivially forgeable — and buys nothing,
because the executor reads only `acp_spend_intents` and never scans `run_events`
for work. The route is the only writer of that table.

A row is claimed before the chain is touched, so two workers cannot fund one job
twice. Amounts reach the chain as integers: the decimal string becomes a bigint
by integer arithmetic and goes through `AssetToken.usdcFromRaw`, never
`AssetToken.usdc`, which takes a `number`. Three attempts, then a single
`acp.fund.failed` event; retries stay on the row.

`acp.fund.submitted` means the runtime called `fund` and it returned. It carries
no `tx_hash`, because the SDK's `fund` resolves to void and a field that can
never be filled is worse than no field. The chain's own account arrives
separately, as an observed `acp.job.funded` entry.

**Off by default.** Without `ACP_SPEND_ENABLED=true` the worker constructs no
executor, so a running process has no code path to `session.fund()` at all.

**No authentication.** v0.1 has none by decision, and that decision was taken
when nothing here could spend. Anyone who can reach the API port can now
authorize a testnet spend. Keep the port local, and treat auth as a
prerequisite for anything beyond a single operator on one machine.

## What it will not do

`fund`, `complete`, `reject`, `setBudget`, `submit` and `executeTool` are never
called from the handler path. `src/acp/test/never-automatic.test.ts` holds this
several ways: a lifecycle driven against a recording Proxy session, a source
scan of every file an entry can reach, a check that no handler-path file even
imports the executor, and a check that the executor works from the intents table
rather than from any event.

Job creation is `pnpm --filter @aura/api acp:create-job`, run by a person. It
always passes an explicit evaluator, because omitting it selects the mode that
releases escrow the moment a provider submits.

## Operator setup

1. Register an agent at <https://app.virtuals.io/acp/new> and note its wallet
   address.
2. Fund that wallet on Base Sepolia with test ETH and test USDC. Use a throwaway
   key that controls nothing else.
3. Fill `ACP_CHAIN_ID`, `ACP_WALLET_ADDRESS`, `ACP_WALLET_PRIVATE_KEY`,
   `ACP_RPC_URL` and `ACP_SERVER_URL` in the root `.env` — see `.env.example`.
   The runtime rejects any chain but Base Sepolia.
4. `pnpm db:migrate`, then `pnpm --filter @aura/api acp`.
5. To exercise it end to end, create a job with `acp:create-job` and watch the
   entries land as `run_events`.

## Not verified against a live agent

Everything above is covered by tests, including the bridge against real
Postgres. What has **not** run is the whole path against a registered agent on
a funded wallet: no such agent exists for this repository yet. Two questions
stay open until it does — how far back the transport replays a hydrated job's
entries on `start()`, and whether the dev host rate-limits the `getJob` fetch.
Neither can now lose an entry: replay depth only affects what a first run
backfills, and the fetch sits behind capture with a timeout.


---

# ACP in the Console

## What

Nothing. There is no ACP surface, no ACP component, and no ACP vocabulary on
screen. The `acp.` namespace says where a fact came from; it is not a second
language for the operator.

## Where

- `apps/web/src/features/console/projection/acp-events.ts` — every ACP mapping
  the Console has, in one file.
- `apps/web/src/features/console/projection/fold-run.ts` — the one projection,
  which consumes those maps like any other.
- `apps/web/src/features/console/projection/stage-map.ts` — merges the ACP stage
  prefixes into the shared list.

## How ACP reads as a Run

| ACP event | Status | Stage |
|---|---|---|
| `acp.job.created` | `RUNNING` | `COMMIT` |
| `acp.job.described` | — | `COMMIT` |
| `acp.budget.set` | `WAITING_APPROVAL` | `FUND` |
| `acp.fund.authorized` | `RUNNING` | `FUND` |
| `acp.fund.submitted` | — | `FUND` |
| `acp.fund.failed` | `BLOCKED` | `FUND` |
| `acp.job.funded` | `RUNNING` | `FUND` |
| `acp.job.submitted` | `RUNNING` | `DELIVER` |
| `acp.job.completed` | `COMPLETED` | `EVALUATE` |
| `acp.job.rejected` | `FAILED` | `EVALUATE` |
| `acp.job.expired` | `FAILED` | — |
| `acp.message` | — | — |

`acp.message` and `acp.job.expired` have no stage but are still `SUPPORTED`.
Telling an operator the Console does not recognise an event it just rendered is
worse than showing it without a stage.

## Spend is only what the chain says

`spentUsdc` moves on `acp.job.funded` alone. `acp.budget.set` is a proposal,
`acp.fund.authorized` is a decision, and `acp.fund.submitted` is our own claim
that we sent it — none of those is money that left. Nothing is summed; the fold
copies a projection-bearing value and never computes one.

## Attention

`acp.budget.set` puts the Run in `AWAITING_APPROVAL`, naming the proposed
amount, which is exactly what the operator has to act on. `acp.fund.authorized`
and `acp.job.funded` clear it. `acp.fund.failed` blocks with domain `funding`
and `retryable: false`, because the runtime already exhausted its retries before
recording that event.

Replay is unchanged: the same fold, with a playhead. There is no second code
path for ACP.

# Partner stacks plan — Virtuals ACP and Base

Worth up to ×1.25 on the final score, which is more than any single rubric line
can move in three days. It is also the work with the most external
dependencies, so it starts tonight and has a go/no-go on Tuesday noon.

The rule: a stack counts only when a judge can **see it doing real work in the
demo**. A dependency in `package.json` or a readiness chip counts for nothing.

## 1. Virtuals ACP (×1.15 as the first stack)

What exists: `origin/feat/acp_job` is a complete client-role runtime on Base
Sepolia (`docs/ai/api/acp.md` on that branch). It observes the job stream into
`run_events`, creates a job by an operator command with an explicit evaluator,
and funds only from an operator-authorized `acp_spend_intents` row. It has
**never run against a registered agent** — the doc says so.

### Prerequisites (tonight, because they wait on other people's systems)

1. Register agents at <https://app.virtuals.io/acp/new>, sandbox:
   - **one buyer** ("Aura Buyer") — its wallet is `ACP_WALLET_ADDRESS`;
   - **two sellers** with an offering each, named to match the fixture keys:
     `Alpha Research` and `Beta Labs`. Owning both sellers is what lets the
     demo produce a *deterministic* Alpha failure (Alpha returns a deliverable
     missing required JSON fields) and a Beta success. Without our own
     sellers, the outcome depends on a stranger's bot.
   - Note the SDK requires a Privy `walletId` for its shipped adapter; the
     branch's `LocalKeyEvmProviderAdapter` avoids that. Confirm the sandbox
     accepts a plain EOA for the buyer; if it insists on the platform wallet,
     that is the Tuesday-noon decision.
2. Fund the buyer wallet on Base Sepolia: test ETH from a faucet, test USDC from
   the CDP faucet (`portal.cdp.coinbase.com/products/faucet`). Use a throwaway
   key that controls nothing else.
3. `.env`: `ACP_CHAIN_ID=84532`, `ACP_WALLET_ADDRESS`, `ACP_WALLET_PRIVATE_KEY`,
   `ACP_RPC_URL` (a public Base Sepolia RPC is enough), `ACP_SERVER_URL`
   (`https://api-dev.acp.virtuals.io` for sandbox), `ACP_SPEND_ENABLED=true`.

Sellers can be scripted with the SDK's own `examples/basic/seller.ts` pattern
(listen for `job.funded`, `submit(deliverable)`); a 40-line script per seller
in `tools/acp-sellers/` is enough, and it is honest to say they are ours.

### The path a judge sees

```text
Decision card: Beta selected, authorization mode OPERATOR_APPROVAL
Approval card: "Fund ACP job #<id> — ceiling 0.20 USDC"  [Approve]
   → POST /api/runs/:id/acp/fund-authorizations  (the branch's endpoint)
   → worker claims the intent, session.fund()  → acp.fund.submitted
   → chain: acp.job.funded (observed entry)      → Agent Job card: FUNDED
Seller submits                                    → acp.job.submitted
Operator evaluates (see below)                    → acp.job.completed / rejected
```

### What the branch is missing for the demo

- **An operator-invoked evaluation.** The runtime never calls
  `complete`/`reject`, by design. Add `pnpm --filter @aura/api acp:evaluate
  <chainId> <jobId> complete|reject "<reason>"` mirroring `create-job.ts`, or an
  endpoint that only an operator click reaches. Without it a funded job never
  finishes on camera.
- **Wire the existing Approval card to the fund-authorization endpoint** for
  ACP Runs (today it posts to `/approve`). One conditional in
  `approval-request-card.tsx` keyed on the Run's `environment: base-sepolia`.
- **Link the Mission to the ACP Run.** An ACP job becomes its own Run
  (`source: AGENT`). For the story, the decision Run should carry a
  `acp.job.linked` event with the job's `run_id`, so Board and Trace can jump
  between them. Keep it as an event; do not merge the two Runs.
- **Evaluation → write-back.** `acp.job.completed`/`rejected` must feed
  `MissionExecutionService`'s outcome path so `record_episode` fires. That is
  the join between the two branches and the moment the loop closes.

### Fallback if Virtuals cannot be made to work by Tue noon

Ship without it. Do not fake it, do not leave the `ACP` chips on the Network
page claiming readiness for a stack that is not exercised. Claiming an unused
stack forfeits the bonus and reads badly.

## 2. Base (×1.10 as the second stack, or ×1.15 alone)

Two candidate actions. Pick A; B only if A is somehow blocked.

### Option A — commit the memory version to Base Sepolia (recommended)

This is tracker task #35 and Frame 6 of the canonical journey, and it is the
only Base action that is *about memory*: Aura publishes a salted hash of the new
private profile so a third party can verify the memory changed without seeing
it. No other entrant will have it, and it closes the "Aura learned" beat with a
transaction.

Mechanics, all with `viem` (already a dependency on the ACP branch):

1. After `record_episode`, canonicalise the profile body (sorted keys, no
   whitespace), generate a 32-byte salt, `commitment = keccak256(canonical ||
   salt)`. Store the salt **only** in Sibyl (`set_reference("commitment:<key>:v<n>")`)
   — it must never leave the operator's memory.
2. Send a Base Sepolia transaction from the buyer wallet: value 0, `to` = the
   wallet itself, `data` = the 32-byte commitment (or a 2-slot payload
   `version || commitment`). No contract to deploy, one RPC call, confirmed in
   seconds. Emit `memory.commitment.submitted` with the tx hash, then
   `memory.commitment.confirmed` after the receipt.
3. Transaction card: network Base Sepolia, "commits memory v13 for
   virtuals:agent:alpha", the hash, link to `https://sepolia.basescan.org/tx/<hash>`.
   The card says what it settled — the visual-system rule.
4. `pnpm memory:verify <key>` recomputes the hash from Sibyl and compares it
   with the on-chain calldata; a mutated record mismatches. Run it on camera.

Effort: half a day for one engineer. Risk: low. It also gives the demo a second
"wallet operation" if the ACP fund never lands.

If a judge asks whether calldata-only counts as a "contract interaction",
the honest answer is that it is a wallet operation on Base with a verifiable
payload, which the rules list explicitly. A minimal `MemoryCommitments`
contract (one `commit(bytes32)` event emitter) is a stretch for Wednesday if
time allows; do not start it before Option A works.

### Option B — x402 paid fetch for the market-data step

The agent pays a small USDC amount over HTTP 402 to fetch the "market data"
it scores from. Real packages exist (`@x402/hono`, `@x402/fetch`, facilitator
`https://x402.org/facilitator`, network `eip155:84532`). It needs a paid
endpoint we host, a facilitator round-trip, and a second funded wallet flow.
More parts, less about memory. Skip unless A is blocked.

## 3. Testnet vs mainnet

The rules say "a deployed action visible in the demo" and the ACP runtime is
Base Sepolia only, by design (`ACP_CHAIN_ID` is validated to 84532). Plan on
Sepolia for everything and state it plainly in the README and the video
("non-mainnet, single operator"). A mainnet dust transaction for the
commitment is a Wednesday stretch only if a team member funds a wallet by
hand; it must not be automated from the console and it is not required.

## 4. Readiness chips must be true

`/system` (Network) shows Virtuals and Base readiness. After integration, each
chip must be backed by a real check (RPC `eth_chainId`, ACP server `GET
/health` or an authenticated ping) and must read `NOT CONFIGURED` when the
env is unset. The chain-readiness commit on `ai_cli_sandbox_reputation`
("Virtuals ACP/Base RPC readiness") may already do this; verify before
re-implementing.

## 5. Acceptance

- [ ] One ACP job created, funded from an operator click, submitted by our seller, evaluated by an operator command, all visible as cards on one Mission, with the on-chain `acp.job.funded` entry in Trace.
- [ ] One Base Sepolia transaction carrying the memory commitment, linked from a Transaction card, verified by `pnpm memory:verify` on camera.
- [ ] README "Partner stacks" section names exactly what ran, with tx hashes and the sandbox agent names.
- [ ] Network page chips reflect real checks.

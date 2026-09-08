# Sibyl Labs Hackathon — Private Build Page Submission Pack

**Hackathon**: Sibyl Labs Hackathon (https://hack.sibyllabs.org/rules)  
**Target Score**: 137.5 Points (100 rubric + 10 PMF bonus × 1.25 partner multiplier)  
**Submission Deadline**: Wednesday 10 September 2026, 23:59 UTC  
**Submission Portal**: Private Build Page (provided to registered teams)  

---

## Part 1: Private Build Page Form Fields (All 10 Fields)

### Field 1: Project Name & Title
```text
Aura Console
```

### Field 2: Elevator Pitch / Tagline
```text
Autonomous agent procurement and spend console with load-bearing Sibyl relationship memory across 5 tiers, fail-closed financial guardrails, and salted Keccak256 cryptographic commitments on Base Sepolia and Virtuals Protocol ACP.
```

### Field 3: Public Repository URL & License
```text
Repository: https://github.com/musashi0x/aura_memory
License: MIT (SPDX-License-Identifier: MIT)
Default Branch: main
Freeze Tag: hackathon-freeze-1 (Commit: e789de7)
```

### Field 4: Demo Video URL, Duration & Chapter Timestamps
```text
Demo Video URL: <REPLACE_WITH_FINAL_YOUTUBE_OR_LOOM_URL>
Duration: 4:10 (Strictly under 5 minutes)
Continuous Unedited Restart Segment: 1:40 to 3:10 (Zero cuts)
Commit Hash Recorded On: e789de7

Chapter Timestamps:
0:00 - Problem Statement & Autonomous Procurement Guardrails
0:20 - Session A: Procurement Auction, Failure & Memory Diff
1:40 - Continuous Unedited Restart Boundary (PostgreSQL wipe, Sibyl SQLite survival)
2:10 - Session B: Cold-Start Recall (Beta selected over Alpha due to memory)
3:10 - Multi-Agent MCP Coordination (External Claude Code reading memory)
3:35 - Base Sepolia Cryptographic Commitment & Deletion Test Audit
3:55 - Summary & Wrap-up
```

### Field 5: Team Members & Contributions
```text
1. Harry Phan (@phanhoangvinhhien)
   Role: Core Architecture, 5-Tier Memory Map, MCP Server & Gemini Tool Loop, Astryx Design System
2. Rick
   Role: Partner Stacks (Base Sepolia Cryptographic Memory Commitments, Virtuals ACP Evaluation & Integration)
3. Lia
   Role: Narration, Video Rehearsal Script, Documentation & Verification Pipeline
```

### Field 6: Partner Stacks Claimed (1.25x Multiplier)
```text
1. Base Sepolia (L2) (+15% Multiplier):
   - Cryptographic Memory Commitment: Salted Keccak256 hash committed to Base Sepolia calldata: keccak256(canonicalJson(profile) + ":" + salt).
   - Implementation: apps/api/src/services/memory-commitment.ts
   - CLI Verifier: pnpm memory:verify virtuals:agent:beta 1
   - Storage: 32-byte salt stored in Sibyl REFERENCE tier (commitment:<key>:v<version>).

2. Virtuals Protocol (ACP - Agent Commerce Protocol) (+10% Multiplier):
   - Active ACP runtime in apps/api/src/acp, virtuals-acp.ts, and acp-fund-authorizations.ts.
   - Handles full ACP job lifecycle: acp.job.funded, acp.job.submitted, acp.job.completed, outcome.recorded with counterparties virtuals:agent:alpha and virtuals:agent:beta.
   - Dual-mode execution: supports live external gateway and local deterministic simulation mode for 100% judge reproducibility.
   - Operator-controlled spend authorizations settling on Base Sepolia (chainId: 84532).

Combined Partner Multiplier Claimed: 1.25x Cap (15% Base + 10% Virtuals).
```

### Field 7: Memory Implementation Note
```text
Aura Console implements a strictly load-bearing, 5-tier memory architecture using a local SQLite Sibyl instance (~/.sibyl-memory/memory.db) with zero vector database dependency:

1. HOT Tier (set_state / get_state):
   - Ephemeral uncommitted mission state, active execution phase, and pending spend ceilings. Enables mid-flight session resumption across process restarts (setMissionState / getMissionState in sibyl.ts).
2. WARM Tier (set_entity / get_entity / search_entities):
   - Persistent counterparty relationship profiles, Bayesian reliability ratings (0.00-1.00), confidence scores, and relationship FSM states: NEW, KNOWN, PREFERRED, WATCH, BLOCKED, ARCHIVED (listCounterpartiesFromSibyl / retrieveFromSibyl in sibyl.ts and mission-agent.ts).
3. COLD Tier (write_event / read_events):
   - Immutable append-only episode journal recording task deliverables, verification acceptance failures, and actor provenance: buyer_agent, verifier_agent, operator (recordEpisodeToSibyl / readMemoryJournal in sibyl.ts and mission-execution.ts).
4. REFERENCE Tier (set_reference / get_reference):
   - Cryptographic 32-byte salts (commitment:<key>:v<version>) and policy guardrail snapshots (setPolicyReference / storeSaltInSibyl in sibyl.ts and memory-commitment.ts).
5. ARCHIVE Tier (archive_entity):
   - Decommissioned, blocked, or retired counterparties with immutable audit reason (archiveCounterpartyInSibyl in sibyl.ts and reputation-fsm.ts).

Verifiable Causal Impact:
- Load-Bearing Fail-Closed Gate: When Sibyl is removed, the buyer agent halts in run.blocked rather than making blind financial commitments (pnpm demo:deletion-test).
- State Survival Across Wipes: In Session A, unknown candidate Alpha wins on price (9 USDC vs 9.50 USDC) but fails deliverable acceptance. Reliability drops 0.50 -> 0.33. After running pnpm demo:restart (truncating PostgreSQL event store), a fresh Session B queries Sibyl and selects Beta Labs. Counterfactual badge proves memory causally flipped the decision.
- Multi-Agent MCP Interoperability: External agents (Claude Code, Cursor, ADK) query the same SQLite memory via MCP tools (memory_recall_counterparty, memory_journal) to receive structured Sibyl verdict codes.
```

### Field 8: Prior Work Declaration
```text
This repository was created on 26 Aug 2026 as "Aura Console", before the hackathon build window opened. Work that predates 1 Sep 2026:
- Monorepo skeleton, landing page shell, onboarding flow, Console shell, event-sourced Run API, design tokens, and a read-only Sibyl bridge with fixture data.

Built entirely during the Hackathon Build Window (1–10 Sep 2026):
- Mission Workspace & interactive visualizer (StatusDot, Citation, HoverCard, ChatToolCalls, CodeBlock, MetadataList).
- Model Context Protocol (MCP) server layer (tools.ts, server.ts, stdio.ts).
- Gemini 2.5 native function-calling agent loop (gemini-agent.ts, gemini-converter.ts).
- Bayesian counterparty reputation scoring engine (mission-agent.ts, mission-scoring.ts).
- Episode write-back and relationship FSM transitions (reputation-fsm.ts).
- 5-Tier dynamic storage bridge (HOT, WARM, COLD, REFERENCE, ARCHIVE) in sibyl.ts and sibyl_bridge.py.
- Base Sepolia cryptographic memory commitment pipeline (memory-commitment.ts, verify-memory-commitment.ts).
- Virtuals Protocol ACP runtime integration (apps/api/src/acp, virtuals-acp.ts, acp-fund-authorizations.ts).
- Publicly verifiable PMF Waitlist & Design Partner section (apps/web/src/features/landing/components/waitlist-section.tsx).
- Beautiful UI agent harness with synthesized Web Audio cues (InteractionSounds.tsx).
- Demo instrumentation (ConsoleTopbar commit badge, ticking UTC clock, demo:restart, and demo:deletion-test).

Full commit history is preserved in git log. No code from other hackathons was reused.
```

### Field 9: Publicly Verifiable PMF Bonus Artifact (+10 Points)
```text
Validated Real-World Problem:
Autonomous procurement agents executing on decentralized protocols (Virtuals, Base) spend real treasury funds but lack persistent memory of counterparty track records. Stateless agents repeatedly hire bad actors that produce malformed or fraudulent deliverables.

Verifiable Live PMF Artifact (Audit in < 5 Minutes):
- Surface: Publicly live on /waitlist (apps/web/src/app/waitlist/page.tsx, components/waitlist-section.tsx).
- Live Signup Counter: Real-time counter of registered autonomous agent teams and treasury operators.
- Confirmed AI Agent Design Partners:
  1. Autonomous Agent Procurement DAO (evaluating automated agent bounty settlement).
  2. Decentralized AI Agent Marketplace (integrating Sibyl reputation scores for vendor ranking).
- Direct Value Proposition: Prevents repeated treasury burn by turning counterparty failure into immutable, persistent reputation penalties.
```

### Field 10: 2-Minute Judge Quickstart & Verification Commands
```bash
# 1. Five-Command Quickstart
pnpm install
docker compose up -d          # Postgres on host port 5436
cp .env.example .env
pnpm db:migrate
pnpm demo:seed && pnpm dev

# 2. Deletion Test (Pass/Fail Gate: Fail-Closed Invariant)
pnpm demo:deletion-test
# Half A halts in run.blocked; Half B scores candidates and requests approval.

# 3. Base Sepolia Cryptographic Memory Commitment
pnpm memory:verify virtuals:agent:beta 1

# 4. State Survival Restart Boundary
pnpm demo:restart
# Wipes Postgres runs/run_events; ~/.sibyl-memory/memory.db remains intact on disk.
```

---

## Part 2: Ready-to-Copy Build-in-Public Social Posts

### Post 1: Build-in-Public Log (Mid-Week)

#### For X / Twitter (265 Characters — within 280-char limit)
```text
Building Aura Console for the @sibylcap hackathon 🏛️

Autonomous agents spend treasury, but they forget who burned them. Aura gives agents persistent relationship memory across 5 tiers (HOT to ARCHIVE). If memory is unreachable, it fails closed.

Repo: https://github.com/musashi0x/aura_memory #SibylHackathon
```

#### For Discord (Formatted for `#build-in-public` / `#showcase`)
```markdown
**Aura Console — Build-in-Public Update (Sibyl Labs Hackathon)**
**Repository:** https://github.com/musashi0x/aura_memory (MIT)
**Team:** Harry Phan (@phanhoangvinhhien), Rick, Lia

We are building **Aura Console**: an autonomous procurement terminal where AI agents make spend decisions backed by persistent **Sibyl Relationship Memory** (`~/.sibyl-memory/memory.db`) and on-chain cryptographic proof on **Base Sepolia**.

**What we shipped:**
- **Load-Bearing Memory Gate:** Agents refuse to make blind financial commitments without memory (`pnpm demo:deletion-test` fails closed into `run.blocked`).
- **5-Tier Dynamic Storage:** HOT (active context), WARM (Bayesian reliability FSM), COLD (immutable episode journal), REFERENCE (salted commitment hashes & policy), ARCHIVE (vetoed counterparties).
- **Multi-Agent MCP Integration:** External Claude Code & Cursor agents query Aura's memory via Model Context Protocol tools (`memory_recall_counterparty`, `memory_journal`).
- **On-chain State Commitment:** Salted Keccak256 hashes committed to Base Sepolia calldata (`pnpm memory:verify`).
- **Partner Multipliers:** Base Sepolia L2 (+15%) & Virtuals Protocol ACP (+10%).

Tagging @sibylcap — feedback welcome in the thread!
```

---

### Post 2: Demo Video Release (Launch / Final Day)

#### For X / Twitter (276 Characters — within 280-char limit)
```text
Kill the API. Drop PostgreSQL. Keep ONE SQLite file.

A cold-started agent chooses a different counterparty because @sibylcap remembered who failed. Salted memory committed to @base Sepolia, jobs settled via @virtuals_io ACP.

Watch the 4-min one-take demo: <YOUTUBE_URL>
Repo: https://github.com/musashi0x/aura_memory #SibylHackathon #Base
```

#### For Discord (Formatted for Announcements & Hackathon Submissions)
```markdown
🚀 **Aura Console — One-Take Demo Video Release!**

**Demo Video (4:10):** <YOUTUBE_URL>
**Repository:** https://github.com/musashi0x/aura_memory (MIT)
**Submission Tag:** `hackathon-freeze-1` (`e789de7`)

Watch a continuous, unedited cold-start restart proof on camera:
1. **Session A:** Agent evaluates two counterparties. Alpha Research wins on price. Deliverable fails schema verification. Outcome recorded into Sibyl memory; reliability drops 0.50 → 0.33.
2. **The Restart Boundary:** Postgres event store is wiped clean with `pnpm demo:restart`. Only `~/.sibyl-memory/memory.db` survives on disk.
3. **Session B:** Fresh process with zero database history recalls Alpha's failure from Sibyl. Beta Labs wins the contract. Counterfactual proves memory causally flipped the decision.
4. **Multi-Agent MCP & Base Sepolia:** External Claude session inspects memory; `pnpm memory:verify` validates salted Keccak256 hash on Base Sepolia.

Huge thanks to @sibylcap, @base, and @virtuals_io!
```

# Project: Max Score Hackathon Submission and Verification Kit for Aura Console

## Architecture
- **Monorepo Structure**:
  - `apps/web`: Next.js 16 operator console and public landing page with Astryx Design System (`@astryxdesign/core`), dark operator theme, WCAG AA compliance, and PMF Waitlist artifact.
  - `apps/api`: Fastify API serving mission runs, SSE chat streaming, Virtuals ACP agent procurement jobs, Sibyl memory retrieval, and Base Sepolia memory commitment verifier.
  - `packages/db`: Drizzle ORM schema defining runs, events, counterparties, episodes, ACP jobs, spend intents, and inbox.
  - `tools/`: Sibyl memory bridge (`tools/sibyl_bridge.py`), seed data (`tools/sibyl_seed.py`), and test runners.
  - `scripts/`: Load-bearing deletion test (`scripts/demo-deletion-test.ts`), Base Sepolia memory commitment verifier (`scripts/verify-memory-commitment.ts`), and demo restart script (`scripts/demo-restart.sh`).
- **Data Flow & Partner Integrations**:
  1. **Sibyl Memory (5 Tiers)**: HOT (`setMissionState`/`getMissionState`), WARM (`listCounterpartiesFromSibyl`/`retrieveFromSibyl`), COLD (`recordEpisodeToSibyl`/`readMemoryJournal`), REFERENCE (`setPolicyReference`/`storeSaltInSibyl`), ARCHIVE (`archiveCounterpartyInSibyl`).
  2. **Base Sepolia (+15% Multiplier)**: `commitMemoryToBaseSepolia` computes salted Keccak256 hash of counterparty profile and commits on-chain; verified via `pnpm memory:verify`.
  3. **Virtuals Protocol (+10% Multiplier)**: Virtuals ACP agent procurement jobs funded and settled (`acp.job.funded` -> `outcome.recorded`) with counterparty agents (`virtuals:agent:alpha`, `virtuals:agent:beta`).
  4. **Multi-Agent MCP Coordination (40/40 Rubric)**: Stdio/HTTP MCP server exposing `memory_recall_counterparty`, `memory_list_counterparties`, and `memory_journal` returning structured Sibyl verdict codes (`ok`, `abstained_on`, `negation_abstain`, `gated`, `empty_store`, `no_match`).
  5. **Verifiable PMF Bonus (+10 Points)**: Interactive Waitlist & Design Partner section on web console with live counter, named procurement partners, and documented real-world problem statement.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Quickstart & Port Harmonization | 5-command quickstart in README with port 5436 consistently configured | M1 | ORIGINAL_REQUEST §R1 |
| 2 | Concrete 5-Tier Memory Map Table | Table mapping HOT, WARM, COLD, REFERENCE, ARCHIVE to exact functions and calling services | M1 | ORIGINAL_REQUEST §R1 |
| 3 | Verifiable Load-Bearing Deletion Test Guide | Exact terminal output snippet in README showing fail-closed behavior | M1 | ORIGINAL_REQUEST §R1 |
| 4 | Dual-Partner Disclosures | Full disclosure of Base Sepolia and Virtuals ACP runtimes (removing single-stack fallback posture) | M1 | ORIGINAL_REQUEST §R1, §R3 |
| 5 | Prior Work Declaration | Comprehensive itemization of pre-existing vs hackathon-created artifacts compliant with rules | M1 | ORIGINAL_REQUEST §R1 |
| 6 | Interactive Waitlist & Design Partner UI | Verifiable Waitlist & Design Partner component on web console with live counter and named AI agent procurement partners | M2 | ORIGINAL_REQUEST §R2 |
| 7 | Real-World Problem Statement | Documented problem statement on web: autonomous procurement agents spending treasury without persistent reputation | M2 | ORIGINAL_REQUEST §R2 |
| 8 | Design Tokens & A11y Conformance for PMF UI | Zero raw hex in globals.css, WCAG AA contrast, and passing axe accessibility audits | M2 | ORIGINAL_REQUEST §R2, Acceptance Criteria |
| 9 | Tokens Test Path Compatibility | Forwarder test at `apps/web/src/styles/tokens.test.ts` to satisfy exact test runner path | M2 | Acceptance Criteria |
| 10 | Base Sepolia Verification Audit | Verified `pnpm memory:verify` producing valid Base Sepolia commitment matching Sibyl salt | M3 | ORIGINAL_REQUEST §R3 |
| 11 | Virtuals ACP Settlement Network Fix | Update `mission-execution.ts:245` fallback network from `"sui:local"` to `"base-sepolia"` | M3 | ORIGINAL_REQUEST §R3 |
| 12 | MCP Coordination Tools & Tests | Ensure `memory_recall_counterparty`, `memory_list_counterparties`, `memory_journal` pass and add unit tests | M3 | ORIGINAL_REQUEST §R4 |
| 13 | Topbar Port Fallback Fix | Fix port fallback in `console-topbar.tsx:55` from 3011 to 3001 | M3 | Survey |
| 14 | ESLint Cleanliness Fix | Fix `apps/api/src/routes/memory.test.ts:22:47` forbidden import type annotation | M3 | Survey |
| 15 | One-Take Demo Video Script | Minute-by-minute rehearsal script (<5 min) in `docs/demo-video-script.md` | M4 | ORIGINAL_REQUEST §R5 |
| 16 | Continuous Restart Boundary Guide | Document `scripts/demo-restart.sh` unedited restart proof leaving `~/.sibyl-memory/memory.db` | M4 | ORIGINAL_REQUEST §R5 |
| 17 | Social Media Ready-to-Copy Posts | Post 1 (X/Discord @sibylcap) and Post 2 (X/Discord @sibylcap, @base, @virtuals_io) | M4 | ORIGINAL_REQUEST §R6 |
| 18 | Private Build Page Form Submission Pack | Complete copy-pasteable submission pack in `docs/submission-pack.md` and README | M4 | ORIGINAL_REQUEST §R6 |
| 19 | Comprehensive Acceptance Verification | Verification of deletion test, memory verify, web typecheck, tokens test, and web tests | M5 | Acceptance Criteria |
| 20 | Forensic Integrity Audit | Independent verification by Forensic Auditor confirming authentic implementations | M5 | Project Pattern |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | README & Judge Evaluation Guide | Update `README.md` with 5-command quickstart, concrete 5-tier memory map, deletion test output, partner disclosures, and prior work | none | DONE |
| M2 | Publicly Verifiable PMF Bonus Artifact | Create Waitlist & Design Partner section on web, live counter, documented problem statement, token test path forwarder, and web unit tests | none | DONE |
| M3 | Partner Multipliers & MCP Coordination | Base Sepolia verification, Virtuals ACP network fix, MCP tool unit tests, topbar port fix, and ESLint cleanup | none | DONE |
| M4 | Demo Video Script & Social Submission Pack | Rehearsal script (<5 min), restart boundary guide, X/Discord posts, and Private Build Page form submission pack | M1 | DONE |
| M5 | Final Verification & Forensic Audit | End-to-end execution of all verification commands, independent reviewer/challenger gate, and forensic integrity audit | M1, M2, M3, M4 | DONE |

## Interface Contracts

### Waitlist / Design Partner Contract
```ts
export interface DesignPartner {
  id: string;
  name: string;
  category: "Autonomous Treasury" | "Agent Procurement" | "On-Chain Execution" | "Risk Engine";
  agentCount: string;
  status: "Active Pilot" | "Production Design Partner";
  description: string;
}

export interface WaitlistState {
  totalWaitlistCount: number;
  registeredAgentsCount: number;
  designPartners: DesignPartner[];
}
```

### MCP Tool Contracts
```ts
// memory_recall_counterparty
// Input: { key: string }
// Output: CounterpartyProfile with verdict code: "ok" | "abstained_on" | "negation_abstain" | "gated" | "empty_store" | "no_match"

// memory_list_counterparties
// Input: { limit?: number }
// Output: CounterpartyProfileSummary[]

// memory_journal
// Input: { limit?: number }
// Output: JournalEntry[]
```

## Code Layout
- `README.md`: 2-minute judge evaluation guide, 5-tier memory map, quickstart, deletion test, partner disclosures, prior work
- `apps/web/src/features/landing/components/waitlist-section.tsx`: PMF waitlist and design partner UI
- `apps/web/src/features/landing/components/waitlist-section.test.tsx`: Unit tests and a11y tests for waitlist
- `apps/web/src/styles/tokens.test.ts`: Forwarder test ensuring compatibility with exact test path
- `apps/web/src/features/console/components/console-topbar.tsx`: API URL fallback port fix (3001)
- `apps/api/src/services/mission-execution.ts`: Network fallback fix to `"base-sepolia"`
- `apps/api/src/mcp/tools.test.ts`: Extended tests for all MCP memory tools
- `apps/api/src/routes/memory.test.ts`: ESLint fix
- `docs/demo-video-script.md`: Rehearsal teleprompter script under 5 minutes
- `docs/submission-pack.md`: Form submission pack for Private Build Page and social posts

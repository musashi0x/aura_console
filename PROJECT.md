# Project: Aura Memory 5 Sibyl Primitives

## Architecture
Aura implements persistent Bayesian reputation and memory for autonomous AI agents procuring services from counterparties. This project integrates all 5 remaining Sibyl memory primitives (reflection, consolidation, temporal history, semantic search, summarization) across backend storage, Hono API routes, CLI runners, and the Astryx Web UI console.

### Data Flow & Component Architecture
1. **Mission Outcome / Verifier**: Deliverable verification evaluates submissions against objective criteria (`verifier-agent.ts`). On failure, the **Reflection Engine** (`reflection-engine.ts`) extracts root-cause analysis and persists structured reflection records (`category: "reflection"`) in SQLite (`node:sqlite`).
2. **Episodic Consolidation Pipeline**: Raw discrete execution episodes are deterministically consolidated into a unified counterparty dossier (`category: "dossier"`) in SQLite (`consolidation-engine.ts`), maintaining defect frequencies, probation transitions, and an audit trail hash.
3. **Temporal Point-in-Time Engine**: Historical episodes are replayed deterministically through `reputation-fsm.ts` up to timestamp $t$ or episode index, reconstructing exact prior reputation state and computing deltas (`temporal-engine.ts`).
4. **Semantic Search Engine**: Tokenizes queries, filters stopwords, expands intent/synonyms, and computes keyword relevance scores across episodes and reflections (`semantic-search.ts`).
5. **Executive Memory Summarizer**: Aggregates multi-episode logs, Bayesian reputation, reflections, and dossiers into an executive risk digest (`executive-summarizer.ts`) for human operators and autonomous agent decision-making.
6. **API Layer**: Hono router exposes endpoints for temporal reconstruction, semantic search, reflections, dossiers, and executive summaries (`apps/api/src/routes/`).
7. **CLI Causal Loop**: Multi-process OS runner (`pnpm demo:causal-loop`) and automated test harness (`pnpm test:causal-loop`) demonstrate all 5 primitives across cold-start sessions, amnesia testing, and fail-closed storage.
8. **Web UI & Console Drawer**: Astryx-compliant components in `apps/web/` render executive risk banners, reflection cards, consolidated dossiers, temporal scrubbers, and semantic search.

---

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Reflection Engine | Root-cause analysis on verifier failure, structured reflection persistence (`category: "reflection"`) in SQLite | M1 | ORIGINAL_REQUEST §R1 |
| 2 | Reflection Scoring Penalty | Candidate ranking in `mission-scoring.ts` inspects reflected failure patterns and applies reflection penalties | M1 | ORIGINAL_REQUEST §R1 |
| 3 | Episodic Consolidation | Deterministic rollup of raw episodes into unified counterparty dossier (`category: "dossier"`) with defect counts | M1 | ORIGINAL_REQUEST §R2 |
| 4 | Consolidation Audit Trail | Maintains cryptographic lineage audit trail hash over consolidated episodes without losing historical logs | M1 | ORIGINAL_REQUEST §R2 |
| 5 | Temporal State Reconstruction | Reconstructs counterparty reputation and FSM state at past timestamp $t$ via deterministic episode replay | M1 | ORIGINAL_REQUEST §R3 |
| 6 | Temporal State Deltas | Computes status, reliability, and failure deltas between historical past state and present state | M1 | ORIGINAL_REQUEST §R3 |
| 7 | Semantic Search Tokenizer & Engine | Tokenization, stopword removal, intent/synonym expansion, and relevance scoring (0-100) across episodes & reflections | M1 | ORIGINAL_REQUEST §R4 |
| 8 | Executive Risk Digest Summarizer | Automated synthesis of multi-episode logs, Bayesian state, reflections, and dossiers into an executive risk digest | M1 | ORIGINAL_REQUEST §R5 |
| 9 | API: Temporal History Endpoint | `GET /api/counterparties/:counterpartyKey/temporal?asOf=...` returning historical state and delta comparison | M2 | ORIGINAL_REQUEST §R3 |
| 10 | API: Semantic Search Endpoint | `GET /api/memory/search?q=...&category=...&limit=...` returning ranked memory records with relevance scores | M2 | ORIGINAL_REQUEST §R4 |
| 11 | API: Executive Summary Endpoint | `GET /api/counterparties/:counterpartyKey/summary` and embedded `executive_summary` in counterparty memory endpoint | M2 | ORIGINAL_REQUEST §R5 |
| 12 | API: Reflections & Dossier Endpoints | `GET /api/counterparties/:key/reflections` and `GET /api/counterparties/:key/dossier` endpoints in Hono router | M2 | Survey Explorer 2 |
| 13 | CLI: Causal Loop Demonstration | `pnpm demo:causal-loop` exercises all 5 primitives in decoupled child processes with dedicated terminal UI cards | M3 | ORIGINAL_REQUEST Acceptance |
| 14 | CLI: Automated Test Runner | `pnpm test:causal-loop` programmatically asserts SQLite persistence of reflections & dossiers, temporal accuracy, and search | M3 | ORIGINAL_REQUEST Acceptance |
| 15 | Web: Typed API Client Methods | Adds typed methods to `api-client.ts` for summary, reflections, dossier, temporal, and semantic search | M4 | Spec Miner 3 |
| 16 | Web: Executive Risk Digest Banner | Renders executive risk banner atop counterparty detail (`/counterparties`) with headline, risk tier, and action pill | M4 | ORIGINAL_REQUEST §R5 |
| 17 | Web: Reflection Lessons Section | Renders structured reflection cards with failure category, root cause, schema errors, and remediation guidance | M4 | Spec Miner 3 |
| 18 | Web: Consolidated Dossier Card | Renders dossier with cumulative reliability meter, recurring defect breakdown pills, and audit trail hash | M4 | Spec Miner 3 |
| 19 | Web: Temporal Time-Travel Scrubber | Interactive scrubber allowing operators to scrub through episode checkpoints and view side-by-side past vs present deltas | M4 | Spec Miner 3 |
| 20 | Web: Semantic Memory Search Bar | Search bar in Counterparties view querying Sibyl memory with instant token relevance cards and highlights | M4 | Spec Miner 3 |
| 21 | Web: Console Drawer Risk Digest | Displays executive delivery performance summary in `StreamlinedDecisionCard` & `EvidenceDrawer` contrasting candidate risk | M4 | ORIGINAL_REQUEST §R5 |
| 22 | Web: Astryx Design Token Conformance | Guarantees 0 literal hex colors in stylesheets and passes `tokens.test.ts` and axe accessibility audits | M4 | ORIGINAL_REQUEST & Spec Miner 3 |
| 23 | E2E Monorepo Verification | Full monorepo tests (`pnpm test`), typecheck (`pnpm turbo run typecheck`), and zero regressions | M5 | ORIGINAL_REQUEST Acceptance |
| 24 | Adversarial & White-Box Hardening | White-box stress tests verifying concurrency, amnesia isolation, secondary rollback safety, and fail-closed storage | M5 | ORIGINAL_REQUEST Acceptance |

---

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| **M1** | Backend Core Primitives Engine | Implement reflection engine, consolidation engine, temporal replay, semantic search, and executive summarizer in `apps/api/src/services/` with unit tests | none | DONE |
| **M2** | API Routes & Controller Layer | Mount Hono endpoints for temporal history, semantic search, executive summary, reflections, and dossiers with route integration tests | M1 | DONE |
| **M3** | CLI Causal Loop & Automated Harness | Implement `demo:causal-loop` terminal cards and `test:causal-loop` programmatic SQLite assertions for all 5 primitives | M1, M2 | DONE |
| **M4** | Web UI & Console Drawer Integration | Add typed API client, Executive Risk Digest, Reflected Lessons, Consolidated Dossier, Temporal Scrubber, Semantic Search bar, and Console drawer integration | M1, M2 | DONE |
| **M5** | Final E2E Suite, Regressions & Hardening | Full monorepo tests, typechecks, adversarial coverage hardening, and final forensic integrity audit | M1, M2, M3, M4 | DONE |

---

## Interface Contracts

### Reflection Engine ↔ Storage & Scoring
- **Function**: `analyzeFailureAndReflect(input: { counterpartyKey: string; runId: string; evaluation: DeliverableVerificationResult }): ReflectionRecord`
- **Function**: `recordReflectionToSibyl(reflection: ReflectionRecord): Promise<void>`
- **Function**: `getReflectionsForCounterparty(counterpartyKey: string): ReflectionRecord[]`
- **Data Model**:
  ```ts
  export interface ReflectionRecord {
    id: string;
    counterpartyKey: string;
    runId: string;
    failureCategory: "MISSING_CITATIONS" | "INSUFFICIENT_COMPETITORS" | "SCHEMA_VIOLATION" | "TEST_FAILURE" | "TIMEOUT";
    rootCause: string;
    lesson: string;
    schemaErrors: string[];
    remediationGuidance: string;
    createdAt: string;
  }
  ```

### Consolidation Engine ↔ Storage
- **Function**: `consolidateEpisodes(counterpartyKey: string): Promise<CounterpartyDossier>`
- **Function**: `getConsolidatedDossier(counterpartyKey: string): CounterpartyDossier | null`
- **Data Model**:
  ```ts
  export interface CounterpartyDossier {
    counterpartyKey: string;
    displayName: string;
    totalMissions: number;
    acceptedCount: number;
    rejectedCount: number;
    successRate: number;
    recurringDefects: Record<string, number>;
    probationHistory: Array<{ fromStatus: string; toStatus: string; runId: string; reason: string; timestamp: string }>;
    auditTrailHash: string;
    lastConsolidatedAt: string;
  }
  ```

### Temporal Engine ↔ Reputation FSM
- **Function**: `reconstructCounterpartyStateAt(counterpartyKey: string, asOf: string | number): TemporalReputationReconstruction | null`
- **Data Model**:
  ```ts
  export interface TemporalReputationReconstruction {
    counterpartyKey: string;
    asOf: string;
    asOfType: "timestamp" | "episode_index";
    historicalState: {
      relationshipStatus: RelationshipStatus;
      overallReliability: number;
      confidence: number;
      alpha: number;
      beta: number;
      consecutiveFailures: number;
      totalMissions: number;
      episodesCount: number;
    };
    currentState: {
      relationshipStatus: RelationshipStatus;
      overallReliability: number;
      confidence: number;
      alpha: number;
      beta: number;
      consecutiveFailures: number;
      totalMissions: number;
      episodesCount: number;
    };
    delta: {
      statusChanged: boolean;
      pastStatus: RelationshipStatus;
      currentStatus: RelationshipStatus;
      reliabilityDelta: number;
      failuresDelta: number;
      missionsDelta: number;
    };
  }
  ```

### Semantic Search Engine
- **Function**: `searchMemoryRecords(query: string, options?: { category?: string; counterpartyKey?: string; limit?: number }): MemorySearchResult[]`
- **Data Model**:
  ```ts
  export interface MemorySearchResult {
    id: string;
    category: "reflection" | "episode" | "dossier";
    name: string;
    score: number;
    matchedTerms: string[];
    headline: string;
    snippet: string;
    createdAt: string;
    body: Record<string, unknown>;
  }
  ```

### Executive Summarizer
- **Function**: `generateExecutiveSummary(counterpartyKey: string): ExecutiveRiskDigest | null`
- **Data Model**:
  ```ts
  export interface ExecutiveRiskDigest {
    counterpartyKey: string;
    displayName: string;
    headline: string;
    riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    reliabilityRating: string;
    relationshipStatus: RelationshipStatus;
    consecutiveFailures: number;
    totalMissions: number;
    successRate: number;
    keyFindings: string[];
    recommendations: string[];
    generatedAt: string;
  }
  ```

---

## Code Layout
- `apps/api/src/services/reflection-engine.ts`: Agent Reflection Engine implementation
- `apps/api/src/services/consolidation-engine.ts`: Episodic Memory Consolidation pipeline
- `apps/api/src/services/temporal-engine.ts`: Point-in-Time history reconstruction
- `apps/api/src/services/semantic-search.ts`: Semantic & intent-based keyword relevance search
- `apps/api/src/services/executive-summarizer.ts`: Executive risk digest summarizer
- `apps/api/src/services/native-sibyl.ts`: SQLite storage methods for new categories & indexes
- `apps/api/src/services/mission-execution.ts`: Pipeline triggers for reflection & consolidation
- `apps/api/src/services/mission-scoring.ts`: Dynamic scoring incorporating reflection penalties
- `apps/api/src/routes/counterparties.ts`: Temporal history, summary, reflections, and dossier endpoints
- `apps/api/src/routes/memory.ts`: Semantic search endpoint
- `scripts/demo-causal-memory-loop.ts`: Live CLI demonstration of all 5 primitives
- `scripts/test-causal-memory-loop.ts`: Automated multi-step verification harness
- `apps/web/src/lib/api-client.ts`: Typed API client methods
- `apps/web/src/features/counterparties/`: Feature components (Executive Summary, Reflections, Dossier, Temporal Scrubber, Semantic Search)
- `apps/web/src/app/counterparties/page.tsx`: Web Counterparty detail view
- `apps/web/src/features/console/components/`: Console drawer integration

# Project: Bayesian Reputation & AI CLI Runner Harness

## Architecture
Modular TypeScript services under `apps/api/src/services/`:
1. **Bayesian Reputation & Status FSM (`reputation-fsm.ts`)**:
   - Beta-Binomial conjugate Bayesian updater with configurable decay parameter $\lambda \in [0.90, 0.98]$.
   - FSM state machine managing `RelationshipStatus = "NEW" | "KNOWN" | "PREFERRED" | "WATCH" | "ARCHIVED" | "BLOCKED"`.
   - Hard Veto Invariant: `BLOCKED` candidates excluded from ranking, requires manual unblock.
2. **AI CLI Runner (`cli-runner.ts`)**:
   - Spawns local headless AI CLIs (Claude Code `--dangerously-skip-permissions`, Gemini CLI) with fallback chain.
   - Isolated Git worktree lifecycle management under `.worktrees/mission-<runId>` with guaranteed `--force` cleanup.
   - Process streaming, stdout/stderr aggregation, and configurable timeouts.
3. **Verifier Agent (`verifier-agent.ts`)**:
   - Inspects git diffs in worktrees, runs deterministic test commands (`pnpm test`), and produces structured evaluation reports.
4. **Simulation Test Suite (`reputation-simulation.test.ts`)**:
   - Multi-turn candidate simulation validating FSM transitions, decay, convergence, and Sibyl write-back formatting.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Beta-Binomial Prior & Update | $\alpha_0=1, \beta_0=1$, neutral reliability 0.5, confidence 0.0 < 0.1; update on success/failure | M1 | ORIGINAL_REQUEST §R1 |
| 2 | Time Decay ($\lambda$) | Configurable $\lambda \in [0.9, 0.98]$ discounting past excess observations toward neutral baseline | M1 | ORIGINAL_REQUEST §R1 |
| 3 | FSM State Transitions | Validated transitions for `NEW`, `KNOWN`, `PREFERRED`, `WATCH`, `ARCHIVED`, `BLOCKED` | M1 | ORIGINAL_REQUEST §R1 |
| 4 | WATCH to BLOCKED Trigger | 2 consecutive failures in `WATCH` state immediately transition candidate to `BLOCKED` | M1 | ORIGINAL_REQUEST §R1 |
| 5 | Hard Veto Invariant | Candidate in `BLOCKED` status produces veto exclusion reason; no auto-promotion; manual unblock only | M1 | ORIGINAL_REQUEST §R1 |
| 6 | Headless AI CLI Spawning | Spawns Claude Code (`claude -p <prompt> --dangerously-skip-permissions`) with fallback to Gemini CLI (`gemini -p <prompt>`) | M2 | ORIGINAL_REQUEST §R2 |
| 7 | Git Worktree Lifecycle | Creates detached temporary worktrees at `.worktrees/mission-<runId>`, cleans up with `git worktree remove --force` in `finally` | M2 | ORIGINAL_REQUEST §R2 |
| 8 | Timeout & Log Streaming | Enforces execution timeout; captures and streams stdout/stderr logs cleanly | M2 | ORIGINAL_REQUEST §R2 |
| 9 | Verifier Agent Inspection | Runs deterministic test commands, inspects `git diff`, parses structured evaluation `{ score, tests_passed, summary, failure_reason? }` | M2 | ORIGINAL_REQUEST §R2 |
| 10 | Reputation Simulation Loop | Simulates multi-turn success/failure cycles across candidates (e.g. KNOWN -> WATCH -> BLOCKED) | M3 | ORIGINAL_REQUEST §R3 |
| 11 | Convergence & Monotonicity | Validates successful runs increase reliability and drive confidence toward 1.0 | M3 | ORIGINAL_REQUEST §R3 |
| 12 | Sibyl Episode Write-back | Formats episodes for Sibyl write-back (`run`, `taskType`, `outcome`, `note`, `occurredAt`) | M3 | ORIGINAL_REQUEST §R3 |
| 13 | Monorepo Coherence & Clean Tests | All files pass `pnpm --filter api typecheck` and `pnpm --filter api test` with zero regressions | M4 | ORIGINAL_REQUEST Acceptance Criteria |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Bayesian Reputation & Status FSM | `reputation-fsm.ts`, `reputation-fsm.test.ts` | none | DONE (47/47 tests) |
| M2 | Configurable AI CLI Runner & Verifier | `cli-runner.ts`, `cli-runner.test.ts`, `verifier-agent.ts`, `verifier-agent.test.ts` | none | DONE (23/23 tests) |
| M3 | Simulation Test Suite & Pipeline Integration | `reputation-simulation.test.ts` | M1, M2 | DONE (23/23 tests) |
| M4 | Final Acceptance & E2E Test Suite | 100% E2E test pass, typecheck clean, adversarial hardening | M1, M2, M3 | DONE (24/24 E2E tests, 205 api tests, CLEAN audit) |

## Interface Contracts

### `reputation-fsm.ts`
```typescript
export type RelationshipStatus = "NEW" | "KNOWN" | "PREFERRED" | "WATCH" | "ARCHIVED" | "BLOCKED";

export interface CandidateReputation {
  candidateId: string;
  alpha: number; // >= 1.0
  beta: number;  // >= 1.0
  overallReliability: number; // alpha / (alpha + beta) in [0, 1]
  confidence: number; // in [0, 1]
  status: RelationshipStatus;
  consecutiveFailures: number;
  totalMissions: number;
  lastUpdatedAt: string; // ISO string
  blockedReason?: string;
  unblockedAt?: string;
  unblockedBy?: string;
}

export interface ReputationConfig {
  decayLambda: number; // in [0.90, 0.98]
  confidenceK: number; // saturation constant, default 5.0
  preferredReliabilityThreshold: number; // default 0.80
  preferredConfidenceThreshold: number;  // default 0.50
}

export interface VetoCheckResult {
  allowed: boolean;
  reason?: string;
}

export function createInitialReputation(candidateId: string): CandidateReputation;
export function updateReputation(current: CandidateReputation, outcome: "success" | "failure", options?: { decayTimeSteps?: number; config?: Partial<ReputationConfig> }): CandidateReputation;
export function applyTimeDecay(current: CandidateReputation, timeSteps: number, lambda?: number): CandidateReputation;
export function checkVeto(candidate: CandidateReputation): VetoCheckResult;
export function manualUnblock(candidate: CandidateReputation, operatorId: string, reason: string): CandidateReputation;
```

### `cli-runner.ts` & `verifier-agent.ts`
```typescript
export interface CliRunnerOptions {
  prompt: string;
  worktreePath: string;
  timeoutMs?: number;
  preferGemini?: boolean;
}

export interface CliRunResult {
  success: boolean;
  cliUsed: "claude" | "gemini";
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
  error?: string;
}

export interface WorktreeSession {
  runId: string;
  worktreePath: string;
  execute: (fn: (worktreePath: string) => Promise<unknown>) => Promise<unknown>;
}

export interface VerifierEvaluation {
  score: number;
  tests_passed: boolean;
  summary: string;
  failure_reason?: string;
}
```

## Code Layout
- `apps/api/src/services/reputation-fsm.ts`: Core Bayesian & FSM implementation
- `apps/api/src/services/reputation-fsm.test.ts`: Comprehensive unit tests for R1
- `apps/api/src/services/cli-runner.ts`: Headless AI CLI spawner and worktree manager
- `apps/api/src/services/cli-runner.test.ts`: Unit tests for CLI runner & worktree lifecycle
- `apps/api/src/services/verifier-agent.ts`: Diff & test execution verifier
- `apps/api/src/services/verifier-agent.test.ts`: Unit tests for Verifier Agent
- `apps/api/src/services/reputation-simulation.test.ts`: R3 Simulation test suite

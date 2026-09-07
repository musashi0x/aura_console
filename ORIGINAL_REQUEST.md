# Original User Request

## Initial Request — 2026-09-07T05:29:09Z

Build a Bayesian reputation update module with a status transition FSM in TypeScript, and a configurable local AI CLI-based Verifier & Execution Harness to run and evaluate missions in `aura_memory`.

Working directory: `/Users/harryphan/Documents/dev/aura_memory`
Integrity mode: development

## Requirements

### R1. Bayesian Reputation Update & Status FSM
- Implement a pure TypeScript module under `apps/api/src/services/reputation-fsm.ts`:
  - **Bayesian Beta-Binomial update** with configurable time decay ($\lambda \in [0.9, 0.98]$) to calculate `overallReliability` (expected mean) and `confidence` (sample size scaling) matching Sibyl's scoring expectations.
  - **Finite State Machine (FSM)** managing status transitions across `NEW`, `KNOWN`, `PREFERRED`, `WATCH`, `ARCHIVED`, `BLOCKED`.
  - **Hard Veto Invariant**: Once `BLOCKED`, a candidate is excluded from ranking and can only be unblocked via explicit operator manual intervention, never automatically.
- Provide comprehensive unit tests (`reputation-fsm.test.ts`) validating convergence, time decay, edge cases (0 samples, 100% fail, 100% pass), and FSM transitions.

### R2. Configurable AI CLI Runner & Verifier Harness
- Implement an execution harness under `apps/api/src/services/cli-runner.ts` and `apps/api/src/services/verifier-agent.ts`:
  - Support spawning local AI CLIs in headless mode, defaulting to Claude Code (`claude -p <prompt> --dangerously-skip-permissions`) and Gemini CLI (`gemini -p <prompt>`) with graceful fallback.
  - Provide safe Git worktree lifecycle management: create isolated temporary worktrees per mission (`.worktrees/mission-<runId>`), capture and stream stdout/stderr logs, enforce execution timeouts, and ensure clean removal (`git worktree remove --force`) on completion or failure.
  - Verifier Agent logic: inspect `git diff`, execute deterministic test commands (`pnpm test`), and parse structured evaluation output (`{ score: number, tests_passed: boolean, summary: string, failure_reason?: string }`).

### R3. Simulation Test Suite & Pipeline Integration
- Implement a simulation script/test in `apps/api/src/services/reputation-simulation.test.ts` demonstrating the complete feedback loop:
  - Simulate a series of successful and failing mission outcomes across different candidates.
  - Verify that repeated failures properly transition a candidate from `KNOWN` $\rightarrow$ `WATCH` $\rightarrow$ `BLOCKED`.
  - Verify that successful runs increase `overallReliability` and drive `confidence` towards 1.0.
  - Demonstrate write-back capability formatting episodes ready for Sibyl.

## Acceptance Criteria

### Mathematical & State Machine Verification
- [ ] Initial unobserved candidate starts with neutral reliability (~0.5) and near-zero confidence (< 0.1).
- [ ] Successful mission outcomes monotonically increase `overallReliability` and `confidence`.
- [ ] 2 consecutive failures in `WATCH` state trigger immediate transition to `BLOCKED`.
- [ ] Any candidate in `BLOCKED` status produces a veto exclusion reason and cannot be auto-promoted by positive scores.

### CLI Runner & Sandbox Safety
- [ ] CLI runner creates dedicated git worktrees without mutating the active branch or main worktree.
- [ ] Execution timeout terminates runaway CLI processes cleanly and removes ephemeral worktrees.
- [ ] Verifier runner executes test commands, extracts exit codes and diffs, and outputs structured JSON evaluation reports.

### Code Quality & Monorepo Coherence
- [ ] All new files pass `pnpm --filter api typecheck` and `pnpm --filter api test` cleanly with zero regressions.
- [ ] Code follows existing codebase patterns in `apps/api/src/services/` (`mission-scoring.ts`, `mission-agent.ts`).

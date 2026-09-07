# TEST_READY: Opaque-Box E2E Testing Suite for Aura Reputation & Execution Harness

## Test Suite Status: READY

The comprehensive 4-tier opaque-box end-to-end test suite for `aura_memory` has been designed, implemented, and verified. All test cases execute cleanly under Vitest and compile without errors under TypeScript's strict `NodeNext` + `verbatimModuleSyntax: true` mode.

### Execution Commands

- **Run E2E Test Suite**:
  ```bash
  pnpm --filter api test src/services/reputation-e2e.test.ts
  ```
- **Run Full API Test Suite**:
  ```bash
  pnpm --filter api test
  ```
- **Run TypeScript Typecheck**:
  ```bash
  pnpm --filter api typecheck
  ```

---

## 1. Test Coverage by Tier

| Tier | Test ID | Description | Result |
|---|---|---|---|
| **Tier 1** | T1.1 | Beta-Binomial Prior ($\alpha_0=1, \beta_0=1, \mathbb{E}=0.50, C=0.0$) & step updates | PASS |
| **Tier 1** | T1.2 | Time Decay ($\lambda \in [0.90, 0.98]$) excess evidence regression | PASS |
| **Tier 1** | T1.3 | FSM State Transitions (`NEW` $\to$ `KNOWN` $\to$ `PREFERRED`, failure $\to$ `WATCH`) | PASS |
| **Tier 1** | T1.4 | WATCH $\to$ BLOCKED Trigger on 2 consecutive failures | PASS |
| **Tier 1** | T1.5 | Hard Veto Invariant: `checkVeto`, auto-promotion rejection, `manualUnblock` | PASS |
| **Tier 1** | T1.6 | CLI Runner headless spawning with Claude Code & Gemini CLI fallback | PASS |
| **Tier 1** | T1.7 | Worktree lifecycle: detached creation & guaranteed `--force` cleanup | PASS |
| **Tier 1** | T1.8 | Verifier Agent test execution and structured report parsing | PASS |
| **Tier 1** | T1.9 | Multi-turn reputation simulation loop | PASS |
| **Tier 1** | T1.10 | Sibyl Write-back formatting (`SibylEpisode`, `SibylCounterparty`) | PASS |
| **Tier 2** | T2.1 | 0 samples / unobserved candidate starts with exact neutral values | PASS |
| **Tier 2** | T2.2 | 100% failure extreme sequence (locks into `BLOCKED` with veto) | PASS |
| **Tier 2** | T2.3 | 100% success extreme sequence (approaches asymptotic upper bounds) | PASS |
| **Tier 2** | T2.4 | Infinite time decay asymptote regresses to neutral baseline | PASS |
| **Tier 2** | T2.5 | Zero time steps decay returns identical state copy | PASS |
| **Tier 2** | T2.6 | Timeout limits terminate runaway CLI execution cleanly | PASS |
| **Tier 2** | T2.7 | Verifier Agent empty diff handling (score 0.0, tests_passed false) | PASS |
| **Tier 2** | T2.8 | Parameter validation & negative assertions (empty IDs, invalid params) | PASS |
| **Tier 3** | T3.1 | Decay reduces confidence & affects subsequent state promotion thresholds | PASS |
| **Tier 3** | T3.2 | CLI Fallback + Worktree cleanup resilience during command errors | PASS |
| **Tier 3** | T3.3 | Verifier failures drive candidate through FSM (`KNOWN` $\to$ `WATCH` $\to$ `BLOCKED`) | PASS |
| **Tier 3** | T3.4 | Hard Veto Ranking Exclusion: blocked candidates strictly filtered from ranking | PASS |
| **Tier 4** | T4.1 | Simulated Full Multi-Round Mission Feedback Loop across 3 competing agents | PASS |
| **Tier 4** | T4.2 | End-to-End Sibyl Export Serialization conforms to canonical schema | PASS |

---

## 2. Feature Checklist & Acceptance Criteria Mapping

| Requirement / AC | Specification Source | Test Verification | Status |
|---|---|---|---|
| Unobserved candidate starts with neutral reliability (~0.5) and near-zero confidence (< 0.1) | ORIGINAL_REQUEST §R1, AC1 | T1.1, T2.1 | VERIFIED |
| Successful mission outcomes monotonically increase `overallReliability` and `confidence` | ORIGINAL_REQUEST §R1, AC2 | T1.1, T1.3, T2.3 | VERIFIED |
| 2 consecutive failures in `WATCH` state trigger immediate transition to `BLOCKED` | ORIGINAL_REQUEST §R1, AC3 | T1.4, T3.3 | VERIFIED |
| Any candidate in `BLOCKED` status produces a veto exclusion reason and cannot be auto-promoted | ORIGINAL_REQUEST §R1, AC4 | T1.5, T3.4 | VERIFIED |
| Manual unblocking permitted only via operator intervention with audit metadata | ORIGINAL_REQUEST §R1 | T1.5, T4.1 | VERIFIED |
| Time decay discounts excess evidence smoothly toward neutral baseline ($\lambda \in [0.90, 0.98]$) | ORIGINAL_REQUEST §R1 | T1.2, T2.4, T3.1 | VERIFIED |
| CLI runner spawns Claude Code headless (`-p <prompt> --dangerously-skip-permissions`) | ORIGINAL_REQUEST §R2 | T1.6 | VERIFIED |
| CLI runner falls back to Gemini CLI (`-p <prompt>`) on error or non-zero exit | ORIGINAL_REQUEST §R2 | T1.6, T3.2 | VERIFIED |
| Ephemeral Git worktree isolation under `.worktrees/mission-<runId>` with `--force` cleanup | ORIGINAL_REQUEST §R2 | T1.7, T3.2 | VERIFIED |
| Execution timeout terminates runaway processes cleanly | ORIGINAL_REQUEST §R2 | T2.6 | VERIFIED |
| Verifier Agent inspects diff, runs tests, and produces structured evaluation report | ORIGINAL_REQUEST §R2 | T1.8, T2.7, T3.3 | VERIFIED |
| Closed-loop feedback simulation demonstrating multi-agent competition and FSM progression | ORIGINAL_REQUEST §R3 | T1.9, T4.1 | VERIFIED |
| Episode and profile write-back formatting conforming to Sibyl memory schema | ORIGINAL_REQUEST §R3 | T1.10, T4.2 | VERIFIED |
| Clean compilation under TypeScript NodeNext and zero regressions across existing tests | Acceptance Criteria | `typecheck`, `test` | VERIFIED |

---

## 3. Test Execution Summary

```
$ pnpm --filter api test src/services/reputation-e2e.test.ts
> vitest run src/services/reputation-e2e.test.ts

 Test Files  1 passed (1)
      Tests  24 passed (24)
   Duration  ~520ms
```

```
$ pnpm --filter api typecheck
> tsc -p tsconfig.json --noEmit
Exit code 0 (0 errors)
```

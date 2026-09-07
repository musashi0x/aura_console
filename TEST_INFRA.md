# TEST_INFRA: Opaque-Box E2E Testing Framework for Aura Reputation & Execution Harness

## 1. Test Philosophy & Architecture Principles

### 1.1 Opaque-Box Requirement-Driven Testing
The testing framework treats the system under test (`apps/api/src/services/`) strictly through public module interfaces, API contracts, and domain specifications as defined in `PROJECT.md` and `ORIGINAL_REQUEST.md`. Tests do not inspect internal private implementation details or state variables; instead, they verify observable state transitions, output values, mathematical invariants, and process lifecycles.

### 1.2 Progressive Testability & Milestones
Testing is structured across four progressive tiers that mirror the development milestones:
- **Milestone 1 (Bayesian & FSM)**: Verifiable via pure computational inputs and state assertions.
- **Milestone 2 (CLI Runner & Verifier Agent)**: Verifiable via hermetic execution harnesses, process supervision, and git worktree isolation.
- **Milestone 3 (Simulation Loop & Sibyl Integration)**: Verifiable via end-to-end multi-turn scenario simulation and schema write-back validation.
- **Milestone 4 (Hardening & Acceptance)**: Verifiable via cross-feature interactions and stress/boundary conditions.

### 1.3 Expected Output Derivation & Authoritative Sources
All expected outputs and assertions in the test suite are derived directly from authoritative mathematical and system requirements:
1. **Bayesian Beta-Binomial Updating**:
   - Uniform Prior: $\alpha_0 = 1.0, \beta_0 = 1.0 \implies \text{overallReliability} = \frac{1}{1+1} = 0.50$.
   - Confidence Saturation: $C(N) = \frac{N}{N + K}$ with $K = 5.0$ and $N = (\alpha - \alpha_0) + (\beta - \beta_0)$. At $N=0$, $C(0) = 0.0 < 0.1$.
   - Excess Evidence Decay: $\alpha' = \alpha_0 + (\alpha - \alpha_0) \cdot \lambda^{\Delta t}$, $\beta' = \beta_0 + (\beta - \beta_0) \cdot \lambda^{\Delta t}$ for $\lambda \in [0.90, 0.98]$.
2. **FSM Transition Specifications**:
   - `NEW` $\to$ `KNOWN` on success ($s=1$); `NEW` $\to$ `WATCH` on failure ($f=1$).
   - `KNOWN` $\to$ `PREFERRED` when $\text{overallReliability} \ge 0.80$, $\text{confidence} \ge 0.50$, and `consecutiveFailures === 0`.
   - `KNOWN` / `PREFERRED` $\to$ `WATCH` on failure.
   - `WATCH` $\to$ `BLOCKED` immediately upon 2 consecutive failures.
   - `BLOCKED` invariant: Strict veto exclusion (`checkVeto`), no auto-promotion via positive scores, unblockable solely via `manualUnblock`.
3. **CLI Runner & Sandbox Lifecycle**:
   - Git worktrees created under `.worktrees/mission-<runId>` with `--detach HEAD`.
   - Guaranteed cleanup via `git worktree remove --force` in `finally` blocks.
   - Claude Code invocation with fallback to Gemini CLI.
4. **Sibyl Memory Write-back Format**:
   - Conformance to `SibylEpisode` and `SibylCounterparty` schemas defined in `apps/api/src/services/sibyl.ts` and `tools/sibyl_seed.py`.

---

## 2. Feature Inventory Mapping to Tiers 1–4

| Tier | Category | Feature / Requirement | Verification Target |
|---|---|---|---|
| **Tier 1** | Feature Coverage | Beta-Binomial Prior & Update | Neutral baseline ($\mathbb{E}=0.50$, $C=0.0$), updates on success/failure |
| **Tier 1** | Feature Coverage | Time Decay ($\lambda \in [0.9, 0.98]$) | Excess evidence decay toward baseline over time steps $\Delta t$ |
| **Tier 1** | Feature Coverage | FSM State Transitions | Valid transitions (`NEW` $\to$ `KNOWN` $\to$ `PREFERRED`, failure to `WATCH`) |
| **Tier 1** | Feature Coverage | WATCH $\to$ BLOCKED Trigger | 2 consecutive failures in `WATCH` status immediately triggers `BLOCKED` |
| **Tier 1** | Feature Coverage | Hard Veto Invariant | `checkVeto` rejects `BLOCKED` candidate; positive scores cannot unblock |
| **Tier 1** | Feature Coverage | CLI Runner Headless Execution | Headless invocation of Claude Code with fallback to Gemini CLI |
| **Tier 1** | Feature Coverage | Git Worktree Lifecycle | Ephemeral worktree creation and guaranteed `--force` cleanup |
| **Tier 1** | Feature Coverage | Verifier Agent Evaluation | Deterministic test execution, diff detection, structured JSON evaluation |
| **Tier 1** | Feature Coverage | Reputation Simulation Loop | Closed-loop multi-turn mission execution across candidate trajectories |
| **Tier 1** | Feature Coverage | Sibyl Write-back Formatting | Output adheres strictly to `SibylEpisode` and `SibylCounterparty` schemas |
| **Tier 2** | Boundary & Corner | Zero Samples / Unobserved | Neutral prior bounds ($\mathbb{E}=0.5$, $C=0.0$), status `NEW` |
| **Tier 2** | Boundary & Corner | 100% Failure Extreme | 20 consecutive failures: $\text{reliability} \to 0$, $C \to 1.0$, blocked |
| **Tier 2** | Boundary & Corner | 100% Success Extreme | 50 consecutive successes: $\text{reliability} \to 1.0$, $C \to 1.0$, `PREFERRED` |
| **Tier 2** | Boundary & Corner | Infinite Time Decay Asymptote | Stale high-reputation candidate regresses to $\alpha=1, \beta=1, C=0.0$ |
| **Tier 2** | Boundary & Corner | Timeout Enforcement | Subprocess execution exceeding `timeoutMs` triggers SIGTERM/SIGKILL |
| **Tier 2** | Boundary & Corner | Empty Diff Handling | Verifier Agent correctly scores 0.0 with tests_passed false on empty diff |
| **Tier 3** | Cross-Feature | Decay + FSM Demotion | Time decay reducing reliability below threshold demotes or alters status |
| **Tier 3** | Cross-Feature | CLI Fallback + Worktree Cleanup | Claude failure triggers Gemini fallback while maintaining worktree integrity |
| **Tier 3** | Cross-Feature | Verifier Failure $\to$ FSM Block | Verifier failures feed directly into FSM, driving `WATCH` $\to$ `BLOCKED` |
| **Tier 3** | Cross-Feature | Hard Veto Ranking Exclusion | Veto excludes blocked candidate from candidate ranking regardless of price |
| **Tier 4** | Real-World Scenarios | Multi-Round Mission Simulation | Realistic multi-agent competitive mission loop with degradation and recovery |
| **Tier 4** | Real-World Scenarios | End-to-End Sibyl Export Pipeline | Full cycle from run evaluation to Sibyl profile and episode serialization |

---

## 3. Test Architecture & Execution Semantics

### 3.1 Test Framework & Runner
- **Test Runner**: Vitest 4.1.11 configured in `apps/api/vitest.config.ts`.
- **Execution Command**:
  ```bash
  pnpm --filter api test src/services/reputation-e2e.test.ts
  ```
- **Typecheck Command**:
  ```bash
  pnpm --filter api typecheck
  ```

### 3.2 Monorepo TypeScript NodeNext Compliance
- Module format: ECMAScript Modules (`"type": "module"` in `package.json`).
- Compiler: `NodeNext` resolution with `verbatimModuleSyntax: true`.
- Conventions:
  - All local imports use explicit `.js` extensions (e.g. `import { ... } from "./reputation-fsm.js"`).
  - All type imports use `import type { ... }`.
  - Zero unused parameters/locals (`noUnusedLocals: true`, `noUnusedParameters: true`).

### 3.3 Hermetic CLI & Process Mocking Strategy
- While `cli-runner.ts` supports real `child_process` execution, testing requires deterministic, zero-network, sub-second execution.
- Tests utilize dependency injection (`commandExecutor`) or mock process harnesses to simulate CLI outputs, timeouts, exit codes, and git worktrees without spawning live external LLMs.
- Real Git worktree creation and cleanup are tested in a dedicated isolated test scenario to verify live git binary interaction without risking branch mutations.

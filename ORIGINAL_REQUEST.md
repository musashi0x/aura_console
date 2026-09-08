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

## Follow-up — 2026-09-07T08:56:43Z

Implement the full UI/UX Phased Roadmap for Aura Memory Console and Mission Chat using Astryx Design System components (`StatusDot`, `Citation`, `SegmentedControl`, `ChatToolCalls`, `CodeBlock`, `HoverCard`, `MetadataList`), transforming the console into an interactive developer/operator terminal with live status, inline sandbox execution visualization, and rich memory citations.

Working directory: /Users/harryphan/.gemini/antigravity/worktrees/aura_memory/ai_cli_sandbox_reputation
Integrity mode: development

## Requirements

### R1. Live Status Indicators, Native Citations & Mission Filter
- Equip the mission selector sidebar items with `<StatusDot>` indicators (`variant="info"` with `isPulsing` for active/running missions, `variant="success"` for completed runs, `variant="error"` for failed runs).
- Add `<SegmentedControl>` at the top of the mission list to filter runs by status (`All`, `Active`, `Settled`).
- Upgrade chat memory citations from bare tokens to Astryx `<Citation variant="number" />` linked to cited counterparty memory records.

### R2. Inline Agent Execution Visualizer (`ChatToolCalls` & `CodeBlock`)
- Integrate `<ChatToolCalls />` inside assistant chat message bubbles to display agent actions (sandboxed CLI execution, Sibyl memory queries, Base Sepolia transaction submissions) with execution duration, sandbox node tags, and status.
- Allow expanding/collapsing tool call outputs with syntax-highlighted `<CodeBlock container="section" />` showing stdout/stderr and JSON payloads.

### R3. Rich Memory HoverCards & Context Inspector (`HoverCard` & `MetadataList`)
- Wrap memory citations with `<HoverCard />` to display rich summaries of cited counterparty episodes (score, outcome, timestamp) on hover without navigating away.
- Provide a collapsible or header-triggered Mission Inspector using `<MetadataList>` to display key technical parameters (Mission UUID, Base Sepolia transaction hashes, budget consumed, environment sandbox type).

### R4. Design System Token & Accessibility Conformance
- All styling must strictly use Aura design tokens (`var(--color-*)`, `var(--glow-*)`) with zero raw hex in `globals.css` (enforced by `tokens.test.ts`).
- Maintain WCAG AA contrast standards and ensure all interactive controls have proper ARIA attributes and pass axe accessibility audits.

## Verification Resources
- Design tokens test: `apps/web/src/styles/tokens.test.ts`
- Console chat test suite: `apps/web/src/features/console/components/console-chat.test.tsx`
- Full web test suite: `apps/web` (`pnpm --filter web test`)
- TypeScript compiler: `pnpm --filter web typecheck`

## Acceptance Criteria

### Test & Build Verification
- [ ] `pnpm --filter web typecheck` exits with 0 TypeScript errors.
- [ ] `pnpm --filter web test src/styles/tokens.test.ts` passes (0 raw hex in `globals.css`, no unauthorized text colors).
- [ ] All web component tests (`pnpm --filter web test`) pass with 0 failures, including `console-chat.test.tsx` and axe accessibility checks.
- [ ] Full monorepo tests (`pnpm test`) pass completely.

### Functional & Visual Quality
- [ ] Sidebar missions display live pulsing status dots and filter correctly via SegmentedControl.
- [ ] Chat conversation renders inline tool invocations via `ChatToolCalls` with expandable details.
- [ ] Memory citations render as Astryx `Citation` elements with rich `HoverCard` preview on hover.
- [ ] Mission details inspector accurately reflects selected run state via `MetadataList`.


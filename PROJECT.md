# Project: Aura Memory Console & Mission Chat UI/UX Phased Roadmap

## Architecture
- **Monorepo Structure**:
  - `apps/web`: Next.js 16.3.3 operator console application using Astryx Design System (`@astryxdesign/core` v0.5.2) and StyleX/Tailwind tokens.
  - `apps/api`: Fastify API serving mission runs, SSE chat streaming (`/api/runs/:runId/chat`, `/api/chat`), Sibyl memory retrieval, and AI CLI runners (`claude`, `gemini`).
  - `packages/`: Shared packages (`@aura/db`, UI primitives).
- **Data Flow**:
  1. Operator selects a mission in `ChatConsoleView` or views table in `RunsPage`.
  2. Missions display live status via `<StatusDot>` (`accent`/`info` pulsing for active, `success` for completed, `error` for failed).
  3. Filter bar (`<SegmentedControl>`) filters runs dynamically (`All`, `Active`, `Settled`).
  4. In `ConsoleChat`, assistant messages display inline `<ChatToolCalls>` showing CLI executions, Sibyl queries, and Base Sepolia tx submissions with duration, node tag, and status.
  5. Expanding tool calls opens `<CodeBlock container="section">` with syntax-highlighted stdout/stderr or JSON.
  6. Memory citations render as Astryx `<Citation variant="number">` wrapped in `<HoverCard>` previewing counterparty Bayesian reliability, confidence, and recent episodes.
  7. Technical mission parameters (UUID, Base Sepolia tx hash, budget ceiling/spent, sandbox type) are presented in `<MissionInspector>` via `<MetadataList>`.
  8. Strict CSS token conformance (`tokens.test.ts`, zero raw hex, WCAG AA contrast) and axe accessibility compliance across all components.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | `StatusDot` Sidebar Indicator | Status indicator with pulsing on active runs in mission selector | M1 | ORIGINAL_REQUEST §R1 |
| 2 | `StatusDot` Table Indicator | Status indicator in main runs table (`runs/page.tsx`) | M1 | Survey |
| 3 | `SegmentedControl` Mission Filter | Top filter for `All`, `Active`, `Settled` runs in sidebar and runs table | M1 | ORIGINAL_REQUEST §R1 |
| 4 | Run Status Derivation | Map run state to `active` vs `settled` and variant (`accent`/`success`/`error`) | M1 | Survey |
| 5 | Chat Tool Calls Data Model | Extend `ChatMessage` with `toolCalls?: ChatToolCallItem[]` | M2 | ORIGINAL_REQUEST §R2 |
| 6 | `ChatToolCalls` in Chat Bubbles | Inline tool call visualizer inside assistant bubbles with node tags and duration | M2 | ORIGINAL_REQUEST §R2 |
| 7 | `CodeBlock` Expandable Section | Expandable stdout/stderr and JSON viewer via `<CodeBlock container="section">` | M2 | ORIGINAL_REQUEST §R2 |
| 8 | Multi-Tool Grouping & Status | Support single inline call vs collapsible group summary with status spinners/icons | M2 | Survey |
| 9 | Astryx Native Numbered Citations | Upgrade bare token citations to Astryx `<Citation variant="number">` | M2 | ORIGINAL_REQUEST §R1 |
| 10 | Rich Memory `HoverCard` | Wrap citations with `<HoverCard>` displaying counterparty Bayesian score & episodes | M2 | ORIGINAL_REQUEST §R3 |
| 11 | Counterparty Profile Navigation | Citation anchor links directly to `/counterparties?key=...` | M2 | Survey |
| 12 | `MetadataList` Mission Inspector | Technical parameters list (UUID, Base Sepolia TX, budget, sandbox) | M2 | ORIGINAL_REQUEST §R3 |
| 13 | Header Inspector Disclosure | Collapsible inspector trigger in `ChatConsoleView` header and `MissionWorkspace` | M2 | ORIGINAL_REQUEST §R3 |
| 14 | Zero Raw Hex Enforcement | Ensure 100% token usage (`var(--color-*)`, `var(--glow-*)`) with 0 hex in `globals.css` | M2 | ORIGINAL_REQUEST §R4 |
| 15 | WCAG AA Contrast & Violet Ban | Ensure text contrast >= 4.5:1 against canvas/surface and no violet text ink | M2 | ORIGINAL_REQUEST §R4 |
| 16 | Axe Accessibility Compliance | `expectNoAxeViolations` on all updated views and interactive elements | M2 | ORIGINAL_REQUEST §R4 |
| 17 | Lint & Typecheck Cleanliness | Resolve `chat-console-view.tsx` unescaped quote and pass `typecheck` | M2 | Survey |
| 18 | E2E Test Suite Pass | 100% pass of requirement-driven 4-tier test suite | M3 | ORIGINAL_REQUEST Acceptance Criteria |
| 19 | Adversarial Coverage Hardening | White-box stress testing and edge-case validation | M3 | Project Pattern |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Live Status Indicators & Mission Filter | `<StatusDot>` with pulsing on active runs, `<SegmentedControl>` filter (`All`, `Active`, `Settled`) in `ChatConsoleView` and `runs/page.tsx` | none | DONE |
| M2 | Mission Chat & Inspector Interactive UI | `<ChatToolCalls />` & `<CodeBlock container="section" />`, Astryx `<Citation variant="number" />` wrapped in `<HoverCard />`, `<MissionInspector />` with `<MetadataList>`, design token & axe compliance | M1 | DONE |
| M3 | E2E Verification & Adversarial Hardening | Verify 100% pass of E2E test suite from E2E Track, adversarial coverage audit, typecheck & monorepo tests | M2, TEST_READY | DONE |

## Interface Contracts

### Status & Filter Types
```ts
export type MissionFilterStatus = "all" | "active" | "settled";

export interface RunStatusInfo {
  variant: "accent" | "success" | "error" | "warning" | "neutral";
  label: string;
  isPulsing: boolean;
  filterCategory: "active" | "settled";
}
```

### Chat Tool Calls
```ts
import type { ChatToolCallItem } from "@astryxdesign/core/Chat";

export interface ChatMessage {
  id: string;
  role: "operator" | "agent" | "console";
  text: string;
  complete: boolean;
  citations: MemoryCitation[];
  toolCalls?: ChatToolCallItem[];
}
```

### Memory HoverCard Payload
```ts
export interface CounterpartyMemorySummary {
  counterpartyKey: string;
  displayName: string;
  status: "PREFERRED" | "KNOWN" | "WATCH" | "BLOCKED" | "NEW";
  overallReliability: number;
  confidence: number;
  episodesUsed: number;
  latestOutcome?: string;
  timestamp?: string;
}
```

### Mission Inspector Props
```ts
export interface MissionInspectorProps {
  runId: string;
  environment: string;
  budgetUsdc?: string;
  spentUsdc?: string;
  txHash?: string;
  txHashes?: string[];
  isCollapsible?: boolean;
}
```

## Code Layout
- `apps/web/src/features/console/components/chat-console-view.tsx`: Mission selector sidebar, filter, header inspector
- `apps/web/src/features/console/components/console-chat.tsx`: Assistant bubbles with `ChatToolCalls`, `CodeBlock`, `Citation`, `HoverCard`
- `apps/web/src/features/console/components/mission-inspector.tsx`: New component with `MetadataList`
- `apps/web/src/features/console/components/mission-workspace.tsx`: Integration of `MissionInspector`
- `apps/web/src/features/console/chat/chat-types.ts`: Extended `ChatMessage` definition
- `apps/web/src/app/runs/page.tsx`: StatusDot and SegmentedControl in main missions list
- `apps/web/src/app/globals.css`: Dark operator token styling without raw hex
- `apps/web/src/features/console/components/chat-console-view.test.tsx`: Unit & axe tests for sidebar & filter
- `apps/web/src/features/console/components/console-chat.test.tsx`: Unit & axe tests for chat, citations, tool calls
- `apps/web/src/features/console/components/mission-inspector.test.tsx`: Unit & axe tests for mission inspector

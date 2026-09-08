import type { ComponentType } from "react";
import type { ChatToolCallItem } from "@astryxdesign/core/Chat";
import type { RunSummary } from "@/lib/api-client";
import type { MemoryCitation } from "../chat/chat-types";

// =============================================================================
// Interface Contracts from PROJECT.md
// =============================================================================

export type MissionFilterStatus = "all" | "active" | "settled";

export interface RunStatusInfo {
  variant: "accent" | "success" | "error" | "warning" | "neutral";
  label: string;
  isPulsing: boolean;
  filterCategory: "active" | "settled";
}

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

export interface MissionInspectorProps {
  runId: string;
  environment: string;
  budgetUsdc?: string;
  spentUsdc?: string;
  txHash?: string;
  txHashes?: string[];
  isCollapsible?: boolean;
}

// Module declaration augmentation for ChatMessage so toolCalls is valid in test suite
declare module "../chat/chat-types" {
  interface ChatMessage {
    toolCalls?: ChatToolCallItem[];
  }
}

/**
 * Authoritative status derivation oracle derived from PROJECT.md R1 & Feature Inventory F4.
 */
export function deriveRunStatus(rawStatus: string): RunStatusInfo {
  const s = rawStatus.toUpperCase();
  if (s === "RUNNING" || s === "STARTED" || s === "STARTING" || s === "ACTIVE") {
    return {
      variant: "accent",
      label: "Running",
      isPulsing: true,
      filterCategory: "active",
    };
  }
  if (s === "WAITING_APPROVAL") {
    return {
      variant: "warning",
      label: "Waiting Approval",
      isPulsing: true,
      filterCategory: "active",
    };
  }
  if (s === "COMPLETED" || s === "SETTLED" || s === "SUCCESS") {
    return {
      variant: "success",
      label: "Completed",
      isPulsing: false,
      filterCategory: "settled",
    };
  }
  if (s === "FAILED" || s === "BLOCKED" || s === "CANCELLED" || s === "ERROR") {
    return {
      variant: "error",
      label: s === "BLOCKED" ? "Blocked" : s === "CANCELLED" ? "Cancelled" : "Failed",
      isPulsing: false,
      filterCategory: "settled",
    };
  }
  return {
    variant: "neutral",
    label: "Pending",
    isPulsing: false,
    filterCategory: "active",
  };
}

// =============================================================================
// Fixtures
// =============================================================================

export const MOCK_ACTIVE_RUN_1: RunSummary = {
  id: "run_active_sandbox_01",
  objective: "Execute sandboxed CLI mission on Base Sepolia with Claude runner",
  source: "CONSOLE",
  environment: "base-sepolia-sandbox",
  isMainnet: false,
  budgetUsdc: "50.000000",
  createdAt: "2026-09-07T08:00:00.000Z",
  updatedAt: "2026-09-07T08:02:15.000Z",
};

export const MOCK_ACTIVE_RUN_2: RunSummary = {
  id: "run_active_gemini_02",
  objective: "Run Gemini CLI verifier against Bayesian reputation contract",
  source: "AGENT",
  environment: "docker-local",
  isMainnet: false,
  budgetUsdc: "25.000000",
  createdAt: "2026-09-07T08:15:00.000Z",
  updatedAt: "2026-09-07T08:16:30.000Z",
};

export const MOCK_COMPLETED_RUN_1: RunSummary = {
  id: "run_completed_settled_03",
  objective: "Settled market transaction with Beta Labs data feed",
  source: "CONSOLE",
  environment: "base-sepolia-sandbox",
  isMainnet: false,
  budgetUsdc: "100.000000",
  createdAt: "2026-09-06T14:00:00.000Z",
  updatedAt: "2026-09-06T14:10:00.000Z",
};

export const MOCK_FAILED_RUN_1: RunSummary = {
  id: "run_failed_timeout_04",
  objective: "Timeout failure during long-running worktree simulation",
  source: "AGENT",
  environment: "docker-local",
  isMainnet: false,
  budgetUsdc: "10.000000",
  createdAt: "2026-09-05T10:00:00.000Z",
  updatedAt: "2026-09-05T10:05:00.000Z",
};

export const MOCK_BLOCKED_RUN_1: RunSummary = {
  id: "run_blocked_veto_05",
  objective: "Disallowed interaction with veto-blocked counterparty",
  source: "FIXTURE",
  environment: "non-mainnet",
  isMainnet: false,
  budgetUsdc: null,
  createdAt: "2026-09-04T12:00:00.000Z",
  updatedAt: "2026-09-04T12:01:00.000Z",
};

export const ALL_MOCK_RUNS: readonly RunSummary[] = [
  MOCK_ACTIVE_RUN_1,
  MOCK_ACTIVE_RUN_2,
  MOCK_COMPLETED_RUN_1,
  MOCK_FAILED_RUN_1,
  MOCK_BLOCKED_RUN_1,
];

// Memory Citations & Summaries
export const MOCK_CITATION_BETA: MemoryCitation = {
  counterpartyKey: "beta_labs",
  label: "Beta Labs",
};

export const MOCK_CITATION_ALPHA: MemoryCitation = {
  counterpartyKey: "alpha_research",
  label: "Alpha Research",
};

export const MOCK_CITATION_GAMMA: MemoryCitation = {
  counterpartyKey: "gamma_data",
  label: "Gamma Data",
};

export const MOCK_COUNTERPARTY_SUMMARIES: Record<string, CounterpartyMemorySummary> = {
  beta_labs: {
    counterpartyKey: "beta_labs",
    displayName: "Beta Labs",
    status: "PREFERRED",
    overallReliability: 0.942,
    confidence: 0.885,
    episodesUsed: 14,
    latestOutcome: "Delivered verified dataset with 0 validation errors",
    timestamp: "2026-09-06T14:08:00.000Z",
  },
  alpha_research: {
    counterpartyKey: "alpha_research",
    displayName: "Alpha Research",
    status: "KNOWN",
    overallReliability: 0.768,
    confidence: 0.652,
    episodesUsed: 6,
    latestOutcome: "Completed job within budget ceiling",
    timestamp: "2026-09-05T11:20:00.000Z",
  },
  gamma_data: {
    counterpartyKey: "gamma_data",
    displayName: "Gamma Data",
    status: "WATCH",
    overallReliability: 0.415,
    confidence: 0.720,
    episodesUsed: 5,
    latestOutcome: "Failed verification tests in sandbox evaluation",
    timestamp: "2026-09-04T09:12:00.000Z",
  },
};

// Tool calls fixtures
export const MOCK_TOOL_CLI_RUNNER: ChatToolCallItem = {
  name: "cli_sandbox",
  status: "complete",
  target: "claude -p 'analyze market feed' --dangerously-skip-permissions",
  duration: "1.4s",
  node: "docker-sandbox",
  additions: 42,
  deletions: 3,
};

export const MOCK_TOOL_SIBYL_QUERY: ChatToolCallItem = {
  name: "sibyl_memory_query",
  status: "complete",
  target: "counterparties/beta_labs/episodes",
  duration: "320ms",
  node: "sibyl-v2",
};

export const MOCK_TOOL_TX_SUBMIT: ChatToolCallItem = {
  name: "base_sepolia_tx",
  status: "complete",
  target: "0x8f3c7a6e129b014d3c9071fe25a6b8c9d01234567890abcdef1234567890abcd",
  duration: "2.8s",
  node: "base-sepolia",
};

export const MOCK_TOOL_ERROR: ChatToolCallItem = {
  name: "cli_verifier",
  status: "error",
  target: "pnpm test --filter verification",
  errorMessage: "Process exited with code 1: 3 test failures encountered",
  node: "verifier-node",
};

export const MOCK_TOOL_RUNNING: ChatToolCallItem = {
  name: "cli_sandbox",
  status: "running",
  target: "gemini -p 'synthesize consensus'",
  node: "docker-sandbox",
};

// Dynamic component loader for optional modules
export function getImplementedMissionInspector(): ComponentType<MissionInspectorProps> | null {
  // Vite's import.meta.glob is safe when file is not yet present
  const modules = import.meta.glob("../components/mission-inspector.tsx", { eager: true });
  const key = "../components/mission-inspector.tsx";
  if (modules[key]) {
    const mod = modules[key] as { MissionInspector?: ComponentType<MissionInspectorProps> };
    return mod.MissionInspector ?? null;
  }
  return null;
}

/**
 * Memory types for Aura Console
 * Mirrors the Sibyl Memory schema
 */

// ============================================================================
// CORE TYPES
// ============================================================================

export interface MemoryEntity {
  /** Entity category (e.g., "task", "project", "user") */
  category: string;
  /** Entity name within category */
  name: string;
  /** Entity body/data */
  body: Record<string, unknown>;
  /** ISO timestamp of last update */
  updatedAt: string;
  /** Optional created timestamp */
  createdAt?: string;
}

export interface MemoryState {
  /** State key */
  key: string;
  /** State body/data */
  body: Record<string, unknown>;
  /** ISO timestamp of last update */
  updatedAt?: string;
}

export interface MemoryEvent {
  /** Unique event ID */
  id: string;
  /** ISO timestamp */
  timestamp: string;
  /** Event type */
  type: "evaluated" | "acted" | "forward";
  /** Human-readable description */
  description: string;
  /** Optional related entities */
  entities?: Array<{ category: string; name: string }>;
  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

// ============================================================================
// TIER TYPES
// ============================================================================

export type MemoryTier = "hot" | "warm" | "cold" | "reference" | "archive";

export interface TierInfo {
  tier: MemoryTier;
  description: string;
  useCase: string;
}

export const TIER_INFO: Record<MemoryTier, TierInfo> = {
  hot: {
    tier: "hot",
    description: "Live working state",
    useCase: "Current task context, active run state",
  },
  warm: {
    tier: "warm",
    description: "Single source of truth",
    useCase: "Project configs, user preferences, task definitions",
  },
  cold: {
    tier: "cold",
    description: "Append-only event log",
    useCase: "Audit trail, action history, decision logs",
  },
  reference: {
    tier: "reference",
    description: "Static knowledge",
    useCase: "Documentation, API specs, team guidelines",
  },
  archive: {
    tier: "archive",
    description: "Retired entities",
    useCase: "Completed tasks, old projects, audit records",
  },
};

// ============================================================================
// SEARCH TYPES
// ============================================================================

export interface SearchResult {
  entity: MemoryEntity;
  score: number;
  highlights: string[];
}

export interface SearchOptions {
  /** Include entities from specific tiers */
  tiers?: MemoryTier[];
  /** Include entities from specific categories */
  categories?: string[];
  /** Enable prefix matching */
  prefix?: boolean;
  /** Maximum results */
  limit?: number;
}

// ============================================================================
// MEMORY CONTEXT FOR AGENTS
// ============================================================================

export interface AgentMemoryContext {
  /** Current task information */
  currentTask?: {
    id: string;
    goal: string;
    phases: string[];
    status: "pending" | "in_progress" | "completed" | "failed";
  };
  /** Related past tasks */
  relatedTasks?: MemoryEntity[];
  /** Current project configuration */
  projectConfig?: MemoryEntity;
  /** Recent events */
  recentEvents?: MemoryEvent[];
  /** Team/workspace information */
  workspace?: {
    name: string;
    members?: string[];
    guidelines?: string[];
  };
}

export interface MemoryDiff {
  /** Entities added */
  added: MemoryEntity[];
  /** Entities modified */
  modified: MemoryEntity[];
  /** Entities archived */
  archived: MemoryEntity[];
  /** Events recorded */
  events: MemoryEvent[];
  /** Timestamp of the diff */
  timestamp: string;
}

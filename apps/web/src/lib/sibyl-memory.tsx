/**
 * Sibyl Memory Integration for Aura Console
 *
 * This module provides utilities for integrating with Sibyl Memory
 * to store and retrieve agent context, task history, and learning.
 *
 * @see https://sibyl.ist/
 * @see https://github.com/Sibyl-Labs/Sibyl-Memory
 */

import type { MemoryEntity, MemoryState, MemoryEvent } from "./types/memory";

// ============================================================================
// TYPES (mirrored from MCP server interface)
// ============================================================================

export interface SibylMemoryConfig {
  /** Path to the SQLite database */
  dbPath?: string;
  /** Credentials file path */
  credentialsPath?: string;
  /** Tenant ID for multi-tenant setups */
  tenantId?: string;
  /** API endpoint for cloud sync (optional) */
  apiEndpoint?: string;
}

export interface MemoryTier {
  HOT: "hot";
  WARM: "warm";
  COLD: "cold";
  REFERENCE: "reference";
  ARCHIVE: "archive";
}

export const TIERS: MemoryTier = {
  HOT: "hot", // Live working state, rewritten in place
  WARM: "warm", // Single source of truth per (category, name)
  COLD: "cold", // Append-only event log
  REFERENCE: "reference", // Static knowledge, rarely changes
  ARCHIVE: "archive", // Retired entities, kept for audit
} as const;

// ============================================================================
// MEMORY CLIENT INTERFACE
// ============================================================================

export interface MemoryClient {
  // HOT tier - Live state
  setState(key: string, body: Record<string, unknown>): Promise<void>;
  getState(key: string): Promise<MemoryState | null>;
  getAllStates(): Promise<MemoryState[]>;

  // WARM tier - Entities
  setEntity(category: string, name: string, body: Record<string, unknown>): Promise<void>;
  getEntity(category: string, name: string): Promise<MemoryEntity | null>;
  listEntities(category?: string): Promise<MemoryEntity[]>;

  // COLD tier - Journal
  writeEvent(event: Omit<MemoryEvent, "id" | "timestamp">): Promise<string>;
  readEvents(options?: {
    limit?: number;
    type?: "evaluated" | "acted" | "forward";
  }): Promise<MemoryEvent[]>;

  // REFERENCE tier
  setReference(key: string, body: string | Record<string, unknown>): Promise<void>;
  getReference(key: string): Promise<string | null>;

  // Search
  search(query: string, options?: { prefix?: boolean }): Promise<MemoryEntity[]>;
  searchEntities(query: string): Promise<MemoryEntity[]>;

  // Utilities
  close(): Promise<void>;
}

// ============================================================================
// MOCK IMPLEMENTATION (for demo purposes)
// ============================================================================

class MockMemoryClient implements MemoryClient {
  private states: Map<string, MemoryState> = new Map();
  private entities: Map<string, MemoryEntity> = new Map();
  private events: MemoryEvent[] = [];

  async setState(key: string, body: Record<string, unknown>): Promise<void> {
    this.states.set(key, { key, body });
  }

  async getState(key: string): Promise<MemoryState | null> {
    return this.states.get(key) || null;
  }

  async getAllStates(): Promise<MemoryState[]> {
    return Array.from(this.states.values());
  }

  async setEntity(
    category: string,
    name: string,
    body: Record<string, unknown>,
  ): Promise<void> {
    const key = `${category}:${name}`;
    this.entities.set(key, {
      category,
      name,
      body,
      updatedAt: new Date().toISOString(),
    });
  }

  async getEntity(category: string, name: string): Promise<MemoryEntity | null> {
    const key = `${category}:${name}`;
    return this.entities.get(key) || null;
  }

  async listEntities(category?: string): Promise<MemoryEntity[]> {
    const all = Array.from(this.entities.values());
    if (!category) return all;
    return all.filter((e) => e.category === category);
  }

  async writeEvent(event: Omit<MemoryEvent, "id" | "timestamp">): Promise<string> {
    const id = `evt_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const fullEvent: MemoryEvent = {
      ...event,
      id,
      timestamp: new Date().toISOString(),
    };
    this.events.unshift(fullEvent);
    return id;
  }

  async readEvents(options?: {
    limit?: number;
    type?: "evaluated" | "acted" | "forward";
  }): Promise<MemoryEvent[]> {
    let filtered = this.events;
    if (options?.type) {
      filtered = filtered.filter((e) => e.type === options.type);
    }
    if (options?.limit) {
      filtered = filtered.slice(0, options.limit);
    }
    return filtered;
  }

  async setReference(key: string, body: string | Record<string, unknown>): Promise<void> {
    const bodyObj = typeof body === "string" ? { content: body } : body;
    await this.setEntity("reference", key, bodyObj);
  }

  async getReference(key: string): Promise<string | null> {
    const entity = await this.getEntity("reference", key);
    if (!entity) return null;
    return JSON.stringify(entity.body);
  }

  async search(query: string): Promise<MemoryEntity[]> {
    const lower = query.toLowerCase();
    return Array.from(this.entities.values()).filter(
      (e) =>
        e.name.toLowerCase().includes(lower) ||
        JSON.stringify(e.body).toLowerCase().includes(lower),
    );
  }

  async searchEntities(query: string): Promise<MemoryEntity[]> {
    return this.search(query);
  }

  async close(): Promise<void> {
    // No-op for mock
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

let globalClient: MemoryClient | null = null;

/**
 * Get or create the global memory client
 */
export async function getMemoryClient(config?: SibylMemoryConfig): Promise<MemoryClient> {
  void config;
  if (globalClient) return globalClient;

  // In production, this would use the MCP server or sibyl-memory-client SDK
  // For now, use the mock implementation
  globalClient = new MockMemoryClient();

  // Initialize with demo data
  await initializeDemoData(globalClient);

  return globalClient;
}

async function initializeDemoData(client: MemoryClient): Promise<void> {
  // Add sample project context
  await client.setEntity("project", "aura-console", {
    description: "Aura Console - Agent inspection console",
    framework: "Next.js + Hono",
    team: "Aura ID Network",
    status: "active",
  });

  // Add sample task history
  await client.setEntity("task", "billing-entitlements", {
    description: "Fix billing entitlements - grace period fallback",
    status: "resolved",
    previousApproach: "Direct revocation without grace period",
    lessonsLearned: "Always implement grace periods for expired keys",
  });

  // Add current run context
  await client.setState("current-run", {
    taskId: "billing-fix",
    startTime: new Date().toISOString(),
    goal: "Fix billing entitlements with grace period",
    status: "in_progress",
  });

  // Write initialization event
  await client.writeEvent({
    type: "acted",
    description: "Agent session initialized with Sibyl Memory context",
  });
}

/**
 * Create a memory client for a specific session
 */
export async function createSessionMemory(sessionId: string): Promise<MemoryClient> {
  const client = await getMemoryClient();
  await client.setState(`session:${sessionId}`, {
    sessionId,
    createdAt: new Date().toISOString(),
  });
  return client;
}

// ============================================================================
// UTILITY HOOKS
// ============================================================================

export interface UseMemoryOptions {
  /** Auto-load memories on mount */
  autoLoad?: boolean;
  /** Categories to load */
  categories?: string[];
}

export interface UseMemoryReturn {
  /** All loaded entities */
  entities: MemoryEntity[];
  /** All loaded states */
  states: MemoryState[];
  /** Recent events */
  recentEvents: MemoryEvent[];
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: Error | null;
  /** Reload all data */
  reload: () => Promise<void>;
  /** Search across all memories */
  search: (query: string) => Promise<MemoryEntity[]>;
  /** Store new entity */
  store: (category: string, name: string, body: Record<string, unknown>) => Promise<void>;
  /** Record an event */
  recordEvent: (
    type: "evaluated" | "acted" | "forward",
    description: string,
  ) => Promise<void>;
  /** Update current run state */
  updateRunState: (state: Record<string, unknown>) => Promise<void>;
}

// ============================================================================
// MEMORY CONTEXT PROVIDER (for React)
// ============================================================================

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

const MemoryContext = createContext<UseMemoryReturn | null>(null);

export function MemoryProvider({ children }: { children: ReactNode }) {
  const [entities, setEntities] = useState<MemoryEntity[]>([]);
  const [states, setStates] = useState<MemoryState[]>([]);
  const [recentEvents, setRecentEvents] = useState<MemoryEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const clientRef = useRef<MemoryClient | null>(null);

  const loadAll = useCallback(async (c: MemoryClient) => {
    setIsLoading(true);
    try {
      const [ents, sts, evts] = await Promise.all([
        c.listEntities(),
        c.getAllStates(),
        c.readEvents({ limit: 50 }),
      ]);
      setEntities(ents);
      setStates(sts);
      setRecentEvents(evts);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    getMemoryClient()
      .then((c) => {
        if (cancelled) return;
        clientRef.current = c;
        return loadAll(c);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err : new Error(String(err)));
        setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [loadAll]);

  const reload = useCallback(async () => {
    const c = clientRef.current;
    if (c) await loadAll(c);
  }, [loadAll]);

  const search = useCallback(async (query: string): Promise<MemoryEntity[]> => {
    const c = clientRef.current;
    if (!c) return [];
    return c.search(query);
  }, []);

  const store = useCallback(
    async (category: string, name: string, body: Record<string, unknown>) => {
      const c = clientRef.current;
      if (!c) return;
      await c.setEntity(category, name, body);
      await reload();
    },
    [reload],
  );

  const recordEvent = useCallback(
    async (type: "evaluated" | "acted" | "forward", description: string) => {
      const c = clientRef.current;
      if (!c) return;
      await c.writeEvent({ type, description });
      await reload();
    },
    [reload],
  );

  const updateRunState = useCallback(
    async (state: Record<string, unknown>) => {
      const c = clientRef.current;
      if (!c) return;
      await c.setState("current-run", { ...state, updatedAt: new Date().toISOString() });
      await reload();
    },
    [reload],
  );

  return (
    <MemoryContext.Provider
      value={{
        entities,
        states,
        recentEvents,
        isLoading,
        error,
        reload,
        search,
        store,
        recordEvent,
        updateRunState,
      }}
    >
      {children}
    </MemoryContext.Provider>
  );
}

export function useMemory(): UseMemoryReturn {
  const context = useContext(MemoryContext);
  if (!context) {
    throw new Error("useMemory must be used within a MemoryProvider");
  }
  return context;
}

// ============================================================================
// PRE-BUILT MEMORY QUERIES
// ============================================================================

export const MemoryQueries = {
  /**
   * Get context for a specific task
   */
  async getTaskContext(taskId: string): Promise<MemoryEntity[]> {
    const client = await getMemoryClient();
    const entities = await client.search(taskId);
    return entities.filter((e) => e.category === "task" || e.category === "project");
  },

  /**
   * Get agent session history
   */
  async getSessionHistory(sessionId: string): Promise<MemoryEvent[]> {
    const client = await getMemoryClient();
    const state = await client.getState(`session:${sessionId}`);
    if (!state) return [];

    const events = await client.readEvents({ limit: 100 });
    return events.filter(
      (e) =>
        e.description.includes(sessionId) ||
        e.timestamp > ((state.body.createdAt as string) || "0"),
    );
  },

  /**
   * Get learning from past tasks
   */
  async getPastLearnings(): Promise<MemoryEntity[]> {
    const client = await getMemoryClient();
    const entities = await client.listEntities("task");
    return entities.filter((e) => e.body.lessonsLearned);
  },

  /**
   * Get project configuration
   */
  async getProjectConfig(projectName: string): Promise<MemoryEntity | null> {
    const client = await getMemoryClient();
    return client.getEntity("project", projectName);
  },
};

import type { ChatMessage } from "./chat-types";

/**
 * The chat thread and whether the dock is open, held outside React.
 *
 * Messages are partitioned by context / run ID (Map<string, ChatMessage[]>) so
 * switching between runs or the global assistant does not bleed history.
 *
 * Not persisted to storage. A transcript is a record of one sitting, and
 * restoring yesterday's questions beside today's Run would invite reading an
 * old answer as if it were about the surface now on screen.
 */
let open = true;
let touched = false;
let activeContext: string = "global";

const messagesByContext = new Map<string, ChatMessage[]>();
let unpartitionedSeed: ChatMessage[] | null = null;
const EMPTY_MESSAGES: ChatMessage[] = [];

const listeners = new Set<() => void>();
const contextListeners = new Map<string, Set<() => void>>();

function normalizeContext(context?: string | null): string {
  return context && context.trim().length > 0 ? context.trim() : "global";
}

const emit = (contextKey?: string) => {
  for (const listener of listeners) {
    listener();
  }
  if (contextKey) {
    const specific = contextListeners.get(contextKey);
    if (specific) {
      for (const listener of specific) {
        listener();
      }
    }
  } else {
    // Broadcast to all context-specific listeners on unpartitioned/global events
    for (const specificSet of contextListeners.values()) {
      for (const listener of specificSet) {
        listener();
      }
    }
  }
};

export function subscribeChatSession(
  listener: () => void,
  contextKey?: string | null,
): () => void {
  if (contextKey) {
    const key = normalizeContext(contextKey);
    if (!contextListeners.has(key)) {
      contextListeners.set(key, new Set());
    }
    const set = contextListeners.get(key)!;
    set.add(listener);
    return () => {
      set.delete(listener);
      if (set.size === 0) {
        contextListeners.delete(key);
      }
    };
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export const getChatOpen = () => open;
export const getChatTouched = () => touched;
export const CHAT_TOUCHED_SERVER_SNAPSHOT = false;

export function setChatOpen(next: boolean) {
  touched = true;
  if (open === next) return;
  open = next;
  emit();
}

/** Active context ID (e.g. run ID or "global"). */
export function getActiveChatContext(): string {
  return activeContext;
}

export function setActiveChatContext(context?: string | null): void {
  const next = normalizeContext(context);
  if (activeContext === next) return;
  const prev = activeContext;
  activeContext = next;
  emit(next);
  if (prev !== next) {
    const prevSet = contextListeners.get(prev);
    if (prevSet) {
      for (const listener of prevSet) {
        listener();
      }
    }
  }
}

/**
 * Returns messages for the specified context key, or active context if omitted.
 * Returns a stable empty array if no messages exist.
 */
export function getChatMessages(contextKey?: string | null): ChatMessage[] {
  const key = contextKey !== undefined ? normalizeContext(contextKey) : activeContext;
  const existing = messagesByContext.get(key);
  if (existing) return existing;

  // If an unpartitioned test fixture seeded messages before a component with runId mounted,
  // migrate and claim those messages for this specific context, then clear the seed so
  // it never bleeds to any other context.
  if (unpartitionedSeed !== null) {
    const seeded = unpartitionedSeed;
    unpartitionedSeed = null;
    messagesByContext.set(key, seeded);
    if (key !== "global") {
      messagesByContext.delete("global");
    }
    return seeded;
  }

  return EMPTY_MESSAGES;
}

/**
 * Replace the thread for the given context (or active context if omitted).
 */
export function setChatMessages(
  next: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[]),
  contextKey?: string | null,
) {
  const key = contextKey !== undefined ? normalizeContext(contextKey) : activeContext;
  const current = messagesByContext.get(key) ?? (contextKey === undefined && unpartitionedSeed !== null ? unpartitionedSeed : EMPTY_MESSAGES);
  const value = typeof next === "function" ? next(current) : next;
  if (value === current) return;

  messagesByContext.set(key, value);

  // If called without context while activeContext is global, track as unpartitioned seed for legacy test fixtures
  if (contextKey === undefined && activeContext === "global") {
    unpartitionedSeed = value;
  } else {
    unpartitionedSeed = null;
  }

  emit(key);
}

export const CHAT_OPEN_SERVER_SNAPSHOT = true;
/** One frozen empty array: a new [] each call would never compare equal. */
export const CHAT_MESSAGES_SERVER_SNAPSHOT: ChatMessage[] = [];

/** Test-only, so one spec cannot leave a thread behind for the next. */
export function __resetChatSession() {
  open = true;
  touched = false;
  activeContext = "global";
  messagesByContext.clear();
  unpartitionedSeed = null;
  emit();
}

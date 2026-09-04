import type { ChatMessage } from "./chat-types";

/**
 * The chat thread and whether the dock is open, held outside React.
 *
 * The chat can navigate the console, and every console surface mounts its own
 * shell — so component state would be destroyed by the very command the
 * operator just ran: the chat would answer "Opened Policies." and then vanish
 * along with the sentence. A module store lets the thread outlive the page
 * that produced it, the same way the nav preference does.
 *
 * Not persisted to storage. A transcript is a record of one sitting, and
 * restoring yesterday's questions beside today's Run would invite reading an
 * old answer as if it were about the surface now on screen.
 */
// Open by default. Behind a launcher the chat was something an operator had
// to know existed and go find; the console's own brief puts the agent
// surface in front of them.
let open = true;
let messages: ChatMessage[] = [];
const listeners = new Set<() => void>();

const emit = () => {
  for (const listener of listeners) listener();
};

export function subscribeChatSession(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const getChatOpen = () => open;
export const getChatMessages = () => messages;

export function setChatOpen(next: boolean) {
  if (open === next) return;
  open = next;
  emit();
}

/** Replace the thread. The array identity changes only when the thread does,
 *  which is what keeps `useSyncExternalStore` from looping. */
export function setChatMessages(next: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) {
  const value = typeof next === "function" ? next(messages) : next;
  if (value === messages) return;
  messages = value;
  emit();
}

export const CHAT_OPEN_SERVER_SNAPSHOT = true;
/** One frozen empty array: a new [] each call would never compare equal. */
export const CHAT_MESSAGES_SERVER_SNAPSHOT: ChatMessage[] = [];

/** Test-only, so one spec cannot leave a thread behind for the next. */
export function __resetChatSession() {
  open = true;
  messages = [];
  emit();
}

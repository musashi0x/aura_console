"use client";

import { useSyncExternalStore } from "react";

import {
  CHAT_OPEN_SERVER_SNAPSHOT,
  CHAT_TOUCHED_SERVER_SNAPSHOT,
  getChatOpen,
  getChatTouched,
  setChatOpen,
  subscribeChatSession,
} from "../chat/chat-session";

export { setChatOpen };
import { CONSOLE_COMMANDS } from "../console-commands";
import { console_ } from "../copy";
import type { ChatGrounding } from "./console-chat";
import { ConsoleChat } from "./console-chat";

/** Whether the chat panel is showing, for the shell that lays it out. */
export function useChatOpen(): boolean {
  return useSyncExternalStore(
    subscribeChatSession,
    getChatOpen,
    () => CHAT_OPEN_SERVER_SNAPSHOT,
  );
}

/** True once the operator has opened or closed the chat themselves. */
export function useChatTouched(): boolean {
  return useSyncExternalStore(
    subscribeChatSession,
    getChatTouched,
    () => CHAT_TOUCHED_SERVER_SNAPSHOT,
  );
}

/**
 * The chat's contents.
 *
 * It no longer positions itself. The shell puts it in the frame's end panel,
 * so the workspace and the conversation are two regions of one layout rather
 * than a panel floating over the surface it is discussing — the reason the
 * workspace previously had to reserve a right-hand gutter by hand.
 */
export function ConsoleChatPanel({
  runId,
  grounding,
}: {
  runId?: string;
  grounding?: ChatGrounding;
}) {
  return (
    <>
      <ConsoleChat runId={runId} grounding={grounding} />

      {/* What the chat can actually do, listed rather than discovered by
          trial. The same registry the palette runs, so this cannot drift into
          advertising a command that does not exist. */}
      <details className="cs__chat-dock-commands">
        <summary>{console_.chat.dock.commandsTitle}</summary>
        <p className="cs__hint">{console_.chat.dock.commandsNote}</p>
        <ul className="cs__chat-dock-command-list">
          {CONSOLE_COMMANDS.map((command) => (
            <li key={command.id}>
              <code>{command.aliases[0]}</code> — {command.label}
            </li>
          ))}
        </ul>
      </details>
    </>
  );
}

/** Brings the chat back once it has been closed. */
export function ConsoleChatLauncher() {
  return (
    <button
      type="button"
      className="cs__chat-launcher"
      onClick={() => setChatOpen(true)}
      aria-expanded={false}
    >
      {console_.chat.dock.open}
    </button>
  );
}

export function ConsoleChatCloseButton() {
  return (
    <button type="button" className="btn" onClick={() => setChatOpen(false)} aria-expanded>
      {console_.chat.dock.close}
    </button>
  );
}

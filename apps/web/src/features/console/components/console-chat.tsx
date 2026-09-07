"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { useRouter } from "next/navigation";

import { Banner } from "@astryxdesign/core/Banner";
import { ChatComposer } from "@astryxdesign/core/Chat";
import {
  ChatComposerInput,
  ChatMessage as ChatMessageRow,
  ChatMessageBubble,
  ChatMessageList,
  type ChatComposerTrigger,
} from "@astryxdesign/core/Chat";
import {
  createStaticSource,
  TypeaheadItem,
  type SearchableItem,
} from "@astryxdesign/core/Typeahead";
import { HStack, StackItem, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { Token } from "@astryxdesign/core/Token";

import { MonoRef } from "@/components/primitives";
import { env } from "@/lib/env";

import {
  CHAT_MESSAGES_SERVER_SNAPSHOT,
  getChatMessages,
  setChatMessages,
  subscribeChatSession,
} from "../chat/chat-session";
import { openChatStream, type ChatStreamHandle } from "../chat/chat-transport";
import type {
  ChatConnection,
  ChatMessage,
  MemoryCitation,
} from "../chat/chat-types";
import { useSmoothedText } from "../chat/use-smoothed-text";
import { CONSOLE_COMMANDS, matchCommand } from "../console-commands";
import { console_ } from "../copy";
import { ConsoleChatSuggestions } from "./console-chat-suggestions";
import {
  MEMORY_VIEW_SERVER_SNAPSHOT,
  getMemoryViewEnabled,
  subscribeMemoryView,
} from "../memory-view-state";

/**
 * A `/` command menu is written and NOT wired, on purpose.
 *
 * Passing `triggers` to ChatComposerInput switches the input from
 * `role="textbox"` to `role="combobox"` while it keeps `aria-multiline="true"`,
 * which ARIA does not allow on a combobox. Verified by isolation in
 * @astryxdesign/core 0.5.2: without triggers the input is a valid textbox, with
 * them it is an invalid combobox, and no prop this side removes the attribute.
 * A screen reader would be handed a control that contradicts itself, on the one
 * element the whole surface exists for.
 *
 * The definition stays because it is right and because it documents the
 * blocker: turn it on the moment the attribute conflict is fixed upstream.
 *
 * There would be no `@` trigger either way. The pattern this borrows from
 * mentions people, and this product has no user model at all: no accounts, no
 * directory, nothing to resolve a name against.
 */
const COMMAND_ITEMS: SearchableItem<{ description: string }>[] =
  CONSOLE_COMMANDS.map((command) => ({
    id: command.id,
    label: command.aliases[0]!,
    auxiliaryData: { description: command.label },
  }));

export const SLASH_COMMANDS_BLOCKED_ON_ARIA: ChatComposerTrigger = {
  character: "/",
  searchSource: createStaticSource(COMMAND_ITEMS),
  renderItem: (item) => (
    <TypeaheadItem
      item={item}
      description={(item.auxiliaryData as { description: string })?.description}
    />
  ),
  onSelect: (item) => ({
    value: item.label,
    label: item.label,
    variant: "neutral",
  }),
};

/**
 * What the console actually knows about the answering path, checked rather than
 * assumed. Absent means it was never asked, which is itself a state worth
 * reporting: the grounding banner used to be hardcoded, so it kept announcing
 * that grounding was not connected after it was.
 */
export interface ChatGrounding {
  agentReachable: boolean;
  memoryReachable: boolean;
  /** Why the answering path is incomplete, in the API's own words. */
  detail?: string;
}

export interface ConsoleChatProps {
  /** The Run the conversation is scoped to. Absent means nothing to ask about. */
  runId?: string;
  /** Omitted means unchecked, and is reported as unchecked, never as ready. */
  grounding?: ChatGrounding;
  /**
   * Where this chat is being rendered, which is the only thing that decides how
   * roomy it is.
   *
   * `dock` is the panel on the right of a non-Mission surface: narrow, beside
   * the thing it talks about, so it stays compact. `centre` is inside a
   * Mission, where the conversation IS the surface rather than a column next to
   * it, and a cramped composer there understates the primary way to direct a
   * Mission. Same component, same behaviour; only the density and the room it
   * is given differ.
   */
  placement?: "dock" | "centre";
  /**
   * Memory On/Off, owned by the command palette (#68). The chat inherits it and
   * renders no toggle of its own: two controls for one setting would let the
   * surface disagree with the palette. Omitted means "read the palette's own
   * state"; it is an override for tests, not a second source of truth.
   */
  memoryEnabled?: boolean;
}

/**
 * The operator's question surface for a Run.
 *
 * Answers render only from what the stream sent. There is no seeded transcript,
 * no placeholder reply and no "thinking" filler: when the stream cannot be
 * reached the panel says so and stops, because an invented answer here would be
 * the console fabricating the agent's reasoning — the one thing this product
 * exists to make inspectable.
 *
 * The sources rail is built from citations the stream delivered, so it can only
 * ever list evidence that was really used. It is deliberately not a catalogue
 * of available memory: showing one would imply a retrieval that has not run.
 */
export function ConsoleChat({
  runId,
  grounding,
  memoryEnabled,
  /* Defaults to the dock, so every existing call site keeps the size it had. */
  placement = "dock",
}: ConsoleChatProps) {
  const router = useRouter();
  // The owning page is a server component and cannot read a client store, so
  // the chat subscribes directly rather than having the flag drilled through
  // one. Same store the palette writes, so the two cannot disagree.
  const memoryFromPalette = useSyncExternalStore(
    subscribeMemoryView,
    getMemoryViewEnabled,
    () => MEMORY_VIEW_SERVER_SNAPSHOT,
  );
  const memoryOn = memoryEnabled ?? memoryFromPalette;
  // The thread lives outside React so a chat-driven navigation does not
  // destroy the transcript that announced it.
  const messages = useSyncExternalStore(
    subscribeChatSession,
    getChatMessages,
    () => CHAT_MESSAGES_SERVER_SNAPSHOT,
  );
  const setMessages = setChatMessages;
  const [connection, setConnection] = useState<ChatConnection>({
    kind: "idle",
  });
  const [draft, setDraft] = useState("");
  const [liveId, setLiveId] = useState<string | null>(null);
  const handleRef = useRef<ChatStreamHandle | null>(null);
  const counterRef = useRef(0);

  const { text: streamText, push, end, reset } = useSmoothedText();

  useEffect(() => {
    return () => {
      handleRef.current?.close();
      handleRef.current = null;
    };
  }, []);

  const busy =
    connection.kind === "connecting" || connection.kind === "streaming";

  // Every citation any answer made, in the order they arrived, numbered so the
  // inline marker and the rail entry agree.
  const sources: MemoryCitation[] = [];
  for (const message of messages) {
    for (const citation of message.citations) {
      if (
        !sources.some((s) => s.counterpartyKey === citation.counterpartyKey)
      ) {
        sources.push(citation);
      }
    }
  }

  const stop = useCallback(() => {
    handleRef.current?.close();
    handleRef.current = null;
    end();
    setConnection({ kind: "idle" });
    setLiveId(null);
  }, [end]);

  function ask(question: string) {
    counterRef.current += 1;
    const turn = counterRef.current;
    const agentId = `agent-${turn}`;
    reset();
    setLiveId(agentId);

    setMessages((prev) => [
      ...prev,
      {
        id: `operator-${turn}`,
        role: "operator",
        text: question,
        complete: true,
        citations: [],
      },
      { id: agentId, role: "agent", text: "", complete: false, citations: [] },
    ]);

    const update = (change: (message: ChatMessage) => ChatMessage) =>
      setMessages((prev) =>
        prev.map((m) => (m.id === agentId ? change(m) : m)),
      );

    handleRef.current?.close();
    const chatUrl = runId
      ? `${env.NEXT_PUBLIC_API_URL}/api/runs/${encodeURIComponent(runId)}/chat?q=${encodeURIComponent(question)}`
      : `${env.NEXT_PUBLIC_API_URL}/api/chat?q=${encodeURIComponent(question)}`;

    let hadToolCalls = false;

    handleRef.current = openChatStream({
      // GET only. EventSource cannot issue anything else, which is why the
      // read-only requirement holds without a separate guard.
      url: chatUrl,
      onToken: (text) => {
        push(text);
        update((m) => ({ ...m, text: m.text + text }));
      },
      onCitation: (citation) =>
        update((m) => ({ ...m, citations: [...m.citations, citation] })),
      onThought: (thought) => {
        update((m) => ({
          ...m,
          thought: (m.thought ? m.thought + "\n" : "") + thought,
        }));
      },
      onUsage: (usage) => {
        update((m) => ({ ...m, usage }));
      },
      onToolCall: (toolCall) => {
        hadToolCalls = true;
        update((m) => ({
          ...m,
          toolCalls: [...(m.toolCalls ?? []), toolCall],
        }));
        if (toolCall.name === "console_navigate" && typeof toolCall.args?.destination === "string") {
          router.push(toolCall.args.destination);
        }
        if (toolCall.name === "mission_propose_approval") {
          router.refresh();
        }
      },
      onState: setConnection,
      onDone: () => {
        end();
        update((m) => ({ ...m, complete: true }));
        setConnection({ kind: "idle" });
        setLiveId(null);
        if (hadToolCalls) {
          router.refresh();
        }
      },
    });
  }

  function offer(text: string) {
    setDraft(text);
    // Fills the composer; it does not send. A chip that ran on sight would
    // navigate the console out from under someone who was still reading it.
  }

  /** Append a line the console says about itself, never in the agent's voice. */
  function reportConsole(said: string, outcome: string) {
    counterRef.current += 1;
    const turn = counterRef.current;
    setMessages((prev) => [
      ...prev,
      {
        id: `operator-${turn}`,
        role: "operator",
        text: said,
        complete: true,
        citations: [],
      },
      {
        id: `console-${turn}`,
        role: "console",
        text: outcome,
        complete: true,
        citations: [],
      },
    ]);
  }

  function submit() {
    const said = draft.trim();
    if (!said || busy) return;
    setDraft("");

    // A command runs the same registry entry the palette runs — the chat gains
    // no power the palette lacks, and neither can reach an economic action.
    const command = matchCommand(said);
    if (command) {
      command.run((href) => router.push(href));
      reportConsole(said, command.done());
      return;
    }

    // Not a command, so it is a question. Questions need an agent to answer
    // them; without one the console says so rather than producing something
    // that reads like an answer.
    if (!runId && grounding?.agentReachable !== true) {
      reportConsole(said, console_.chat.did.cannotAnswer);
      return;
    }
    ask(said);
  }

  /** The console's three voices, in the design system's own vocabulary. */
  const senderFor = (role: ChatMessage["role"]) =>
    role === "operator" ? "user" : role === "console" ? "system" : "assistant";

  const composer = (
    <ChatComposer
      value={draft}
      onChange={setDraft}
      onSubmit={submit}
      onStop={stop}
      isStopShown={busy}
      placeholder={console_.chat.placeholder}
      density={placement === "centre" ? "spacious" : "compact"}
      input={
        /* Deliberately no `value`/`onChange` here: the input reads both from
           the composer's context, and passing them would switch it into its own
           controlled mode and fork the draft in two places.
           `hasHistory={false}` because the console keeps no message history —
           the default binds ArrowUp to recall and selects the draft, which on a
           surface with nothing to recall just eats the operator's text.
           No `triggers` — see the note on `slashCommands`. */
        <ChatComposerInput hasHistory={false} />
      }
    />
  );

  const zeroState = <ConsoleChatSuggestions onOffer={offer} />;

  return (
    <VStack gap={4} height="100%">
      {/* Every band except the transcript keeps its natural height. In a
          height-constrained column they were all shrinkable flex items, so the
          banner was compressed below its own text and the overflow drew on top
          of the block beneath it — an 18px overlap at 1500x1000. The transcript
          is the one thing that should absorb the leftover space and scroll. */}
      <StackItem>
        <VStack gap={1}>
          <Text as="p" size="sm" color="secondary">
            {runId ? (
              <MonoRef label={console_.chat.scopeLabel}>{runId}</MonoRef>
            ) : (
              console_.chat.noScope
            )}
          </Text>
          <Text as="p" size="xsm" color="secondary">
            {console_.chat.readOnly}
          </Text>
        </VStack>
      </StackItem>

      {/* A statement about wiring, not about a lookup result — and a checked
          one. This banner was hardcoded, so it kept announcing that grounding
          was not connected after an agent and a memory were both answering.
          Silence here is not a claim that everything is fine: it renders
          nothing only when both halves were checked and both answered. */}
      {grounding?.agentReachable === true && grounding.memoryReachable === true ? null : (
        <StackItem>
          <Banner
            status="warning"
            title={console_.chat.groundingBadge}
            description={
              <VStack gap={1}>
                <Text as="p" size="sm">
                  {grounding === undefined
                    ? console_.chat.groundingUnchecked
                    : (grounding.detail ?? console_.chat.groundingBody)}
                </Text>
                <Text as="p" size="sm">
                  {console_.chat.groundingNote}
                </Text>
                {memoryOn === false ? (
                  <Text as="p" size="sm">
                    {console_.chat.memoryOff}
                  </Text>
                ) : null}
              </VStack>
            }
          />
        </StackItem>
      )}

      {/* Only records an answer actually cited. A catalogue of what might exist
          would imply a retrieval the console has not performed. */}
      {sources.length > 0 ? (
        <StackItem>
          <VStack gap={2}>
            <Text as="p" size="xsm" color="secondary" weight="semibold">
              {console_.chat.sourcesTitle}
            </Text>
            <HStack gap={2} wrap="wrap">
              {sources.map((source, index) => (
                <Token
                  key={source.counterpartyKey}
                  label={`${index + 1}. ${source.label}`}
                  size="sm"
                  color="default"
                />
              ))}
            </HStack>
          </VStack>
        </StackItem>
      ) : null}

      {/* The transcript is the one band that absorbs the leftover height and
          scrolls. Everything above and below it keeps its natural size. */}
      <StackItem size="fill" isScrollable>
        <ChatMessageList emptyState={zeroState} isStreaming={busy} align="top">
          {messages.map((message) => {
            const live = message.id === liveId;
            const body = live ? streamText : message.text;
            const pending =
              message.role === "agent" && body === ""
                ? connection.kind === "unavailable"
                  ? console_.chat.unavailableBody
                  : console_.chat.connecting
                : null;

            return (
              <ChatMessageRow key={message.id} sender={senderFor(message.role)}>
                <ChatMessageBubble
                  name={
                    message.role === "operator"
                      ? console_.chat.you
                      : message.role === "console"
                        ? console_.chat.consoleRole
                        : console_.chat.agent
                  }
                  metadata={
                    message.citations.length > 0 || (message.toolCalls && message.toolCalls.length > 0) ? (
                      <HStack gap={1} wrap="wrap">
                        {message.toolCalls?.map((tool, idx) => (
                          <Token
                            key={`tool-${idx}-${tool.name}`}
                            label={`MCP: ${tool.name}`}
                            size="sm"
                            color="default"
                          />
                        ))}
                        {message.citations.map((citation) => {
                          const index = sources.findIndex(
                            (s) =>
                              s.counterpartyKey === citation.counterpartyKey,
                          );
                          return (
                            <Token
                              key={citation.counterpartyKey}
                              label={String(index + 1)}
                              size="sm"
                              color="default"
                            />
                          );
                        })}
                      </HStack>
                    ) : undefined
                  }
                >
                  {pending ?? body}
                </ChatMessageBubble>
              </ChatMessageRow>
            );
          })}
        </ChatMessageList>
      </StackItem>

      {connection.kind === "reconnecting" ? (
        <Text as="p" size="sm" color="secondary">
          {console_.chat.disconnected}
        </Text>
      ) : null}

      {/* The composer sits at the bottom, always. Leading with it on an empty
          surface read well in a mock and wrong in use: the place you type is
          the bottom of a chat, and a person opening one looks there without
          being taught. Moving it by state also relocates the control under the
          operator between one message and the next. */}
      <StackItem>{composer}</StackItem>
    </VStack>
  );
}

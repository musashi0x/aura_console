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
  ChatToolCalls,
  type ChatComposerTrigger,
} from "@astryxdesign/core/Chat";
import { Citation } from "@astryxdesign/core/Citation";
import { CodeBlock } from "@astryxdesign/core/CodeBlock";
import { HoverCard } from "@astryxdesign/core/HoverCard";
import { Markdown } from "@astryxdesign/core/Markdown";
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
  setActiveChatContext,
  setChatMessages,
  subscribeChatSession,
} from "../chat/chat-session";
import { openChatStream, type ChatStreamHandle } from "../chat/chat-transport";
import type {
  ChatConnection,
  ChatMessage,
  ChatToolCallItem,
  ChatToolCallStatus,
  MemoryCitation,
} from "../chat/chat-types";
import { ChatApprovalCard } from "./chat-approval-card";
import { CounterpartyMemoryHoverCard } from "./counterparty-memory-hover-card";
import { TextLoader } from "generative-loaders";
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
    variant: "gray",
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
   * Memory On/Off, owned by the command palette (#68). The chat inherits it and
   * renders no toggle of its own: two controls for one setting would let the
   * surface disagree with the palette. Omitted means "read the palette's own
   * state"; it is an override for tests, not a second source of truth.
   */
  memoryEnabled?: boolean;
  placement?: string;
}

/**
 * Ensures that tool call items with output data have a properly configured
 * `<CodeBlock container="section" />` in their `resultDetail`.
 */
function normalizeToolCallItem(call: ChatToolCallItem): ChatToolCallItem {
  if (call.resultDetail != null && typeof call.resultDetail !== "string") {
    return call;
  }

  const raw = typeof call.resultDetail === "string" ? call.resultDetail : call.data;
  if (raw == null) {
    return call;
  }

  let code: string;
  let language: string = "bash";

  if (typeof raw === "string") {
    code = raw;
    if (code.startsWith("---") || code.startsWith("diff ") || code.includes("\n+++ ")) {
      language = "diff";
    } else if (code.trim().startsWith("{") || code.trim().startsWith("[")) {
      language = "json";
    } else {
      language = "bash";
    }
  } else {
    code = JSON.stringify(raw, null, 2);
    language = "json";
  }

  return {
    ...call,
    resultDetail: (
      <CodeBlock
        container="section"
        code={code}
        language={language}
        isWrapped
      />
    ),
  };
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
export function ConsoleChat({ runId, grounding, memoryEnabled }: ConsoleChatProps) {
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
  const activeRunContext = runId?.trim() || "global";

  useEffect(() => {
    setActiveChatContext(activeRunContext);
  }, [activeRunContext]);

  // The thread lives outside React, partitioned by runId/context, so a chat-driven
  // navigation or switching runs does not bleed transcript history.
  const messages = useSyncExternalStore(
    useCallback(
      (listener: () => void) => subscribeChatSession(listener, activeRunContext),
      [activeRunContext],
    ),
    useCallback(() => getChatMessages(activeRunContext), [activeRunContext]),
    () => CHAT_MESSAGES_SERVER_SNAPSHOT,
  );
  const setMessages = useCallback(
    (next: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => {
      setChatMessages(next, activeRunContext);
    },
    [activeRunContext],
  );
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
    const canAskWithoutRun = Boolean(grounding?.agentReachable && grounding?.memoryReachable);
    if (!runId && !canAskWithoutRun) return;
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

    const streamUrl = runId
      ? `${env.NEXT_PUBLIC_API_URL}/api/runs/${encodeURIComponent(runId)}/chat?q=${encodeURIComponent(question)}`
      : `${env.NEXT_PUBLIC_API_URL}/api/chat?q=${encodeURIComponent(question)}`;

    handleRef.current?.close();
    handleRef.current = openChatStream({
      // GET only. EventSource cannot issue anything else, which is why the
      // read-only requirement holds without a separate guard.
      url: streamUrl,
      onToken: (text) => {
        push(text);
        update((m) => ({ ...m, text: m.text + text }));
      },
      onCitation: (citation) =>
        update((m) => ({ ...m, citations: [...m.citations, citation] })),
      onToolStart: (toolStart) => {
        update((m) => {
          const currentCalls = m.toolCalls ? [...m.toolCalls] : [];
          const exists = currentCalls.some((c) =>
            toolStart.callId
              ? c.id === toolStart.callId || c.callId === toolStart.callId
              : c.name === toolStart.name && c.status === "running",
          );
          if (!exists) {
            const newItem: ChatToolCallItem = {
              id: toolStart.callId,
              callId: toolStart.callId,
              name: toolStart.name,
              status: "running",
              args: toolStart.args,
              target:
                toolStart.name === "mission_propose_approval"
                  ? `${toolStart.args.amountUsdc ?? ""} USDC with ${toolStart.args.counterpartyKey ?? ""}`
                  : toolStart.args && Object.keys(toolStart.args).length > 0
                    ? JSON.stringify(toolStart.args)
                    : undefined,
            };
            return {
              ...m,
              toolCalls: [...currentCalls, newItem],
            };
          }
          return m;
        });
      },
      onToolCall: (call) => {
        update((m) => {
          const currentCalls = m.toolCalls ? [...m.toolCalls] : [];
          const matchIdx = currentCalls.findIndex((c) =>
            call.id || call.callId
              ? (call.id && (c.id === call.id || c.callId === call.id)) ||
                (call.callId && (c.id === call.callId || c.callId === call.callId))
              : c.name === call.name && c.status === "running",
          );
          const hasError =
            call.result && typeof call.result === "object" && "error" in call.result;
          const status: ChatToolCallStatus = hasError ? "error" : "complete";
          const updatedItem: ChatToolCallItem = {
            id: call.id ?? call.callId,
            callId: call.callId ?? call.id,
            name: call.name,
            status,
            args: call.args,
            result: call.result,
            data: call.result,
            target:
              call.name === "mission_propose_approval"
                ? `${call.args?.amountUsdc ?? ""} USDC with ${call.args?.counterpartyKey ?? ""}`
                : call.args && Object.keys(call.args).length > 0
                  ? JSON.stringify(call.args)
                  : undefined,
          };
          if (matchIdx >= 0) {
            currentCalls[matchIdx] = updatedItem;
            return { ...m, toolCalls: currentCalls };
          }
          return {
            ...m,
            toolCalls: [...currentCalls, updatedItem],
          };
        });
      },
      onState: setConnection,
      onDone: () => {
        end();
        update((m) => ({ ...m, complete: true }));
        setConnection({ kind: "idle" });
        setLiveId(null);
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

    // Not a command, so it is a question. Questions need a Run to be about and
    // an agent to answer them; without either the console says so rather than
    // producing something that reads like an answer.
    const canAskWithoutRun = Boolean(grounding?.agentReachable && grounding?.memoryReachable);
    if (!runId && !canAskWithoutRun) {
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
      density="compact"
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

  const zeroState = <ConsoleChatSuggestions onOffer={offer} runId={runId} />;

  return (
    <VStack gap={4} height="100%">
      {/* Every band except the transcript keeps its natural height. In a
          height-constrained column they were all shrinkable flex items, so the
          banner was compressed below its own text and the overflow drew on top
          of the block beneath it — an 18px overlap at 1500x1000. The transcript
          is the one thing that should absorb the leftover space and scroll. */}
      <StackItem>
        <VStack gap={1}>
          <div className="cs__chat-scope-wrap flex items-center text-sm text-neutral-400 max-w-full overflow-hidden">
            {runId ? (
              <MonoRef label={console_.chat.scopeLabel}>{runId}</MonoRef>
            ) : (
              console_.chat.noScope
            )}
          </div>
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
                  color="gray"
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
            const body = live ? (streamText || message.text) : message.text;
            const pending =
              message.role === "agent" && body === ""
                ? connection.kind === "unavailable"
                  ? console_.chat.unavailableBody
                  : console_.chat.connecting
                : null;

            const renderBody = () => {
              if (message.role === "agent") {
                if (!message.complete) {
                  return (
                    <TextLoader
                      text={body}
                      variant="redact"
                      color="var(--color-text)"
                      paused={!live}
                    />
                  );
                }
                return (
                  <div className="cs__chat-markdown leading-relaxed text-sm text-[var(--color-text,#f4f7fb)]">
                    <Markdown density="compact" headingLevelStart={4}>
                      {body}
                    </Markdown>
                  </div>
                );
              }
              return <div className="leading-relaxed text-sm whitespace-pre-wrap">{body}</div>;
            };

            const renderPending = () => (
              <div className="flex items-center gap-2 py-1 px-1 text-xs text-[var(--color-text-secondary,#8d9aaf)]">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="font-mono text-xs">{pending}</span>
              </div>
            );

            const hasToolCalls =
              message.role === "agent" &&
              Boolean(message.toolCalls && message.toolCalls.length > 0);

            const normalizedToolCalls = hasToolCalls
              ? message.toolCalls!.map(normalizeToolCallItem)
              : undefined;

            const proposalCall = message.toolCalls?.find(
              (c) => c.name === "mission_propose_approval",
            );
            const isProposalReady =
              proposalCall &&
              proposalCall.status !== "running" &&
              proposalCall.status !== "error";
            const proposalCounterparty =
              (proposalCall?.args?.counterpartyKey as string) ??
              ((proposalCall?.result as Record<string, unknown> | undefined)?.counterpartyKey as string) ??
              "counterparty";
            const proposalAmount =
              (proposalCall?.args?.amountUsdc as string | number) ??
              ((proposalCall?.result as Record<string, unknown> | undefined)?.amountUsdc as string | number) ??
              "10.000000";
            const proposalRationale =
              (proposalCall?.args?.reason as string) ??
              ((proposalCall?.result as Record<string, unknown> | undefined)?.counterfactualRationale as string) ??
              "Mission spend authorization requested under guardrail limits.";
            const proposalRunId =
              runId ??
              (proposalCall?.args?.runId as string) ??
              ((proposalCall?.result as Record<string, unknown> | undefined)?.runId as string);

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
                    message.citations.length > 0 ? (
                      <HStack gap={1} wrap="wrap">
                        {message.citations.map((citation) => {
                          const index = sources.findIndex(
                            (s) =>
                              s.counterpartyKey === citation.counterpartyKey,
                          );
                          const citationNumber = index >= 0 ? index + 1 : 1;
                          const profileUrl = `/counterparties?key=${encodeURIComponent(citation.counterpartyKey)}`;
                          return (
                            <HoverCard
                              key={citation.counterpartyKey}
                              placement="above"
                              label="Memory Citation Preview"
                              content={
                                <CounterpartyMemoryHoverCard
                                   counterpartyKey={citation.counterpartyKey}
                                   displayName={citation.label}
                                   summary={citation.summary}
                                />
                              }
                            >
                              <Citation
                                variant="number"
                                number={citationNumber}
                                source={{
                                  title: citation.label,
                                  url: profileUrl,
                                }}
                              />
                            </HoverCard>
                          );
                        })}
                      </HStack>
                    ) : undefined
                  }
                >
                  {hasToolCalls && normalizedToolCalls ? (
                    <VStack gap={2} align="stretch">
                      <ChatToolCalls calls={normalizedToolCalls} />
                      {isProposalReady ? (
                        <ChatApprovalCard
                          counterpartyKey={proposalCounterparty}
                          amountUsdc={proposalAmount}
                          rationale={proposalRationale}
                          runId={proposalRunId}
                        />
                      ) : null}
                      {body ? renderBody() : pending ? renderPending() : null}
                    </VStack>
                  ) : isProposalReady ? (
                    <VStack gap={2} align="stretch">
                      <ChatApprovalCard
                        counterpartyKey={proposalCounterparty}
                        amountUsdc={proposalAmount}
                        rationale={proposalRationale}
                        runId={proposalRunId}
                      />
                      {body ? renderBody() : pending ? renderPending() : null}
                    </VStack>
                  ) : body ? (
                    renderBody()
                  ) : pending ? (
                    renderPending()
                  ) : null}
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

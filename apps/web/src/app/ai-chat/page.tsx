// Copyright (c) Meta Platforms, Inc. and affiliates.

'use client';

import { useCallback, useRef, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';

import {
  HStack,
  VStack,
  StackItem,
  Layout,
  LayoutContent,
} from '@astryxdesign/core/Layout';
import { Text, Heading } from '@astryxdesign/core/Text';
import {
  ChatComposer,
  ChatComposerInput,
  ChatLayout,
  ChatMessage as ChatMessageRow,
  ChatMessageBubble,
  ChatMessageList,
  ChatMessageMetadata,
  ChatSystemMessage,
  ChatTokenizedText,
  ChatToolCalls,
} from '@astryxdesign/core/Chat';
import { Avatar } from '@astryxdesign/core/Avatar';
import { Card } from '@astryxdesign/core/Card';
import { ClickableCard } from '@astryxdesign/core/ClickableCard';
import { Section } from '@astryxdesign/core/Section';
import { Markdown } from '@astryxdesign/core/Markdown';
import { Timestamp } from '@astryxdesign/core/Timestamp';
import { Button } from '@astryxdesign/core/Button';
import { Icon } from '@astryxdesign/core/Icon';
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog';
import { DropdownMenu } from '@astryxdesign/core/DropdownMenu';
import { MoreMenu } from '@astryxdesign/core/MoreMenu';
import { Toolbar } from '@astryxdesign/core/Toolbar';
import { useResizable, ResizeHandle } from '@astryxdesign/core/Resizable';
import { AppShell } from '@astryxdesign/core/AppShell';
import { Theme } from '@astryxdesign/core/theme';
import { stoneTheme } from '@/themes/stone/stone.js';
import { ConsoleNavigation } from '@/features/console/components/console-navigation';
import { ConsoleTopbar } from '@/features/console/components/console-topbar';
import { ConsoleChatSuggestions } from '@/features/console/components/console-chat-suggestions';
import { openChatStream, type ChatStreamHandle } from '@/features/console/chat/chat-transport';
import type { ChatConnection, ChatMessage, TokenUsage } from '@/features/console/chat/chat-types';
import { env } from '@/lib/env';
import { matchCommand } from '@/features/console/console-commands';

import {
  FileText,
  Copy,
  Share2,
  AtSign,
  Paperclip,
  X,
  ChevronRight,
  Sparkles,
  Cpu,
} from 'lucide-react';
import type { IconType } from '@astryxdesign/core/Icon';

const DocumentTextIcon = FileText as unknown as IconType;
const ClipboardDocumentIcon = Copy as unknown as IconType;
const ShareIcon = Share2 as unknown as IconType;
const AtSymbolIcon = AtSign as unknown as IconType;
const PaperClipIcon = Paperclip as unknown as IconType;
const XMarkIcon = X as unknown as IconType;
const ChevronRightIcon = ChevronRight as unknown as IconType;

// Below this width the split-pane collapses to a single chat column. Shared by
// the CSS container query and the JS check in openArtifact so they can't drift.
const MOBILE_MAX_WIDTH = 767;

const root: CSSProperties = {
  height: '100%',
  width: '100%',
  containerType: 'inline-size',
  containerName: 'artifact',
  backgroundColor: 'var(--color-canvas)',
  color: 'var(--color-text)',
  fontFamily: 'var(--font-sans)',
};
const chatColumn: CSSProperties = {
  flex: 1,
  width: '100%',
  minWidth: 0,
  height: '100%',
};
const chatLayout: CSSProperties = {
  flex: 1,
  minHeight: 0,
};
const artifactScroll: CSSProperties = {
  flex: 1,
  overflowY: 'auto',
};
const articleBody: CSSProperties = {
  maxWidth: 720,
  marginInline: 'auto',
};

// Runtime width for the artifact panel, passed in via the --artifact-panel-width
// custom property so the MOBILE container query can still override it to 100%
// (an inline `width` would beat the class rule).
const artifactPanelWidthVar = (size: number | string): CSSProperties =>
  ({
    '--artifact-panel-width': typeof size === 'number' ? `${size}px` : size,
  }) as CSSProperties;

const AI_CHAT_CSS = `
.ai-chat-root {
  background-color: var(--color-canvas);
  color: var(--color-text);
  height: 100%;
}
.astryx-chat-composer {
  transition: border-color 150ms ease, box-shadow 150ms ease;
}
.astryx-chat-composer:focus-within {
  border-color: var(--color-accent) !important;
  box-shadow: 0 0 0 1px var(--color-accent), 0 0 16px -4px rgba(243, 243, 245, 0.2) !important;
}
.astryx-chat-composer [contenteditable]:focus,
.astryx-chat-composer [contenteditable]:focus-visible,
.astryx-chat-composer-input [contenteditable]:focus,
.astryx-chat-composer-input [contenteditable]:focus-visible,
.astryx-chat-composer [role="textbox"]:focus,
.astryx-chat-composer [role="textbox"]:focus-visible,
.astryx-chat-composer textarea:focus,
.astryx-chat-composer textarea:focus-visible,
.astryx-chat-composer input:focus,
.astryx-chat-composer input:focus-visible {
  outline: none !important;
  box-shadow: none !important;
}

.ai-chat-resize-handle {
  display: flex;
  background-color: transparent;
  transition: background-color 150ms ease;
}
.ai-chat-resize-handle:hover {
  background-color: color-mix(in srgb, var(--color-accent) 20%, transparent);
}
.ai-chat-artifact-panel {
  overflow: hidden;
  display: flex;
  flex-direction: column;
  width: var(--artifact-panel-width);
  flex-shrink: 0;
  background-color: var(--color-surface);
  border-left: 1px solid var(--color-border);
}
.ai-chat-artifact-body {
  padding: var(--space-6) var(--space-8);
}
.ai-chat-artifact-body h1,
.ai-chat-artifact-body h2,
.ai-chat-artifact-body h3 {
  color: var(--color-text);
  font-family: var(--font-sans);
  letter-spacing: -0.01em;
}
.ai-chat-artifact-body p,
.ai-chat-artifact-body li {
  color: var(--color-text);
  line-height: 1.6;
}
.ai-chat-artifact-body table {
  width: 100%;
  border-collapse: collapse;
  margin-block: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  overflow: hidden;
}
.ai-chat-artifact-body th {
  background-color: var(--color-surface-raised);
  color: var(--color-text);
  padding: var(--space-2) var(--space-3);
  text-align: left;
  font-size: var(--text-sm);
  border-bottom: 1px solid var(--color-border);
}
.ai-chat-artifact-body td {
  padding: var(--space-2) var(--space-3);
  border-bottom: 1px solid var(--color-border);
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}
.ai-chat-artifact-body code {
  font-family: var(--font-mono);
  font-size: 0.85em;
  background-color: var(--color-surface-raised);
  color: var(--color-accent);
  padding: 0.15em 0.35em;
  border-radius: 4px;
}
.ai-chat-artifact-card {
  background-color: var(--color-surface-raised) !important;
  border: 1px solid var(--color-border) !important;
  border-radius: var(--radius-md) !important;
  transition: border-color 150ms ease, box-shadow 150ms ease !important;
}
.ai-chat-artifact-card:hover {
  border-color: var(--color-accent) !important;
  box-shadow: 0 0 12px rgba(243, 243, 245, 0.15) !important;
}
.ai-chat-artifact-card-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: var(--radius-sm);
  background-color: rgba(243, 243, 245, 0.1);
  color: var(--color-accent);
}
@container artifact (max-width: ${MOBILE_MAX_WIDTH}px) {
  .ai-chat-resize-handle {
    display: none;
  }
  .ai-chat-artifact-panel {
    display: none;
    width: 100%;
    flex-shrink: 1;
  }
}

/* Thought Process Card */
.ai-chat-thought-card {
  margin-block: var(--space-2);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  overflow: hidden;
  max-width: 600px;
}
.ai-chat-thought-header {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-2) var(--space-3);
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--color-text-secondary);
  font-size: var(--text-supporting-size);
  font-family: inherit;
  transition: background-color 150ms ease, color 150ms ease;
}
.ai-chat-thought-header:hover {
  background: rgba(255, 255, 255, 0.03);
  color: var(--color-text);
}
.ai-chat-thought-badge {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
.ai-chat-thought-pulse {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--color-accent);
  box-shadow: 0 0 8px var(--color-accent);
  animation: aiPulse 1.4s ease-in-out infinite alternate;
}
@keyframes aiPulse {
  0% { opacity: 0.3; transform: scale(0.85); }
  100% { opacity: 1; transform: scale(1.15); }
}
.ai-chat-thought-spark {
  color: var(--color-accent);
}
.ai-chat-thought-label {
  font-weight: 500;
  letter-spacing: -0.01em;
}
.ai-chat-thought-arrow {
  color: var(--color-text-tertiary);
  transition: transform 180ms cubic-bezier(0.16, 1, 0.3, 1);
}
.ai-chat-thought-arrow.is-expanded {
  transform: rotate(90deg);
}
.ai-chat-thought-body {
  padding: var(--space-3) var(--space-4);
  border-top: 1px solid var(--color-border);
  font-size: var(--text-supporting-size);
  line-height: 1.5;
  color: var(--color-text-secondary);
  background: color-mix(in srgb, var(--color-canvas) 40%, transparent);
}

/* Token Meter */
.ai-chat-token-meter {
  padding: 6px var(--space-4);
  border-bottom: 1px solid var(--color-border);
  background: color-mix(in srgb, var(--color-surface) 65%, transparent);
  backdrop-filter: blur(12px);
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.ai-chat-token-stats {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  font-size: 11px;
  color: var(--color-text-secondary);
}
.ai-chat-token-item {
  display: flex;
  align-items: center;
  gap: 5px;
}
.ai-chat-token-icon {
  color: var(--color-accent);
}
.ai-chat-token-model {
  font-weight: 600;
  color: var(--color-text);
  letter-spacing: -0.01em;
}
.ai-chat-token-divider {
  width: 1px;
  height: 10px;
  background: var(--color-border);
}
.ai-chat-token-metric {
  color: var(--color-text);
}
.ai-chat-token-sub {
  color: var(--color-text-tertiary);
}
.ai-chat-token-pct {
  color: var(--color-text-tertiary);
  font-family: var(--font-mono);
}
.ai-chat-token-bar-track {
  width: 100%;
  height: 2px;
  background: color-mix(in srgb, var(--color-border) 60%, transparent);
  border-radius: 999px;
  overflow: hidden;
}
.ai-chat-token-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #8c8c94, #d8d8db);
  border-radius: 999px;
  transition: width 300ms ease;
}
.ai-chat-turn-tokens {
  display: inline-flex;
  align-items: center;
  padding: 1px 6px;
  border-radius: var(--radius-sm);
  background: var(--color-surface-raised);
  border: 1px solid var(--color-border);
  font-size: 10px;
  font-family: var(--font-mono);
  color: var(--color-text-secondary);
  margin-left: var(--space-2);
}
`;

// Artifact content

const MENTION_TOKENS = [
  { value: '@agent', label: '@Agent', variant: 'neutral' as const },
];

const ARTIFACT_TITLE = 'JWT Token Refresh: Design & Rollout';
const ARTIFACT_SUBTITLE = 'Document · Updated just now';
const ARTIFACT_CONTENT = `## Overview

Our API gateway authenticates every request with a short-lived JWT access token. Until now, an expired token meant an immediate \`401\` — even when the user still held a valid refresh token. This document describes the silent-refresh flow we just shipped and how we're rolling it out.

## The Problem

Token validation ran **before** any refresh logic, so the middleware rejected expired tokens outright:

1. A request arrives with an expired access token
2. \`validateToken()\` throws \`TokenExpiredError\`
3. The catch block returns \`401\` — \`refreshToken()\` is never reached

The result was users getting logged out whenever an access token lapsed mid-session.

## The Fix

The middleware now catches \`TokenExpiredError\` specifically and attempts a silent refresh before rejecting. On success it reissues an access token and continues the request; on failure it falls back to \`401\`.

- **Transparent** — valid sessions never see an interruption
- **Safe** — a missing or invalid refresh token still returns \`401\`
- **Cheap** — refresh only runs on the expiry path, not on every request

## Testing

The refresh path is covered end to end:

| Scenario | Expected |
|----------|----------|
| Valid token passes through | \`200\` |
| Expired token, valid refresh | \`200\` + new access token |
| Expired token, invalid refresh | \`401\` |
| Malformed token | \`401\` |

## Rollout & Monitoring

1. Ship behind the \`silent_refresh\` flag at 5% of traffic
2. Watch the \`auth.refresh.success\` and \`auth.refresh.failure\` counters
3. Alert if the failure rate exceeds **2%** over any 5-minute window
4. Ramp to 100% once metrics hold steady for 24 hours`;

// Artifact subviews

function ArtifactActions({ onClose }: { onClose?: () => void }) {
  return (
    <>
      <DropdownMenu
        button={{
          label: 'v2',
          variant: 'ghost',
          size: 'sm',
        }}
        items={[{ label: 'v2 (current)' }, { label: 'v1' }]}
      />
      <Button
        label="Copy"
        variant="ghost"
        size="sm"
        icon={<Icon icon={ClipboardDocumentIcon} size="sm" />}
        isIconOnly
      />
      <Button
        label="Share"
        variant="ghost"
        size="sm"
        icon={<Icon icon={ShareIcon} size="sm" />}
        isIconOnly
      />
      {onClose != null && (
        <Button
          label="Close document"
          variant="ghost"
          size="sm"
          icon={<Icon icon={XMarkIcon} size="sm" />}
          isIconOnly
          onClick={onClose}
        />
      )}
    </>
  );
}

function MobileArtifactActions() {
  return (
    <MoreMenu
      label="Document actions"
      size="sm"
      items={[
        {
          type: 'section',
          title: 'Version',
          items: [
            { label: 'v2 (current)', onClick: () => {} },
            { label: 'v1', onClick: () => {} },
          ],
        },
        { type: 'divider' },
        { label: 'Copy', icon: <Copy size={16} /> },
        { label: 'Share', icon: <Share2 size={16} /> },
      ]}
    />
  );
}

function ArtifactBody() {
  return (
    <Section variant="transparent" style={artifactScroll} className="ai-chat-artifact-body">
      <VStack gap={2} style={articleBody}>
        <Heading level={1}>{ARTIFACT_TITLE}</Heading>
        <Markdown>{ARTIFACT_CONTENT}</Markdown>
      </VStack>
    </Section>
  );
}

function ArtifactCard({ onOpen }: { onOpen: () => void }) {
  return (
    <ClickableCard
      label={`Open ${ARTIFACT_TITLE}`}
      onClick={onOpen}
      variant="muted"
      padding={3}
      maxWidth={360}
      className="ai-chat-artifact-card"
    >
      <HStack gap={3} vAlign="center" width="100%">
        <div className="ai-chat-artifact-card-icon">
          <Icon icon={DocumentTextIcon} size="md" color="inherit" />
        </div>
        <StackItem size="fill">
          <VStack gap={0}>
            <Text type="label" weight="semibold">
              {ARTIFACT_TITLE}
            </Text>
            <Text type="supporting" color="secondary">
              Document
            </Text>
          </VStack>
        </StackItem>
        <Icon icon={ChevronRightIcon} size="sm" color="secondary" />
      </HStack>
    </ClickableCard>
  );
}

function ThinkingProcessCard({
  thought,
  isStreaming,
}: {
  thought: string;
  isStreaming?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="ai-chat-thought-card">
      <button
        type="button"
        className="ai-chat-thought-header"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
      >
        <span className="ai-chat-thought-badge">
          {isStreaming ? (
            <span className="ai-chat-thought-pulse" />
          ) : (
            <Sparkles size={13} className="ai-chat-thought-spark" />
          )}
          <span className="ai-chat-thought-label">
            {isStreaming ? 'Reasoning in progress...' : 'Thought process'}
          </span>
        </span>
        <ChevronRight
          size={14}
          className={`ai-chat-thought-arrow ${isOpen ? 'is-expanded' : ''}`}
        />
      </button>
      {isOpen && (
        <div className="ai-chat-thought-body">
          <Markdown density="compact">{thought}</Markdown>
        </div>
      )}
    </div>
  );
}

function TokenMeter({ usage }: { usage: TokenUsage }) {
  const maxContext = 1048576; // 1M context window for Gemini 2.5 Flash
  const percent = Math.min(100, Math.max(0.01, (usage.totalTokens / maxContext) * 100));

  return (
    <div className="ai-chat-token-meter">
      <div className="ai-chat-token-stats">
        <div className="ai-chat-token-item">
          <Cpu size={13} className="ai-chat-token-icon" />
          <span className="ai-chat-token-model">Gemini 2.5 Flash</span>
        </div>
        <div className="ai-chat-token-divider" />
        <div className="ai-chat-token-item">
          <span className="ai-chat-token-metric">
            <strong>{usage.totalTokens.toLocaleString()}</strong> tokens
          </span>
          <span className="ai-chat-token-sub">
            ({usage.promptTokens.toLocaleString()} prompt · {usage.candidateTokens.toLocaleString()} gen)
          </span>
        </div>
        <div className="ai-chat-token-divider" />
        <div className="ai-chat-token-item">
          <span className="ai-chat-token-pct">{percent.toFixed(2)}% of 1M context</span>
        </div>
      </div>
      <div className="ai-chat-token-bar-track">
        <div
          className="ai-chat-token-bar-fill"
          style={{ width: `${Math.max(percent, 0.4)}%` }}
        />
      </div>
    </div>
  );
}

// Initial demo message seeds so the conversation starts rich and informative
const INITIAL_DEMO_MESSAGES: ChatMessage[] = [
  {
    id: 'demo-user-1',
    role: 'operator',
    text: '@agent Can you review these auth files? The JWT refresh logic seems broken — tokens expire but the middleware doesn&apos;t catch it.',
    complete: true,
    citations: [],
  },
  {
    id: 'demo-agent-1',
    role: 'agent',
    text: `Found the issue. In \`middleware.ts\`, the token validation runs **before** the refresh check. When a token expires, the middleware rejects the request immediately instead of attempting a refresh.\n\nHere's the problematic sequence:\n1. Request arrives with an expired access token\n2. \`validateToken()\` throws \`TokenExpiredError\`\n3. The catch block returns \`401\` — never reaching \`refreshToken()\`\n\nThe fix is to catch \`TokenExpiredError\` specifically and attempt a refresh before rejecting.\n\nI have drafted a design and rollout doc. You can open the artifact on the right to review it.`,
    thought: `1. Analyzed operator inquiry regarding JWT expiration and middleware failure.\n2. Read auth-service.ts and middleware.ts token interception flows.\n3. Identified ordering bug: validateToken() executed before refreshToken().\n4. Formulated architecture fix and generated rollout artifact.`,
    usage: {
      promptTokens: 840,
      candidateTokens: 440,
      totalTokens: 1280,
    },
    complete: true,
    citations: [],
    toolCalls: [
      { name: 'read', args: { target: 'auth-service.ts' } },
      { name: 'read', args: { target: 'middleware.ts' } },
      { name: 'bash', args: { command: 'grep -rn "refreshToken" src/' } },
    ],
  },
];

// Main component

export default function AIChatConversationTemplate() {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_DEMO_MESSAGES);
  const [sessionUsage, setSessionUsage] = useState<TokenUsage>({
    promptTokens: 840,
    candidateTokens: 440,
    totalTokens: 1280,
  });
  const [draft, setDraft] = useState('');
  const [connection, setConnection] = useState<ChatConnection>({ kind: 'idle' });
  const [composerMode, setComposerMode] = useState('ask');
  const [isArtifactDialogOpen, setIsArtifactDialogOpen] = useState(false);
  const [isArtifactOpen, setIsArtifactOpen] = useState(true);

  const rootRef = useRef<HTMLDivElement>(null);
  const counterRef = useRef(0);
  const handleRef = useRef<ChatStreamHandle | null>(null);

  const busy = connection.kind === 'connecting' || connection.kind === 'streaming';

  const artifactResize = useResizable({
    defaultSize: 640,
    minSizePx: 480,
    maxSizePx: 960,
    autoSaveId: 'ai-chat-artifact-panel',
  });

  const openArtifact = () => {
    const width = rootRef.current?.offsetWidth ?? Infinity;
    if (width <= MOBILE_MAX_WIDTH) {
      setIsArtifactDialogOpen(true);
    } else {
      setIsArtifactOpen(true);
    }
  };

  const stop = useCallback(() => {
    handleRef.current?.close();
    handleRef.current = null;
    setConnection({ kind: 'idle' });
  }, []);

  const ask = useCallback(
    (question: string) => {
      counterRef.current += 1;
      const turn = counterRef.current;
      const agentId = `agent-${turn}`;
      setConnection({ kind: 'streaming' });

      setMessages((prev) => [
        ...prev,
        {
          id: `operator-${turn}`,
          role: 'operator',
          text: question,
          complete: true,
          citations: [],
        },
        {
          id: agentId,
          role: 'agent',
          text: '',
          complete: false,
          citations: [],
        },
      ]);

      const update = (change: (message: ChatMessage) => ChatMessage) =>
        setMessages((prev) =>
          prev.map((m) => (m.id === agentId ? change(m) : m)),
        );

      handleRef.current?.close();
      const chatUrl = `${env.NEXT_PUBLIC_API_URL}/api/chat?q=${encodeURIComponent(question)}`;

      handleRef.current = openChatStream({
        url: chatUrl,
        onToken: (token) => {
          update((m) => ({ ...m, text: m.text + token }));
        },
        onCitation: (citation) => {
          update((m) => ({ ...m, citations: [...m.citations, citation] }));
        },
        onThought: (thought) => {
          update((m) => ({
            ...m,
            thought: (m.thought ? m.thought + '\n' : '') + thought,
          }));
        },
        onUsage: (usage) => {
          update((m) => ({ ...m, usage }));
          setSessionUsage((prev) => ({
            promptTokens: prev.promptTokens + usage.promptTokens,
            candidateTokens: prev.candidateTokens + usage.candidateTokens,
            totalTokens: prev.totalTokens + usage.totalTokens,
          }));
        },
        onToolCall: (toolCall) => {
          update((m) => ({
            ...m,
            toolCalls: [...(m.toolCalls ?? []), toolCall],
          }));
          if (toolCall.name === 'console_navigate' && typeof toolCall.args?.destination === 'string') {
            router.push(toolCall.args.destination);
          }
          if (toolCall.name === 'mission_propose_approval') {
            setIsArtifactOpen(true);
          }
        },
        onState: setConnection,
        onDone: () => {
          update((m) => ({ ...m, complete: true }));
          setConnection({ kind: 'idle' });
        },
      });
    },
    [router],
  );

  const submit = () => {
    const text = draft.trim();
    if (!text || busy) return;
    setDraft('');

    const command = matchCommand(text);
    if (command) {
      command.run((href) => router.push(href));
      setMessages((prev) => [
        ...prev,
        {
          id: `operator-${Date.now()}`,
          role: 'operator',
          text,
          complete: true,
          citations: [],
        },
        {
          id: `console-${Date.now()}`,
          role: 'console',
          text: command.done(),
          complete: true,
          citations: [],
        },
      ]);
      return;
    }

    ask(text);
  };

  return (
    <Theme theme={stoneTheme} mode="dark">
      <AppShell
        height="fill"
        contentPadding={0}
        topNav={<ConsoleTopbar surface="Chat Console" readiness="ready" />}
        sideNav={<ConsoleNavigation surface="Chat Console" />}
      >
        <div ref={rootRef} style={root} className="ai-chat-root">
          <style>{AI_CHAT_CSS}</style>
          <HStack height="100%">
            {/* Chat column — flexes to fill the space the artifact leaves */}
            <VStack style={chatColumn}>
              <TokenMeter usage={sessionUsage} />
              <ChatLayout
                density="spacious"
                style={chatLayout}
                composer={
                  <ChatComposer
                    value={draft}
                    onChange={setDraft}
                    onSubmit={submit}
                    onStop={stop}
                    isStopShown={busy}
                    placeholder={
                      composerMode === 'ask'
                        ? 'Ask ADK Gemini agent anything, execute MCP tools, or navigate...'
                        : 'Describe your edit...'
                    }
                    input={<ChatComposerInput hasHistory={false} />}
                    headerActions={
                      <>
                        <Button
                          label="Mention"
                          variant="ghost"
                          size="sm"
                          icon={<Icon icon={AtSymbolIcon} size="sm" />}
                          isIconOnly
                          onClick={() => setDraft((d) => (d ? `${d} @agent ` : '@agent '))}
                        />
                        <Button
                          label="Attach"
                          variant="ghost"
                          size="sm"
                          icon={<Icon icon={PaperClipIcon} size="sm" />}
                          isIconOnly
                          onClick={() => setDraft((d) => `${d} auth-service.ts `)}
                        />
                      </>
                    }
                    footerActions={
                      <DropdownMenu
                        button={{
                          label: composerMode === 'ask' ? 'Ask' : 'Edit',
                          variant: 'ghost',
                          size: 'sm',
                        }}
                        items={[
                          {
                            label: 'Ask',
                            onClick: () => setComposerMode('ask'),
                          },
                          {
                            label: 'Edit',
                            onClick: () => setComposerMode('edit'),
                          },
                        ]}
                      />
                    }
                  />
                }
              >
                <ChatMessageList
                  emptyState={<ConsoleChatSuggestions onOffer={(q) => setDraft(q)} />}
                  isStreaming={busy}
                  align="top"
                >
                  <ChatSystemMessage variant="divider">
                    Live ADK & MCP Session
                  </ChatSystemMessage>

                  {messages.map((message) => {
                    const isUser = message.role === 'operator';
                    const isConsole = message.role === 'console';

                    if (isConsole) {
                      return (
                        <ChatSystemMessage key={message.id}>
                          {message.text}
                        </ChatSystemMessage>
                      );
                    }

                    if (isUser) {
                      return (
                        <ChatMessageRow key={message.id} sender="user">
                          <ChatMessageBubble
                            metadata={
                              <ChatMessageMetadata
                                timestamp={
                                  <Timestamp
                                    value={new Date().toISOString()}
                                    format="time"
                                  />
                                }
                              />
                            }
                          >
                            <ChatTokenizedText tokens={MENTION_TOKENS}>
                              {message.text}
                            </ChatTokenizedText>
                          </ChatMessageBubble>
                        </ChatMessageRow>
                      );
                    }

                    return (
                      <ChatMessageRow
                        key={message.id}
                        sender="assistant"
                        avatar={<Avatar name="Agent" size="md" />}
                      >
                        {message.thought && (
                          <ChatMessageBubble variant="ghost" width="100%">
                            <ThinkingProcessCard
                              thought={message.thought}
                              isStreaming={busy && !message.complete}
                            />
                          </ChatMessageBubble>
                        )}

                        {message.toolCalls && message.toolCalls.length > 0 && (
                          <ChatToolCalls
                            defaultIsExpanded
                            calls={message.toolCalls.map((tc) => ({
                              name: tc.name,
                              target: String(
                                (tc.args?.target as string) ||
                                  (tc.args?.command as string) ||
                                  (tc.args?.destination as string) ||
                                  (tc.args?.counterpartyKey as string) ||
                                  tc.name,
                              ),
                              status: message.complete ? 'complete' : 'running',
                              duration: 'active',
                            }))}
                          />
                        )}

                        <ChatMessageBubble variant="ghost">
                          <Markdown density="compact">
                            {message.text || (busy && !message.complete ? 'Thinking...' : '')}
                          </Markdown>
                        </ChatMessageBubble>

                        {message.id === 'demo-agent-1' && (
                          <ChatMessageBubble variant="ghost" width="100%">
                            <ArtifactCard onOpen={openArtifact} />
                          </ChatMessageBubble>
                        )}

                        <ChatMessageMetadata
                          timestamp={
                            <Timestamp
                              value={new Date().toISOString()}
                              format="time"
                            />
                          }
                          footer={
                            <HStack gap={2} vAlign="center">
                              <Text type="supporting" color="secondary">
                                ADK Gemini Agent
                              </Text>
                              {message.usage && (
                                <span className="ai-chat-turn-tokens">
                                  {message.usage.totalTokens.toLocaleString()} tokens
                                </span>
                              )}
                            </HStack>
                          }
                        />
                      </ChatMessageRow>
                    );
                  })}
                </ChatMessageList>
              </ChatLayout>
            </VStack>

            {/* Desktop split-pane: resize handle + artifact panel */}
            {isArtifactOpen && (
              <>
                <ResizeHandle
                  direction="horizontal"
                  resizable={artifactResize.props}
                  isReversed
                  pillPlacement="start"
                  hasDivider
                  label="Resize artifact panel"
                  className="ai-chat-resize-handle"
                />

                <Card
                  variant="transparent"
                  height="100%"
                  className="ai-chat-artifact-panel"
                  style={artifactPanelWidthVar(artifactResize.size)}
                >
                  <Toolbar
                    label="Artifact actions"
                    dividers={['bottom']}
                    startContent={
                      <HStack gap={3} vAlign="center">
                        <Icon
                          icon={DocumentTextIcon}
                          size="sm"
                          color="secondary"
                        />
                        <VStack gap={0}>
                          <Text type="label" weight="semibold">
                            {ARTIFACT_TITLE}
                          </Text>
                          <Text type="supporting" color="secondary">
                            {ARTIFACT_SUBTITLE}
                          </Text>
                        </VStack>
                      </HStack>
                    }
                    endContent={
                      <ArtifactActions
                        onClose={() => setIsArtifactOpen(false)}
                      />
                    }
                  />

                  <ArtifactBody />
                </Card>
              </>
            )}
          </HStack>
        </div>
      </AppShell>

      {/* Mobile artifact view — full-screen Dialog */}
      <Dialog
        isOpen={isArtifactDialogOpen}
        onOpenChange={setIsArtifactDialogOpen}
        purpose="info"
        variant="fullscreen"
      >
        <Layout
          header={
            <DialogHeader
              title={ARTIFACT_TITLE}
              subtitle={ARTIFACT_SUBTITLE}
              hasDivider
              onOpenChange={setIsArtifactDialogOpen}
              endContent={<MobileArtifactActions />}
            />
          }
          content={
            <LayoutContent padding={0}>
              <ArtifactBody />
            </LayoutContent>
          }
        />
      </Dialog>
    </Theme>
  );
}

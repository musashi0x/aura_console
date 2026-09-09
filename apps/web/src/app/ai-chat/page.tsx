// Copyright (c) Meta Platforms, Inc. and affiliates.

'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
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
  ThinkingState,
  StreamingText,
  ToolChips,
  ApprovalCard,
  MissionCard,
  NavigationCard,
  DiffTable,
  RecordsTable,
  InteractionSounds,
  SoundToggle,
  playInteractionSound,
} from '@/components/primitives';

import {
  FileText,
  Copy,
  Share2,
  X,
  ChevronRight,
  Cpu,
  AtSign,
  Paperclip,
  Sparkles,
  RotateCcw,
  Plus,
} from 'lucide-react';
import type { IconType } from '@astryxdesign/core/Icon';

const DocumentTextIcon = FileText as unknown as IconType;
const ClipboardDocumentIcon = Copy as unknown as IconType;
const ShareIcon = Share2 as unknown as IconType;
const XMarkIcon = X as unknown as IconType;
const ChevronRightIcon = ChevronRight as unknown as IconType;
const AtSymbolIcon = AtSign as unknown as IconType;
const PaperClipIcon = Paperclip as unknown as IconType;
const PlusIcon = Plus as unknown as IconType;

const DEFAULT_SUGGESTIONS = [
  { label: 'Why hire Beta Labs?', query: 'Why should we hire Beta Labs and what would it cost to draft a 10 USDC spend?' },
  { label: 'Recall memory', query: 'Recall counterparty memory for virtuals:agent:beta' },
  { label: 'Check spend guardrail', query: 'Check current active spend limit and remaining budget' },
  { label: 'Go to missions', query: 'go to missions' },
];

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

function ChatSidebarContext({
  scope,
  onScopeChange,
  onSelectMission,
}: {
  scope: 'global' | 'mission';
  onScopeChange: (scope: 'global' | 'mission') => void;
  onSelectMission?: (missionId: string) => void;
}) {
  return (
    <div className="p-3 border-b border-[rgba(216,216,219,0.12)] flex flex-col gap-2.5">
      <div className="flex items-center p-0.5 rounded-[8px] bg-[#111015] border border-[rgba(216,216,219,0.16)] text-[11.5px]">
        <button
          type="button"
          onClick={() => onScopeChange('global')}
          data-sound="press"
          className={`flex-1 py-1 px-2 rounded-[6px] text-center font-medium transition-colors ${
            scope === 'global'
              ? 'bg-[#25252a] text-[#f4f7fb] shadow-sm'
              : 'text-[var(--color-text-muted,#8d9aaf)] hover:text-[#f4f7fb]'
          }`}
        >
          Global Assistant
        </button>
        <button
          type="button"
          onClick={() => onScopeChange('mission')}
          data-sound="press"
          className={`flex-1 py-1 px-2 rounded-[6px] text-center font-medium transition-colors ${
            scope === 'mission'
              ? 'bg-[#25252a] text-[#f4f7fb] shadow-sm'
              : 'text-[var(--color-text-muted,#8d9aaf)] hover:text-[#f4f7fb]'
          }`}
        >
          Mission Scoped
        </button>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--color-text-muted,#8d9aaf)] px-1">
          Recent Missions
        </span>
        {[
          { id: 'm-01', title: 'Beta Labs Onboarding', active: true },
          { id: 'm-02', title: 'Base Sepolia Registry', active: false },
          { id: 'm-03', title: 'Treasury Spend Limit', active: false },
        ].map((m) => (
          <button
            key={m.id}
            type="button"
            data-sound="press"
            onClick={() => onSelectMission?.(m.id)}
            className={`flex items-center justify-between px-2 py-1 rounded-[6px] text-left text-[11px] transition-colors ${
              m.active
                ? 'bg-[#1b1b1f] text-[#f4f7fb] font-medium'
                : 'text-[var(--color-text-muted,#8d9aaf)] hover:bg-[#1b1b1f] hover:text-[#f4f7fb]'
            }`}
          >
            <span className="truncate">{m.title}</span>
            <span className="text-[9px] font-mono opacity-60 ml-1">{m.id}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function TokenMeter({ usage, onNewChat }: { usage: TokenUsage; onNewChat?: () => void }) {
  const maxContext = 1048576; // 1M context window for Gemini 3.5 Flash
  const percent = Math.min(100, Math.max(0.01, (usage.totalTokens / maxContext) * 100));

  return (
    <div className="ai-chat-token-meter">
      <div className="ai-chat-token-stats">
        <div className="ai-chat-token-item">
          <Cpu size={13} className="ai-chat-token-icon" />
          <span className="ai-chat-token-model">Gemini 3.5 Flash</span>
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
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
          {onNewChat && (
            <button
              type="button"
              onClick={onNewChat}
              data-sound="press"
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium text-[var(--color-text-muted,#8d9aaf)] hover:text-[#f4f7fb] hover:bg-[rgba(255,255,255,0.06)] border border-transparent hover:border-[rgba(216,216,219,0.12)] transition-colors cursor-pointer"
              title="Start a new chat and reset session"
            >
              <RotateCcw size={11} />
              <span>New Chat</span>
            </button>
          )}
          <SoundToggle variant="pill" />
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

const STORAGE_KEY_MESSAGES = 'aura:ai-chat:messages:v2';
const STORAGE_KEY_USAGE = 'aura:ai-chat:usage:v2';

export default function AIChatConversationTemplate() {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    if (typeof window === 'undefined') return INITIAL_DEMO_MESSAGES;
    try {
      const stored = localStorage.getItem(STORAGE_KEY_MESSAGES);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // Ignore storage parse errors
    }
    return INITIAL_DEMO_MESSAGES;
  });

  const [sessionUsage, setSessionUsage] = useState<TokenUsage>(() => {
    if (typeof window === 'undefined') {
      return { promptTokens: 840, candidateTokens: 440, totalTokens: 1280 };
    }
    try {
      const storedUsage = localStorage.getItem(STORAGE_KEY_USAGE);
      if (storedUsage) {
        const parsedUsage = JSON.parse(storedUsage);
        if (parsedUsage && typeof parsedUsage.totalTokens === 'number') {
          return parsedUsage;
        }
      }
    } catch {
      // Ignore storage parse errors
    }
    return { promptTokens: 840, candidateTokens: 440, totalTokens: 1280 };
  });
  const [draft, setDraft] = useState('');
  const [composerMode, setComposerMode] = useState<'ask' | 'edit'>('ask');
  const [connection, setConnection] = useState<ChatConnection>({ kind: 'idle' });
  const [chatScope, setChatScope] = useState<'global' | 'mission'>('global');
  const [artifactTab, setArtifactTab] = useState<'document' | 'diffs' | 'records'>('document');
  const [isArtifactDialogOpen, setIsArtifactDialogOpen] = useState(false);
  const [isArtifactOpen, setIsArtifactOpen] = useState(true);

  const rootRef = useRef<HTMLDivElement>(null);
  const counterRef = useRef(messages.length);
  const handleRef = useRef<ChatStreamHandle | null>(null);

  const busy = connection.kind === 'connecting' || connection.kind === 'streaming';

  const artifactResize = useResizable({
    defaultSize: 640,
    minSizePx: 480,
    maxSizePx: 960,
    autoSaveId: 'ai-chat-artifact-panel',
  });

  // Save messages to localStorage on change
  useEffect(() => {
    try {
      if (messages === INITIAL_DEMO_MESSAGES) {
        localStorage.removeItem(STORAGE_KEY_MESSAGES);
      } else {
        localStorage.setItem(STORAGE_KEY_MESSAGES, JSON.stringify(messages));
      }
    } catch (e) {
      console.warn('Failed to save messages to localStorage', e);
    }
  }, [messages]);

  // Save session usage to localStorage on change
  useEffect(() => {
    try {
      if (messages === INITIAL_DEMO_MESSAGES) {
        localStorage.removeItem(STORAGE_KEY_USAGE);
      } else {
        localStorage.setItem(STORAGE_KEY_USAGE, JSON.stringify(sessionUsage));
      }
    } catch (e) {
      console.warn('Failed to save session usage to localStorage', e);
    }
  }, [sessionUsage, messages]);

  const openArtifact = () => {
    setArtifactTab('document');
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

  const handleNewChat = useCallback(() => {
    playInteractionSound('release');
    stop();
    setMessages(INITIAL_DEMO_MESSAGES);
    setSessionUsage({
      promptTokens: 840,
      candidateTokens: 440,
      totalTokens: 1280,
    });
    try {
      localStorage.removeItem(STORAGE_KEY_MESSAGES);
      localStorage.removeItem(STORAGE_KEY_USAGE);
    } catch {
      // Ignore storage errors on clear
    }
  }, [stop]);

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
          if (toolCall.name === 'mission_propose_approval') {
            setIsArtifactOpen(true);
            setArtifactTab('diffs');
          }
        },
        onState: setConnection,
        onDone: () => {
          update((m) => ({ ...m, complete: true }));
          setConnection({ kind: 'idle' });
        },
      });
    },
    [],
  );

  const submit = (overrideText?: string) => {
    const text = (overrideText ?? draft).trim();
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
      <InteractionSounds />
      <AppShell
        height="fill"
        contentPadding={0}
        topNav={
          <ConsoleTopbar
            surface="Chat Console"
            readiness="ready"
            actions={
              <HStack gap={2} vAlign="center">
                <Button
                  label="New Chat"
                  variant="ghost"
                  size="sm"
                  icon={<Icon icon={PlusIcon} size="sm" />}
                  onClick={handleNewChat}
                />
                <SoundToggle variant="icon" />
              </HStack>
            }
          />
        }
        sideNav={
          <ConsoleNavigation
            surface="Chat Console"
            contextSelector={
              <ChatSidebarContext
                scope={chatScope}
                onScopeChange={setChatScope}
              />
            }
          />
        }
      >
        <div ref={rootRef} style={root} className="ai-chat-root">
          <style>{AI_CHAT_CSS}</style>
          <HStack height="100%">
            {/* Chat column — flexes to fill the space the artifact leaves */}
            <VStack style={chatColumn}>
              <TokenMeter usage={sessionUsage} onNewChat={handleNewChat} />
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
                    drawer={
                      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar px-1 py-1.5">
                        {DEFAULT_SUGGESTIONS.map((s, i) => (
                          <button
                            key={i}
                            type="button"
                            data-sound="press"
                            onClick={() => {
                              playInteractionSound('press');
                              setDraft(s.query);
                            }}
                            className="flex items-center gap-1 shrink-0 px-2.5 py-1 rounded-[6px] text-[11.5px] bg-[#25252a] hover:bg-[#2e2d35] border border-[rgba(216,216,219,0.12)] text-[#d8d8db] hover:text-[#f4f7fb] transition-colors cursor-pointer"
                          >
                            <Sparkles size={11} className="text-[#d8d8db]" />
                            <span>{s.label}</span>
                          </button>
                        ))}
                      </div>
                    }
                    headerActions={
                      <>
                        <Button
                          label="Mention"
                          variant="ghost"
                          size="sm"
                          icon={<Icon icon={AtSymbolIcon} size="sm" />}
                          isIconOnly
                          onClick={() => {
                            playInteractionSound('press');
                            setDraft((d) => (d ? `${d} @agent ` : '@agent '));
                          }}
                        />
                        <Button
                          label="Attach"
                          variant="ghost"
                          size="sm"
                          icon={<Icon icon={PaperClipIcon} size="sm" />}
                          isIconOnly
                          onClick={() => {
                            playInteractionSound('press');
                            setDraft((d) => `${d} auth-service.ts `);
                          }}
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
                            onClick: () => {
                              playInteractionSound('press');
                              setComposerMode('ask');
                            },
                          },
                          {
                            label: 'Edit',
                            onClick: () => {
                              playInteractionSound('press');
                              setComposerMode('edit');
                            },
                          },
                        ]}
                      />
                    }
                    sendActions={<SoundToggle variant="icon" />}
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
                                status="delivered"
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
                            <ThinkingState
                              thought={message.thought}
                              isStreaming={busy && !message.complete}
                            />
                          </ChatMessageBubble>
                        )}

                        {message.toolCalls && message.toolCalls.length > 0 && (
                          <div className="w-full flex flex-col gap-2">
                            <ToolChips
                              calls={message.toolCalls}
                              isComplete={message.complete}
                              defaultExpanded={true}
                            />
                            {message.toolCalls.map((tc, idx) => {
                              if (tc.name === 'mission_create') {
                                const res = tc.result as Record<string, unknown> | undefined;
                                const runId =
                                  (res?.runId as string) ||
                                  (tc.args?.runId as string) ||
                                  'created-mission';
                                const obj =
                                  (res?.objective as string) ||
                                  (tc.args?.objective as string) ||
                                  'Autonomous agent mission executed via MCP';
                                const budget =
                                  (res?.budgetUsdc as string) ||
                                  (tc.args?.budgetUsdc as string) ||
                                  '25.00';
                                const src =
                                  (res?.source as string) ||
                                  (tc.args?.source as string) ||
                                  'AGENT';
                                const dest =
                                  (res?.destination as string) || `/runs/${runId}`;
                                return (
                                  <MissionCard
                                    key={`mission-${idx}-${runId}`}
                                    runId={runId}
                                    objective={obj}
                                    budgetUsdc={budget}
                                    source={src}
                                    destination={dest}
                                    onNavigate={(d) => router.push(d)}
                                  />
                                );
                              }
                              if (
                                tc.name === 'console_navigate' &&
                                typeof tc.args?.destination === 'string'
                              ) {
                                return (
                                  <NavigationCard
                                    key={`nav-${idx}-${tc.args.destination}`}
                                    destination={tc.args.destination}
                                    onNavigate={(d) => router.push(d)}
                                  />
                                );
                              }
                              if (tc.name === 'mission_propose_approval') {
                                return (
                                  <ApprovalCard
                                    key={`approval-${idx}`}
                                    runId="demo-run-1"
                                    counterpartyKey={
                                      (tc.args?.counterpartyKey as string) ||
                                      'virtuals:agent:beta'
                                    }
                                    amountUsdc={
                                      (tc.args?.amountUsdc as string) || '10.00'
                                    }
                                    reason={
                                      (tc.args?.reason as string) ||
                                      'Draft exploratory research engagement under active guardrail limits'
                                    }
                                  />
                                );
                              }
                              return null;
                            })}
                          </div>
                        )}

                        <ChatMessageBubble variant="ghost" width="100%">
                          <StreamingText
                            text={message.text || (busy && !message.complete ? 'Thinking...' : '')}
                            isStreaming={busy && !message.complete}
                            sources={message.citations?.map((c) => ({
                              name: c.label,
                              domain: c.counterpartyKey,
                            }))}
                            onFollowUp={(prompt) => ask(prompt)}
                          />
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
                          status={busy && !message.complete ? 'sending' : 'sent'}
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
                            {artifactTab === 'document'
                              ? ARTIFACT_TITLE
                              : artifactTab === 'diffs'
                              ? 'Memory State & Ledger Diffs'
                              : 'Sibyl Counterparty Ledger'}
                          </Text>
                          <Text type="supporting" color="secondary">
                            {artifactTab === 'document'
                              ? ARTIFACT_SUBTITLE
                              : artifactTab === 'diffs'
                              ? 'Proposed state changes vs commit log'
                              : 'Historical relationship memory & reliability'}
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

                  {/* Tab Navigation */}
                  <div className="flex items-center gap-1 px-3 py-1.5 border-b border-[rgba(216,216,219,0.12)] bg-[#111015] text-[12px]">
                    <button
                      type="button"
                      onClick={() => setArtifactTab('document')}
                      data-sound="press"
                      className={`px-2.5 py-1 rounded-[6px] font-medium transition-colors ${
                        artifactTab === 'document'
                          ? 'bg-[#25252a] text-[#f4f7fb] shadow-sm'
                          : 'text-[var(--color-text-muted,#8d9aaf)] hover:text-[#f4f7fb]'
                      }`}
                    >
                      Document
                    </button>
                    <button
                      type="button"
                      onClick={() => setArtifactTab('diffs')}
                      data-sound="press"
                      className={`px-2.5 py-1 rounded-[6px] font-medium transition-colors ${
                        artifactTab === 'diffs'
                          ? 'bg-[#25252a] text-[#f4f7fb] shadow-sm'
                          : 'text-[var(--color-text-muted,#8d9aaf)] hover:text-[#f4f7fb]'
                      }`}
                    >
                      Memory Diffs
                    </button>
                    <button
                      type="button"
                      onClick={() => setArtifactTab('records')}
                      data-sound="press"
                      className={`px-2.5 py-1 rounded-[6px] font-medium transition-colors ${
                        artifactTab === 'records'
                          ? 'bg-[#25252a] text-[#f4f7fb] shadow-sm'
                          : 'text-[var(--color-text-muted,#8d9aaf)] hover:text-[#f4f7fb]'
                      }`}
                    >
                      Sibyl Records
                    </button>
                  </div>

                  {artifactTab === 'document' && <ArtifactBody />}
                  {artifactTab === 'diffs' && (
                    <div style={artifactScroll} className="p-4">
                      <DiffTable />
                    </div>
                  )}
                  {artifactTab === 'records' && (
                    <div style={artifactScroll} className="p-4">
                      <RecordsTable />
                    </div>
                  )}
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
              title={
                artifactTab === 'document'
                  ? ARTIFACT_TITLE
                  : artifactTab === 'diffs'
                  ? 'Memory State & Ledger Diffs'
                  : 'Sibyl Counterparty Ledger'
              }
              subtitle={
                artifactTab === 'document'
                  ? ARTIFACT_SUBTITLE
                  : artifactTab === 'diffs'
                  ? 'Proposed state changes vs commit log'
                  : 'Historical relationship memory & reliability'
              }
              hasDivider
              onOpenChange={setIsArtifactDialogOpen}
              endContent={<MobileArtifactActions />}
            />
          }
          content={
            <LayoutContent padding={0}>
              <div className="flex items-center gap-1 px-3 py-1.5 border-b border-[rgba(216,216,219,0.12)] bg-[#111015] text-[12px]">
                <button
                  type="button"
                  onClick={() => setArtifactTab('document')}
                  data-sound="press"
                  className={`px-2.5 py-1 rounded-[6px] font-medium transition-colors ${
                    artifactTab === 'document'
                      ? 'bg-[#25252a] text-[#f4f7fb]'
                      : 'text-[var(--color-text-muted,#8d9aaf)]'
                  }`}
                >
                  Document
                </button>
                <button
                  type="button"
                  onClick={() => setArtifactTab('diffs')}
                  data-sound="press"
                  className={`px-2.5 py-1 rounded-[6px] font-medium transition-colors ${
                    artifactTab === 'diffs'
                      ? 'bg-[#25252a] text-[#f4f7fb]'
                      : 'text-[var(--color-text-muted,#8d9aaf)]'
                  }`}
                >
                  Memory Diffs
                </button>
                <button
                  type="button"
                  onClick={() => setArtifactTab('records')}
                  data-sound="press"
                  className={`px-2.5 py-1 rounded-[6px] font-medium transition-colors ${
                    artifactTab === 'records'
                      ? 'bg-[#25252a] text-[#f4f7fb]'
                      : 'text-[var(--color-text-muted,#8d9aaf)]'
                  }`}
                >
                  Sibyl Records
                </button>
              </div>
              {artifactTab === 'document' && <ArtifactBody />}
              {artifactTab === 'diffs' && (
                <div style={artifactScroll} className="p-4">
                  <DiffTable />
                </div>
              )}
              {artifactTab === 'records' && (
                <div style={artifactScroll} className="p-4">
                  <RecordsTable />
                </div>
              )}
            </LayoutContent>
          }
        />
      </Dialog>
    </Theme>
  );
}

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
import { apiClient } from '@/lib/api-client';
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
import type { CounterpartyRecord, DiffRow } from '@/components/primitives';

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

// Artifact content & definitions

const MENTION_TOKENS = [
  { value: '@agent', label: '@Agent', variant: 'neutral' as const },
];

export interface ArtifactData {
  id: string;
  title: string;
  subtitle: string;
  counterpartyKey?: string;
  content: string;
  v1Content?: string;
}

export interface SidebarMission {
  id: string;
  title: string;
  active: boolean;
}

export const ARTIFACT_BETA: ArtifactData = {
  id: 'artifact-beta',
  title: 'Beta Labs: Memory Dossier & Spend Proposal',
  subtitle: 'Sibyl Reputation Dossier · Status: ESTABLISHED · Base Sepolia',
  counterpartyKey: 'virtuals:agent:beta',
  content: `## Executive Overview

Counterparty record for **Beta Labs** (\`virtuals:agent:beta\`). Governed under Aura Memory Protocol with continuous on-chain Merkle commitment attestation on **Base Sepolia**.

- **Primary Domain**: Market Data Procurement & Specialized Inferences
- **Relationship Tier**: \`ESTABLISHED\` (Tier 2 / 5)
- **Overall Reliability**: **84.0%** (14 episodes, 0 settlement disputes)
- **Base Sepolia Attestation**: \`0x8fa1c94b2e88a01f92e0719da6b42b919ca012efd4b2\`

## Reputation & Historical Performance

Beta Labs has operated continuously without execution timeouts or SLA breaches across the last 14 tasks:

| Metric | Recorded Value | Peer Benchmark | Assessment |
|---|---|---|---|
| Reliability Score | **84%** | 68% | Outperforming |
| Task Completion Rate | **100%** (14/14) | 91% | Exceptional |
| Disputed Settlements | **0** | 1.2 avg | Zero Fault |
| Mean Response Latency | **2.4s** | 4.8s | Fast |
| Last Verification | **Today** | — | Verified |

## Spend Proposal & Guardrail Check

An operator proposal is staged for **10.00 USDC** to procure verified real-time liquidity telemetry for autonomous execution:

- **Daily Spend Limit**: \`100.00 USDC\`
- **Cumulative Daily Spend**: \`10.00 USDC\`
- **Remaining Daily Budget**: \`90.00 USDC\`
- **Approval Threshold**: Exceeds \`5.00 USDC\` baseline threshold; operator approval card rendered in chat stream.
- **Safety Status**: \`PASS\` — zero anomalies detected in counterparty historical signature verifications.

## Counterfactual Rationale

- **Why Beta Labs?** Beta Labs demonstrated verified execution integrity on Base Sepolia.
- **Alternative Evaluated**: **Alpha Studio** (\`virtuals:agent:alpha\`) was considered for similar tasks, but holds a **42%** reliability rating with probationary restrictions following 2 recent SLA delivery faults.
- **Decision Engine Output**: Recommendation is to proceed with Beta Labs under standard 10 USDC staged release escrow.`,
  v1Content: `## Preliminary Draft: Beta Labs Evaluation (v1)

Initial evaluation of Beta Labs (\`virtuals:agent:beta\`) for dataset procurement.

- Initial Reliability: 78% (12 tasks recorded)
- Status: PROBATIONARY
- Guardrail: Pending daily cap assessment
- Note: Preliminary observation before final Base Sepolia settlement verification.`,
};

export const ARTIFACT_ALPHA: ArtifactData = {
  id: 'artifact-alpha',
  title: 'Alpha Studio: Risk Assessment & Probationary Dossier',
  subtitle: 'Sibyl Reputation Dossier · Status: PROBATIONARY · Base Sepolia',
  counterpartyKey: 'virtuals:agent:alpha',
  content: `## Executive Overview

Counterparty record for **Alpha Studio** (\`virtuals:agent:alpha\`). Sibyl Memory Protocol has placed this entity on active watch.

- **Primary Domain**: Code Generation & Verification
- **Relationship Tier**: \`PROBATIONARY\` (Tier 1 / 5)
- **Overall Reliability**: **42.0%** (42 tasks, 5 disputed settlements)
- **Base Sepolia Attestation**: \`0x4b7e21a089d1b6cf843105a9de7218320498305c9a12\`

## Risk Telemetry & Incidents

Alpha Studio incurred an automated score degradation following failure to deliver signed validation proofs in Episode #39 and #41.

| Incident ID | Timestamp | Category | Penalty Impact |
|---|---|---|---|
| \`INC-8821\` | 2 days ago | SLA Delivery Timeout | -180 bps Reliability |
| \`INC-8740\` | 5 days ago | Payload Hash Mismatch | -240 bps Reliability |

## Guardrail Constraints

- **Single Transaction Max**: \`5.00 USDC\` (Strict Hard Cap)
- **Operator Multi-Sig**: Required for all interactions regardless of amount.
- **Escrow**: 100% bond collateralization required prior to mission acceptance.`,
  v1Content: `## Preliminary Draft: Alpha Studio (v1)

- Initial Reliability: 45%
- Status: PROBATIONARY
- Note: High incident frequency logged during stress execution tests.`,
};

export const ARTIFACT_GAMMA: ArtifactData = {
  id: 'artifact-gamma',
  title: 'Gamma Research: Intelligence & Onboarding Dossier',
  subtitle: 'Sibyl Reputation Dossier · Status: PROBATIONARY · Base Sepolia',
  counterpartyKey: 'virtuals:agent:gamma',
  content: `## Executive Overview

Counterparty record for **Gamma Research** (\`virtuals:agent:gamma\`).

- **Primary Domain**: Market Intelligence & Quantitative Modeling
- **Relationship Tier**: \`PROBATIONARY\` (Tier 1 / 5)
- **Overall Reliability**: **62.0%** (5 episodes completed)
- **Base Sepolia Attestation**: \`0x12dc58a74b39e081c70217ea958d348a520938b865f8\`

## Performance History

Emerging agent node onboarded 3 days ago. Initial performance indicates acceptable accuracy with slightly elevated response latency (8.2s avg).`,
  v1Content: `## Preliminary Draft: Gamma Research (v1)

- Status: Onboarding candidate
- Evaluation: In progress`,
};

const DEFAULT_COUNTERPARTY_RECORDS: CounterpartyRecord[] = [
  {
    id: 'virtuals:agent:beta',
    name: 'Beta Labs (Agent)',
    category: 'Procurement & Data',
    reliabilityScore: 0.84,
    tasksCompleted: 14,
    status: 'ESTABLISHED',
    lastInteraction: '1 day ago',
    commitmentHash: '0x8fa1...d4b2',
  },
  {
    id: 'virtuals:agent:alpha',
    name: 'Alpha Studio (Agent)',
    category: 'Code & Verification',
    reliabilityScore: 0.42,
    tasksCompleted: 42,
    status: 'PROBATIONARY',
    lastInteraction: '2 hours ago',
    commitmentHash: '0x4b7e...9a12',
  },
  {
    id: 'virtuals:agent:gamma',
    name: 'Gamma Research',
    category: 'Market Intelligence',
    reliabilityScore: 0.62,
    tasksCompleted: 5,
    status: 'PROBATIONARY',
    lastInteraction: '3 days ago',
    commitmentHash: '0x12dc...65f8',
  },
];

const DEFAULT_DIFF_ROWS: DiffRow[] = [
  {
    key: 'reliability',
    field: 'Beta Labs Reliability',
    previousValue: '0.78 (12 tasks)',
    newValue: '0.84 (14 tasks)',
    status: 'modified',
  },
  {
    key: 'status',
    field: 'Relationship Status',
    previousValue: 'PROBATIONARY',
    newValue: 'ESTABLISHED',
    status: 'modified',
  },
  {
    key: 'commitment',
    field: 'Base Sepolia Hash',
    previousValue: '0x8fa1...d4b2',
    newValue: '0x3e9c...81a0',
    status: 'added',
  },
  {
    key: 'spend_limit',
    field: 'Remaining Daily Guardrail',
    previousValue: '100.00 USDC',
    newValue: '90.00 USDC',
    status: 'modified',
  },
];

const DEFAULT_MISSIONS: SidebarMission[] = [
  { id: '01918342-7000-7c23-8c43-2617f16ef001', title: 'Buy market dataset under 25 USDC', active: true },
  { id: '01918342-7000-7c23-8c43-2617f16ef002', title: 'Beta Labs 10 USDC Spend Proposal', active: false },
  { id: '01918342-7000-7c23-8c43-2617f16ef003', title: 'Base Sepolia Treasury Spend Limit', active: false },
];

// Artifact subviews

function ArtifactActions({
  version = 'v2',
  onVersionChange,
  onCopy,
  copied = false,
  showVersionSelector = true,
  onClose,
}: {
  version?: 'v1' | 'v2';
  onVersionChange?: (version: 'v1' | 'v2') => void;
  onCopy?: () => void;
  copied?: boolean;
  showVersionSelector?: boolean;
  onClose?: () => void;
}) {
  return (
    <>
      {showVersionSelector && (
        <DropdownMenu
          button={{
            label: version === 'v2' ? 'v2 (current)' : 'v1 (draft)',
            variant: 'ghost',
            size: 'sm',
          }}
          items={[
            {
              label: 'v2 (current)',
              onClick: () => {
                playInteractionSound('press');
                onVersionChange?.('v2');
              },
            },
            {
              label: 'v1 (draft)',
              onClick: () => {
                playInteractionSound('press');
                onVersionChange?.('v1');
              },
            },
          ]}
        />
      )}
      <Button
        label={copied ? 'Copied' : 'Copy'}
        variant="ghost"
        size="sm"
        icon={<Icon icon={ClipboardDocumentIcon} size="sm" />}
        isIconOnly
        onClick={onCopy}
      />
      <Button
        label="Share"
        variant="ghost"
        size="sm"
        icon={<Icon icon={ShareIcon} size="sm" />}
        isIconOnly
        onClick={() => playInteractionSound('press')}
      />
      {onClose != null && (
        <Button
          label="Close document"
          variant="ghost"
          size="sm"
          icon={<Icon icon={XMarkIcon} size="sm" />}
          isIconOnly
          onClick={() => {
            playInteractionSound('release');
            onClose();
          }}
        />
      )}
    </>
  );
}

function MobileArtifactActions({
  version = 'v2',
  onVersionChange,
  onCopy,
  showVersionSelector = true,
}: {
  version?: 'v1' | 'v2';
  onVersionChange?: (version: 'v1' | 'v2') => void;
  onCopy?: () => void;
  showVersionSelector?: boolean;
}) {
  const versionItems = showVersionSelector
    ? [
        {
          type: 'section' as const,
          title: 'Version',
          items: [
            {
              label: version === 'v2' ? '✓ v2 (current)' : 'v2 (current)',
              onClick: () => {
                playInteractionSound('press');
                onVersionChange?.('v2');
              },
            },
            {
              label: version === 'v1' ? '✓ v1 (draft)' : 'v1 (draft)',
              onClick: () => {
                playInteractionSound('press');
                onVersionChange?.('v1');
              },
            },
          ],
        },
        { type: 'divider' as const },
      ]
    : [];

  return (
    <MoreMenu
      label="Document actions"
      size="sm"
      items={[
        ...versionItems,
        {
          label: 'Copy',
          icon: <Copy size={16} />,
          onClick: onCopy,
        },
        {
          label: 'Share',
          icon: <Share2 size={16} />,
          onClick: () => playInteractionSound('press'),
        },
      ]}
    />
  );
}

function ArtifactBody({
  artifact = ARTIFACT_BETA,
  version = 'v2',
}: {
  artifact?: ArtifactData;
  version?: 'v1' | 'v2';
}) {
  const content = version === 'v1' && artifact.v1Content ? artifact.v1Content : artifact.content;
  return (
    <Section variant="transparent" style={artifactScroll} className="ai-chat-artifact-body">
      <VStack gap={2} style={articleBody}>
        <Heading level={1}>{artifact.title}</Heading>
        <Markdown>{content}</Markdown>
      </VStack>
    </Section>
  );
}

function ArtifactCard({
  title = ARTIFACT_BETA.title,
  subtitle = ARTIFACT_BETA.subtitle,
  onOpen,
}: {
  title?: string;
  subtitle?: string;
  onOpen: () => void;
}) {
  return (
    <ClickableCard
      label={`Open ${title}`}
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
              {title}
            </Text>
            <Text type="supporting" color="secondary">
              {subtitle}
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
  missions = DEFAULT_MISSIONS,
  selectedMissionId,
  onSelectMission,
}: {
  scope: 'global' | 'mission';
  onScopeChange: (scope: 'global' | 'mission') => void;
  missions?: SidebarMission[];
  selectedMissionId?: string;
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
        {missions.map((m) => {
          const isSelected = scope === 'mission' && (selectedMissionId ? m.id === selectedMissionId : m.active);
          return (
            <button
              key={m.id}
              type="button"
              data-sound="press"
              onClick={() => onSelectMission?.(m.id)}
              className={`flex items-center justify-between px-2 py-1 rounded-[6px] text-left text-[11px] transition-colors ${
                isSelected
                  ? 'bg-[#1b1b1f] text-[#f4f7fb] font-medium'
                  : 'text-[var(--color-text-muted,#8d9aaf)] hover:bg-[#1b1b1f] hover:text-[#f4f7fb]'
              }`}
            >
              <span className="truncate">{m.title}</span>
              <span className="text-[9px] font-mono opacity-60 ml-1">{m.id.slice(0, 8)}</span>
            </button>
          );
        })}
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
    text: '@agent Evaluate counterparty memory for Beta Labs and draft a 10 USDC spend proposal under active guardrails.',
    complete: true,
    citations: [],
  },
  {
    id: 'demo-agent-1',
    role: 'agent',
    text: `I recalled first-party reputation memory from Sibyl for **Beta Labs** (\`virtuals:agent:beta\`).\n\n- **Reliability**: 84% across 14 recorded tasks (Relationship: **ESTABLISHED**).\n- **Task Fit**: 92% match for dataset procurement and autonomous analysis.\n- **Guardrail Check**: Daily limit is 100.00 USDC with 90.00 USDC remaining. The proposed 10.00 USDC spend is within policy limits.\n\n*Counterfactual Rationale*: Memory checked; Beta Labs has proven fault-free settlement across past episodes, whereas Alpha Research has an active risk penalty from a recent delivery failure.\n\nI have drafted an approval proposal in the mission log and generated the Counterparty Dossier & Memory Ledger artifact in the inspector.`,
    thought: `1. Analyzed operator inquiry regarding Beta Labs evaluation and spend proposal.\n2. Queried Sibyl memory store for virtuals:agent:beta and checked counterparty reputation score.\n3. Verified operator guardrail policies (100.00 USDC daily cap, 90.00 USDC remaining).\n4. Formulated counterfactual rationale comparing Beta Labs with alternative providers.\n5. Prepared approval proposal and updated Base Sepolia memory commitment diffs.`,
    usage: {
      promptTokens: 2786,
      candidateTokens: 881,
      totalTokens: 3667,
    },
    complete: true,
    citations: [
      {
        label: 'Sibyl Memory: Beta Labs',
        counterpartyKey: 'virtuals:agent:beta',
      },
    ],
    toolCalls: [
      {
        name: 'memory_recall_counterparty',
        args: { counterpartyKey: 'virtuals:agent:beta' },
        result: {
          status: 'AVAILABLE',
          overall_reliability: 0.84,
          relationship_status: 'ESTABLISHED',
          task_fit: 0.92,
          observed_price_usdc: '10.00',
        },
      },
      {
        name: 'guardrails_get_policies',
        args: { agentId: 'aura-agent-01' },
        result: {
          dailyLimitUsdc: '100.00',
          remainingBudgetUsdc: '90.00',
          requiresApprovalAboveUsdc: '5.00',
        },
      },
      {
        name: 'mission_propose_approval',
        args: {
          runId: 'run-seed-01',
          counterpartyKey: 'virtuals:agent:beta',
          amountUsdc: '10.00',
          reason: 'Procure verified market dataset under active guardrail limits',
        },
        result: {
          created: true,
          runId: 'run-seed-01',
          status: 'APPROVAL_REQUESTED',
          amountUsdc: '10.00',
        },
      },
    ],
  },
];

const INITIAL_SESSION_USAGE: TokenUsage = {
  promptTokens: 2786,
  candidateTokens: 881,
  totalTokens: 3667,
};

// Main component

const STORAGE_KEY_MESSAGES = 'aura:ai-chat:messages:v3';
const STORAGE_KEY_USAGE = 'aura:ai-chat:usage:v3';

export default function AIChatConversationTemplate() {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    if (typeof window === 'undefined') return INITIAL_DEMO_MESSAGES;
    try {
      // Purge obsolete v2 keys containing outdated JWT mocks
      const v2 = localStorage.getItem('aura:ai-chat:messages:v2');
      if (v2 && (v2.includes('JWT') || v2.includes('auth-service'))) {
        localStorage.removeItem('aura:ai-chat:messages:v2');
        localStorage.removeItem('aura:ai-chat:usage:v2');
      }

      const stored = localStorage.getItem(STORAGE_KEY_MESSAGES) || localStorage.getItem('aura:ai-chat:messages:v2');
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
      return INITIAL_SESSION_USAGE;
    }
    try {
      const storedUsage = localStorage.getItem(STORAGE_KEY_USAGE) || localStorage.getItem('aura:ai-chat:usage:v2');
      if (storedUsage) {
        const parsedUsage = JSON.parse(storedUsage);
        if (parsedUsage && typeof parsedUsage.totalTokens === 'number') {
          return parsedUsage;
        }
      }
    } catch {
      // Ignore storage parse errors
    }
    return INITIAL_SESSION_USAGE;
  });
  const [draft, setDraft] = useState('');
  const [composerMode, setComposerMode] = useState<'ask' | 'edit'>('ask');
  const [connection, setConnection] = useState<ChatConnection>({ kind: 'idle' });
  const [chatScope, setChatScope] = useState<'global' | 'mission'>('global');
  const [artifactTab, setArtifactTab] = useState<'document' | 'diffs' | 'records'>('document');
  const [isArtifactDialogOpen, setIsArtifactDialogOpen] = useState(false);
  const [isArtifactOpen, setIsArtifactOpen] = useState(true);

  const [activeArtifact, setActiveArtifact] = useState<ArtifactData>(ARTIFACT_BETA);
  const [artifactVersion, setArtifactVersion] = useState<'v1' | 'v2'>('v2');
  const [copiedArtifact, setCopiedArtifact] = useState(false);
  const [diffRows, setDiffRows] = useState<DiffRow[]>(DEFAULT_DIFF_ROWS);
  const [counterpartyRecords, setCounterpartyRecords] = useState<CounterpartyRecord[]>(
    DEFAULT_COUNTERPARTY_RECORDS
  );
  const [recentMissions, setRecentMissions] = useState<SidebarMission[]>(DEFAULT_MISSIONS);
  const [selectedMissionId, setSelectedMissionId] = useState<string>('01918342-7000-7c23-8c43-2617f16ef001');

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

  // Fetch real runs on mount to populate sidebar missions
  useEffect(() => {
    let isMounted = true;
    apiClient
      .listRuns(10)
      .then((res) => {
        if (isMounted && res.ok && res.data?.runs && res.data.runs.length > 0) {
          const loadedRuns = res.data.runs.map((r, i) => ({
            id: r.id,
            title: r.objective || `Mission ${r.id}`,
            active: i === 0,
          }));
          setRecentMissions(loadedRuns);
          if (loadedRuns[0]) {
            setSelectedMissionId(loadedRuns[0].id);
          }
        }
      })
      .catch(() => {
        // Retain default missions
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // Fetch real counterparties on mount to populate Sibyl records
  useEffect(() => {
    let isMounted = true;
    apiClient
      .listSibylCounterparties()
      .then((res) => {
        if (isMounted && res.ok && res.data?.items && res.data.items.length > 0) {
          const mapped: CounterpartyRecord[] = res.data.items.map((item) => ({
            id: item.counterpartyKey,
            name: item.displayName || item.counterpartyKey,
            category: item.counterpartyKey.includes('alpha')
              ? 'Market Intelligence & Verification'
              : item.counterpartyKey.includes('beta')
              ? 'Procurement & Data'
              : 'Autonomous Agent',
            reliabilityScore:
              item.overallReliability ?? (item.counterpartyKey.includes('beta') ? 0.84 : 0.65),
            tasksCompleted:
              item.episodes?.length ?? (item.counterpartyKey.includes('beta') ? 14 : 6),
            status:
              item.relationshipStatus === 'PREFERRED' || item.relationshipStatus === 'ESTABLISHED'
                ? 'ESTABLISHED'
                : item.relationshipStatus === 'WATCH' || item.relationshipStatus === 'PROBATIONARY'
                ? 'PROBATIONARY'
                : 'ESTABLISHED',
            lastInteraction: item.updatedAt
              ? new Date(item.updatedAt).toLocaleDateString()
              : '1 day ago',
            commitmentHash: item.counterpartyKey.includes('beta') ? '0x8fa1...d4b2' : '0x4b7e...9a12',
          }));
          setCounterpartyRecords(mapped);
        }
      })
      .catch(() => {
        // Retain default records
      });
    return () => {
      isMounted = false;
    };
  }, []);

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

  const openArtifact = (artifact?: ArtifactData) => {
    if (artifact) {
      setActiveArtifact(artifact);
    }
    setArtifactTab('document');
    const width = rootRef.current?.offsetWidth ?? Infinity;
    if (width <= MOBILE_MAX_WIDTH) {
      setIsArtifactDialogOpen(true);
    } else {
      setIsArtifactOpen(true);
    }
  };

  const handleApplyDiffs = (selectedKeys: string[]) => {
    playInteractionSound('pulse');
    setDiffRows((prev) =>
      prev.map((row) =>
        selectedKeys.includes(row.key)
          ? { ...row, previousValue: row.newValue, status: 'unchanged' as const }
          : row
      )
    );
  };

  const handleSelectCounterparty = (record: CounterpartyRecord) => {
    playInteractionSound('press');
    if (record.id.includes('alpha')) {
      setActiveArtifact(ARTIFACT_ALPHA);
    } else if (record.id.includes('beta')) {
      setActiveArtifact(ARTIFACT_BETA);
    } else if (record.id.includes('gamma')) {
      setActiveArtifact(ARTIFACT_GAMMA);
    } else {
      setActiveArtifact({
        id: `artifact-${record.id}`,
        title: `${record.name}: Memory Dossier`,
        subtitle: `Sibyl Reputation Dossier · Status: ${record.status} · Base Sepolia`,
        counterpartyKey: record.id,
        content: `## Executive Overview\n\nCounterparty record for **${record.name}** (\`${record.id}\`). Category: **${record.category}**.\n\n## Reputation Metrics\n\n- **Reliability Score**: ${Math.round(record.reliabilityScore * 100)}%\n- **Tasks Completed**: ${record.tasksCompleted}\n- **Relationship Status**: ${record.status}\n- **Base Sepolia Commitment**: \`${record.commitmentHash || '0x4b7e...9a12'}\`\n\n## Guardrails & Policy\n\nGoverned by active operator spend policies on Base Sepolia.`,
      });
    }
    setArtifactTab('document');
    setIsArtifactOpen(true);
  };

  const handleSelectMission = (missionId: string) => {
    playInteractionSound('press');
    setSelectedMissionId(missionId);
    setChatScope('mission');
    setRecentMissions((prev) =>
      prev.map((m) => ({ ...m, active: m.id === missionId }))
    );
  };

  const handleCopyArtifact = useCallback(() => {
    playInteractionSound('press');
    const textToCopy =
      artifactVersion === 'v1' && activeArtifact.v1Content
        ? activeArtifact.v1Content
        : activeArtifact.content;
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(textToCopy);
      setCopiedArtifact(true);
      setTimeout(() => setCopiedArtifact(false), 2000);
    }
  }, [activeArtifact, artifactVersion]);

  const stop = useCallback(() => {
    handleRef.current?.close();
    handleRef.current = null;
    setConnection({ kind: 'idle' });
  }, []);

  const handleNewChat = useCallback(() => {
    playInteractionSound('release');
    stop();
    setMessages(INITIAL_DEMO_MESSAGES);
    setSessionUsage(INITIAL_SESSION_USAGE);
    setActiveArtifact(ARTIFACT_BETA);
    setDiffRows(DEFAULT_DIFF_ROWS);
    try {
      localStorage.removeItem(STORAGE_KEY_MESSAGES);
      localStorage.removeItem(STORAGE_KEY_USAGE);
      localStorage.removeItem('aura:ai-chat:messages:v2');
      localStorage.removeItem('aura:ai-chat:usage:v2');
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
      const chatUrl =
        chatScope === 'mission' && selectedMissionId
          ? `${env.NEXT_PUBLIC_API_URL}/api/runs/${encodeURIComponent(selectedMissionId)}/chat?q=${encodeURIComponent(question)}`
          : `${env.NEXT_PUBLIC_API_URL}/api/chat?q=${encodeURIComponent(question)}`;

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
            const args = toolCall.args as {
              counterpartyKey?: string;
              amountUsdc?: string | number;
              reason?: string;
            };
            const cpKey = args?.counterpartyKey || 'virtuals:agent:beta';
            const num = typeof args?.amountUsdc === 'number' ? args.amountUsdc : parseFloat(String(args?.amountUsdc || '10.00'));
            const spendStr = Number.isNaN(num) ? '10.00' : num.toFixed(2);
            const remainingBudget = Math.max(0, 100 - (Number.isNaN(num) ? 10 : num)).toFixed(2);

            setDiffRows([
              {
                key: 'proposed_spend',
                field: `${cpKey} Spend Authorization`,
                previousValue: '0.00 USDC',
                newValue: `${spendStr} USDC`,
                status: 'added',
              },
              {
                key: 'spend_limit',
                field: 'Remaining Daily Guardrail',
                previousValue: '100.00 USDC',
                newValue: `${remainingBudget} USDC`,
                status: 'modified',
              },
              {
                key: 'approval_status',
                field: 'Guardrail Policy Gate',
                previousValue: 'STAGED',
                newValue: 'OPERATOR_APPROVAL_REQUESTED',
                status: 'modified',
              },
              {
                key: 'commitment',
                field: 'Base Sepolia Commitment Hash',
                previousValue: '0x8fa1...d4b2',
                newValue: '0x3e9c...81a0',
                status: 'modified',
              },
            ]);
            setIsArtifactOpen(true);
            setArtifactTab('diffs');
          } else if (toolCall.name === 'memory_recall_counterparty') {
            const cpKey = (toolCall.args as { counterpartyKey?: string })?.counterpartyKey;
            if (cpKey?.includes('alpha')) {
              setActiveArtifact(ARTIFACT_ALPHA);
            } else if (cpKey?.includes('beta')) {
              setActiveArtifact(ARTIFACT_BETA);
            } else if (cpKey?.includes('gamma')) {
              setActiveArtifact(ARTIFACT_GAMMA);
            } else if (cpKey) {
              const res = toolCall.result as Record<string, unknown> | undefined;
              const displayName = (res?.displayName as string) || cpKey;
              const ret = res?.retrieval as Record<string, unknown> | undefined;
              const rel = typeof ret?.overallReliability === 'number' ? Math.round(ret.overallReliability * 100) : 80;
              const status = (ret?.relationshipStatus as string) || 'ESTABLISHED';
              setActiveArtifact({
                id: `artifact-${cpKey}`,
                title: `${displayName}: Memory Dossier`,
                subtitle: `Sibyl Reputation Dossier · Status: ${status} · Base Sepolia`,
                counterpartyKey: cpKey,
                content: `## Executive Overview\n\nCounterparty record for **${displayName}** (\`${cpKey}\`). Recalled from Sibyl Memory Protocol.\n\n## Reputation Metrics\n\n- **Reliability Score**: ${rel}%\n- **Relationship Status**: \`${status}\`\n- **Base Sepolia Attestation**: \`0x8fa1...d4b2\`\n\n## Governance & Guardrails\n\nUnder active Aura Memory Protocol guardrail surveillance.`,
              });
            }
            setIsArtifactOpen(true);
            setArtifactTab('document');
          }
        },
        onState: (state) => {
          setConnection(state);
          if (state.kind === 'unavailable') {
            update((m) => ({
              ...m,
              complete: true,
              text:
                m.text ||
                (state.detail === 'stream-unreachable'
                  ? `Unable to connect to the agent gateway. Please verify that the API server is reachable at ${env.NEXT_PUBLIC_API_URL}`
                  : 'Connection to the agent stream was interrupted.'),
            }));
          }
        },
        onDone: () => {
          update((m) => ({ ...m, complete: true }));
          setConnection({ kind: 'idle' });
        },
      });
    },
    [chatScope, selectedMissionId],
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
                missions={recentMissions}
                selectedMissionId={selectedMissionId}
                onSelectMission={handleSelectMission}
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
                            setDraft((d) => `${d} virtuals:agent:beta `);
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
                                const tcRes = tc.result as Record<string, unknown> | undefined;
                                const effectiveRunId =
                                  (tcRes?.runId as string) ||
                                  (tc.args?.runId as string) ||
                                  (chatScope === 'mission' && selectedMissionId ? selectedMissionId : undefined);
                                return (
                                  <ApprovalCard
                                    key={`approval-${idx}`}
                                    runId={effectiveRunId}
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
                                    counterfactual={{
                                      baselineCounterparty: 'Alpha Studio',
                                      baselineReliability: 0.42,
                                      proposedReliability: 0.84,
                                      delta: '+42%',
                                      rationale:
                                        'Beta Labs demonstrates verified 84% reliability on Base Sepolia. Alpha Studio holds a 42% probationary rating following deliverable acceptance faults.',
                                    }}
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

                        {(message.id === 'demo-agent-1' ||
                          message.toolCalls?.some((tc) => tc.name === 'memory_recall_counterparty')) && (
                          <ChatMessageBubble variant="ghost" width="100%">
                            <ArtifactCard
                              title={
                                message.id === 'demo-agent-1'
                                  ? activeArtifact.title
                                  : (() => {
                                      const tc = message.toolCalls?.find(
                                        (t) => t.name === 'memory_recall_counterparty',
                                      );
                                      const key = (tc?.args as { counterpartyKey?: string })?.counterpartyKey;
                                      if (key?.includes('alpha')) return ARTIFACT_ALPHA.title;
                                      if (key?.includes('gamma')) return ARTIFACT_GAMMA.title;
                                      return ARTIFACT_BETA.title;
                                    })()
                              }
                              subtitle={
                                message.id === 'demo-agent-1'
                                  ? activeArtifact.subtitle
                                  : (() => {
                                      const tc = message.toolCalls?.find(
                                        (t) => t.name === 'memory_recall_counterparty',
                                      );
                                      const key = (tc?.args as { counterpartyKey?: string })?.counterpartyKey;
                                      if (key?.includes('alpha')) return ARTIFACT_ALPHA.subtitle;
                                      if (key?.includes('gamma')) return ARTIFACT_GAMMA.subtitle;
                                      return ARTIFACT_BETA.subtitle;
                                    })()
                              }
                              onOpen={() => {
                                if (message.id === 'demo-agent-1') {
                                  openArtifact(activeArtifact);
                                } else {
                                  const tc = message.toolCalls?.find(
                                    (t) => t.name === 'memory_recall_counterparty',
                                  );
                                  const key = (tc?.args as { counterpartyKey?: string })?.counterpartyKey;
                                  if (key?.includes('alpha')) openArtifact(ARTIFACT_ALPHA);
                                  else if (key?.includes('gamma')) openArtifact(ARTIFACT_GAMMA);
                                  else openArtifact(ARTIFACT_BETA);
                                }
                              }}
                            />
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
                              ? activeArtifact.title
                              : artifactTab === 'diffs'
                              ? 'Memory State & Ledger Diffs'
                              : 'Sibyl Counterparty Ledger'}
                          </Text>
                          <Text type="supporting" color="secondary">
                            {artifactTab === 'document'
                              ? activeArtifact.subtitle
                              : artifactTab === 'diffs'
                              ? 'Proposed state changes vs commit log'
                              : 'Historical relationship memory & reliability'}
                          </Text>
                        </VStack>
                      </HStack>
                    }
                    endContent={
                      <ArtifactActions
                        version={artifactVersion}
                        onVersionChange={setArtifactVersion}
                        onCopy={handleCopyArtifact}
                        copied={copiedArtifact}
                        showVersionSelector={artifactTab === 'document'}
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

                  {artifactTab === 'document' && (
                    <ArtifactBody artifact={activeArtifact} version={artifactVersion} />
                  )}
                  {artifactTab === 'diffs' && (
                    <div style={artifactScroll} className="p-4">
                      <DiffTable rows={diffRows} onApply={handleApplyDiffs} />
                    </div>
                  )}
                  {artifactTab === 'records' && (
                    <div style={artifactScroll} className="p-4">
                      <RecordsTable
                        records={counterpartyRecords}
                        onSelectRecord={handleSelectCounterparty}
                      />
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
                  ? activeArtifact.title
                  : artifactTab === 'diffs'
                  ? 'Memory State & Ledger Diffs'
                  : 'Sibyl Counterparty Ledger'
              }
              subtitle={
                artifactTab === 'document'
                  ? activeArtifact.subtitle
                  : artifactTab === 'diffs'
                  ? 'Proposed state changes vs commit log'
                  : 'Historical relationship memory & reliability'
              }
              hasDivider
              onOpenChange={setIsArtifactDialogOpen}
              endContent={
                <MobileArtifactActions
                  version={artifactVersion}
                  onVersionChange={setArtifactVersion}
                  onCopy={handleCopyArtifact}
                  showVersionSelector={artifactTab === 'document'}
                />
              }
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
              {artifactTab === 'document' && (
                <ArtifactBody artifact={activeArtifact} version={artifactVersion} />
              )}
              {artifactTab === 'diffs' && (
                <div style={artifactScroll} className="p-4">
                  <DiffTable rows={diffRows} onApply={handleApplyDiffs} />
                </div>
              )}
              {artifactTab === 'records' && (
                <div style={artifactScroll} className="p-4">
                  <RecordsTable
                    records={counterpartyRecords}
                    onSelectRecord={handleSelectCounterparty}
                  />
                </div>
              )}
            </LayoutContent>
          }
        />
      </Dialog>
    </Theme>
  );
}

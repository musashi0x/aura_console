"use client";

import { useState } from "react";
import Link from "next/link";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { Token } from "@astryxdesign/core/Token";

import type { RunSummary } from "@/lib/api-client";
import type { ChatGrounding } from "./console-chat";
import { ConsoleChat } from "./console-chat";

export interface ChatConsoleViewProps {
  runs: readonly RunSummary[];
  grounding?: ChatGrounding;
  initialRunId?: string;
}

export function ChatConsoleView({
  runs,
  grounding,
  initialRunId,
}: ChatConsoleViewProps) {
  const [selectedRunId, setSelectedRunId] = useState<string | null>(
    initialRunId ?? (runs.length > 0 ? runs[0]!.id : null),
  );

  const activeRun = runs.find((r) => r.id === selectedRunId);

  return (
    <div className="cs__chat-console-layout">
      {/* Run Selector Sidebar */}
      <aside className="cs__chat-console-sidebar" aria-label="Mission context selector">
        <div className="cs__chat-console-sidebar-header">
          <Text as="h2" size="sm" weight="semibold">
            Context Selector
          </Text>
          <Text as="p" size="xsm" color="secondary">
            Select a Mission to ground the agent's memory retrieval, or use Global Assistant.
          </Text>
        </div>

        <div className="cs__chat-console-sidebar-actions">
          <button
            type="button"
            className={`cs__chat-context-item ${selectedRunId === null ? "is-active" : ""}`}
            onClick={() => setSelectedRunId(null)}
          >
            <HStack justify="between" align="center">
              <Text as="span" size="sm" weight="medium">
                Global Assistant
              </Text>
              <Token label="SYSTEM" size="sm" color="cyan" />
            </HStack>
            <Text as="span" size="xsm" color="secondary">
              General commands, orientation & system controls
            </Text>
          </button>
        </div>

        <div className="cs__chat-console-missions-header">
          <Text as="h3" size="xsm" color="secondary" weight="semibold">
            RECENT MISSIONS ({runs.length})
          </Text>
        </div>

        <div className="cs__chat-console-missions-list" role="list">
          {runs.map((run) => {
            const isSelected = run.id === selectedRunId;
            return (
              <button
                key={run.id}
                type="button"
                className={`cs__chat-context-item ${isSelected ? "is-active" : ""}`}
                onClick={() => setSelectedRunId(run.id)}
                role="listitem"
              >
                <HStack justify="between" align="center">
                  <span className="cs__chat-context-title">
                    {run.objective}
                  </span>
                  <Token
                    label={run.budgetUsdc ? `${run.budgetUsdc} USDC` : "RUN"}
                    size="sm"
                    color={isSelected ? "cyan" : "gray"}
                  />
                </HStack>
                <HStack justify="between" align="center" gap={2}>
                  <code className="cs__chat-context-id">{run.id.slice(0, 8)}...</code>
                  <Text as="span" size="xsm" color="secondary">
                    {new Date(run.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </Text>
                </HStack>
              </button>
            );
          })}

          {runs.length === 0 ? (
            <div className="cs__chat-empty-runs">
              <Text as="p" size="xsm" color="secondary">
                No missions found yet.
              </Text>
              <Link href="/runs/new" className="btn btn-sm">
                + Start a Mission
              </Link>
            </div>
          ) : null}
        </div>
      </aside>

      {/* Main Chat Conversation Area */}
      <section className="cs__chat-console-main" aria-label="Conversation area">
        <header className="cs__chat-console-main-header">
          <HStack justify="between" align="center" wrap="wrap" gap={3}>
            <VStack gap={1}>
              <HStack align="center" gap={2}>
                <Text as="h1" size="lg" weight="semibold">
                  {activeRun ? activeRun.objective : "Global Chat Console"}
                </Text>
                <Token
                  label={activeRun ? "MISSION SCOPED" : "GLOBAL"}
                  size="sm"
                  color={activeRun ? "green" : "cyan"}
                />
              </HStack>
              {activeRun ? (
                <Text as="p" size="xsm" color="secondary">
                  Grounded in Mission <code>{activeRun.id}</code> · Budget: {activeRun.budgetUsdc ?? "0"} USDC · {activeRun.environment}
                </Text>
              ) : (
                <Text as="p" size="xsm" color="secondary">
                  Ready for console navigation commands and general operator queries.
                </Text>
              )}
            </VStack>

            {activeRun ? (
              <Link href={`/runs/${activeRun.id}`} className="btn btn-sm">
                Open Mission Workspace ↗
              </Link>
            ) : (
              <Link href="/runs/new" className="btn btn-sm">
                + New Mission
              </Link>
            )}
          </HStack>
        </header>

        <div className="cs__chat-console-body">
          <ConsoleChat
            key={selectedRunId ?? "global"}
            runId={selectedRunId ?? undefined}
            grounding={grounding}
          />
        </div>
      </section>
    </div>
  );
}

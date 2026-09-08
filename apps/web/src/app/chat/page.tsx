import type { Metadata } from "next";

import { ConsoleShell } from "@/features/console/components/console-shell";
import { readGrounding } from "@/features/console/grounding";
import { apiClient } from "@/lib/api-client";
import { ChatConsoleView } from "@/features/console/components/chat-console-view";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Chat Console — Aura Console" };

export default async function ChatPage({
  searchParams,
}: {
  searchParams?: Promise<{ runId?: string }>;
}) {
  const params = searchParams ? await searchParams : {};
  const [health, grounding, runsResult] = await Promise.all([
    apiClient.dbHealth(),
    readGrounding(),
    apiClient.listRuns(50),
  ]);

  const readiness = health.ok ? "ready" : "degraded";
  const runs = runsResult.ok ? runsResult.data.runs : [];

  return (
    <ConsoleShell
      surface="Chat Console"
      readiness={readiness}
      grounding={grounding}
      hostsConversation
    >
      <ChatConsoleView
        runs={runs}
        grounding={grounding}
        initialRunId={params.runId}
      />
    </ConsoleShell>
  );
}

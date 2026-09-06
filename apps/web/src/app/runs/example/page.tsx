import type { Metadata } from "next";

import { ConsoleShell } from "@/features/console/components/console-shell";
import { MissionWorkspace } from "@/features/console/components/mission-workspace";
import { exampleEvents, exampleRun } from "@/features/console/fixtures/example-run";
import { eventsFromApi, seedFromRun } from "@/features/console/model/from-api";
import { apiClient } from "@/lib/api-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Example Run — Aura Console" };

/**
 * The example Run: fixture data through the real projection.
 *
 * It does not call the API for its events, and it says so. Everything else on
 * the page behaves exactly as a real Run does, because it is the same
 * component and the same fold. Readiness is still the live check: the example
 * works whether or not the store is reachable, and claiming otherwise would
 * make the badge a decoration.
 */
/**
 * The answering path, checked on the server before the page renders.
 *
 * Both halves must answer for the chat to drop its warning: an agent with no
 * memory answers from nothing, and a memory with no agent answers not at all.
 * A failed check is reported as a failed check, never as readiness.
 */
async function readGrounding() {
  const [agent, sibyl] = await Promise.all([apiClient.agentHealth(), apiClient.sibylHealth()]);
  const agentReachable = agent.ok && agent.data.reachable;
  const memoryReachable = sibyl.ok && sibyl.data.reachable;
  const detail = !agentReachable
    ? (agent.ok ? agent.data.detail : undefined) ??
      "The answering agent is not reachable, so no question can be answered here."
    : !memoryReachable
      ? (sibyl.ok ? sibyl.data.detail : undefined) ??
        "Relationship memory is not reachable, so an answer would rest on nothing."
      : undefined;
  return { agentReachable, memoryReachable, detail };
}

export default async function ExampleRunPage() {
  const [health, grounding] = await Promise.all([apiClient.dbHealth(), readGrounding()]);

  return (
    <ConsoleShell
      surface="Missions"
      readiness={health.ok ? "ready" : "degraded"}
      runRef={exampleRun.id}
      hostsConversation
    >
      {/* First, not last. Below the timeline the panel sat off-screen on
          every Run long enough to matter. */}
      <MissionWorkspace
        events={eventsFromApi(exampleEvents)}
        seed={seedFromRun(exampleRun)}
        grounding={grounding}
        fixtureLabel="Example data. This Run was not executed and no economic action was taken."
      />
    </ConsoleShell>
  );
}

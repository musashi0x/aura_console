import { apiClient } from "@/lib/api-client";

import type { ChatGrounding } from "./components/console-chat";

/**
 * The answering path, checked on the server before a console surface renders.
 *
 * Both halves must answer before the chat drops its warning: an agent with no
 * memory answers from nothing, and a memory with no agent answers not at all.
 * A failed check is reported as a failed check, never as readiness.
 *
 * Every console surface calls this, not only the Mission routes. The docked
 * chat reaches all of them, and passing this from two pages left the panel
 * reporting "not checked" on four surfaces where the console could have looked.
 */
export async function readGrounding(): Promise<ChatGrounding> {
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

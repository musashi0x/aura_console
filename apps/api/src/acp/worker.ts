import { closeDb } from "@aura/db";
import type { AcpAgent, EntryHandler } from "@virtuals-protocol/acp-node-v2";

import { createAcpAgent } from "./agent.js";
import { loadAcpEnv } from "./env.js";

const SHUTDOWN_TIMEOUT_MS = 10_000;

/**
 * The ACP runtime, in its own process.
 *
 * It is deliberately not part of `server.ts`: the SDK holds a persistent event
 * stream and a signing client, and coupling them to the HTTP listener would
 * make "the API is up" and "the ACP stream is connected" one fact when they are
 * two. `apps/api/src/server.ts` imports nothing from this directory, and the
 * API boots with every ACP_* variable unset.
 *
 * The runtime observes. It never funds, completes, rejects, sets a budget,
 * submits, or calls executeTool — see docs/ai/api/acp.md.
 */
function log(level: "info" | "error", msg: string, fields: Record<string, unknown> = {}): void {
  const line = JSON.stringify({ level, msg, ...fields });
  if (level === "error") console.error(line);
  else console.log(line);
}

const logEntry: EntryHandler = (session, entry) => {
  log("info", "acp entry", {
    chainId: entry.chainId,
    jobId: entry.onChainJobId,
    kind: entry.kind,
    detail: entry.kind === "system" ? entry.event.type : entry.contentType,
    status: session.status,
  });
};

async function main(): Promise<void> {
  const env = loadAcpEnv();

  let agent: AcpAgent;
  try {
    agent = await createAcpAgent(env, logEntry);
    await agent.start(() => {
      log("info", "acp connected", { serverUrl: env.ACP_SERVER_URL, chainId: env.ACP_CHAIN_ID });
    });
  } catch (error) {
    // Never report connected on the way out: a runtime that logs a failure and
    // keeps running would leave an operator believing a stream exists.
    log("error", "acp connection failed", { error: String(error) });
    await closeDb();
    process.exit(1);
  }

  log("info", "acp listening", { address: await agent.getAddress() });

  let shuttingDown = false;

  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    log("info", "acp shutting down", { signal });

    const forceExit = setTimeout(() => {
      log("error", "acp shutdown timed out, forcing exit");
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
    forceExit.unref();

    await agent.stop();
    await closeDb();

    clearTimeout(forceExit);
    log("info", "acp shutdown complete");
    process.exit(0);
  };

  process.on("SIGINT", (signal) => void shutdown(signal));
  process.on("SIGTERM", (signal) => void shutdown(signal));
}

await main();

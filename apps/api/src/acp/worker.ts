import { closeDb } from "@aura/db";
import type { AcpAgent } from "@virtuals-protocol/acp-node-v2";

import { createAcpAgent } from "./agent.js";
import { AcpBridge } from "./bridge.js";
import { loadAcpEnv } from "./env.js";
import { AcpSpendExecutor } from "./spender.js";

const SHUTDOWN_TIMEOUT_MS = 10_000;

/**
 * How often to retry entries captured but not yet projected. A transient
 * database or ACP outage should heal without an operator noticing.
 */
const SWEEP_INTERVAL_MS = 30_000;

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

async function main(): Promise<void> {
  const env = loadAcpEnv();

  // Bound below, before any entry can arrive: the agent is not started until
  // after createAcpAgent returns, and only a started agent emits entries.
  let agent: AcpAgent | undefined;

  const bridge = new AcpBridge({
    fetchJobDescription: async (chainId, jobId) => {
      const job = await agent?.getApi().getJob(chainId, jobId);
      return job?.description ?? null;
    },
    log,
  });

  try {
    agent = await createAcpAgent(env, (_session, entry) => bridge.handleEntry(entry));
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

  const connected = agent;

  // Whatever a crash or an outage left behind, before anything new arrives.
  await bridge.sweep();

  // Nothing is constructed when spending is off, so there is no code path from
  // a running worker to session.fund() at all.
  const spender = env.ACP_SPEND_ENABLED
    ? new AcpSpendExecutor({ agent: connected, log })
    : null;

  log("info", "acp spend executor", {
    enabled: env.ACP_SPEND_ENABLED,
    note: spender ? "operator authorizations will be executed" : "ACP_SPEND_ENABLED is not true",
  });

  if (spender) await spender.sweep();

  const sweepTimer = setInterval(() => {
    void bridge.sweep().catch((error: unknown) => {
      log("error", "acp inbox sweep failed", { error: String(error) });
    });
    void spender?.sweep().catch((error: unknown) => {
      log("error", "acp spend sweep failed", { error: String(error) });
    });
  }, SWEEP_INTERVAL_MS);
  sweepTimer.unref();

  log("info", "acp listening", { address: await connected.getAddress() });

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

    clearInterval(sweepTimer);
    await connected.stop();
    await closeDb();

    clearTimeout(forceExit);
    log("info", "acp shutdown complete");
    process.exit(0);
  };

  process.on("SIGINT", (signal) => void shutdown(signal));
  process.on("SIGTERM", (signal) => void shutdown(signal));
}

await main();

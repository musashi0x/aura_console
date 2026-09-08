import { pathToFileURL } from "node:url";

import { closeDb } from "@aura/db";

import { createAcpAgent } from "./connection/agent.js";
import { loadAcpEnv } from "./connection/env.js";
import { AcpEvaluator } from "./outbound/evaluator.js";

export type EvaluateJobArgs = {
  chainId: number;
  jobId: string;
  action: "complete" | "reject";
  reason: string;
};

const USAGE =
  'Usage: pnpm --filter @aura/api acp:evaluate <chainId> <jobId> complete|reject "<reason>"';

export function parseEvaluateJobArgs(argv: readonly string[]): EvaluateJobArgs {
  const [chainIdRaw, jobId, actionRaw, reason] = argv;

  if (!chainIdRaw || !jobId || !actionRaw || !reason) {
    throw new Error(`Missing argument.\n${USAGE}`);
  }

  const chainId = Number.parseInt(chainIdRaw, 10);
  if (Number.isNaN(chainId) || chainId <= 0) {
    throw new Error(`Chain ID must be a positive integer.\n${USAGE}`);
  }

  const action = actionRaw.toLowerCase();
  if (action !== "complete" && action !== "reject") {
    throw new Error(`Action must be 'complete' or 'reject'.\n${USAGE}`);
  }

  if (reason.trim().length === 0) {
    throw new Error(`Reason cannot be empty.\n${USAGE}`);
  }

  return { chainId, jobId, action, reason };
}

/**
 * Operator command to evaluate an ACP job.
 * Creates an explicit complete or reject transaction/event.
 */
export async function main(): Promise<void> {
  const args = parseEvaluateJobArgs(process.argv.slice(2));

  let agent: Awaited<ReturnType<typeof createAcpAgent>> | undefined = undefined;
  let evaluatorAddress = "operator";

  try {
    const env = loadAcpEnv();
    agent = await createAcpAgent(env, () => {});
    evaluatorAddress = await agent.getAddress();
  } catch {
    // If running in environment without live ACP credentials (e.g. offline testing), continue with evaluator
  }

  const evaluator = new AcpEvaluator({ agent });
  const result = await evaluator.evaluate({
    chainId: args.chainId,
    jobId: args.jobId,
    action: args.action,
    reason: args.reason,
    evaluatorAddress,
  });

  console.log(
    JSON.stringify({
      level: "info",
      msg: `acp job ${args.action}d`,
      chainId: args.chainId,
      jobId: args.jobId,
      action: args.action,
      reason: args.reason,
      evaluatorAddress,
      eventId: result.eventId,
      runId: result.runId,
    }),
  );

  if (agent) {
    await agent.stop();
  }
  await closeDb();
}

const invokedDirectly =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  await main();
}

import { pathToFileURL } from "node:url";

import { closeDb } from "@aura/db";

import { createAcpAgent } from "./agent.js";
import { loadAcpEnv } from "./env.js";

/**
 * The chain's no-evaluator sentinel. Passing it — or omitting the evaluator,
 * which defaults to it — puts a job in skip-evaluation mode, where a provider's
 * submit auto-completes the job and releases escrow with nobody in the loop.
 */
export const NO_EVALUATOR_ADDRESS = "0x0000000000000000000000000000000000000000";

export type CreateJobArgs = {
  offeringName: string;
  providerAddress: string;
  requirement: Record<string, unknown>;
};

const USAGE =
  'Usage: pnpm --filter @aura/api acp:create-job "<offering name>" <0xProviderAddress> \'{"json":"requirement"}\'';

export function parseCreateJobArgs(argv: readonly string[]): CreateJobArgs {
  const [offeringName, providerAddress, requirementJson] = argv;

  if (!offeringName || !providerAddress || !requirementJson) {
    throw new Error(`Missing argument.\n${USAGE}`);
  }

  if (!/^0x[0-9a-fA-F]{40}$/.test(providerAddress)) {
    throw new Error(`Provider address must be a 0x-prefixed 20-byte address.\n${USAGE}`);
  }

  let requirement: unknown;
  try {
    requirement = JSON.parse(requirementJson);
  } catch {
    throw new Error(`Requirement must be valid JSON.\n${USAGE}`);
  }

  if (typeof requirement !== "object" || requirement === null || Array.isArray(requirement)) {
    throw new Error(`Requirement must be a JSON object.\n${USAGE}`);
  }

  return { offeringName, providerAddress, requirement: requirement as Record<string, unknown> };
}

/**
 * Always an explicit evaluator, never the sentinel.
 *
 * This is the one place in the repository that creates an economic
 * commitment, and the SDK's default for this option is the unsafe one. Passing
 * our own address means a submitted deliverable waits for a `complete` or
 * `reject` that only a human can decide to send.
 */
export function evaluatorOptions(evaluatorAddress: string): { evaluatorAddress: string } {
  if (!/^0x[0-9a-fA-F]{40}$/.test(evaluatorAddress)) {
    throw new Error(`Evaluator address must be a 0x-prefixed 20-byte address: ${evaluatorAddress}`);
  }

  if (evaluatorAddress.toLowerCase() === NO_EVALUATOR_ADDRESS) {
    throw new Error(
      "Refusing to create a job with the no-evaluator sentinel: that mode releases escrow " +
        "automatically when the provider submits.",
    );
  }

  return { evaluatorAddress };
}

/**
 * Operator command. Nothing calls this on a schedule and the ACP runtime's
 * entry handler cannot reach it: creating a job is a deliberate human action.
 */
async function main(): Promise<void> {
  const args = parseCreateJobArgs(process.argv.slice(2));
  const env = loadAcpEnv();

  const agent = await createAcpAgent(env, () => {});
  const evaluatorAddress = await agent.getAddress();

  const jobId = await agent.createJobByOfferingName(
    env.ACP_CHAIN_ID,
    args.offeringName,
    args.providerAddress,
    args.requirement,
    evaluatorOptions(evaluatorAddress),
  );

  console.log(
    JSON.stringify({
      level: "info",
      msg: "acp job created",
      jobId: jobId.toString(),
      chainId: env.ACP_CHAIN_ID,
      offeringName: args.offeringName,
      providerAddress: args.providerAddress,
      evaluatorAddress,
    }),
  );

  await agent.stop();
  await closeDb();
}

const invokedDirectly =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  await main();
}

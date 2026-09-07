import { pathToFileURL } from "node:url";

import { ComputeClient } from "./client.js";
import { loadComputeEnv } from "./env.js";

/**
 * Operator commands for Agent Compute.
 *
 * Nothing calls these on a schedule and the ACP runtime cannot reach them, for
 * the same reason `create-job` is a command rather than a code path: a
 * completion draws on the agent's wallet, so buying one is a deliberate human
 * action.
 */

const USAGE = [
  "Usage:",
  "  pnpm --filter @aura/api acp:compute models",
  '  pnpm --filter @aura/api acp:compute complete "<prompt>" [--model <id>] [--max-tokens <n>]',
].join("\n");

export type CompleteArgs = {
  prompt: string;
  model: string | undefined;
  maxTokens: number;
};

/**
 * Defaults to a budget well above any reasoning preamble. A small
 * `max_tokens` on a reasoning model is charged in full and returns no content,
 * so a low default would bill the operator for nothing on their first run.
 */
export const DEFAULT_MAX_TOKENS = 1024;

export function parseCompleteArgs(argv: readonly string[]): CompleteArgs {
  const [prompt, ...rest] = argv;
  if (!prompt) {
    throw new Error(`Missing prompt.\n${USAGE}`);
  }

  let model: string | undefined;
  let maxTokens = DEFAULT_MAX_TOKENS;

  for (let index = 0; index < rest.length; index += 2) {
    const flag = rest[index];
    const value = rest[index + 1];
    if (value === undefined) {
      throw new Error(`Flag ${flag} needs a value.\n${USAGE}`);
    }
    if (flag === "--model") {
      model = value;
    } else if (flag === "--max-tokens") {
      const parsed = Number(value);
      if (!Number.isInteger(parsed) || parsed < 1) {
        throw new Error(`--max-tokens must be a positive integer.\n${USAGE}`);
      }
      maxTokens = parsed;
    } else {
      throw new Error(`Unknown flag ${flag}.\n${USAGE}`);
    }
  }

  return { prompt, model, maxTokens };
}

function emit(payload: Record<string, unknown>): void {
  console.log(JSON.stringify(payload));
}

async function main(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2);
  const client = new ComputeClient(loadComputeEnv());

  if (command === "models") {
    const result = await client.listModels();
    if (!result.ok) {
      emit({ level: "error", msg: "compute models failed", code: result.code, error: result.message });
      process.exit(1);
    }
    for (const model of result.value) {
      emit({ level: "info", msg: "compute model", id: model.id, contextLength: model.contextLength });
    }
    return;
  }

  if (command === "complete") {
    const args = parseCompleteArgs(rest);

    // The catalog is fetched, never assumed: the docs say the list changes, so
    // a hardcoded default would rot into an unexplainable request-time error.
    const model = args.model ?? (await firstModelId(client));

    const result = await client.complete({
      model,
      messages: [{ role: "user", content: args.prompt }],
      maxTokens: args.maxTokens,
    });

    if (!result.ok) {
      emit({ level: "error", msg: "compute completion failed", model, code: result.code, error: result.message });
      process.exit(1);
    }

    // Reported separately from the content, because a truncated answer is
    // still a charge and the operator needs to see it as one.
    emit({
      level: "info",
      msg: "compute completion",
      model: result.value.model,
      provider: result.value.provider,
      finishReason: result.value.finishReason,
      costUsdc: result.value.usage.costUsdc,
      promptTokens: result.value.usage.promptTokens,
      completionTokens: result.value.usage.completionTokens,
      reasoningTokens: result.value.usage.reasoningTokens,
      content: result.value.content,
    });

    if (result.value.content === null) {
      emit({
        level: "warn",
        msg: "compute completion returned no content",
        hint: `finish_reason=${result.value.finishReason}; raise --max-tokens above the reasoning budget`,
      });
    }
    return;
  }

  console.error(USAGE);
  process.exit(1);
}

async function firstModelId(client: ComputeClient): Promise<string> {
  const models = await client.listModels();
  if (!models.ok || models.value.length === 0) {
    throw new Error("Could not resolve a model id from /models; pass --model explicitly.");
  }
  return models.value[0]!.id;
}

const invokedDirectly =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  await main();
}

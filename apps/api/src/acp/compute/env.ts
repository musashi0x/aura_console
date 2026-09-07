import { loadRootEnvFile } from "@aura/db";
import { z } from "zod";

loadRootEnvFile();

/**
 * The endpoint EconomyOS publishes for Agent Compute. It is a default rather
 * than a constant because the dashboard hands each agent its own base URL to
 * copy, and an operator on a different one should not have to patch source.
 *
 * https://os.virtuals.io/agent-identity/compute/overview
 */
export const DEFAULT_COMPUTE_BASE_URL = "https://compute.virtuals.io/v1";

/**
 * Keys are issued from the agent's Compute settings and are prefixed. The
 * prefix is checked because the mistake worth catching is pasting one of the
 * other three credentials this repository already knows about — a Privy
 * authorization key, a wallet id, or a 0x address — into the wrong variable.
 */
const computeApiKey = /^acp-[A-Za-z0-9]{8,}$/;

const computeEnvSchema = z.object({
  ACP_API_KEY: z
    .string()
    .refine(
      (value) => computeApiKey.test(value),
      "ACP_API_KEY must be an EconomyOS compute key, of the form acp-<alphanumeric>",
    ),
  ACP_COMPUTE_BASE_URL: z
    .string()
    .refine((value) => /^https?:\/\//.test(value), "ACP_COMPUTE_BASE_URL must be an http:// or https:// URL")
    .default(DEFAULT_COMPUTE_BASE_URL),
});

export type ComputeEnv = z.infer<typeof computeEnvSchema>;

export type ComputeEnvResult =
  | { ok: true; env: ComputeEnv }
  | { ok: false; message: string };

/**
 * Parses without exiting, the same split the ACP environment uses, so a caller
 * can ask whether compute is configured without taking the process down.
 */
export function parseComputeEnv(source: NodeJS.ProcessEnv = process.env): ComputeEnvResult {
  const result = computeEnvSchema.safeParse(source);
  if (result.success) {
    return { ok: true, env: result.data };
  }
  const details = result.error.issues
    .map((issue) => `  ${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("\n");
  return { ok: false, message: `Invalid compute environment:\n${details}` };
}

/**
 * Whether compute is configured at all.
 *
 * Compute is optional and independent of the marketplace: an agent can hold a
 * compute key and never touch ACP, or run ACP with no compute key at all. A
 * caller that cannot answer this would have to treat "not configured" and
 * "configured but broken" as one state, which is the unavailable-versus-empty
 * mistake this repository refuses to make everywhere else.
 */
export function isComputeConfigured(source: NodeJS.ProcessEnv = process.env): boolean {
  return parseComputeEnv(source).ok;
}

/** Parses or exits 1, naming the offending variable and never its value. */
export function loadComputeEnv(source: NodeJS.ProcessEnv = process.env): ComputeEnv {
  const result = parseComputeEnv(source);
  if (!result.ok) {
    console.error(result.message);
    process.exit(1);
  }
  return result.env;
}

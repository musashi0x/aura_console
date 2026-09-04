import { loadRootEnvFile } from "@aura/db";
import { z } from "zod";

loadRootEnvFile();

/**
 * Base Sepolia. The runtime is non-mainnet by construction, so the chain id is
 * a fixed literal rather than a range: a typo that reached Base mainnet would
 * be a real-money mistake, and there is no reason for this slice to accept one.
 */
export const BASE_SEPOLIA_CHAIN_ID = 84_532;

const hexAddress = /^0x[0-9a-fA-F]{40}$/;
const hexPrivateKey = /^0x[0-9a-fA-F]{64}$/;

const acpEnvSchema = z.object({
  ACP_CHAIN_ID: z.coerce
    .number()
    .int("ACP_CHAIN_ID must be an integer")
    .refine(
      (value) => value === BASE_SEPOLIA_CHAIN_ID,
      `ACP_CHAIN_ID must be ${BASE_SEPOLIA_CHAIN_ID} (Base Sepolia); this runtime is non-mainnet`,
    ),
  ACP_WALLET_ADDRESS: z
    .string()
    .regex(hexAddress, "ACP_WALLET_ADDRESS must be a 0x-prefixed 20-byte address"),
  ACP_WALLET_PRIVATE_KEY: z
    .string()
    .regex(hexPrivateKey, "ACP_WALLET_PRIVATE_KEY must be a 0x-prefixed 32-byte private key"),
  ACP_RPC_URL: z
    .string()
    .refine(
      (value) => value.startsWith("http://") || value.startsWith("https://"),
      "ACP_RPC_URL must be an http:// or https:// URL",
    ),
  ACP_SERVER_URL: z
    .string()
    .refine(
      (value) => value.startsWith("http://") || value.startsWith("https://"),
      "ACP_SERVER_URL must be an http:// or https:// URL",
    ),
});

export type AcpEnv = z.infer<typeof acpEnvSchema>;

export type AcpEnvResult =
  | { ok: true; env: AcpEnv }
  | { ok: false; message: string };

/**
 * Parses without exiting, so tests can assert on the message. Every issue
 * names its own variable, because "invalid environment" sends the reader
 * hunting through five values to find the one that is wrong.
 */
export function parseAcpEnv(source: NodeJS.ProcessEnv = process.env): AcpEnvResult {
  const result = acpEnvSchema.safeParse(source);
  if (result.success) {
    return { ok: true, env: result.data };
  }
  const details = result.error.issues
    .map((issue) => `  ${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("\n");
  return { ok: false, message: `Invalid ACP environment:\n${details}` };
}

/**
 * Parses or exits 1. Called at the worker's module load, before any network or
 * signing client is constructed, so a misconfigured runtime dies immediately
 * and never half-connects.
 *
 * The private key is never echoed: the message names the variable, not its
 * value.
 */
export function loadAcpEnv(source: NodeJS.ProcessEnv = process.env): AcpEnv {
  const result = parseAcpEnv(source);
  if (!result.ok) {
    console.error(result.message);
    process.exit(1);
  }
  return result.env;
}

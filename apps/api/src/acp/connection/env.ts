import { loadRootEnvFile } from "@aura/db";
import { z } from "zod";

loadRootEnvFile();

/**
 * The two chains this runtime knows how to talk to, as fixed literals rather
 * than a range: every other chain id is a typo, and a typo that reached one is
 * a real-money mistake.
 *
 * Base mainnet is real money. It is accepted because an operator asked for it,
 * not because it is safe by default — the chain id has to be written out in
 * full, and `ACP_SPEND_ENABLED` still gates every transfer independently.
 */
export const BASE_SEPOLIA_CHAIN_ID = 84_532;
export const BASE_MAINNET_CHAIN_ID = 8_453;

const SUPPORTED_CHAIN_IDS = [BASE_SEPOLIA_CHAIN_ID, BASE_MAINNET_CHAIN_ID];

const hexAddress = /^0x[0-9a-fA-F]{40}$/;

/**
 * Privy's authorization key: base64 PKCS8 with no PEM headers, which Privy
 * hands out with a `wallet-auth:` prefix. It authorizes a signing request
 * against `api.privy.io`; it is not the wallet's own key and there is no EOA
 * key to hold, because the agent wallet is Privy-managed.
 */
const privyAuthorizationKey = /^(wallet-auth:)?[A-Za-z0-9+/]{40,}={0,2}$/;

const acpEnvSchema = z.object({
  ACP_CHAIN_ID: z.coerce
    .number()
    .int("ACP_CHAIN_ID must be an integer")
    .refine(
      (value) => SUPPORTED_CHAIN_IDS.includes(value),
      `ACP_CHAIN_ID must be ${BASE_SEPOLIA_CHAIN_ID} (Base Sepolia) or ${BASE_MAINNET_CHAIN_ID} (Base mainnet, real funds)`,
    ),
  ACP_WALLET_ADDRESS: z
    .string()
    .regex(hexAddress, "ACP_WALLET_ADDRESS must be a 0x-prefixed 20-byte address"),
  /**
   * The Privy wallet backing ACP_WALLET_ADDRESS. Both are needed: the address
   * is what ACP and the chain see, the id is what Privy's RPC is addressed by,
   * and nothing in this runtime can derive one from the other.
   */
  ACP_PRIVY_WALLET_ID: z
    .string()
    .regex(/^\S{8,}$/, "ACP_PRIVY_WALLET_ID must be the Privy wallet id, with no whitespace"),
  ACP_PRIVY_AUTHORIZATION_KEY: z
    .string()
    .refine(
      (value) => !value.startsWith("0x"),
      "ACP_PRIVY_AUTHORIZATION_KEY is Privy's authorization key, not a 0x EOA private key; a Privy-managed agent wallet has no exportable EOA key",
    )
    .refine(
      (value) => privyAuthorizationKey.test(value),
      "ACP_PRIVY_AUTHORIZATION_KEY must be a base64 PKCS8 key, optionally prefixed with 'wallet-auth:'",
    ),
  /**
   * Optional. Left unset the runtime uses the SDK's testnet Privy app, which is
   * the one that matches the dev ACP host. Set it only when Virtuals tells you
   * your agent lives under a different app.
   */
  ACP_PRIVY_APP_ID: z.string().min(1, "ACP_PRIVY_APP_ID must not be empty").optional(),
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
  /**
   * Off unless the operator says otherwise. With it unset the runtime cannot
   * move money at all, whatever is sitting in `acp_spend_intents` — which
   * matters because the API has no authentication and the authorization route
   * is reachable by anyone who can reach the port.
   */
  ACP_SPEND_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
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
 * The authorization key is never echoed: the message names the variable, not
 * its value.
 */
export function loadAcpEnv(source: NodeJS.ProcessEnv = process.env): AcpEnv {
  const result = parseAcpEnv(source);
  if (!result.ok) {
    console.error(result.message);
    process.exit(1);
  }
  return result.env;
}

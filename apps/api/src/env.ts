import { loadRootEnvFile } from "@aura/db";
import { z } from "zod";

loadRootEnvFile();

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce
    .number()
    .int("PORT must be an integer")
    .min(1)
    .max(65_535)
    .default(3001),
  DATABASE_URL: z
    .string()
    .min(1, "DATABASE_URL is required")
    .refine(
      (value) => value.startsWith("postgres://") || value.startsWith("postgresql://"),
      "DATABASE_URL must be a postgres:// or postgresql:// connection string",
    ),
  /**
   * The operator's own agent. v0.1 is single-operator with no account model, so
   * first-party access is established by deployment rather than by a session.
   * Adding a second operator requires real authentication, not a header.
   */
  AGENT_ID: z.string().min(1).default("agent_buyer_1"),
  /**
   * Base URL of the Google ADK agent that answers operator questions. Optional
   * on purpose: with no agent configured the chat endpoint reports that it is
   * unreachable rather than inventing a reply.
   */
  ADK_BASE_URL: z.string().url().optional(),
  /** Seconds to wait for the agent's first token before giving up. */
  ADK_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120_000).default(30_000),
  CORS_ORIGINS: z
    .string()
    .default("http://localhost:3000")
    .transform((value) =>
      value
        .split(",")
        .map((origin) => origin.trim())
        .filter((origin) => origin.length > 0),
    ),
});

export type ApiEnv = z.infer<typeof envSchema>;

/**
 * Parses the environment or exits. Called before the listener binds, so a
 * misconfigured process dies in seconds with a message naming the variable.
 */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): ApiEnv {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `  ${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("\n");
    console.error(`Invalid API environment:\n${details}`);
    process.exit(1);
  }
  return result.data;
}

export const env: ApiEnv = loadEnv();

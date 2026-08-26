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

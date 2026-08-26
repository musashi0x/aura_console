import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z
    .string()
    .min(1, "DATABASE_URL is required")
    .refine(
      (value) => value.startsWith("postgres://") || value.startsWith("postgresql://"),
      "DATABASE_URL must be a postgres:// or postgresql:// connection string",
    ),
});

export type DbEnv = z.infer<typeof envSchema>;

let cached: DbEnv | undefined;

/**
 * Parses and caches the database environment. Throws a descriptive error the
 * first time it is called with a missing or malformed DATABASE_URL, so the
 * owning process fails fast instead of erroring later under load.
 */
export function loadDbEnv(source: NodeJS.ProcessEnv = process.env): DbEnv {
  if (cached) return cached;

  const result = envSchema.safeParse(source);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `  ${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid database environment:\n${details}`);
  }

  cached = result.data;
  return cached;
}

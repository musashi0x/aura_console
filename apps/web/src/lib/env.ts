import { z } from "zod";

const envSchema = z.object({
  NEXT_PUBLIC_API_URL: z
    .string()
    .min(1, "NEXT_PUBLIC_API_URL is required")
    .refine((value) => URL.canParse(value), "NEXT_PUBLIC_API_URL must be a valid URL"),
});

export type WebEnv = z.infer<typeof envSchema>;

function parseEnv(): WebEnv {
  // Next inlines process.env.NEXT_PUBLIC_* at build time only when referenced
  // statically, so the property access below must stay literal.
  const result = envSchema.safeParse({
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  });

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `  ${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid web environment:\n${details}`);
  }

  return result.data;
}

export const env: WebEnv = parseEnv();

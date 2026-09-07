import path from "node:path";
import { fileURLToPath } from "node:url";

import { config as loadEnvFile } from "dotenv";
import type { NextConfig } from "next";

// The repository keeps one .env at the root; Next only looks inside the app.
//
// This loads the whole root .env into the Next *server* process, secrets
// included — ACP_WALLET_PRIVATE_KEY among them once the ACP worker is
// configured. Nothing here reaches the browser: Next only inlines variables
// prefixed NEXT_PUBLIC_, and this config sets no `env` block that would widen
// that. Do not add one, and do not rename a secret to NEXT_PUBLIC_ anything.
loadEnvFile({
  path: path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", ".env"),
  override: false,
  quiet: true,
});

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
    "..",
  ),
};

export default nextConfig;

import path from "node:path";
import { fileURLToPath } from "node:url";

import { config as loadEnvFile } from "dotenv";
import type { NextConfig } from "next";

// The repository keeps one .env at the root; Next only looks inside the app.
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

import path from "node:path";
import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const here = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(here, "src") },
  },
  test: {
    environment: "jsdom",
    // The web env schema is validated at module load, so tests need a value.
    env: { NEXT_PUBLIC_API_URL: "http://localhost:3001" },
    globals: true,
    setupFiles: [path.resolve(here, "src/test-support/setup.ts")],
    include: ["src/**/*.test.{ts,tsx}"],
  },
});

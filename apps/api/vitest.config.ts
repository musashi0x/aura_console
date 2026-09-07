import { defineConfig } from "vitest/config";

import { testDatabaseUrl } from "./src/test/database.js";
import { testSibylDbPath, testSibylHomeDir } from "./src/test/sibyl.js";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    globalSetup: ["./src/test/global-setup.ts"],
    setupFiles: ["./src/test/setup.ts"],
    // The suite writes, so it must never reach the development database.
    env: {
      NODE_ENV: "test",
      DATABASE_URL: testDatabaseUrl(),
      GEMINI_API_KEY: "test-key",
      HOME: testSibylHomeDir(),
      SIBYL_DB_PATH: testSibylDbPath(),
    },
    // Route handlers share one connection pool and one schema, so parallel
    // files would truncate each other's rows mid-test.
    fileParallelism: false,
    maxWorkers: 1,
  },
});


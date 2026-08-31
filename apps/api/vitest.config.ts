import { defineConfig } from "vitest/config";

import { testDatabaseUrl } from "./src/test/database.js";

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
    },
    // Route handlers share one connection pool and one schema, so parallel
    // files would truncate each other's rows mid-test.
    fileParallelism: false,
  },
});

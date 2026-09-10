import { defineConfig } from "vitest/config";
import { testSibylDbPath, testSibylHomeDir } from "./src/test-support/sibyl.js";

export default defineConfig({
  test: {
    environment: "node",
    include: [
      "src/services/challenger-m1-primitives.stress.test.ts",
      "src/services/reflection-engine.test.ts",
      "src/services/consolidation-engine.test.ts",
      "src/services/temporal-engine.test.ts",
      "src/services/semantic-search.test.ts",
      "src/services/executive-summarizer.test.ts",
    ],
    fileParallelism: false,
    maxWorkers: 1,
    env: {
      NODE_ENV: "test",
      HOME: testSibylHomeDir(),
      SIBYL_DB_PATH: testSibylDbPath(),
    },
  },
});

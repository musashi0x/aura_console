import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    env: {
      NODE_ENV: "test",
      // Tests never open a socket or a pool; this only satisfies env validation.
      DATABASE_URL: "postgresql://aura:aura@localhost:5432/aura_console_test",
    },
  },
});

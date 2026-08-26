import { defineConfig } from "drizzle-kit";

import { loadDbEnv } from "./src/env.js";
import { loadRootEnvFile } from "./src/root-env.js";

loadRootEnvFile();

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema/index.ts",
  out: "./drizzle",
  strict: true,
  verbose: true,
  dbCredentials: {
    url: loadDbEnv().DATABASE_URL,
  },
});

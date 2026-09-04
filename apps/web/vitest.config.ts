import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * Under vite 8 / rolldown, `?raw` on a `.css` file resolves to an empty
 * string (the CSS pipeline swallows it) and `node:fs` is unresolvable in the
 * jsdom test module graph. Both tests that assert on stylesheet text read
 * from disk instead — the file content is inlined as a compile-time constant
 * so no module resolution is involved at all.
 */
function cssRaw(name: string): string {
  return readFileSync(path.resolve(here, name), "utf8");
}

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(here, "src") },
  },
  define: {
    __TOKENS_CSS__: JSON.stringify(cssRaw("src/styles/tokens.css")),
    __GLOBALS_CSS__: JSON.stringify(cssRaw("src/app/globals.css")),
  },
  test: {
    environment: "jsdom",
    // React's `act` only exists on the development build. Vitest 4 defaults to
    // production mode, which loads react.production.js and makes every
    // @testing-library/react render throw "React.act is not a function".
    env: {
      NODE_ENV: "development",
      // The web env schema is validated at module load, so tests need a value.
      NEXT_PUBLIC_API_URL: "http://localhost:3001",
    },
    globals: true,
    setupFiles: [path.resolve(here, "src/test/setup.ts")],
    include: ["src/**/*.test.{ts,tsx}"],
  },
});

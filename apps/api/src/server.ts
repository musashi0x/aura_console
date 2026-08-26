import { closeDb } from "@aura/db";
import { serve } from "@hono/node-server";

import { app } from "./app.js";
import { env } from "./env.js";

const SHUTDOWN_TIMEOUT_MS = 10_000;

const server = serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(
    JSON.stringify({
      level: "info",
      msg: "listening",
      address: `http://localhost:${info.port}`,
      env: env.NODE_ENV,
    }),
  );
});

let shuttingDown = false;

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(JSON.stringify({ level: "info", msg: "shutting down", signal }));

  const forceExit = setTimeout(() => {
    console.error("[api] shutdown timed out, forcing exit");
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  forceExit.unref();

  await new Promise<void>((resolve) => {
    server.close(() => {
      resolve();
    });
  });
  await closeDb();

  clearTimeout(forceExit);
  console.log(JSON.stringify({ level: "info", msg: "shutdown complete" }));
  process.exit(0);
}

process.on("SIGINT", (signal) => void shutdown(signal));
process.on("SIGTERM", (signal) => void shutdown(signal));

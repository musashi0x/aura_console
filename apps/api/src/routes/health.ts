import { getDb, sql } from "@aura/db";
import { Hono } from "hono";

import { errorBody } from "../errors.js";

export const health = new Hono();

/** Liveness only. Must answer even when Postgres is down. */
health.get("/", (c) =>
  c.json({
    status: "ok",
    uptime: Math.round(process.uptime() * 1000) / 1000,
    timestamp: new Date().toISOString(),
  }),
);

/** Readiness of the database dependency. */
health.get("/db", async (c) => {
  const start = performance.now();
  try {
    await getDb().execute(sql`select 1`);
    const latencyMs = Math.round((performance.now() - start) * 100) / 100;
    return c.json({ status: "ok", latencyMs });
  } catch (error) {
    // Log the real cause server-side; the client gets nothing exploitable.
    console.error("[health] database check failed", error);
    return c.json(
      { status: "error", ...errorBody("database_unreachable", "Database unreachable") },
      503,
    );
  }
});

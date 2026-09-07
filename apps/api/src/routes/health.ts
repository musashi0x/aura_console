import { getDb, sql } from "@aura/db";
import { Hono } from "hono";

import { errorBody } from "../errors.js";
import { getAgentStatus } from "../services/adk-agent.js";
import { getSibylStatus } from "../services/sibyl.js";

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

/**
 * Readiness of Sibyl Memory, reported by Sibyl.
 *
 * 200 with `reachable: false` rather than 503: the API itself is fine, and the
 * Console needs the reason to render the right unavailable state. A 503 here
 * would say the service is down when what is down is one dependency.
 */
health.get("/sibyl", async (c) => c.json(await getSibylStatus()));

/**
 * Readiness of the answering agent. Same contract as `/health/sibyl`: 200 with
 * `reachable: false` and a reason, because the API is up and one dependency is
 * not.
 */
health.get("/agent", async (c) => c.json(await getAgentStatus()));

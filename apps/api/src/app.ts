import { Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";

import { env } from "./env.js";
import { errorBody } from "./errors.js";
import { requestLogger } from "./middleware/request-logger.js";
import { approvals } from "./routes/approvals.js";
import { chat } from "./routes/chat.js";
import { counterparties } from "./routes/counterparties.js";
import { health } from "./routes/health.js";
import { counterpartyMemory, memory } from "./routes/memory.js";
import { policies } from "./routes/policies.js";
import { runs } from "./routes/runs.js";

export const app = new Hono();

app.use("*", requestLogger);

app.use(
  "*",
  cors({
    origin: (origin) => (env.CORS_ORIGINS.includes(origin) ? origin : null),
    allowMethods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    maxAge: 600,
  }),
);

app.route("/health", health);
app.route("/api/runs", runs);
// Mounted on the same prefix: the Run resource owns its own event log, and its
// live surfaces are paths under a Run rather than a second Run namespace.
app.route("/api/runs", chat);
// The approval path hangs off the Run it authorizes, and keeps its own file
// because it is the only endpoint in the console that authorizes a spend.
app.route("/api/runs", approvals);
app.route("/api/counterparties", counterparties);
// Mounted on the same prefix as the counterparty projection: memory read
// *about* a counterparty hangs off that counterparty, but composing Postgres
// with Sibyl is a different concern from the AD-04 projection, so it keeps its
// own file.
app.route("/api/counterparties", counterpartyMemory);
// The list surface is its own resource rather than a counterparty subpath:
// it answers "who does this operator remember", not "what about this one".
app.route("/api/memory", memory);
app.route("/api/policies", policies);

app.notFound((c) =>
  c.json(errorBody("not_found", `No route for ${c.req.method} ${c.req.path}`), 404),
);

app.onError((error, c) => {
  if (error instanceof HTTPException) {
    const response = error.getResponse();
    if (response.headers.get("content-type")?.includes("application/json")) {
      return response;
    }
    return c.json(errorBody("http_error", error.message), error.status);
  }

  // Unexpected: log everything, return nothing but a code.
  console.error("[api] unhandled error", error);
  return c.json(
    errorBody("internal_error", "An unexpected error occurred"),
    500,
  );
});

export type App = typeof app;

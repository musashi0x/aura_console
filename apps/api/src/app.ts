import { Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";

import { env } from "./env.js";
import { errorBody } from "./errors.js";
import { requestLogger } from "./middleware/request-logger.js";
import { health } from "./routes/health.js";

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

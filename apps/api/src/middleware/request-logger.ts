import { type MiddlewareHandler } from "hono";

/** One structured line per request: method, path, status, duration. */
export const requestLogger: MiddlewareHandler = async (c, next) => {
  const start = performance.now();
  await next();
  const durationMs = Math.round((performance.now() - start) * 100) / 100;

  console.log(
    JSON.stringify({
      level: "info",
      msg: "request",
      method: c.req.method,
      path: c.req.path,
      status: c.res.status,
      durationMs,
    }),
  );
};

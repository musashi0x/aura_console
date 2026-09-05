import { Hono } from "hono";

import { listCounterpartiesFromSibyl } from "../services/sibyl.js";

export const memory = new Hono();

/**
 * The operator's own relationship memory, from Sibyl.
 *
 * 503 when Sibyl cannot be read, never `{items: []}`. An empty list is a claim
 * that we looked and there is nobody; an unreadable store is a claim that we
 * could not look. The Console renders those as different surfaces, and it can
 * only do that if this endpoint keeps them apart.
 */
memory.get("/counterparties", async (c) => {
  const result = await listCounterpartiesFromSibyl();
  if (!result.ok) {
    return c.json({ error: { code: result.code, message: result.detail } }, 503);
  }
  return c.json({ items: result.items });
});

import { Hono } from "hono";
import { z } from "zod";

import { httpError } from "../errors.js";
import { PolicyStore } from "../services/policy-store.js";

const store = new PolicyStore();

const money = z
  .string()
  .regex(/^\d+(\.\d{1,6})?$/, "must be a decimal amount")
  .nullish();

const policySchema = z.object({
  auto_spend_limit_usdc: money,
  absolute_spend_limit_usdc: money,
  daily_spend_limit_usdc: money,
  human_approval_above_usdc: money,
  minimum_reliability: z.number().int().min(0).max(100).nullish(),
  preferred_provider_premium_limit: z
    .string()
    .regex(/^\d+(\.\d{1,4})?$/, "must be a decimal ratio")
    .nullish(),
  block_after_recent_failures: z.number().int().min(0).max(100).nullish(),
  prefer_previous_success: z.boolean().optional(),
  require_verified_commitment: z.boolean().optional(),
  /**
   * Whether an operator override may turn a memory ERROR into an approval.
   * It can never reach AUTO; see memory-authorization.
   */
  memory_error_override_allowed: z.boolean().optional(),
});

export const policies = new Hono();

policies.get("/:agentId", async (c) => {
  const agentId = c.req.param("agentId");
  const policy = await store.get(agentId);
  // No stored policy is a 404, not an empty object. Returning defaults here
  // would present an assumed ceiling as a configured one.
  if (!policy) {
    throw httpError(404, "policy_not_found", `No policy stored for agent ${agentId}`);
  }
  return c.json(policy);
});

policies.put("/:agentId", async (c) => {
  const agentId = c.req.param("agentId");
  const body = await c.req.json().catch(() => {
    throw httpError(400, "invalid_json", "Request body must be JSON");
  });
  const parsed = policySchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw httpError(
      422,
      "invalid_policy",
      `${issue?.path.join(".") ?? "body"}: ${issue?.message ?? "invalid"}`,
    );
  }
  return c.json(await store.put(agentId, parsed.data));
});

import { eq, getDb, schema, sql, type Database } from "@aura/db";

export interface PolicyBody {
  auto_spend_limit_usdc: string | null;
  absolute_spend_limit_usdc: string | null;
  daily_spend_limit_usdc: string | null;
  human_approval_above_usdc: string | null;
  minimum_reliability: number | null;
  preferred_provider_premium_limit: string | null;
  block_after_recent_failures: number | null;
  prefer_previous_success: boolean;
  require_verified_commitment: boolean;
  memory_error_override_allowed: boolean;
}

export interface PolicyResponse extends PolicyBody {
  agent_id: string;
  policy_version: number;
}

function toResponse(row: schema.AgentPolicy): PolicyResponse {
  return {
    agent_id: row.agentId,
    policy_version: row.policyVersion,
    // Money stays a string end to end. Parsing a spend limit as a float is how
    // a ceiling silently becomes a different ceiling.
    auto_spend_limit_usdc: row.autoSpendLimitUsdc,
    absolute_spend_limit_usdc: row.absoluteSpendLimitUsdc,
    daily_spend_limit_usdc: row.dailySpendLimitUsdc,
    human_approval_above_usdc: row.humanApprovalAboveUsdc,
    minimum_reliability: row.minimumReliability,
    preferred_provider_premium_limit: row.preferredProviderPremiumLimit,
    block_after_recent_failures: row.blockAfterRecentFailures,
    prefer_previous_success: row.preferPreviousSuccess,
    require_verified_commitment: row.requireVerifiedCommitment,
    memory_error_override_allowed: row.memoryErrorOverrideAllowed,
  };
}

export class PolicyStore {
  constructor(private readonly db: Database = getDb()) {}

  /** Null rather than a default policy: an assumed ceiling is not a ceiling. */
  async get(agentId: string): Promise<PolicyResponse | null> {
    const [row] = await this.db
      .select()
      .from(schema.agentPolicies)
      .where(eq(schema.agentPolicies.agentId, agentId))
      .limit(1);
    return row ? toResponse(row) : null;
  }

  /** Every write bumps `policy_version`, so a decision can name the version it read. */
  async put(agentId: string, body: Partial<PolicyBody>): Promise<PolicyResponse> {
    const values = {
      autoSpendLimitUsdc: body.auto_spend_limit_usdc ?? null,
      absoluteSpendLimitUsdc: body.absolute_spend_limit_usdc ?? null,
      dailySpendLimitUsdc: body.daily_spend_limit_usdc ?? null,
      humanApprovalAboveUsdc: body.human_approval_above_usdc ?? null,
      minimumReliability: body.minimum_reliability ?? null,
      preferredProviderPremiumLimit: body.preferred_provider_premium_limit ?? null,
      blockAfterRecentFailures: body.block_after_recent_failures ?? null,
      preferPreviousSuccess: body.prefer_previous_success ?? true,
      requireVerifiedCommitment: body.require_verified_commitment ?? false,
      memoryErrorOverrideAllowed: body.memory_error_override_allowed ?? false,
    };

    const [row] = await this.db
      .insert(schema.agentPolicies)
      .values({ agentId, policyVersion: 1, ...values })
      .onConflictDoUpdate({
        target: schema.agentPolicies.agentId,
        set: {
          ...values,
          // Incremented in SQL so two concurrent writes cannot both read the
          // same version and store the same next one.
          policyVersion: sql`${schema.agentPolicies.policyVersion} + 1`,
          updatedAt: new Date(),
        },
      })
      .returning();

    if (!row) throw new Error("upsert into agent_policies returned no row");
    return toResponse(row);
  }
}

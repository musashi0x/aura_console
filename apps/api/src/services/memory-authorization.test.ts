import { describe, expect, it } from "vitest";

import { authorizeFromRetrieval } from "./memory-authorization.js";
import type { RetrievalResult } from "./memory-store.js";
import type { PolicyResponse } from "./policy-store.js";

const permissive: PolicyResponse = {
  agent_id: "agent_buyer_1",
  policy_version: 3,
  auto_spend_limit_usdc: "1.000000",
  absolute_spend_limit_usdc: "5.000000",
  daily_spend_limit_usdc: "20.000000",
  human_approval_above_usdc: "1.000000",
  minimum_reliability: 70,
  preferred_provider_premium_limit: "0.2500",
  block_after_recent_failures: 2,
  prefer_previous_success: true,
  require_verified_commitment: false,
  memory_error_override_allowed: false,
};

const available: RetrievalResult = {
  status: "AVAILABLE",
  counterpartyKey: "virtuals:agent:alpha",
  memoryVersion: 13,
  episodesUsed: 4,
  relationshipStatus: "PREFERRED",
  overallReliability: 91,
  taskFit: 94,
  confidence: 74,
};

const error: RetrievalResult = {
  status: "ERROR",
  counterpartyKey: "virtuals:agent:alpha",
  retryable: true,
};

describe("AD-03: what a retrieval result permits", () => {
  it("reaches AUTO only when memory is actually available and every rule passes", () => {
    expect(authorizeFromRetrieval(available, permissive).approval).toBe("AUTO");
  });

  it("never reaches AUTO on ERROR, whatever the policy says", () => {
    // The whole point of the rule: an unknown state cannot authorize spending.
    expect(authorizeFromRetrieval(error, permissive).approval).toBe("DENY");
    expect(
      authorizeFromRetrieval(error, { ...permissive, memory_error_override_allowed: true })
        .approval,
    ).toBe("REQUIRE_APPROVAL");
  });

  it("keeps NO_HISTORY and ERROR apart", () => {
    const noHistory = authorizeFromRetrieval(
      { status: "NO_HISTORY", counterpartyKey: "virtuals:agent:new" },
      permissive,
    );
    const failed = authorizeFromRetrieval(error, permissive);
    // Retrieval succeeded and found nothing, versus not knowing what exists.
    // Mapping one onto the other is exactly what AD-03 forbids.
    expect(noHistory.approval).toBe("REQUIRE_APPROVAL");
    expect(failed.approval).toBe("DENY");
    expect(noHistory.reason).not.toEqual(failed.reason);
  });

  it("denies rather than assumes when no policy is stored", () => {
    expect(authorizeFromRetrieval(error, null).approval).toBe("DENY");
    // A missing rule is not permission, so even a healthy retrieval stops short
    // of automatic.
    expect(authorizeFromRetrieval(available, null).approval).toBe("REQUIRE_APPROVAL");
  });

  it("holds the operator's reliability floor", () => {
    const weak = { ...available, overallReliability: 40 };
    expect(authorizeFromRetrieval(weak, permissive).approval).toBe("REQUIRE_APPROVAL");
  });

  it("respects blocked and watched relationships", () => {
    expect(
      authorizeFromRetrieval({ ...available, relationshipStatus: "BLOCKED" }, permissive).approval,
    ).toBe("DENY");
    expect(
      authorizeFromRetrieval({ ...available, relationshipStatus: "WATCH" }, permissive).approval,
    ).toBe("REQUIRE_APPROVAL");
  });
});

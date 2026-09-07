import type { RetrievalResult } from "./memory-store.js";
import type { PolicyResponse } from "./policy-store.js";

/** Decision states, State Machines section 6. */
export type Approval = "AUTO" | "REQUIRE_APPROVAL" | "DENY";

export interface AuthorizationOutcome {
  approval: Approval;
  /** Why, in terms a Run timeline can render without re-deriving the rule. */
  reason: string;
}

/**
 * The AD-03 gate: what a memory retrieval result permits.
 *
 * `AUTO` is unreachable when retrieval is `ERROR`. This holds on every path,
 * including retries and any degraded or partial-context mode — no retry count,
 * timeout, or override converts `ERROR` into `NO_HISTORY`.
 *
 * An override may only soften `ERROR` as far as `REQUIRE_APPROVAL`, and only
 * when the operator's versioned policy says so. Absent policy means deny,
 * because a missing rule is not permission.
 */
export function authorizeFromRetrieval(
  retrieval: RetrievalResult,
  policy: PolicyResponse | null,
): AuthorizationOutcome {
  if (retrieval.status === "ERROR") {
    if (policy?.memory_error_override_allowed) {
      return {
        approval: "REQUIRE_APPROVAL",
        reason:
          "Required memory could not be read. The operator policy permits an approval path, so this needs a human.",
      };
    }
    return {
      approval: "DENY",
      reason:
        "Required memory could not be read and no versioned override permits proceeding, so the action is denied.",
    };
  }

  if (!policy) {
    return {
      approval: "REQUIRE_APPROVAL",
      reason: "No operator policy is stored for this agent, so nothing authorizes an automatic action.",
    };
  }

  if (retrieval.status === "NO_HISTORY") {
    // A known state: retrieval succeeded and there is nothing to know. Policy
    // may reason about it under neutral priors, but it is still not evidence of
    // reliability, so it cannot clear an automatic spend on its own.
    return {
      approval: "REQUIRE_APPROVAL",
      reason: "No relationship history exists for this counterparty, so the first action needs a human.",
    };
  }

  if (retrieval.memoryVersion === null) {
    // Recall exists, but no committed memory version does: Sibyl remembered
    // something Postgres has never versioned, salted or diffed.
    //
    // This is the clause that lets `compose()` report a Sibyl-only recall as
    // AVAILABLE — which is the truth, because memory WAS found — without
    // loosening the gate on money. An automatic action has to be able to name
    // the memory version it relied on; that name is what tracker #35 commits to
    // Base, and a recall with no version to name cannot supply it.
    //
    // Without this branch a Sibyl-only recall would fall through to AUTO on any
    // agent whose policy sets no reliability floor, and the reason string would
    // read "Memory is available at version null".
    return {
      approval: "REQUIRE_APPROVAL",
      reason:
        "Relationship memory was recalled, but no committed memory version exists to name, so this needs a human.",
    };
  }

  if (
    policy.minimum_reliability !== null &&
    (retrieval.overallReliability ?? -1) < policy.minimum_reliability
  ) {
    return {
      approval: "REQUIRE_APPROVAL",
      reason: `Reliability ${retrieval.overallReliability ?? "unknown"} is below the operator minimum of ${policy.minimum_reliability}.`,
    };
  }

  if (retrieval.relationshipStatus === "BLOCKED") {
    return { approval: "DENY", reason: "The operator has blocked this counterparty." };
  }

  if (retrieval.relationshipStatus === "WATCH") {
    return {
      approval: "REQUIRE_APPROVAL",
      reason: "This counterparty is on watch, so an action needs a human.",
    };
  }

  return {
    approval: "AUTO",
    reason: `Memory is available at version ${retrieval.memoryVersion} and every operator rule passed.`,
  };
}

/**
 * Bayesian Reputation & Status Finite State Machine (FSM)
 *
 * Implements:
 * 1. Conjugate Beta-Binomial Bayesian updating with time decay (lambda in [0.90, 0.98]).
 * 2. Relationship status FSM across NEW, KNOWN, PREFERRED, WATCH, ARCHIVED, BLOCKED.
 * 3. Hard Veto Invariant: BLOCKED candidates produce veto exclusion reasons,
 *    cannot be auto-promoted or updated by positive scores, and can only be
 *    unblocked via explicit manual operator intervention.
 * 4. Sibyl-compatible serialization and episode formatting.
 */

import type { SibylCounterparty, SibylEpisode } from "./sibyl.js";

export type RelationshipStatus =
  | "NEW"
  | "KNOWN"
  | "PREFERRED"
  | "WATCH"
  | "ARCHIVED"
  | "BLOCKED";

export const RELATIONSHIP_STATUSES: readonly RelationshipStatus[] = [
  "NEW",
  "KNOWN",
  "PREFERRED",
  "WATCH",
  "ARCHIVED",
  "BLOCKED",
] as const;

/** Uninformative neutral prior parameters: Beta(1, 1) */
export const ALPHA_0 = 1.0;
export const BETA_0 = 1.0;

export interface CandidateReputation {
  candidateId: string;
  alpha: number; // >= 1.0
  beta: number; // >= 1.0
  overallReliability: number; // alpha / (alpha + beta) in [0, 1]
  confidence: number; // in [0, 1]
  status: RelationshipStatus;
  consecutiveFailures: number;
  totalMissions: number;
  lastUpdatedAt: string; // ISO string
  blockedReason?: string;
  unblockedAt?: string;
  unblockedBy?: string;
  unblockedReason?: string;
}

export interface ReputationConfig {
  decayLambda: number; // in [0.90, 0.98], default 0.95
  confidenceK: number; // saturation constant, default 5.0
  preferredReliabilityThreshold: number; // default 0.80
  preferredConfidenceThreshold: number; // default 0.50
  watchRecoveryThreshold?: number; // default 0.50
}

export const DEFAULT_REPUTATION_CONFIG: ReputationConfig = {
  decayLambda: 0.95,
  confidenceK: 5.0,
  preferredReliabilityThreshold: 0.80,
  preferredConfidenceThreshold: 0.50,
  watchRecoveryThreshold: 0.50,
};

export interface VetoCheckResult {
  allowed: boolean;
  reason?: string;
}

export interface UpdateReputationOptions {
  decayTimeSteps?: number;
  weight?: number;
  config?: Partial<ReputationConfig>;
  now?: string | Date;
}

/**
 * Computes expected mean reliability under the Beta(alpha, beta) distribution.
 * E[theta] = alpha / (alpha + beta) in [0, 1].
 */
export function calculateReliability(alpha: number, beta: number): number {
  if (alpha <= 0 || beta <= 0) {
    throw new Error(`Alpha and Beta parameters must be strictly positive (got alpha=${alpha}, beta=${beta})`);
  }
  return alpha / (alpha + beta);
}

/**
 * Computes sample size confidence scaling using rational saturation:
 * N_eff = max(0, (alpha - alpha_0) + (beta - beta_0))
 * confidence = N_eff / (N_eff + K)
 *
 * Strictly monotonic in N_eff, starts at 0.0, approaches 1.0.
 */
export function calculateConfidence(
  alpha: number,
  beta: number,
  k: number = DEFAULT_REPUTATION_CONFIG.confidenceK
): number {
  if (k <= 0) {
    throw new Error(`Confidence saturation constant K must be strictly positive (got K=${k})`);
  }
  const nEff = Math.max(0, alpha - ALPHA_0 + (beta - BETA_0));
  return nEff / (nEff + k);
}

/**
 * Creates an unobserved candidate reputation record.
 * Starts with neutral reliability (0.50) and near-zero confidence (0.0 < 0.1).
 */
export function createInitialReputation(
  candidateId: string,
  now?: string | Date
): CandidateReputation {
  if (!candidateId || typeof candidateId !== "string" || !candidateId.trim()) {
    throw new Error("candidateId must be a non-empty string");
  }

  const timestamp =
    now instanceof Date
      ? now.toISOString()
      : typeof now === "string"
        ? now
        : new Date().toISOString();

  const alpha = ALPHA_0;
  const beta = BETA_0;
  const overallReliability = calculateReliability(alpha, beta);
  const confidence = calculateConfidence(alpha, beta, DEFAULT_REPUTATION_CONFIG.confidenceK);

  return {
    candidateId: candidateId.trim(),
    alpha,
    beta,
    overallReliability,
    confidence,
    status: "NEW",
    consecutiveFailures: 0,
    totalMissions: 0,
    lastUpdatedAt: timestamp,
  };
}

/**
 * Applies exponential time decay to accumulated evidence above the prior:
 * alpha' = alpha_0 + (alpha - alpha_0) * (lambda ** deltaT)
 * beta' = beta_0 + (beta - beta_0) * (lambda ** deltaT)
 *
 * Guarantees alpha, beta >= 1.0 at all times and smoothly regresses stale
 * observations back toward the neutral uninformative baseline (0.5 reliability, 0 confidence).
 */
export function applyTimeDecay(
  current: CandidateReputation,
  timeSteps: number,
  lambda: number = DEFAULT_REPUTATION_CONFIG.decayLambda,
  now?: string | Date
): CandidateReputation {
  if (current.status === "BLOCKED" || timeSteps <= 0) {
    return { ...current };
  }
  if (lambda <= 0 || lambda > 1) {
    throw new Error(`Decay lambda must be in (0, 1], got ${lambda}`);
  }

  const alphaExcess = Math.max(0, current.alpha - ALPHA_0);
  const betaExcess = Math.max(0, current.beta - BETA_0);
  const decayMultiplier = Math.pow(lambda, timeSteps);

  const decayedAlpha = ALPHA_0 + alphaExcess * decayMultiplier;
  const decayedBeta = BETA_0 + betaExcess * decayMultiplier;

  const overallReliability = calculateReliability(decayedAlpha, decayedBeta);
  const confidence = calculateConfidence(
    decayedAlpha,
    decayedBeta,
    DEFAULT_REPUTATION_CONFIG.confidenceK
  );

  const timestamp =
    now instanceof Date
      ? now.toISOString()
      : typeof now === "string"
        ? now
        : new Date().toISOString();

  return {
    ...current,
    alpha: decayedAlpha,
    beta: decayedBeta,
    overallReliability,
    confidence,
    lastUpdatedAt: timestamp,
  };
}

/**
 * Updates candidate reputation after a mission evaluation outcome.
 *
 * FSM Transition Rules:
 * - NEW -> on first success transitions to KNOWN; on first failure transitions to WATCH (consecutiveFailures = 1).
 * - KNOWN -> if overallReliability >= 0.80 and confidence >= 0.50 with consecutiveFailures === 0,
 *   transitions to PREFERRED. On failure, transitions to WATCH (consecutiveFailures = 1).
 * - PREFERRED -> maintained on success; transitions to WATCH on failure (consecutiveFailures = 1).
 * - WATCH -> on success, consecutiveFailures resets to 0 (and promotes to KNOWN if reliability >= 0.50);
 *   on failure, consecutiveFailures increments. If consecutiveFailures >= 2 while in WATCH,
 *   candidate immediately transitions to BLOCKED.
 * - BLOCKED -> Hard Veto Invariant: BLOCKED candidate cannot be auto-promoted or updated by positive scores.
 *   Can ONLY be unblocked via explicit manual operator intervention: manualUnblock(candidate, operatorId, reason).
 */
export function updateReputation(
  current: CandidateReputation,
  outcome: "success" | "failure",
  options?: UpdateReputationOptions
): CandidateReputation {
  const config: ReputationConfig = {
    ...DEFAULT_REPUTATION_CONFIG,
    ...options?.config,
  };

  const timestamp =
    options?.now instanceof Date
      ? options.now.toISOString()
      : typeof options?.now === "string"
        ? options.now
        : new Date().toISOString();

  // Hard Veto Invariant: BLOCKED candidates cannot be auto-promoted or updated by positive scores.
  if (current.status === "BLOCKED") {
    return {
      ...current,
      lastUpdatedAt: timestamp,
    };
  }

  // Apply decay if requested before observing new mission evidence
  let working = current;
  if (options?.decayTimeSteps && options.decayTimeSteps > 0) {
    working = applyTimeDecay(working, options.decayTimeSteps, config.decayLambda, timestamp);
  }

  const weight = options?.weight ?? 1.0;
  if (weight <= 0) {
    throw new Error(`Outcome weight must be positive, got ${weight}`);
  }

  let newAlpha = working.alpha;
  let newBeta = working.beta;
  let newConsecutiveFailures = working.consecutiveFailures;

  if (outcome === "success") {
    newAlpha += weight;
    newConsecutiveFailures = 0;
  } else if (outcome === "failure") {
    newBeta += weight;
    newConsecutiveFailures += 1;
  } else {
    throw new Error(`Invalid outcome: ${outcome as string}. Expected "success" or "failure".`);
  }

  const overallReliability = calculateReliability(newAlpha, newBeta);
  const confidence = calculateConfidence(newAlpha, newBeta, config.confidenceK);
  const totalMissions = working.totalMissions + 1;

  let newStatus: RelationshipStatus = working.status;
  let blockedReason: string | undefined = working.blockedReason;

  const preferredThresholdMet =
    overallReliability >= config.preferredReliabilityThreshold &&
    confidence >= config.preferredConfidenceThreshold &&
    newConsecutiveFailures === 0;

  const recoveryThreshold = config.watchRecoveryThreshold ?? 0.50;

  switch (working.status) {
    case "NEW":
      if (outcome === "success") {
        newStatus = preferredThresholdMet ? "PREFERRED" : "KNOWN";
      } else {
        newStatus = "WATCH";
      }
      break;

    case "KNOWN":
      if (outcome === "failure") {
        newStatus = "WATCH";
      } else if (preferredThresholdMet) {
        newStatus = "PREFERRED";
      } else {
        newStatus = "KNOWN";
      }
      break;

    case "PREFERRED":
      if (outcome === "failure") {
        newStatus = "WATCH";
      } else {
        newStatus = "PREFERRED";
      }
      break;

    case "WATCH":
      if (outcome === "failure") {
        if (newConsecutiveFailures >= 2) {
          newStatus = "BLOCKED";
          blockedReason = "2 consecutive failures in WATCH state";
        } else {
          newStatus = "WATCH";
        }
      } else {
        // Success resets consecutiveFailures to 0
        if (preferredThresholdMet) {
          newStatus = "PREFERRED";
        } else if (overallReliability >= recoveryThreshold) {
          newStatus = "KNOWN";
        } else {
          newStatus = "WATCH";
        }
      }
      break;

    case "ARCHIVED":
      if (outcome === "failure" && newConsecutiveFailures >= 2) {
        newStatus = "BLOCKED";
        blockedReason = "2 consecutive failures while in ARCHIVED state";
      }
      break;

    default:
      break;
  }

  return {
    ...working,
    alpha: newAlpha,
    beta: newBeta,
    overallReliability,
    confidence,
    status: newStatus,
    consecutiveFailures: newConsecutiveFailures,
    totalMissions,
    lastUpdatedAt: timestamp,
    ...(blockedReason ? { blockedReason } : { blockedReason: undefined }),
  };
}

/**
 * Checks whether candidate is vetoed from selection/ranking.
 * Hard Veto Invariant: BLOCKED status produces a non-allowed veto check with an explicit reason.
 */
export function checkVeto(candidate: CandidateReputation): VetoCheckResult {
  if (candidate.status === "BLOCKED") {
    return {
      allowed: false,
      reason: candidate.blockedReason
        ? `Relationship status on record is BLOCKED: ${candidate.blockedReason}`
        : "Relationship status on record is BLOCKED, so this counterparty was not ranked.",
    };
  }
  return { allowed: true };
}

/**
 * Manually unblocks a BLOCKED candidate through explicit operator intervention.
 * Resets consecutiveFailures to 0 and records operator audit metadata.
 */
export function manualUnblock(
  candidate: CandidateReputation,
  operatorId: string,
  reason: string,
  targetStatus: RelationshipStatus = "WATCH",
  now?: string | Date
): CandidateReputation {
  if (candidate.status !== "BLOCKED") {
    throw new Error(`Cannot unblock a candidate that is not BLOCKED (current status: ${candidate.status})`);
  }
  if (!operatorId || typeof operatorId !== "string" || !operatorId.trim()) {
    throw new Error("operatorId is required to manually unblock candidate");
  }
  if (!reason || typeof reason !== "string" || !reason.trim()) {
    throw new Error("reason is required to manually unblock candidate");
  }
  if (targetStatus === "BLOCKED") {
    throw new Error("targetStatus cannot be BLOCKED when manually unblocking candidate");
  }

  const timestamp =
    now instanceof Date
      ? now.toISOString()
      : typeof now === "string"
        ? now
        : new Date().toISOString();

  return {
    ...candidate,
    status: targetStatus,
    consecutiveFailures: 0,
    unblockedAt: timestamp,
    unblockedBy: operatorId.trim(),
    unblockedReason: reason,
    blockedReason: undefined,
    lastUpdatedAt: timestamp,
  };
}

/**
 * Transitions candidate relationship to ARCHIVED status.
 */
export function manualArchive(
  candidate: CandidateReputation,
  now?: string | Date
): CandidateReputation {
  if (candidate.status === "BLOCKED") {
    throw new Error("Cannot archive a candidate that is BLOCKED; candidate must be manually unblocked first.");
  }

  const timestamp =
    now instanceof Date
      ? now.toISOString()
      : typeof now === "string"
        ? now
        : new Date().toISOString();

  return {
    ...candidate,
    status: "ARCHIVED",
    lastUpdatedAt: timestamp,
  };
}

/**
 * Formats a mission outcome into canonical SibylEpisode format.
 */
export function formatEpisodeForSibyl(
  runId: string,
  taskType: string,
  outcome: "success" | "failure",
  note: string,
  occurredAt?: string
): SibylEpisode {
  return {
    run: runId,
    taskType,
    outcome: outcome === "success" ? "accepted" : "rejected",
    note,
    occurredAt: occurredAt ?? new Date().toISOString(),
  };
}

export interface FormatForSibylOptions {
  displayName?: string;
  taskFit?: number;
  observedPriceUsdc?: string;
  riskNote?: string;
  episodes?: SibylEpisode[];
  isFixture?: boolean;
  includeBayesianState?: boolean;
  alpha?: number;
  beta?: number;
  consecutiveFailures?: number;
  totalMissions?: number;
  blockedReason?: string | null;
}

/**
 * Serializes candidate reputation into SibylCounterparty entity format.
 */
export function formatForSibyl(
  candidate: CandidateReputation,
  options?: FormatForSibylOptions
): SibylCounterparty {
  const counterparty: SibylCounterparty = {
    counterpartyKey: candidate.candidateId,
    displayName: options?.displayName ?? candidate.candidateId,
    hasProfile: true,
    isFixture: options?.isFixture ?? false,
    relationshipStatus: candidate.status,
    memoryVersion: 1,
    overallReliability: candidate.overallReliability,
    taskFit: options?.taskFit ?? null,
    confidence: candidate.confidence,
    observedPriceUsdc: options?.observedPriceUsdc ?? null,
    riskNote: options?.riskNote ?? candidate.blockedReason ?? null,
    episodes: options?.episodes ?? [],
    updatedAt: candidate.lastUpdatedAt,
  };

  if (options?.includeBayesianState !== false) {
    counterparty.alpha = options?.alpha ?? candidate.alpha;
    counterparty.beta = options?.beta ?? candidate.beta;
    counterparty.consecutiveFailures =
      options?.consecutiveFailures ?? candidate.consecutiveFailures;
    counterparty.totalMissions = options?.totalMissions ?? candidate.totalMissions;
    counterparty.blockedReason =
      options?.blockedReason ?? candidate.blockedReason ?? null;
  }

  return counterparty;
}

/**
 * Rehydrates a CandidateReputation record from Sibyl retrieval data or SibylCounterparty.
 * Falls back to unobserved neutral priors Beta(1, 1) when values are missing.
 */
export function rehydrateFromSibyl(
  counterpartyKey: string,
  source?: Partial<SibylCounterparty> | null,
  now?: string | Date
): CandidateReputation {
  const initial = createInitialReputation(counterpartyKey, now);
  if (!source) {
    return initial;
  }

  const alpha =
    typeof source.alpha === "number" && source.alpha > 0 ? source.alpha : initial.alpha;
  const beta =
    typeof source.beta === "number" && source.beta > 0 ? source.beta : initial.beta;
  const status =
    (source.relationshipStatus as RelationshipStatus) ?? initial.status;
  const consecutiveFailures =
    typeof source.consecutiveFailures === "number" && source.consecutiveFailures >= 0
      ? source.consecutiveFailures
      : 0;
  const totalMissions =
    typeof source.totalMissions === "number" && source.totalMissions >= 0
      ? source.totalMissions
      : 0;
  const overallReliability =
    typeof source.overallReliability === "number"
      ? source.overallReliability
      : calculateReliability(alpha, beta);
  const confidence =
    typeof source.confidence === "number"
      ? source.confidence
      : calculateConfidence(alpha, beta);
  const blockedReason =
    (typeof source.blockedReason === "string" && source.blockedReason.length > 0
      ? source.blockedReason
      : undefined) ??
    (status === "BLOCKED" && typeof source.riskNote === "string" && source.riskNote.length > 0
      ? source.riskNote
      : undefined);

  return {
    candidateId: counterpartyKey,
    alpha,
    beta,
    overallReliability,
    confidence,
    status,
    consecutiveFailures,
    totalMissions,
    lastUpdatedAt: source.updatedAt ?? initial.lastUpdatedAt,
    ...(blockedReason ? { blockedReason } : {}),
  };
}

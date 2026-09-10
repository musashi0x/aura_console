import { readNativeMemoryJournal, retrieveNativeFromSibyl } from "./native-sibyl.js";
import {
  createInitialReputation,
  updateReputation,
  type RelationshipStatus,
} from "./reputation-fsm.js";

export interface TemporalReputationReconstruction {
  counterpartyKey: string;
  asOf: string;
  asOfType: "timestamp" | "episode_index";
  historicalState: {
    relationshipStatus: RelationshipStatus;
    overallReliability: number;
    confidence: number;
    alpha: number;
    beta: number;
    consecutiveFailures: number;
    totalMissions: number;
    episodesCount: number;
  };
  currentState: {
    relationshipStatus: RelationshipStatus;
    overallReliability: number;
    confidence: number;
    alpha: number;
    beta: number;
    consecutiveFailures: number;
    totalMissions: number;
    episodesCount: number;
  };
  delta: {
    statusChanged: boolean;
    pastStatus: RelationshipStatus;
    currentStatus: RelationshipStatus;
    reliabilityDelta: number;
    failuresDelta: number;
    missionsDelta: number;
  };
}

/**
 * Reconstructs a counterparty's exact Bayesian reputation parameters and FSM status
 * at an arbitrary past point in time or episode checkpoint.
 *
 * Supports:
 * - ISO timestamp string (e.g. "2026-08-14T09:12:00Z")
 * - Epoch millisecond timestamp (number)
 * - Episode index t in [0, N] (number or numeric string, where t=0 is prior state)
 */
export function reconstructCounterpartyStateAt(
  counterpartyKey: string,
  asOf: string | number,
): TemporalReputationReconstruction | null {
  const profileLookup = retrieveNativeFromSibyl(counterpartyKey);
  const journal = readNativeMemoryJournal(1000, counterpartyKey);
  const rawEpisodes = (journal.episodes ?? []) as Array<{
    run?: string;
    outcome?: "accepted" | "rejected";
    note?: string;
    occurredAt?: string;
    occurred_at?: string;
  }>;

  if (profileLookup.status === "NO_HISTORY" && rawEpisodes.length === 0) {
    return null;
  }

  // Sort episodes strictly chronologically ascending
  const sortedEpisodes = [...rawEpisodes].sort((a, b) => {
    const timeA = new Date(a.occurredAt ?? a.occurred_at ?? 0).getTime();
    const timeB = new Date(b.occurredAt ?? b.occurred_at ?? 0).getTime();
    return timeA - timeB;
  });

  let asOfType: "timestamp" | "episode_index" = "timestamp";
  let asOfStr = String(asOf);
  let filteredEpisodes: typeof sortedEpisodes = [];

  if (typeof asOf === "number") {
    if (Number.isInteger(asOf) && asOf >= 0 && asOf <= 10000) {
      asOfType = "episode_index";
      asOfStr = String(asOf);
      filteredEpisodes = sortedEpisodes.slice(0, asOf);
    } else {
      asOfType = "timestamp";
      asOfStr = new Date(asOf).toISOString();
      filteredEpisodes = sortedEpisodes.filter((e) => {
        const t = new Date(e.occurredAt ?? e.occurred_at ?? 0).getTime();
        return t <= asOf;
      });
    }
  } else {
    const trimmed = asOf.trim();
    if (/^\d+$/.test(trimmed) && trimmed.length <= 5) {
      const idx = parseInt(trimmed, 10);
      asOfType = "episode_index";
      asOfStr = String(idx);
      filteredEpisodes = sortedEpisodes.slice(0, idx);
    } else {
      const parsedDate = new Date(asOf);
      if (isNaN(parsedDate.getTime())) {
        throw new Error(`Invalid asOf temporal parameter: ${asOf}`);
      }
      asOfType = "timestamp";
      asOfStr = parsedDate.toISOString();
      const cutoff = parsedDate.getTime();
      filteredEpisodes = sortedEpisodes.filter((e) => {
        const t = new Date(e.occurredAt ?? e.occurred_at ?? 0).getTime();
        return t <= cutoff;
      });
    }
  }

  // Deterministically replay historical state from neutral Beta(1,1) prior
  let historicalRep = createInitialReputation(counterpartyKey);
  for (const ep of filteredEpisodes) {
    const time = ep.occurredAt ?? ep.occurred_at ?? new Date().toISOString();
    historicalRep = updateReputation(
      historicalRep,
      ep.outcome === "accepted" ? "success" : "failure",
      { now: time },
    );
  }

  // Deterministically replay current full state
  let currentRep = createInitialReputation(counterpartyKey);
  for (const ep of sortedEpisodes) {
    const time = ep.occurredAt ?? ep.occurred_at ?? new Date().toISOString();
    currentRep = updateReputation(
      currentRep,
      ep.outcome === "accepted" ? "success" : "failure",
      { now: time },
    );
  }

  // If no episodes exist but persisted profile exists, use persisted metadata
  if (sortedEpisodes.length === 0 && profileLookup.status === "AVAILABLE") {
    const p = profileLookup;
    if (p.relationshipStatus) {
      currentRep.status = p.relationshipStatus as RelationshipStatus;
    }
    if (typeof p.overallReliability === "number") {
      currentRep.overallReliability = p.overallReliability;
    }
    if (typeof p.confidence === "number") {
      currentRep.confidence = p.confidence;
    }
    if (typeof p.consecutiveFailures === "number") {
      currentRep.consecutiveFailures = p.consecutiveFailures;
    }
    if (typeof p.totalMissions === "number") {
      currentRep.totalMissions = p.totalMissions;
    }
    if (typeof p.alpha === "number") {
      currentRep.alpha = p.alpha;
    }
    if (typeof p.beta === "number") {
      currentRep.beta = p.beta;
    }
  }

  const statusChanged = historicalRep.status !== currentRep.status;
  const reliabilityDelta = Number(
    (currentRep.overallReliability - historicalRep.overallReliability).toFixed(4),
  );
  const failuresDelta = currentRep.consecutiveFailures - historicalRep.consecutiveFailures;
  const missionsDelta = currentRep.totalMissions - historicalRep.totalMissions;

  return {
    counterpartyKey,
    asOf: asOfStr,
    asOfType,
    historicalState: {
      relationshipStatus: historicalRep.status,
      overallReliability: historicalRep.overallReliability,
      confidence: historicalRep.confidence,
      alpha: historicalRep.alpha,
      beta: historicalRep.beta,
      consecutiveFailures: historicalRep.consecutiveFailures,
      totalMissions: historicalRep.totalMissions,
      episodesCount: filteredEpisodes.length,
    },
    currentState: {
      relationshipStatus: currentRep.status,
      overallReliability: currentRep.overallReliability,
      confidence: currentRep.confidence,
      alpha: currentRep.alpha,
      beta: currentRep.beta,
      consecutiveFailures: currentRep.consecutiveFailures,
      totalMissions: currentRep.totalMissions,
      episodesCount: sortedEpisodes.length,
    },
    delta: {
      statusChanged,
      pastStatus: historicalRep.status,
      currentStatus: currentRep.status,
      reliabilityDelta,
      failuresDelta,
      missionsDelta,
    },
  };
}

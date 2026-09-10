import crypto from "node:crypto";
import {
  type CounterpartyDossier,
  type ProbationTransition,
  getNativeDossier,
  getNativeReflections,
  readNativeMemoryJournal,
  retrieveNativeFromSibyl,
  setNativeDossier,
} from "./native-sibyl.js";
import {
  createInitialReputation,
  updateReputation,
  type RelationshipStatus,
} from "./reputation-fsm.js";

export type { CounterpartyDossier, ProbationTransition };

/**
 * Computes a deterministic SHA-256 cryptographic lineage hash
 * over an ordered sequence of mission execution episodes.
 */
export function computeAuditTrailHash(
  episodes: Array<{ run?: string | null; outcome?: string | null; occurredAt?: string | null }>,
): string {
  if (!episodes || episodes.length === 0) {
    return crypto.createHash("sha256").update("").digest("hex");
  }

  const payload = episodes
    .map((e) => `${e.run ?? ""}:${e.outcome ?? ""}:${e.occurredAt ?? ""}`)
    .join("|");

  return crypto.createHash("sha256").update(payload).digest("hex");
}

/**
 * Consolidates discrete, raw execution episodes and reflection records
 * for a counterparty into a unified, high-integrity dossier.
 *
 * Synthesizes:
 * - Cumulative mission counts and success rate
 * - Recurring defect frequency distributions
 * - Chronological probation history transitions (e.g. NEW -> WATCH -> BLOCKED)
 * - Cryptographic audit trail hash over all evaluated episodes
 */
export function consolidateEpisodesSync(counterpartyKey: string): CounterpartyDossier {
  const profileLookup = retrieveNativeFromSibyl(counterpartyKey);
  const displayName = profileLookup.status === "AVAILABLE" && profileLookup.displayName
    ? profileLookup.displayName
    : counterpartyKey;

  // Retrieve raw episodes and sort chronologically ascending
  const journal = readNativeMemoryJournal(1000, counterpartyKey);
  const rawEpisodes = (journal.episodes ?? []) as Array<{
    run?: string;
    outcome?: "accepted" | "rejected";
    note?: string;
    occurredAt?: string;
    occurred_at?: string;
  }>;

  const sortedEpisodes = [...rawEpisodes].sort((a, b) => {
    const timeA = new Date(a.occurredAt ?? a.occurred_at ?? 0).getTime();
    const timeB = new Date(b.occurredAt ?? b.occurred_at ?? 0).getTime();
    return timeA - timeB;
  });

  const totalMissions = sortedEpisodes.length;
  const acceptedCount = sortedEpisodes.filter((e) => e.outcome === "accepted").length;
  const rejectedCount = sortedEpisodes.filter((e) => e.outcome === "rejected").length;
  const successRate = totalMissions > 0 ? Number((acceptedCount / totalMissions).toFixed(4)) : 0;

  // Aggregate recurring defect patterns across reflections and episode notes
  const reflections = getNativeReflections(counterpartyKey);
  const recurringDefects: Record<string, number> = {};

  for (const ref of reflections) {
    const defectKey = ref.failureCategory.toLowerCase();
    recurringDefects[defectKey] = (recurringDefects[defectKey] ?? 0) + 1;
  }

  // Also check rejected episodes without separate reflection records
  for (const ep of sortedEpisodes) {
    if (ep.outcome === "rejected") {
      const note = (ep.note ?? "").toLowerCase();
      if (/citation|source/.test(note) && !recurringDefects["missing_citations"]) {
        recurringDefects["missing_citations"] = (recurringDefects["missing_citations"] ?? 0) + 1;
      } else if (/competitor/.test(note) && !recurringDefects["insufficient_competitors"]) {
        recurringDefects["insufficient_competitors"] = (recurringDefects["insufficient_competitors"] ?? 0) + 1;
      } else if (/timeout/.test(note) && !recurringDefects["timeout"]) {
        recurringDefects["timeout"] = (recurringDefects["timeout"] ?? 0) + 1;
      } else if (Object.keys(recurringDefects).length === 0) {
        recurringDefects["deliverable_rejection"] = (recurringDefects["deliverable_rejection"] ?? 0) + 1;
      }
    }
  }

  // Deterministically reconstruct probation history across episodes
  const probationHistory: ProbationTransition[] = [];
  let rep = createInitialReputation(counterpartyKey);

  for (const ep of sortedEpisodes) {
    const prevStatus: RelationshipStatus = rep.status;
    const epTime = ep.occurredAt ?? ep.occurred_at ?? new Date().toISOString();
    rep = updateReputation(rep, ep.outcome === "accepted" ? "success" : "failure", {
      now: epTime,
    });

    if (rep.status !== prevStatus) {
      probationHistory.push({
        fromStatus: prevStatus,
        toStatus: rep.status,
        runId: ep.run ?? "unknown",
        reason:
          rep.blockedReason ||
          (ep.outcome === "rejected"
            ? (ep.note || "Delivery failed objective verification")
            : "Satisfied promotion criteria"),
        timestamp: epTime,
      });
    }
  }

  const auditTrailHash = computeAuditTrailHash(
    sortedEpisodes.map((e) => ({
      run: e.run,
      outcome: e.outcome,
      occurredAt: e.occurredAt ?? e.occurred_at,
    })),
  );

  const dossier: CounterpartyDossier = {
    counterpartyKey,
    displayName,
    totalMissions,
    acceptedCount,
    rejectedCount,
    successRate,
    recurringDefects,
    probationHistory,
    auditTrailHash,
    lastConsolidatedAt: new Date().toISOString(),
  };

  // Only persist to SQLite if the counterparty actually has history (episodes or known profile)
  // to avoid mutating storage with phantom 0-mission records on read-only queries
  if (totalMissions > 0 || profileLookup.status === "AVAILABLE") {
    setNativeDossier(counterpartyKey, dossier);
  }
  return dossier;
}

/**
 * Async wrapper matching PROJECT.md interface contract.
 */
export async function consolidateEpisodes(counterpartyKey: string): Promise<CounterpartyDossier> {
  return consolidateEpisodesSync(counterpartyKey);
}

/**
 * Retrieves the latest consolidated dossier for a counterparty,
 * or returns null if no dossier has been consolidated yet.
 */
export function getConsolidatedDossier(counterpartyKey: string): CounterpartyDossier | null {
  return getNativeDossier(counterpartyKey);
}

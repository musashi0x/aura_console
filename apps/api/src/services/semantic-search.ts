import {
  getNativeDossier,
  getNativeReflections,
  listNativeCounterpartiesFromSibyl,
  readNativeMemoryJournal,
} from "./native-sibyl.js";

export interface MemorySearchResult {
  id: string;
  category: "reflection" | "episode" | "dossier";
  name: string;
  score: number; // 0 to 100
  matchedTerms: string[];
  headline: string;
  snippet: string;
  createdAt: string;
  body: Record<string, unknown>;
}

export interface SearchOptions {
  category?: "reflection" | "episode" | "dossier" | string;
  counterpartyKey?: string;
  limit?: number;
}

const STOP_WORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "in",
  "on",
  "at",
  "to",
  "for",
  "of",
  "with",
  "is",
  "are",
  "was",
  "were",
  "by",
  "from",
  "it",
  "as",
  "be",
  "this",
  "that",
]);

const SYNONYM_MAP: Record<string, string[]> = {
  citation: ["citations", "source", "sources", "url", "evidence", "reference"],
  citations: ["citation", "source", "sources", "url", "evidence", "reference"],
  source: ["sources", "citation", "citations", "url", "evidence"],
  sources: ["source", "citation", "citations", "url", "evidence"],
  failure: ["failed", "fail", "defect", "rejected", "rejection", "violation", "error"],
  failed: ["failure", "fail", "defect", "rejected", "rejection", "violation", "error"],
  reject: ["rejected", "rejection", "failure", "failed", "defect"],
  rejected: ["reject", "rejection", "failure", "failed", "defect"],
  defect: ["defects", "failure", "violation", "error"],
  verified: ["verify", "verification", "accepted", "passed", "success", "successful"],
  verification: ["verified", "verify", "accepted", "passed", "acceptance"],
  accepted: ["accept", "verified", "passed", "success", "successful"],
  competitor: ["competitors", "research", "market"],
  competitors: ["competitor", "research", "market"],
  reputation: ["reliability", "status", "watch", "blocked", "preferred"],
  watch: ["probation", "warning", "status"],
  blocked: ["veto", "banned", "excluded", "status"],
};

/**
 * Tokenizes and filters stopwords from an input text query.
 */
export function tokenizeQuery(query: string): string[] {
  return query
    .toLowerCase()
    .replace(/[^\w\s-]/g, " ")
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 2 && !STOP_WORDS.has(w) && !/^[-]+$/.test(w));
}

/**
 * Expands query tokens using domain synonyms and intent maps.
 */
export function expandQueryTokens(tokens: string[]): {
  primary: string[];
  expanded: Map<string, number>; // token -> weight (1.0 for primary, 0.7 for synonym)
} {
  const expanded = new Map<string, number>();

  for (const token of tokens) {
    expanded.set(token, 1.0);
    const synonyms = SYNONYM_MAP[token];
    if (synonyms) {
      for (const syn of synonyms) {
        if (!expanded.has(syn)) {
          expanded.set(syn, 0.7);
        }
      }
    }
  }

  return { primary: tokens, expanded };
}

function extractSnippet(text: string, matchedTerms: string[], maxLength = 160): string {
  if (!text) return "";
  const lower = text.toLowerCase();
  let bestIdx = -1;

  for (const term of matchedTerms) {
    const idx = lower.indexOf(term.toLowerCase());
    if (idx !== -1 && (bestIdx === -1 || idx < bestIdx)) {
      bestIdx = idx;
    }
  }

  if (bestIdx === -1) {
    return text.length > maxLength ? text.slice(0, maxLength) + "..." : text;
  }

  const start = Math.max(0, bestIdx - 30);
  const end = Math.min(text.length, start + maxLength);
  const prefix = start > 0 ? "..." : "";
  const suffix = end < text.length ? "..." : "";

  return prefix + text.slice(start, end).trim() + suffix;
}

/**
 * Searches across Sibyl memory records (reflections, execution episodes, and consolidated dossiers)
 * using tokenized semantic relevance and intent-based keyword matching.
 */
export function searchMemoryRecords(
  query: string,
  options: SearchOptions = {},
): MemorySearchResult[] {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const rawTokens = tokenizeQuery(trimmed);
  if (rawTokens.length === 0) return [];

  const { expanded } = expandQueryTokens(rawTokens);
  const exactPhrase = trimmed.toLowerCase();
  const results: MemorySearchResult[] = [];

  const targetCategory = options.category;
  const targetCounterparty = options.counterpartyKey;

  // 1. Search Reflections (category: "reflection")
  if (!targetCategory || targetCategory === "reflection") {
    const reflections = getNativeReflections(targetCounterparty);
    for (const ref of reflections) {
      const lessonText = ref.lesson || "";
      const rootCauseText = ref.rootCause || "";
      const guidanceText = ref.remediationGuidance || "";
      const categoryText = ref.failureCategory || "";
      const fullText = `${categoryText} ${rootCauseText} ${lessonText} ${guidanceText} ${ref.counterpartyKey}`.toLowerCase();

      let rawScore = 0;
      const matched = new Set<string>();

      // Phrase match bonus
      if (fullText.includes(exactPhrase)) {
        rawScore += 15;
      }

      for (const [term, termWeight] of expanded.entries()) {
        let termMatches = 0;
        if (lessonText.toLowerCase().includes(term)) termMatches += 3.5;
        if (rootCauseText.toLowerCase().includes(term)) termMatches += 3.5;
        if (categoryText.toLowerCase().includes(term)) termMatches += 2.5;
        if (guidanceText.toLowerCase().includes(term)) termMatches += 2.0;
        if (ref.counterpartyKey.toLowerCase().includes(term)) termMatches += 1.5;

        if (termMatches > 0) {
          matched.add(term);
          rawScore += termMatches * termWeight;
        }
      }

      if (rawScore > 0) {
        // Saturation score from 10 to 100
        const score = Math.min(100, Math.round(100 * (1 - Math.exp(-rawScore / 10))));
        const matchedList = Array.from(matched);
        results.push({
          id: ref.id,
          category: "reflection",
          name: ref.counterpartyKey,
          score,
          matchedTerms: matchedList,
          headline: `[Reflection: ${ref.failureCategory}] ${ref.rootCause}`,
          snippet: extractSnippet(lessonText || rootCauseText, matchedList),
          createdAt: ref.createdAt,
          body: ref as unknown as Record<string, unknown>,
        });
      }
    }
  }

  // 2. Search Episodes (category: "episode")
  if (!targetCategory || targetCategory === "episode") {
    const journal = readNativeMemoryJournal(500, targetCounterparty);
    const episodes = (journal.episodes ?? []) as Array<{
      run?: string;
      counterpartyKey?: string;
      taskType?: string;
      outcome?: string;
      note?: string;
      occurredAt?: string;
      occurred_at?: string;
    }>;

    for (const ep of episodes) {
      const cKey = ep.counterpartyKey || "";
      const note = ep.note || "";
      const task = ep.taskType || "mission";
      const outcome = ep.outcome || "";
      const fullText = `${cKey} ${task} ${outcome} ${note}`.toLowerCase();

      let rawScore = 0;
      const matched = new Set<string>();

      if (fullText.includes(exactPhrase)) {
        rawScore += 15;
      }

      for (const [term, termWeight] of expanded.entries()) {
        let termMatches = 0;
        if (note.toLowerCase().includes(term)) termMatches += 3.0;
        if (outcome.toLowerCase().includes(term)) termMatches += 2.0;
        if (task.toLowerCase().includes(term)) termMatches += 1.5;
        if (cKey.toLowerCase().includes(term)) termMatches += 1.5;

        if (termMatches > 0) {
          matched.add(term);
          rawScore += termMatches * termWeight;
        }
      }

      if (rawScore > 0) {
        const score = Math.min(100, Math.round(100 * (1 - Math.exp(-rawScore / 10))));
        const matchedList = Array.from(matched);
        const date = ep.occurredAt || ep.occurred_at || new Date().toISOString();
        results.push({
          id: `ep_${cKey}_${ep.run ?? "0"}`,
          category: "episode",
          name: cKey,
          score,
          matchedTerms: matchedList,
          headline: `[Episode: ${outcome.toUpperCase()}] Run ${ep.run ?? "N/A"} - ${task}`,
          snippet: extractSnippet(note || `${cKey} outcome ${outcome}`, matchedList),
          createdAt: date,
          body: ep as unknown as Record<string, unknown>,
        });
      }
    }
  }

  // 3. Search Dossiers (category: "dossier")
  if (!targetCategory || targetCategory === "dossier") {
    const cpListResult = listNativeCounterpartiesFromSibyl();
    const counterparties = targetCounterparty
      ? [{ counterpartyKey: targetCounterparty }]
      : (cpListResult.ok ? cpListResult.items : []);

    for (const cp of counterparties) {
      const dossier = getNativeDossier(cp.counterpartyKey);
      if (!dossier) continue;

      const defectsStr = Object.entries(dossier.recurringDefects)
        .map(([k, v]) => `${k}:${v}`)
        .join(" ");
      const probationStr = dossier.probationHistory
        .map((p) => `${p.fromStatus}->${p.toStatus} ${p.reason}`)
        .join(" ");
      const fullText = `${dossier.counterpartyKey} ${dossier.displayName} ${defectsStr} ${probationStr}`.toLowerCase();

      let rawScore = 0;
      const matched = new Set<string>();

      if (fullText.includes(exactPhrase)) {
        rawScore += 15;
      }

      for (const [term, termWeight] of expanded.entries()) {
        let termMatches = 0;
        if (defectsStr.toLowerCase().includes(term)) termMatches += 3.0;
        if (probationStr.toLowerCase().includes(term)) termMatches += 2.5;
        if (dossier.displayName.toLowerCase().includes(term)) termMatches += 2.0;
        if (dossier.counterpartyKey.toLowerCase().includes(term)) termMatches += 1.5;

        if (termMatches > 0) {
          matched.add(term);
          rawScore += termMatches * termWeight;
        }
      }

      if (rawScore > 0) {
        const score = Math.min(100, Math.round(100 * (1 - Math.exp(-rawScore / 10))));
        const matchedList = Array.from(matched);
        results.push({
          id: `dossier_${dossier.counterpartyKey}`,
          category: "dossier",
          name: dossier.counterpartyKey,
          score,
          matchedTerms: matchedList,
          headline: `[Dossier: ${dossier.displayName}] ${dossier.totalMissions} missions (${Math.round(dossier.successRate * 100)}% pass rate)`,
          snippet: extractSnippet(defectsStr || probationStr || dossier.displayName, matchedList),
          createdAt: dossier.lastConsolidatedAt,
          body: dossier as unknown as Record<string, unknown>,
        });
      }
    }
  }

  // Sort by score descending, then by creation date descending
  results.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const limit = options.limit ?? 20;
  return results.slice(0, limit);
}

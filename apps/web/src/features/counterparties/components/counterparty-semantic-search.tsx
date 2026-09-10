"use client";

import { useState, useTransition } from "react";
import { Badge } from "@astryxdesign/core/Badge";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { Token } from "@astryxdesign/core/Token";
import { Search, Sparkles, X, Tag } from "lucide-react";

import { apiClient, type MemorySearchResult } from "@/lib/api-client";

export interface CounterpartySemanticSearchProps {
  counterpartyKey?: string;
  onSelectRecord?: (record: MemorySearchResult) => void;
  className?: string;
}

export function CounterpartySemanticSearch({
  counterpartyKey,
  onSelectRecord,
  className,
}: CounterpartySemanticSearchProps) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<"all" | "reflection" | "episode" | "dossier">("all");
  const [results, setResults] = useState<MemorySearchResult[] | null>(null);
  const [searchedQuery, setSearchedQuery] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) {
      setResults(null);
      setSearchedQuery("");
      return;
    }

    startTransition(async () => {
      const items = await apiClient.searchMemory(trimmed, {
        category: category === "all" ? undefined : category,
        counterpartyKey,
      });
      setResults(items);
      setSearchedQuery(trimmed);
    });
  };

  const handleClear = () => {
    setQuery("");
    setResults(null);
    setSearchedQuery("");
  };

  const getCategoryColor = (cat: MemorySearchResult["category"]): "red" | "orange" | "cyan" => {
    switch (cat) {
      case "reflection":
        return "red";
      case "dossier":
        return "orange";
      case "episode":
      default:
        return "cyan";
    }
  };

  return (
    <section
      data-testid="semantic-search-container"
      aria-label="Semantic Memory Search"
      className={`p-5 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] flex flex-col gap-4 ${className ?? ""}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--color-border)] pb-3">
        <HStack gap={2} align="center">
          <Search size={16} className="text-[var(--color-accent)]" />
          <span className="font-semibold text-sm text-[var(--color-text)]">
            Semantic & Intent-Based Memory Search
          </span>
        </HStack>
        <HStack gap={1} align="center">
          <Sparkles size={13} className="text-[var(--color-accent)] opacity-80" />
          <span className="text-[11px] font-mono text-[var(--color-text-muted)]">
            Sibyl R4 Semantic Search Engine
          </span>
        </HStack>
      </div>

      {/* Search Input Bar */}
      <form onSubmit={handleSearch} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            data-testid="semantic-search-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search memory intent (e.g., 'missing citation sources', 'verified deliverable')..."
            className="w-full pl-9 pr-8 py-2 rounded-xl bg-[var(--color-canvas)] border border-[var(--color-border)] text-xs text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)] transition-colors"
          />
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
          />
          {query && (
            <button
              type="button"
              onClick={handleClear}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
              title="Clear query"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Category Pill Select */}
        <div className="flex items-center gap-1 text-xs">
          {(["all", "reflection", "episode", "dossier"] as const).map((cat) => (
            <button
              key={cat}
              type="button"
              data-testid={`category-filter-${cat}`}
              onClick={() => setCategory(cat)}
              className={`px-2.5 py-1.5 rounded-lg font-mono text-[11px] capitalize border transition-colors ${
                category === cat
                  ? "bg-[var(--color-accent)] text-[var(--color-canvas)] border-[var(--color-accent)] font-semibold"
                  : "bg-[var(--color-canvas)] text-[var(--color-text-muted)] border-[var(--color-border)] hover:text-[var(--color-text)]"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <button
          type="submit"
          data-testid="semantic-search-submit"
          disabled={isPending || !query.trim()}
          className="px-4 py-2 rounded-xl bg-[var(--color-accent)] text-[var(--color-canvas)] text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isPending ? "Searching..." : "Search"}
        </button>
      </form>

      {/* Results View */}
      {results !== null && (
        <div data-testid="semantic-search-results" className="flex flex-col gap-2.5 pt-2">
          <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)] border-b border-[var(--color-border)] pb-1.5">
            <span>
              Found <strong>{results.length}</strong> matching memory record{results.length === 1 ? "" : "s"} for &quot;{searchedQuery}&quot;
            </span>
            {counterpartyKey && (
              <span className="font-mono text-[11px]">Filtered: {counterpartyKey}</span>
            )}
          </div>

          {results.length === 0 ? (
            <div
              data-testid="semantic-search-empty"
              className="p-4 rounded-xl bg-[var(--color-canvas)] border border-[var(--color-border)] text-xs text-[var(--color-text-muted)]"
            >
              No matching memory records found for &quot;{searchedQuery}&quot;. Try different keywords like &quot;citations&quot;, &quot;verified&quot;, or &quot;probation&quot;.
            </div>
          ) : (
            <VStack gap={2}>
              {results.map((record) => (
                <div
                  key={record.id}
                  data-testid={`search-result-card-${record.id}`}
                  onClick={() => onSelectRecord?.(record)}
                  className={`p-3.5 rounded-xl bg-[var(--color-canvas)] border border-[var(--color-border)] hover:border-[var(--color-accent)] transition-all flex flex-col gap-2 ${
                    onSelectRecord ? "cursor-pointer" : ""
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <HStack gap={1.5} align="center" wrap="wrap">
                      <Token
                        label={record.category.toUpperCase()}
                        size="sm"
                        color={getCategoryColor(record.category)}
                      />
                      <span className="font-semibold text-xs text-[var(--color-text)]">
                        {record.name}
                      </span>
                    </HStack>
                    <Badge
                      variant={record.score >= 80 ? "success" : record.score >= 50 ? "warning" : "neutral"}
                      label={`Relevance: ${Math.round(record.score)}`}
                    />
                  </div>

                  {record.headline && (
                    <Text as="p" size="sm" weight="bold" className="text-[var(--color-text)]">
                      {record.headline}
                    </Text>
                  )}

                  <p className="text-xs text-[var(--color-text-muted)] leading-relaxed font-mono">
                    {record.snippet}
                  </p>

                  {record.matchedTerms && record.matchedTerms.length > 0 && (
                    <div className="flex items-center gap-1.5 pt-1">
                      <Tag size={12} className="text-[var(--color-text-muted)]" />
                      <div className="flex flex-wrap gap-1">
                        {record.matchedTerms.map((term, i) => (
                          <span
                            key={i}
                            className="px-1.5 py-0.5 rounded bg-[var(--color-surface)] text-[10px] font-mono text-[var(--color-accent)] border border-[var(--color-border)]"
                          >
                            {term}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </VStack>
          )}
        </div>
      )}
    </section>
  );
}

CounterpartySemanticSearch.displayName = "CounterpartySemanticSearch";

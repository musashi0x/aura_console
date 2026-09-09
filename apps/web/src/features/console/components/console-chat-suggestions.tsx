"use client";

import { usePathname } from "next/navigation";
import { ClickableCard } from "@astryxdesign/core/ClickableCard";
import { Grid } from "@astryxdesign/core/Grid";
import { VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";

import { CONSOLE_COMMANDS } from "../console-commands";
import { console_ } from "../copy";
import { getRouteChatContext } from "../chat/route-chat-context";

export interface ConsoleChatSuggestionsProps {
  /**
   * Puts the text in the composer. Deliberately the ONLY thing this component
   * can do: it takes no navigate function and no command, so a suggestion here
   * cannot run one however the markup is later rearranged.
   */
  onOffer: (text: string) => void;
  runId?: string;
  surface?: string;
}

/**
 * The zero state: what to ask, when nothing has been asked.
 *
 * Grounded contextually to whichever surface/route the operator is currently on.
 * Suggestions dynamically adapt between /counterparties, /runs, /policies,
 * /system, and /docs while maintaining canonical command registry access.
 */
const SIBYL_MEMORY_SHOWCASE_PROMPTS = [
  {
    id: "recall-alpha",
    tier: "WARM TIER",
    label: "Recall Alpha Memory",
    prompt: "Recall what Sibyl memory knows about virtuals:agent:alpha",
    description: "Inspect reliability rating, confidence, and past episodes",
  },
  {
    id: "search-fts5",
    tier: "WARM FTS5",
    label: "Search Sibyl Memory",
    prompt: "Search Sibyl memory for research and compute agents",
    description: "Execute BM25 search across agent entities with Sibyl verdicts",
  },
  {
    id: "remember-update",
    tier: "WARM WRITE",
    label: "Remember Counterparty Update",
    prompt: "Remember that virtuals:agent:alpha has reliability 0.33 due to delivery failure",
    description: "Write-back Bayesian reliability score and status into SQLite WARM tier",
  },
  {
    id: "record-episode",
    tier: "COLD JOURNAL",
    label: "Record Verified Episode",
    prompt: "Record a completed episode for virtuals:agent:beta with budget 10 USDC",
    description: "Append immutable deliverable acceptance into COLD audit journal",
  },
  {
    id: "read-journal",
    tier: "COLD READ",
    label: "Read Memory Journal",
    prompt: "Read the Sibyl memory journal to inspect recent episodes",
    description: "Query immutable audit history with actor provenance",
  },
  {
    id: "verify-commitment",
    tier: "BASE SEPOLIA",
    label: "Verify Base Sepolia Hash",
    prompt: "Verify on-chain memory commitment for virtuals:agent:alpha on Base Sepolia",
    description: "Recompute Keccak256(canonical || salt) against Base Sepolia calldata",
  },
] as const;

export function ConsoleChatSuggestions({
  onOffer,
  runId,
  surface,
}: ConsoleChatSuggestionsProps) {
  const pathname = usePathname();
  const routeContext = getRouteChatContext(surface, pathname, runId);

  return (
    <VStack gap={3} padding={2}>
      <VStack gap={1}>
        <Text as="p" weight="semibold">
          {console_.chat.zero.title}
        </Text>
        <Text as="p" size="sm" color="secondary">
          {routeContext.surfaceId !== "general"
            ? `${routeContext.surfaceTitle} contextual intelligence: ${routeContext.groundingDescription}`
            : console_.chat.zero.lede}
        </Text>
      </VStack>

      {/* Surface-specific Active Entity Registry (e.g. Counterparties on /counterparties) */}
      {routeContext.entities && routeContext.entities.length > 0 ? (
        <VStack gap={1}>
          <div className="flex items-center justify-between">
            <Text as="p" size="xsm" color="secondary" weight="semibold">
              Active Counterparty Registry ({routeContext.entities.length})
            </Text>
            <span className="text-[10px] font-mono text-[var(--color-accent,#b692f6)]">
              1-Click Audit
            </span>
          </div>
          <Grid columns={{ minWidth: 220, max: 2 }} gap={2}>
            {routeContext.entities.map((agent) => (
              <ClickableCard
                key={agent.key}
                label={`Audit ${agent.label}`}
                variant="muted"
                padding={3}
                onClick={() =>
                  onOffer(
                    `Audit counterparty ${agent.label} (${agent.key}) Bayesian prior and risk profile`,
                  )
                }
              >
                <VStack gap={0.5}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <Text as="p" size="sm" weight="semibold">
                      {agent.label}
                    </Text>
                    <span
                      style={{
                        fontSize: "10px",
                        padding: "1px 5px",
                        borderRadius: "4px",
                        background:
                          agent.status === "PREFERRED"
                            ? "color-mix(in srgb, var(--color-success) 15%, transparent)"
                            : agent.status === "WATCH"
                              ? "color-mix(in srgb, var(--color-warning) 15%, transparent)"
                              : "color-mix(in srgb, var(--color-cyan) 15%, transparent)",
                        color:
                          agent.status === "PREFERRED"
                            ? "var(--color-success)"
                            : agent.status === "WATCH"
                              ? "var(--color-warning)"
                              : "var(--color-cyan)",
                        letterSpacing: "0.04em",
                        fontFamily: "var(--font-mono, monospace)",
                      }}
                    >
                      {agent.status} · {agent.score}
                    </span>
                  </div>
                  <Text as="p" size="xsm" color="secondary">
                    {agent.note}
                  </Text>
                </VStack>
              </ClickableCard>
            ))}
          </Grid>
        </VStack>
      ) : null}

      {/* Surface-specific Suggestion Groups */}
      {routeContext.suggestionGroups.map((group) => (
        <VStack key={group.title} gap={1}>
          <Text as="p" size="xsm" color="secondary" weight="semibold">
            {group.title}
          </Text>
          <Grid columns={{ minWidth: 220, max: 2 }} gap={2}>
            {group.suggestions.map((item) => (
              <ClickableCard
                key={item.id}
                label={item.label}
                variant="muted"
                padding={3}
                onClick={() => onOffer(item.prompt)}
              >
                <VStack gap={0.5}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <Text as="p" size="sm" weight="semibold">
                      {item.label}
                    </Text>
                    <span
                      style={{
                        fontSize: "10px",
                        padding: "1px 5px",
                        borderRadius: "4px",
                        background:
                          item.tier.includes("BAYES") ||
                          item.tier.includes("REPUTATION") ||
                          item.tier.includes("HEAD")
                            ? "color-mix(in srgb, var(--color-cyan) 15%, transparent)"
                            : item.tier.includes("PENALTY") ||
                                item.tier.includes("FAIL") ||
                                item.tier.includes("BREACH")
                              ? "color-mix(in srgb, var(--color-warning) 15%, transparent)"
                              : item.tier.includes("PIPELINE") ||
                                  item.tier.includes("NODE") ||
                                  item.tier.includes("CEILINGS")
                                ? "color-mix(in srgb, var(--color-success) 15%, transparent)"
                                : "var(--color-surface-hover)",
                        color:
                          item.tier.includes("BAYES") ||
                          item.tier.includes("REPUTATION") ||
                          item.tier.includes("HEAD")
                            ? "var(--color-cyan)"
                            : item.tier.includes("PENALTY") ||
                                item.tier.includes("FAIL") ||
                                item.tier.includes("BREACH")
                              ? "var(--color-warning)"
                              : item.tier.includes("PIPELINE") ||
                                  item.tier.includes("NODE") ||
                                  item.tier.includes("CEILINGS")
                                ? "var(--color-success)"
                                : "var(--color-text-muted)",
                        letterSpacing: "0.04em",
                        fontFamily: "var(--font-mono, monospace)",
                      }}
                    >
                      {item.tier}
                    </span>
                  </div>
                  <Text as="p" size="xsm" color="secondary">
                    {item.description}
                  </Text>
                </VStack>
              </ClickableCard>
            ))}
          </Grid>
        </VStack>
      ))}

      {/* Sibyl Labs 5-Tier Memory Protocol Showcase */}
      <VStack gap={1}>
        <Text as="p" size="xsm" color="secondary" weight="semibold">
          Sibyl Labs Memory Protocol (5 Tiers & Base Sepolia)
        </Text>
        <Grid columns={{ minWidth: 220, max: 2 }} gap={2}>
          {SIBYL_MEMORY_SHOWCASE_PROMPTS.map((item) => (
            <ClickableCard
              key={item.id}
              label={item.label}
              variant="muted"
              padding={3}
              onClick={() => onOffer(item.prompt)}
            >
              <VStack gap={0.5}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <Text as="p" size="sm" weight="semibold">
                    {item.label}
                  </Text>
                  <span
                    style={{
                      fontSize: "10px",
                      padding: "1px 5px",
                      borderRadius: "4px",
                      background: "var(--color-surface-hover)",
                      color: "var(--color-text-muted)",
                      letterSpacing: "0.04em",
                      fontFamily: "var(--font-mono, monospace)",
                    }}
                  >
                    {item.tier}
                  </span>
                </div>
                <Text as="p" size="xsm" color="secondary">
                  {item.description}
                </Text>
              </VStack>
            </ClickableCard>
          ))}
        </Grid>
      </VStack>

      <Text as="p" size="xsm" color="secondary" weight="semibold">
        {console_.chat.zero.worksLabel}
      </Text>
      <Grid columns={{ minWidth: 200, max: 2 }} gap={2}>
        {CONSOLE_COMMANDS.map((command) => (
          <ClickableCard
            key={command.id}
            label={command.label}
            variant="muted"
            padding={3}
            onClick={() => onOffer(command.aliases[0]!)}
          >
            <VStack gap={0.5}>
              <Text as="p" size="sm" weight="semibold">
                {command.label}
              </Text>
              <Text as="p" size="xsm" color="secondary">
                {command.aliases[0]}
              </Text>
            </VStack>
          </ClickableCard>
        ))}
      </Grid>

      <Text as="p" size="xsm" color="secondary" weight="semibold">
        {console_.chat.zero.needsAgentLabel}
      </Text>
      <Grid columns={{ minWidth: 200, max: 2 }} gap={2}>
        <ClickableCard
          label={console_.chat.placeholder}
          variant="transparent"
          padding={3}
          onClick={() => onOffer(console_.chat.placeholder)}
        >
          <Text as="p" size="sm">
            {console_.chat.placeholder}
          </Text>
        </ClickableCard>
      </Grid>
      <Text as="p" size="xsm" color="secondary">
        {console_.chat.zero.needsAgentNote}
      </Text>
    </VStack>
  );
}

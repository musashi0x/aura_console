"use client";

import { ClickableCard } from "@astryxdesign/core/ClickableCard";
import { Grid } from "@astryxdesign/core/Grid";
import { VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";

import { CONSOLE_COMMANDS } from "../console-commands";
import { console_ } from "../copy";

export interface ConsoleChatSuggestionsProps {
  /**
   * Puts the text in the composer. Deliberately the ONLY thing this component
   * can do: it takes no navigate function and no command, so a suggestion here
   * cannot run one however the markup is later rearranged.
   */
  onOffer: (text: string) => void;
  runId?: string;
}

/**
 * The zero state: what to ask, when nothing has been asked.
 *
 * Every card is drawn from the command registry the palette runs, so this
 * cannot drift into advertising a command that does not exist. There are no
 * invented categories: the honest grouping is "these run now" and "this needs
 * the agent", because those are the two things the console can actually tell
 * the operator apart.
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

export function ConsoleChatSuggestions({ onOffer, runId }: ConsoleChatSuggestionsProps) {
  return (
    <VStack gap={3} padding={2}>
      <VStack gap={1}>
        <Text as="p" weight="semibold">
          {console_.chat.zero.title}
        </Text>
        <Text as="p" size="sm" color="secondary">
          {console_.chat.zero.lede}
        </Text>
      </VStack>

      {/* When scoped to a Run, provide prompt cards that explain the running steps */}
      {runId ? (
        <VStack gap={1}>
          <Text as="p" size="xsm" color="secondary" weight="semibold">
            Mission Execution & Step Explanations
          </Text>
          <Grid columns={{ minWidth: 220, max: 2 }} gap={2}>
            <ClickableCard
              label="Explain Mission Running Steps"
              variant="muted"
              padding={3}
              onClick={() =>
                onOffer(
                  "Explain the recorded execution steps of this mission so far, including memory recall, candidate scoring, and the chosen counterparty.",
                )
              }
            >
              <VStack gap={0.5}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <Text as="p" size="sm" weight="semibold">
                    Explain Mission Steps
                  </Text>
                  <span
                    style={{
                      fontSize: "10px",
                      padding: "1px 5px",
                      borderRadius: "4px",
                      background: "color-mix(in srgb, var(--color-success) 15%, transparent)",
                      color: "var(--color-success)",
                      letterSpacing: "0.04em",
                      fontFamily: "var(--font-mono, monospace)",
                    }}
                  >
                    RUN PIPELINE
                  </span>
                </div>
                <Text as="p" size="xsm" color="secondary">
                  Walk through the causal execution spine: budget ceiling, Sibyl reputation queries, and candidate ranking
                </Text>
              </VStack>
            </ClickableCard>

            <ClickableCard
              label="Why was this counterparty chosen?"
              variant="muted"
              padding={3}
              onClick={() =>
                onOffer(
                  "Why was this counterparty chosen for this mission based on Sibyl relationship memory?",
                )
              }
            >
              <VStack gap={0.5}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <Text as="p" size="sm" weight="semibold">
                    Why was this chosen?
                  </Text>
                  <span
                    style={{
                      fontSize: "10px",
                      padding: "1px 5px",
                      borderRadius: "4px",
                      background: "color-mix(in srgb, var(--color-cyan) 15%, transparent)",
                      color: "var(--color-cyan)",
                      letterSpacing: "0.04em",
                      fontFamily: "var(--font-mono, monospace)",
                    }}
                  >
                    DECISION REASONING
                  </span>
                </div>
                <Text as="p" size="xsm" color="secondary">
                  Inspect Bayesian composite scores, reliability ratings, and past delivery episodes
                </Text>
              </VStack>
            </ClickableCard>
          </Grid>
        </VStack>
      ) : null}

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
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
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

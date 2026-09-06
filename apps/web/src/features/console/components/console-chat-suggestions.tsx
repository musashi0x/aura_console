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
export function ConsoleChatSuggestions({ onOffer }: ConsoleChatSuggestionsProps) {
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
            /* Fills the composer; it does not run. A card is a larger, more
               inviting target than the chip it replaced, so the rule matters
               more here, not less: pressing one must never navigate the
               console out from under someone still reading the list. */
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

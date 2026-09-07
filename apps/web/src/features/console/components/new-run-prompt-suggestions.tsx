"use client";

import { ClickableCard } from "@astryxdesign/core/ClickableCard";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { Token } from "@astryxdesign/core/Token";

import { MISSION_TEMPLATES, type MissionTemplate } from "../model/draft-run-store";

export interface NewRunPromptSuggestionsProps {
  onSelect: (template: MissionTemplate) => void;
}

export function NewRunPromptSuggestions({ onSelect }: NewRunPromptSuggestionsProps) {
  return (
    <VStack gap={3} padding={2}>
      <VStack gap={1}>
        <Text as="p" weight="semibold">
          Prompt Templates & Objectives
        </Text>
        <Text as="p" size="sm" color="secondary">
          Click any template to auto-populate the objective and budget ceiling on the form.
        </Text>
      </VStack>

      <VStack gap={2}>
        {MISSION_TEMPLATES.map((template) => (
          <ClickableCard
            key={template.id}
            label={template.title}
            variant="muted"
            padding={3}
            onClick={() => onSelect(template)}
          >
            <VStack gap={1.5}>
              <HStack justify="between" align="center">
                <Text as="p" size="sm" weight="semibold">
                  {template.title}
                </Text>
                <HStack gap={1} align="center">
                  <Token label={template.category} size="sm" color="cyan" />
                  <Token label={`${parseInt(template.budgetUsdc, 10)} USDC`} size="sm" color="green" />
                </HStack>
              </HStack>
              <Text as="p" size="xsm" color="secondary">
                {template.objective}
              </Text>
            </VStack>
          </ClickableCard>
        ))}
      </VStack>

      <VStack gap={1} padding={2} className="cs__prompt-tips">
        <Text as="p" size="xsm" weight="semibold" color="secondary">
          TIPS FOR EFFECTIVE PROMPTS
        </Text>
        <Text as="p" size="xsm" color="secondary">
          • State explicit targets (pools, providers, protocols)
        </Text>
        <Text as="p" size="xsm" color="secondary">
          • Declare concrete deliverables (dataset, audit log)
        </Text>
        <Text as="p" size="xsm" color="secondary">
          • Set a strict budget ceiling to cap autonomous spending
        </Text>
      </VStack>
    </VStack>
  );
}

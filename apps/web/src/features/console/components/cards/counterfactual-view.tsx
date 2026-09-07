"use client";

import { useState } from "react";
import { Button } from "@astryxdesign/core/Button";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";

import { console_ } from "@/features/console/copy";
import type { Counterfactual, RankedCandidate } from "@/features/console/projection/counterfactual";

/**
 * What the ranking would have been without private memory.
 *
 * This is the line the whole product is built to earn, and the one most easily
 * turned into a lie, so two rules are enforced here rather than trusted:
 *
 * - **"Memory changed this decision" renders only on DECISION_CHANGED.** When
 *   memory was consulted and the choice held, the honest line is that it was
 *   checked and nothing moved — a real result, and a good one to show.
 * - **An UNAVAILABLE comparison renders no control at all.** A Mission whose
 *   scoring recorded no memory component cannot be compared, and a button that
 *   opens onto "we could not work it out" is worse than no button.
 *
 * The comparison itself is computed upstream by a pure fold over recorded
 * events. Nothing in this component can execute anything.
 */
export function CounterfactualView({ counterfactual }: { counterfactual: Counterfactual }) {
  const copy = console_.cards.counterfactual;
  const [open, setOpen] = useState(false);

  if (counterfactual.status === "UNAVAILABLE") return null;

  const changed = counterfactual.status === "DECISION_CHANGED";

  return (
    <VStack gap={2}>
      <HStack gap={2}>
        <Button
          label={open ? copy.close : copy.open}
          variant="secondary"
          size="sm"
          onClick={() => setOpen((v) => !v)}
        />
      </HStack>

      {open ? (
        <VStack gap={2}>
          {/* The headline is the claim. It is bound to the status rather than
              to whether a comparison happened to render. */}
          <Text as="p" size="sm" weight="semibold">
            {changed ? copy.changed : copy.unchanged}
          </Text>

          <HStack gap={6} wrap="wrap">
            <Column title={copy.withMemory} rows={counterfactual.withMemory} />
            <Column title={copy.withoutMemory} rows={counterfactual.withoutMemory} />
          </HStack>

          {changed ? (
            <VStack gap={1}>
              <Text as="p" size="xsm" color="secondary">
                {copy.whatChanged}
              </Text>
              <Text as="p" size="sm">
                {counterfactual.explanation}
              </Text>
            </VStack>
          ) : null}

          <Text as="p" size="xsm" color="secondary">
            {copy.simulated}
          </Text>
        </VStack>
      ) : null}
    </VStack>
  );
}

/** One ranking, winner first, exactly as the fold ordered it. */
function Column({ title, rows }: { title: string; rows: readonly RankedCandidate[] }) {
  return (
    <VStack gap={1}>
      <Text as="p" size="xsm" color="secondary">
        {title}
      </Text>
      {rows.map((row, index) => (
        <HStack key={row.key} gap={2} wrap="wrap">
          <Text as="span" size="sm" weight={index === 0 ? "semibold" : undefined}>
            {row.key}
          </Text>
          <Text as="span" size="xsm" color="secondary">
            {row.score}
          </Text>
        </HStack>
      ))}
    </VStack>
  );
}

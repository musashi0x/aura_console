"use client";

import { useId, useState, type ReactNode } from "react";
import { MetadataList, MetadataListItem } from "@astryxdesign/core/MetadataList";
import { VStack } from "@astryxdesign/core/Stack";

export interface MissionInspectorProps {
  runId: string;
  environment: string;
  budgetUsdc?: string | null;
  spentUsdc?: string | null;
  txHash?: string | null;
  txHashes?: readonly string[] | string[];
  isCollapsible?: boolean;
  isOpen?: boolean;
  onToggle?: () => void;
  memoryStatus?: string | null;
  title?: ReactNode;
  className?: string;
}

function formatBudget(budget?: string | null): string {
  if (!budget) return "None";
  return budget.includes("USDC") ? budget : `${budget} USDC`;
}

function formatSpent(spent?: string | null): string {
  if (!spent) return "Not yet reported";
  return spent.includes("USDC") ? spent : `${spent} USDC`;
}

export function MissionInspector({
  runId,
  environment,
  budgetUsdc,
  spentUsdc,
  txHash,
  txHashes,
  isCollapsible = false,
  isOpen: controlledIsOpen,
  onToggle,
  memoryStatus,
  title = "Mission Technical Parameters",
  className,
}: MissionInspectorProps) {
  const [internalIsOpen, setInternalIsOpen] = useState(!isCollapsible);
  const panelId = useId();
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;

  const handleToggle = () => {
    if (onToggle) {
      onToggle();
    } else {
      setInternalIsOpen((prev) => !prev);
    }
  };

  const hashes = txHashes ?? (txHash ? [txHash] : []);

  return (
    <section
      className={`cs__mission-inspector ${className ?? ""}`.trim()}
      aria-label="Mission Inspector"
    >
      {isCollapsible ? (
        <div className="cs__inspector-disclosure-trigger">
          <button
            type="button"
            className="btn btn--sm btn--secondary cs__inspector-toggle"
            onClick={handleToggle}
            aria-expanded={isOpen}
            aria-controls={panelId}
          >
            {isOpen ? "Hide Inspector" : "Show Inspector"}
          </button>
        </div>
      ) : null}

      {isOpen ? (
        <div
          id={panelId}
          data-testid="mission-inspector-panel"
          className="cs__mission-inspector-panel"
        >
          <MetadataList columns="multi" title={title} orientation="vertical">
            <MetadataListItem label="Mission UUID">
              <code data-testid="meta-run-id">{runId}</code>
            </MetadataListItem>

            <MetadataListItem label="Sandbox Environment">
              <span data-testid="meta-environment">{environment}</span>
            </MetadataListItem>

            <MetadataListItem label="Budget Ceiling">
              <span data-testid="meta-budget">{formatBudget(budgetUsdc)}</span>
            </MetadataListItem>

            <MetadataListItem label="Budget Spent">
              <span className="visually-hidden">Spent</span>
              <span data-testid="meta-spent">{formatSpent(spentUsdc)}</span>
            </MetadataListItem>

            {memoryStatus != null ? (
              <MetadataListItem label="Memory">
                <span data-testid="meta-memory">{memoryStatus}</span>
              </MetadataListItem>
            ) : null}

            <MetadataListItem label="Base Sepolia Transactions">
              {hashes.length > 0 ? (
                <VStack gap={1}>
                  {hashes.map((h) => (
                    <a
                      key={h}
                      href={`https://sepolia.basescan.org/tx/${h}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="cs__tx-link"
                      data-testid="meta-tx-link"
                    >
                      {h.length > 20 ? `${h.slice(0, 10)}...${h.slice(-8)} ↗` : `${h} ↗`}
                    </a>
                  ))}
                </VStack>
              ) : (
                <span data-testid="meta-no-tx">None</span>
              )}
            </MetadataListItem>
          </MetadataList>
        </div>
      ) : null}
    </section>
  );
}

MissionInspector.displayName = "MissionInspector";

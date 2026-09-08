"use client";

import { useState } from "react";
import { Button } from "@astryxdesign/core/Button";
import { HStack, VStack } from "@astryxdesign/core/Stack";
import { Text } from "@astryxdesign/core/Text";
import { Token } from "@astryxdesign/core/Token";

import { apiClient } from "@/lib/api-client";
import { useWeb3Wallet } from "@/features/web3";

export interface ChatApprovalCardProps {
  counterpartyKey: string;
  amountUsdc: string | number;
  rationale: string;
  runId?: string;
  onApproved?: () => void;
}

/**
 * Interactive in-chat approval action card.
 * Rendered when an assistant message invokes mission_propose_approval.
 * Shows counterparty, amount USDC, rationale, and an [Approve Spend] button
 * that directly calls POST /api/runs/:runId/approve and updates local state.
 */
export function ChatApprovalCard({
  counterpartyKey,
  amountUsdc,
  rationale,
  runId,
  onApproved,
}: ChatApprovalCardProps) {
  const { address, isConnected, isBaseSepolia } = useWeb3Wallet();
  const [status, setStatus] = useState<"pending" | "approving" | "approved" | "failed">("pending");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const num = typeof amountUsdc === "number" ? amountUsdc : parseFloat(amountUsdc);
  const displayNum = Number.isNaN(num) || num <= 0 ? 10 : num;
  const formattedAmount = Number.isNaN(num) || num <= 0 ? "10.000000" : num.toFixed(6);
  const displayAmount = displayNum.toFixed(2);

  async function handleApprove() {
    if (!runId || status === "approving" || status === "approved") return;
    setStatus("approving");
    setErrorMessage(null);

    try {
      const result = await apiClient.approveRun(runId, formattedAmount);
      if (result.ok) {
        setStatus("approved");
        onApproved?.();
      } else {
        setStatus("failed");
        setErrorMessage(result.error?.message ?? "Failed to approve spend");
      }
    } catch (err) {
      setStatus("failed");
      setErrorMessage(err instanceof Error ? err.message : "Network error during approval");
    }
  }

  const signerDisplay = isConnected && address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : "0x71C2...3a9F (Default)";

  return (
    <div
      role="region"
      aria-label="Mission Spend Approval"
      style={{
        border: "1px solid var(--color-border, rgba(255, 255, 255, 0.12))",
        borderRadius: "8px",
        padding: "14px 16px",
        background: "var(--color-surface-subtle, rgba(255, 255, 255, 0.03))",
        marginTop: "10px",
        marginBottom: "6px",
      }}
    >
      <VStack gap={3}>
        <HStack gap={2} align="center" justify="between" wrap="wrap">
          <Text as="h3" size="sm" weight="semibold">
            Proposed Spend Approval
          </Text>
          <Token
            label={
              status === "approved"
                ? "Spend Approved"
                : status === "failed"
                  ? "Approval Failed"
                  : "Awaiting Approval"
            }
            size="sm"
            color={status === "approved" ? "green" : status === "failed" ? "red" : "orange"}
          />
        </HStack>

        <VStack gap={1}>
          <HStack gap={2} wrap="wrap">
            <Text as="span" size="xsm" color="secondary" weight="semibold">
              Network:
            </Text>
            <Text as="span" size="sm" weight="semibold" style={{ color: "var(--color-cyan)" }}>
              Base Sepolia (84532){isBaseSepolia ? " (Active)" : ""}
            </Text>
          </HStack>

          <HStack gap={2} wrap="wrap">
            <Text as="span" size="xsm" color="secondary" weight="semibold">
              Operator Signer:
            </Text>
            <Text as="span" size="sm" style={{ fontFamily: "var(--font-mono)" }}>
              {signerDisplay}
            </Text>
          </HStack>

          <HStack gap={2} wrap="wrap">
            <Text as="span" size="xsm" color="secondary" weight="semibold">
              Counterparty:
            </Text>
            <Text as="span" size="sm">
              {counterpartyKey}
            </Text>
          </HStack>

          <HStack gap={2} wrap="wrap">
            <Text as="span" size="xsm" color="secondary" weight="semibold">
              Amount USDC:
            </Text>
            <Text as="span" size="sm" weight="semibold">
              ${displayAmount} USDC
            </Text>
          </HStack>

          <HStack gap={2} wrap="wrap" align="start">
            <Text as="span" size="xsm" color="secondary" weight="semibold">
              Rationale:
            </Text>
            <Text as="span" size="sm">
              {rationale}
            </Text>
          </HStack>
        </VStack>

        {status === "approved" ? (
          <Text as="p" size="sm" color="secondary">
            ✓ Spend of ${displayAmount} USDC approved by operator.
          </Text>
        ) : (
          <VStack gap={2} align="start">
            <HStack gap={2} align="center">
              <Button
                label={status === "approving" ? "Approving..." : "Approve Spend"}
                onClick={handleApprove}
                isDisabled={!runId || status === "approving"}
                isLoading={status === "approving"}
              />
              {!runId ? (
                <Text as="span" size="xsm" color="secondary">
                  Run context required
                </Text>
              ) : null}
            </HStack>

            {errorMessage ? (
              <Text as="p" size="xsm" color="secondary">
                {errorMessage}
              </Text>
            ) : null}
          </VStack>
        )}
      </VStack>
    </div>
  );
}

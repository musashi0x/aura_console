"use client";

import { useState } from "react";
import {
  Terminal,
  FileCode,
  Check,
  Loader2,
  ChevronDown,
  Brain,
  ShieldCheck,
  Search,
} from "lucide-react";
import type { McpToolCall } from "@/features/console/chat/chat-types";
import { playInteractionSound } from "./InteractionSounds";

export type ToolDiff = { file: string; add: number; del: number };

export interface ToolChipsProps {
  calls?: McpToolCall[];
  diffs?: ToolDiff[];
  isComplete?: boolean;
  className?: string;
  defaultExpanded?: boolean;
}

const DEFAULT_TOOL_CALLS: McpToolCall[] = [
  {
    name: "memory_recall_counterparty",
    args: { counterpartyKey: "virtuals:agent:beta" },
    result: {
      retrieval: {
        status: "AVAILABLE",
        memoryVersion: 3,
        episodesUsed: 14,
        relationshipStatus: "ESTABLISHED",
        overallReliability: 0.84,
        taskFit: "HIGH",
        confidence: 0.91,
      },
    },
  },
  {
    name: "policy_check_limit",
    args: { amountUsdc: "10.00", counterpartyKey: "virtuals:agent:beta" },
    result: { withinLimit: true, requiresBoardApproval: false, remainingDailyBudget: "90.00" },
  },
  {
    name: "mission_propose_approval",
    args: {
      counterpartyKey: "virtuals:agent:beta",
      amountUsdc: "10.00",
      reason: "Draft exploratory research engagement under active guardrail limits",
    },
    result: { status: "PROPOSED", approvalId: "appr-01" },
  },
];

function getToolIcon(name: string) {
  if (name.includes("memory") || name.includes("recall")) {
    return <Brain size={13} className="text-[#d8d8db]" />;
  }
  if (name.includes("approval") || name.includes("policy") || name.includes("spend")) {
    return <ShieldCheck size={13} className="text-[#51e6a6]" />;
  }
  if (name.includes("search") || name.includes("query")) {
    return <Search size={13} className="text-[#d8d8db]" />;
  }
  if (name.includes("write") || name.includes("code") || name.includes("edit")) {
    return <FileCode size={13} className="text-[#d8d8db]" />;
  }
  return <Terminal size={13} className="text-[#d8d8db]" />;
}

export function ToolChips({
  calls = DEFAULT_TOOL_CALLS,
  diffs = [],
  isComplete = true,
  className = "",
  defaultExpanded = false,
}: ToolChipsProps) {
  const [containerExpanded, setContainerExpanded] = useState(defaultExpanded);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  const toggleRow = (index: number) => {
    playInteractionSound("press");
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const toggleContainer = () => {
    playInteractionSound("press");
    setContainerExpanded((prev) => !prev);
  };

  if (!calls || calls.length === 0) return null;

  return (
    <div
      data-tool-chips
      className={`w-full max-w-[620px] rounded-[10px] border border-[rgba(216,216,219,0.16)] bg-[#1b1b1f] my-2 overflow-hidden text-[#f4f7fb] ${className}`}
    >
      {/* Header bar */}
      <button
        type="button"
        aria-expanded={containerExpanded}
        onClick={toggleContainer}
        data-sound="press"
        className="flex w-full items-center justify-between px-3 py-2 text-left bg-transparent hover:bg-[rgba(255,255,255,0.03)] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#d8d8db]"
      >
        <div className="flex items-center gap-2">
          <Terminal size={13} className="text-[#d8d8db]" />
          <span className="text-[12.5px] font-medium text-[var(--color-text-muted,#8d9aaf)]">
            {calls.length} {calls.length === 1 ? "tool invocation" : "tool invocations"}
          </span>
          {isComplete ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#51e6a6]/15 px-2 py-0.5 text-[10.5px] font-medium text-[#51e6a6]">
              <Check size={10} strokeWidth={2.5} /> Done
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#ffbe63]/15 px-2 py-0.5 text-[10.5px] font-medium text-[#ffbe63]">
              <Loader2 size={10} className="animate-spin" /> Active
            </span>
          )}
        </div>

        <ChevronDown
          size={14}
          className={`text-[var(--color-text-muted,#8d9aaf)] transition-transform duration-200 ${
            containerExpanded ? "rotate-180" : "rotate-0"
          }`}
        />
      </button>

      {/* Expanded list of tool chips */}
      {containerExpanded && (
        <div className="border-t border-[rgba(216,216,219,0.16)] bg-[#111015]/60 p-2.5 flex flex-col gap-1.5">
          {calls.map((call, idx) => {
            const isRowOpen = expandedRows.has(idx);
            const previewTarget =
              String(
                (call.args?.counterpartyKey as string) ||
                  (call.args?.target as string) ||
                  (call.args?.command as string) ||
                  (call.args?.reason as string) ||
                  ""
              ) || call.name;

            return (
              <div
                key={`${call.name}-${idx}`}
                className="rounded-[8px] border border-[rgba(216,216,219,0.12)] bg-[#1b1b1f] overflow-hidden"
              >
                <button
                  type="button"
                  aria-expanded={isRowOpen}
                  onClick={() => toggleRow(idx)}
                  data-sound="press"
                  className="flex w-full items-center justify-between px-2.5 py-1.5 text-left hover:bg-[#25252a] transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-[4px] bg-[#25252a]">
                      {getToolIcon(call.name)}
                    </span>
                    <span className="font-mono text-[11.5px] font-semibold text-[#f4f7fb] truncate">
                      {call.name}
                    </span>
                    <span className="inline-block max-w-[200px] truncate rounded-[6px] bg-[#25252a] px-1.5 py-0.5 font-mono text-[10.5px] text-[var(--color-text-muted,#8d9aaf)]">
                      {previewTarget}
                    </span>
                  </div>

                  <ChevronDown
                    size={12}
                    className={`text-[var(--color-text-muted,#8d9aaf)] transition-transform duration-150 shrink-0 ml-2 ${
                      isRowOpen ? "rotate-180" : "rotate-0"
                    }`}
                  />
                </button>

                {/* Inspection panel */}
                {isRowOpen && (
                  <div className="border-t border-[rgba(216,216,219,0.12)] bg-[#111015] p-2.5 text-[11px] font-mono text-[var(--color-text-muted,#8d9aaf)] flex flex-col gap-2">
                    <div>
                      <span className="text-[#d8d8db] font-semibold">Arguments:</span>
                      <pre className="mt-1 p-2 rounded-[6px] bg-[#1b1b1f] overflow-x-auto text-[10.5px] text-[#f4f7fb]">
                        {JSON.stringify(call.args, null, 2)}
                      </pre>
                    </div>

                    {call.result !== undefined && (
                      <div>
                        <span className="text-[#51e6a6] font-semibold">Result:</span>
                        <pre className="mt-1 p-2 rounded-[6px] bg-[#1b1b1f] overflow-x-auto text-[10.5px] text-[#f4f7fb]">
                          {JSON.stringify(call.result, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Diffs preview chips */}
          {diffs && diffs.length > 0 && (
            <div className="mt-2 pt-2 border-t border-[rgba(216,216,219,0.12)] flex flex-wrap gap-1.5">
              {diffs.map((diff, i) => (
                <span
                  key={`${diff.file}-${i}`}
                  className="inline-flex items-center gap-1.5 rounded-[6px] bg-[#25252a] border border-[rgba(216,216,219,0.16)] px-2 py-1 font-mono text-[11px] text-[#f4f7fb]"
                >
                  <span>{diff.file}</span>
                  <span className="text-[#51e6a6]">+{diff.add}</span>
                  {diff.del > 0 && <span className="text-[#ff6b7a]">-{diff.del}</span>}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ToolChips;

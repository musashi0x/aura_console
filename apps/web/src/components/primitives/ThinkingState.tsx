"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Sparkles, ChevronDown, Check, Loader2, Search } from "lucide-react";
import { playInteractionSound } from "./InteractionSounds";

export type ThinkingStep = {
  primary: string;
  secondary?: string;
  mono?: boolean;
  add?: number;
  del?: number;
  href?: string;
  status?: "pending" | "running" | "complete";
};

type StageInfo = { active: string; done: string; rows: ThinkingStep[]; query?: string };

const DEFAULT_STAGES: Record<"Steps" | "Reasoning" | "Search" | "Coding", StageInfo> = {
  Steps: {
    active: "Thinking",
    done: "Thought for 4 seconds",
    rows: [
      { primary: "Evaluating counterparty memory records" },
      { primary: "Scanning active policy spend limits" },
      { primary: "Comparing Sibyl relationship reliability scores", secondary: "2 counterparties" },
      { primary: "Formulating spend recommendation" },
    ],
  },
  Reasoning: {
    active: "Reasoning",
    done: "Thought for 4 seconds",
    rows: [
      { primary: "Counterparty Beta Labs has an overall reliability of 84% across 14 historical tasks." },
      { primary: "Policy guardrails allow maximum $50 USDC per transaction without board quorum." },
    ],
  },
  Search: {
    active: "Searching memory records",
    done: "Searched memory records",
    query: "counterparty:beta-labs memory_version",
    rows: [
      { primary: "Sibyl Relationship Graph", secondary: "sibyl.aura.network", href: "#" },
      { primary: "Base Sepolia Contract Logs", secondary: "basescan.org", href: "#" },
      { primary: "Policy Store Registry", secondary: "aura-policies.local", href: "#" },
    ],
  },
  Coding: {
    active: "Executing MCP tools",
    done: "Ran 3 tools",
    rows: [
      { primary: "Call", secondary: "memory_recall_counterparty", mono: true },
      { primary: "Inspect", secondary: "policy_check_limit", mono: true },
      { primary: "Propose", secondary: "mission_propose_approval", mono: true, add: 10, del: 0 },
    ],
  },
};

export interface ThinkingStateProps {
  variant?: "Steps" | "Reasoning" | "Search" | "Coding";
  thought?: string;
  isStreaming?: boolean;
  durationSeconds?: number;
  onSettled?: () => void;
  className?: string;
  defaultExpanded?: boolean;
}

export function ThinkingState({
  variant = "Steps",
  thought,
  isStreaming = false,
  durationSeconds,
  onSettled,
  className = "",
  defaultExpanded,
}: ThinkingStateProps) {
  const [manualExpanded, setManualExpanded] = useState<boolean | null>(
    defaultExpanded !== undefined ? defaultExpanded : null
  );
  const [liveElapsed, setLiveElapsed] = useState(0);
  const startTimeRef = useRef<number>(0);
  const settledRef = useRef(false);
  const traceRef = useRef<HTMLDivElement>(null);
  const [lineHeight, setLineHeight] = useState(0);

  const elapsed = durationSeconds !== undefined ? durationSeconds : liveElapsed;
  const v = DEFAULT_STAGES[variant] ?? DEFAULT_STAGES.Steps;

  // Handle live timer
  useEffect(() => {
    if (durationSeconds !== undefined) return;

    if (isStreaming) {
      startTimeRef.current = Date.now();
      const timer = setInterval(() => {
        const secs = Math.max(1, Math.floor((Date.now() - startTimeRef.current) / 1000));
        setLiveElapsed(secs);
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [isStreaming, durationSeconds]);

  // Handle settled callback
  useEffect(() => {
    if (isStreaming || settledRef.current) return;
    settledRef.current = true;
    onSettled?.();
  }, [isStreaming, onSettled]);

  const expanded = manualExpanded ?? (isStreaming ? true : false);

  useLayoutEffect(() => {
    if (traceRef.current) {
      setLineHeight(traceRef.current.offsetHeight);
    }
  }, [expanded, thought, isStreaming, variant]);

  const toggleExpand = () => {
    playInteractionSound("press");
    setManualExpanded((curr) => !(curr ?? (isStreaming ? true : false)));
  };

  // Header label
  const headerLabel = isStreaming
    ? `Reasoning in progress... (${elapsed}s)`
    : elapsed > 0
    ? `Thought for ${elapsed} ${elapsed === 1 ? "second" : "seconds"}`
    : thought
    ? "Thought process"
    : v.done;

  return (
    <div
      data-thinking-state
      className={`flex w-full max-w-[620px] flex-col rounded-[10px] border border-[rgba(216,216,219,0.16)] bg-[#1b1b1f] overflow-hidden text-[#f4f7fb] my-2 ${className}`}
    >
      {/* Header button */}
      <button
        type="button"
        aria-expanded={expanded}
        onClick={toggleExpand}
        data-sound="press"
        className="flex w-full items-center justify-between px-3 py-2 text-left bg-transparent hover:bg-[rgba(255,255,255,0.03)] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#d8d8db]"
      >
        <div className="flex items-center gap-2 min-w-0">
          {isStreaming ? (
            <span className="flex size-4 items-center justify-center text-[#d8d8db] animate-spin">
              <Loader2 size={13} />
            </span>
          ) : (
            <Sparkles size={13} className="text-[#d8d8db] shrink-0" />
          )}

          <span
            className={`text-[12.5px] font-medium truncate ${
              isStreaming
                ? "text-[#f4f7fb] font-semibold"
                : "text-[var(--color-text-muted,#8d9aaf)]"
            }`}
          >
            {headerLabel}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <ChevronDown
            size={14}
            className={`text-[var(--color-text-muted,#8d9aaf)] transition-transform duration-200 ${
              expanded ? "rotate-180" : "rotate-0"
            }`}
          />
        </div>
      </button>

      {/* Expandable Trace Accordion */}
      <div
        className="grid transition-[grid-template-rows,opacity] duration-300 ease-out"
        style={{
          gridTemplateRows: expanded ? "1fr" : "0fr",
          opacity: expanded ? 1 : 0,
        }}
      >
        <div className="overflow-hidden">
          <div className="border-t border-[rgba(216,216,219,0.16)] bg-[#111015]/60 px-3.5 py-3">
            <div ref={traceRef} className="flex flex-col gap-2">
              {/* Custom raw thought markdown/text if provided */}
              {thought ? (
                <div className="text-[12.5px] leading-relaxed text-[var(--color-text-muted,#8d9aaf)] whitespace-pre-wrap font-sans">
                  {thought}
                </div>
              ) : (
                <>
                  {/* Query header if present */}
                  {v.query && (
                    <div className="flex items-center gap-2 px-1 text-[12px] text-[var(--color-text-muted,#8d9aaf)] font-mono">
                      <Search size={12} className="shrink-0 text-[#d8d8db]" />
                      <span className="truncate">{v.query}</span>
                    </div>
                  )}

                  {/* Stage steps */}
                  <div className="relative pl-3 flex flex-col gap-1.5">
                    <span
                      aria-hidden
                      className="absolute left-[3px] top-1 w-px bg-[rgba(216,216,219,0.16)]"
                      style={{ height: lineHeight ? Math.max(12, lineHeight - 14) : 0 }}
                    />
                    {v.rows.map((row, idx) => {
                      const isRowDone = !isStreaming || idx < v.rows.length - 1;
                      return (
                        <div
                          key={row.primary}
                          className="flex items-center gap-2 rounded-[6px] px-1.5 py-0.5 text-[12px]"
                        >
                          {isStreaming && idx === v.rows.length - 1 ? (
                            <span className="size-3.5 shrink-0 flex items-center justify-center text-[#d8d8db] animate-spin">
                              <Loader2 size={11} />
                            </span>
                          ) : (
                            <span className="size-3.5 shrink-0 flex items-center justify-center rounded-full bg-[#51e6a6]/15 text-[#51e6a6]">
                              <Check size={10} strokeWidth={2.5} />
                            </span>
                          )}

                          <span
                            className={`min-w-0 truncate font-medium ${
                              isRowDone ? "text-[#f4f7fb]" : "text-[var(--color-text-muted,#8d9aaf)]"
                            }`}
                          >
                            {row.primary}
                          </span>

                          {row.secondary && (
                            <span
                              className={`shrink-0 text-[11px] text-[var(--color-text-muted,#8d9aaf)] ${
                                row.mono ? "font-mono" : ""
                              }`}
                            >
                              {row.secondary}
                            </span>
                          )}

                          {row.add !== undefined && (
                            <span className="shrink-0 font-mono text-[10.5px]">
                              <span className="text-[#51e6a6]">+{row.add}</span>
                              {row.del !== undefined && row.del > 0 && (
                                <span className="text-[#ff6b7a]"> -{row.del}</span>
                              )}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ThinkingState;

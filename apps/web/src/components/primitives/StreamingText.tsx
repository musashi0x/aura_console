"use client";

import { useEffect, useState, useId } from "react";
import {
  Copy,
  Check,
  RotateCw,
  ThumbsUp,
  ThumbsDown,
  Globe,
  CornerDownLeft,
} from "lucide-react";
import { playInteractionSound } from "./InteractionSounds";

export type StreamingToken = { text: string; cite?: boolean };

export type StreamingSource = {
  name: string;
  domain: string;
  href?: string;
  image?: string;
};

export interface StreamingTextProps {
  /** Raw text string (useful when streaming live tokens over SSE) */
  text?: string;
  /** Token array (supports progressive simulation or inline citation chips) */
  content?: StreamingToken[];
  /** Flag indicating whether the stream is active */
  isStreaming?: boolean;
  /** Cited sources shown as chips and expandable list */
  sources?: StreamingSource[];
  /** Follow-up prompt recommendations */
  followUps?: string[];
  /** Callback when follow-up is clicked */
  onFollowUp?: (prompt: string, index: number) => void;
  /** Callback when stream finishes */
  onDone?: () => void;
  /** Whether to simulate progressive reveal loop when no external isStreaming is controlled */
  loop?: boolean;
  className?: string;
}

const DEFAULT_TOKENS: StreamingToken[] = [
  ..."Autonomous spend proposal validated under active guardrail limits."
    .split(" ")
    .map((text) => ({ text })),
  { text: "", cite: true },
  ..."Counterparty Beta Labs has an established 84% reliability rating over 14 historical engagements."
    .split(" ")
    .map((text) => ({ text })),
];

const DEFAULT_SOURCES: StreamingSource[] = [
  { name: "Sibyl Relationship Memory", domain: "sibyl.aura.network", href: "#" },
  { name: "Base Sepolia Registry", domain: "basescan.org", href: "#" },
  { name: "Operator Policy Store", domain: "aura-policy.internal", href: "#" },
];

const DEFAULT_FOLLOW_UPS = [
  "Why was Beta Labs preferred over Alpha Studio?",
  "Inspect recent execution logs for run r1",
];

export function StreamingText({
  text,
  content,
  isStreaming = false,
  sources = DEFAULT_SOURCES,
  followUps = DEFAULT_FOLLOW_UPS,
  onFollowUp,
  onDone,
  loop = false,
  className = "",
}: StreamingTextProps) {
  const compId = useId();
  const effectiveTokens: StreamingToken[] =
    content || (text ? text.split(" ").map((t) => ({ text: t })) : DEFAULT_TOKENS);
  const isControlled = text !== undefined || isStreaming !== undefined;

  // For simulation / progressive reveal
  const [simulatedCount, setSimulatedCount] = useState(0);
  const [copied, setCopied] = useState(false);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);

  useEffect(() => {
    if (isControlled) return;

    if (simulatedCount >= effectiveTokens.length) {
      if (loop) {
        const resetTimer = setTimeout(() => setSimulatedCount(0), 4000);
        return () => clearTimeout(resetTimer);
      }
      onDone?.();
      return;
    }

    const t = setTimeout(() => {
      setSimulatedCount((c) => c + 1);
      playInteractionSound("tick");
    }, 55);

    return () => clearTimeout(t);
  }, [simulatedCount, effectiveTokens.length, isControlled, loop, onDone]);

  const revealedCount = isControlled ? effectiveTokens.length : simulatedCount;
  const activeStreaming = isStreaming || (!isControlled && revealedCount < effectiveTokens.length);
  const displayedTokens = isControlled ? effectiveTokens : effectiveTokens.slice(0, revealedCount);

  const fullText = text || effectiveTokens.map((t) => (t.cite ? ` [${sources[0]?.name || "source"}] ` : t.text)).join(" ");

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(fullText);
      setCopied(true);
      playInteractionSound("pulse");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore clipboard error
    }
  };

  const toggleSourceDrawer = () => {
    playInteractionSound("press");
    setSourcesOpen((prev) => !prev);
  };

  return (
    <div data-streaming-text className={`flex flex-col w-full text-[13.5px] leading-relaxed text-[#f4f7fb] ${className}`}>
      {/* Inline styles for streaming caret */}
      <style>{`
        .stream-caret {
          display: inline-block;
          width: 2px;
          height: 1em;
          margin-left: 2px;
          background-color: #f3f3f5;
          border-radius: 1px;
          vertical-align: -0.12em;
        }
        .stream-caret.is-streaming {
          animation: streamCaretBlink 0.8s ease-in-out infinite;
        }
        @keyframes streamCaretBlink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>

      {/* Text body */}
      <p className="min-h-[22px] whitespace-pre-wrap [overflow-wrap:anywhere]">
        {text ? (
          <span>{text}</span>
        ) : (
          displayedTokens.map((token, i) =>
            token.cite ? (
              <span
                key={`${compId}-cite-${i}`}
                className="inline-flex items-center gap-1 mx-1 px-1.5 py-0.5 rounded-[6px] bg-[#25252a] text-[11px] font-mono border border-[rgba(216,216,219,0.16)] text-[#d8d8db] align-middle"
              >
                <Globe size={11} className="text-[#d8d8db]" />
                <span>{sources[0]?.domain || "source"}</span>
              </span>
            ) : (
              <span key={`${compId}-tok-${i}`}>{token.text} </span>
            )
          )
        )}

        {/* Animated caret */}
        {activeStreaming && <span className="stream-caret is-streaming" aria-hidden="true" />}
      </p>

      {/* Action Bar & Citations — visible when not streaming */}
      <div
        className="mt-2.5 flex flex-wrap items-center gap-1 text-[var(--color-text-muted,#8d9aaf)] transition-opacity duration-300"
        style={{ opacity: activeStreaming ? 0.4 : 1 }}
      >
        {/* Copy Button */}
        <button
          type="button"
          aria-label={copied ? "Copied" : "Copy text"}
          onClick={handleCopy}
          data-sound="press"
          className="flex size-7 items-center justify-center rounded-[6px] hover:bg-[#25252a] hover:text-[#f4f7fb] transition-colors"
        >
          {copied ? <Check size={13} className="text-[#51e6a6]" /> : <Copy size={13} />}
        </button>

        {/* Retry / Regenerate */}
        <button
          type="button"
          aria-label="Retry response"
          onClick={() => {
            playInteractionSound("press");
            if (!isControlled) setSimulatedCount(0);
          }}
          data-sound="press"
          className="flex size-7 items-center justify-center rounded-[6px] hover:bg-[#25252a] hover:text-[#f4f7fb] transition-colors"
        >
          <RotateCw size={13} />
        </button>

        {/* Thumbs Feedback */}
        <button
          type="button"
          aria-label="Helpful"
          aria-pressed={feedback === "up"}
          onClick={() => {
            setFeedback(feedback === "up" ? null : "up");
            playInteractionSound("press");
          }}
          data-sound="press"
          className={`flex size-7 items-center justify-center rounded-[6px] transition-colors ${
            feedback === "up"
              ? "bg-[#25252a] text-[#51e6a6]"
              : "hover:bg-[#25252a] hover:text-[#f4f7fb]"
          }`}
        >
          <ThumbsUp size={13} />
        </button>
        <button
          type="button"
          aria-label="Unhelpful"
          aria-pressed={feedback === "down"}
          onClick={() => {
            setFeedback(feedback === "down" ? null : "down");
            playInteractionSound("release");
          }}
          data-sound="release"
          className={`flex size-7 items-center justify-center rounded-[6px] transition-colors ${
            feedback === "down"
              ? "bg-[#25252a] text-[#ff6b7a]"
              : "hover:bg-[#25252a] hover:text-[#f4f7fb]"
          }`}
        >
          <ThumbsDown size={13} />
        </button>

        {/* Sources button */}
        {sources.length > 0 && (
          <button
            type="button"
            aria-expanded={sourcesOpen}
            onClick={toggleSourceDrawer}
            data-sound="press"
            className="ml-1 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[6px] bg-[#1b1b1f] border border-[rgba(216,216,219,0.16)] text-[11.5px] hover:bg-[#25252a] hover:text-[#f4f7fb] transition-colors"
          >
            <Globe size={11} className="text-[#d8d8db]" />
            <span>{sources.length} sources</span>
          </button>
        )}
      </div>

      {/* Expandable Sources Drawer */}
      {sourcesOpen && sources.length > 0 && (
        <div className="mt-2 flex flex-col gap-1 rounded-[8px] bg-[#1b1b1f] border border-[rgba(216,216,219,0.16)] p-1.5">
          {sources.map((src, i) => (
            <a
              key={`${compId}-src-${i}`}
              href={src.href || "#"}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between rounded-[6px] px-2 py-1 text-[12px] text-[var(--color-text-muted,#8d9aaf)] hover:bg-[#25252a] hover:text-[#f4f7fb] transition-colors"
            >
              <span className="font-medium truncate">{src.name}</span>
              <span className="font-mono text-[10.5px] text-[#8d9aaf] shrink-0">{src.domain}</span>
            </a>
          ))}
        </div>
      )}

      {/* Follow-up Prompts */}
      {followUps && followUps.length > 0 && !activeStreaming && (
        <div className="mt-4 flex flex-col gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted,#8d9aaf)]">
            Suggested Follow-ups
          </span>
          <div className="flex flex-col gap-1 mt-1">
            {followUps.map((fu, idx) => (
              <button
                key={`${compId}-fu-${idx}`}
                type="button"
                onClick={() => {
                  playInteractionSound("press");
                  onFollowUp?.(fu, idx);
                }}
                data-sound="press"
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-[8px] border border-[rgba(216,216,219,0.12)] bg-[#1b1b1f] hover:bg-[#25252a] hover:border-[rgba(216,216,219,0.24)] text-left text-[12.5px] text-[#f4f7fb] transition-all"
              >
                <CornerDownLeft size={12} className="text-[#d8d8db] shrink-0" />
                <span className="truncate">{fu}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default StreamingText;

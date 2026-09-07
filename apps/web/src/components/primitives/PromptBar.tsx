"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import {
  Send,
  Paperclip,
  AtSign,
  Slash,
  Sparkles,
  X,
  Bot,
  Brain,
  ShieldCheck,
  Building2,
  Terminal,
} from "lucide-react";
import { playInteractionSound } from "./InteractionSounds";

export type SuggestionPill = {
  label: string;
  query: string;
};

export interface PromptBarProps {
  value?: string;
  onChange?: (value: string) => void;
  onSubmit?: (query: string) => void;
  onStop?: () => void;
  isStreaming?: boolean;
  placeholder?: string;
  suggestions?: SuggestionPill[];
  className?: string;
}

const DEFAULT_SUGGESTIONS: SuggestionPill[] = [
  { label: "Why hire Beta Labs?", query: "Why should we hire Beta Labs and what would it cost to draft a 10 USDC spend?" },
  { label: "Recall memory", query: "Recall counterparty memory for virtuals:agent:beta" },
  { label: "Check spend guardrail", query: "Check current active spend limit and remaining budget" },
  { label: "Go to missions", query: "go to missions" },
];

const MENTION_SOURCES = [
  { id: "agent", name: "@agent", desc: "Aura ADK Gemini agent", icon: Bot },
  { id: "memory", name: "@memory", desc: "Sibyl relationship memory", icon: Brain },
  { id: "policy", name: "@policy", desc: "Active guardrails & spend policies", icon: ShieldCheck },
  { id: "beta", name: "@beta-labs", desc: "Procurement counterparty", icon: Building2 },
];

const SLASH_COMMANDS = [
  { id: "propose", name: "/propose-spend", desc: "Propose spend approval under guardrail" },
  { id: "compare", name: "/compare", desc: "Compare counterparty reliability metrics" },
  { id: "recall", name: "/recall", desc: "Recall Sibyl memory episodes" },
  { id: "navigate", name: "/navigate", desc: "Navigate console surfaces" },
];

export function PromptBar({
  value: controlledValue,
  onChange: controlledOnChange,
  onSubmit,
  onStop,
  isStreaming = false,
  placeholder = "Ask ADK Gemini agent anything, execute MCP tools, or type @ or /...",
  suggestions = DEFAULT_SUGGESTIONS,
  className = "",
}: PromptBarProps) {
  const [internalValue, setInternalValue] = useState("");
  const value = controlledValue !== undefined ? controlledValue : internalValue;

  const updateValue = (updater: string | ((prev: string) => string)) => {
    const nextVal = typeof updater === "function" ? updater(value) : updater;
    setInternalValue(nextVal);
    controlledOnChange?.(nextVal);
  };

  const [mentionOpen, setMentionOpen] = useState(false);
  const [slashOpen, setSlashOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [attachments, setAttachments] = useState<string[]>([]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const newHeight = Math.min(el.scrollHeight, 160);
    el.style.height = `${Math.max(newHeight, 38)}px`;
  }, [value]);

  const handleInputChange = (text: string) => {
    updateValue(text);

    // Detect @ or /
    const lastWord = text.split(/\s+/).pop() || "";
    if (lastWord.startsWith("@")) {
      setMentionOpen(true);
      setSlashOpen(false);
      setSelectedIndex(0);
    } else if (lastWord.startsWith("/")) {
      setSlashOpen(true);
      setMentionOpen(false);
      setSelectedIndex(0);
    } else {
      setMentionOpen(false);
      setSlashOpen(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Menu navigation
    if (mentionOpen || slashOpen) {
      const items = mentionOpen ? MENTION_SOURCES : SLASH_COMMANDS;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % items.length);
        playInteractionSound("tick");
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + items.length) % items.length);
        playInteractionSound("tick");
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        const selected = items[selectedIndex];
        if (selected) {
          const parts = value.split(/\s+/);
          parts.pop();
          const next = (parts.join(" ") + (parts.length > 0 ? " " : "") + selected.name + " ").trimStart();
          updateValue(next);
          playInteractionSound("press");
        }
        setMentionOpen(false);
        setSlashOpen(false);
        return;
      }
      if (e.key === "Escape") {
        setMentionOpen(false);
        setSlashOpen(false);
        return;
      }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (!trimmed || isStreaming) return;
    playInteractionSound("pulse");
    onSubmit?.(trimmed);
    updateValue("");
    setAttachments([]);
    setMentionOpen(false);
    setSlashOpen(false);
  };

  const addAttachment = () => {
    playInteractionSound("press");
    setAttachments((prev) => [...prev, "auth-middleware.ts"]);
  };

  const removeAttachment = (idx: number) => {
    playInteractionSound("release");
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
  };

  const selectSuggestion = (query: string) => {
    playInteractionSound("press");
    updateValue(query);
    textareaRef.current?.focus();
  };

  return (
    <div data-prompt-bar className={`w-full flex flex-col gap-2 ${className}`}>
      {/* Contextual Suggestion Pills */}
      {suggestions && suggestions.length > 0 && !isStreaming && (
        <div className="flex flex-wrap items-center gap-1.5 px-1">
          {suggestions.map((pill) => (
            <button
              key={pill.label}
              type="button"
              onClick={() => selectSuggestion(pill.query)}
              data-sound="press"
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[6px] text-[11.5px] font-medium bg-[#1b1b1f] border border-[rgba(216,216,219,0.14)] text-[var(--color-text-muted,#8d9aaf)] hover:text-[#f4f7fb] hover:border-[rgba(216,216,219,0.32)] transition-colors"
            >
              <Sparkles size={11} className="text-[#d8d8db]" />
              <span>{pill.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Main Composer Box */}
      <div className="relative rounded-[10px] border border-[rgba(216,216,219,0.16)] bg-[#1b1b1f] focus-within:border-[#d8d8db] focus-within:ring-1 focus-within:ring-[#d8d8db] transition-all shadow-sm">
        {/* Mentions Menu Popup */}
        {mentionOpen && (
          <div className="absolute bottom-full left-2 mb-2 w-72 rounded-[8px] border border-[rgba(216,216,219,0.16)] bg-[#1b1b1f] p-1 shadow-lg z-20">
            <div className="px-2 py-1 text-[10.5px] font-semibold uppercase tracking-wider text-[var(--color-text-muted,#8d9aaf)]">
              Context Sources
            </div>
            {MENTION_SOURCES.map((item, idx) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    playInteractionSound("press");
                    updateValue((v) => `${v.replace(/@\w*$/, "")}${item.name} `);
                    setMentionOpen(false);
                  }}
                  className={`flex w-full items-center gap-2 px-2 py-1.5 rounded-[6px] text-left text-[12px] ${
                    selectedIndex === idx
                      ? "bg-[#25252a] text-[#f4f7fb]"
                      : "text-[var(--color-text-muted,#8d9aaf)] hover:bg-[#25252a] hover:text-[#f4f7fb]"
                  }`}
                >
                  <Icon size={13} className="text-[#d8d8db] shrink-0" />
                  <span className="font-mono font-medium text-[#f4f7fb]">{item.name}</span>
                  <span className="text-[11px] truncate text-[var(--color-text-muted,#8d9aaf)]">
                    {item.desc}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Slash Commands Menu Popup */}
        {slashOpen && (
          <div className="absolute bottom-full left-2 mb-2 w-72 rounded-[8px] border border-[rgba(216,216,219,0.16)] bg-[#1b1b1f] p-1 shadow-lg z-20">
            <div className="px-2 py-1 text-[10.5px] font-semibold uppercase tracking-wider text-[var(--color-text-muted,#8d9aaf)]">
              Commands
            </div>
            {SLASH_COMMANDS.map((item, idx) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  playInteractionSound("press");
                  updateValue((v) => `${v.replace(/\/\w*$/, "")}${item.name} `);
                  setSlashOpen(false);
                }}
                className={`flex w-full items-center gap-2 px-2 py-1.5 rounded-[6px] text-left text-[12px] ${
                  selectedIndex === idx
                    ? "bg-[#25252a] text-[#f4f7fb]"
                    : "text-[var(--color-text-muted,#8d9aaf)] hover:bg-[#25252a] hover:text-[#f4f7fb]"
                }`}
              >
                <Terminal size={13} className="text-[#d8d8db] shrink-0" />
                <span className="font-mono font-medium text-[#f4f7fb]">{item.name}</span>
                <span className="text-[11px] truncate text-[var(--color-text-muted,#8d9aaf)]">
                  {item.desc}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Attachment chips if any */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-1.5 p-2 pb-0">
            {attachments.map((file, i) => (
              <span
                key={`${file}-${i}`}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[6px] bg-[#25252a] border border-[rgba(216,216,219,0.12)] text-[11px] font-mono text-[#f4f7fb]"
              >
                <span>{file}</span>
                <button
                  type="button"
                  onClick={() => removeAttachment(i)}
                  className="text-[var(--color-text-muted,#8d9aaf)] hover:text-[#ff6b7a]"
                >
                  <X size={11} />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Text Input */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={1}
          aria-label="Agent Prompt"
          className="w-full bg-transparent px-3 py-2.5 text-[13.5px] text-[#f4f7fb] placeholder:text-[var(--color-text-muted,#8d9aaf)] outline-none resize-none min-h-[38px] max-h-[160px]"
        />

        {/* Action controls row */}
        <div className="flex items-center justify-between px-2.5 py-1.5 border-t border-[rgba(216,216,219,0.08)] bg-[#111015]/40 rounded-b-[10px]">
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Add attachment"
              onClick={addAttachment}
              data-sound="press"
              className="flex size-7 items-center justify-center rounded-[6px] text-[var(--color-text-muted,#8d9aaf)] hover:text-[#f4f7fb] hover:bg-[#25252a] transition-colors"
            >
              <Paperclip size={14} />
            </button>
            <button
              type="button"
              aria-label="Mention data source"
              onClick={() => {
                updateValue((v) => (v ? `${v} @agent ` : "@agent "));
                playInteractionSound("press");
                textareaRef.current?.focus();
              }}
              data-sound="press"
              className="flex size-7 items-center justify-center rounded-[6px] text-[var(--color-text-muted,#8d9aaf)] hover:text-[#f4f7fb] hover:bg-[#25252a] transition-colors"
            >
              <AtSign size={14} />
            </button>
            <button
              type="button"
              aria-label="Trigger command"
              onClick={() => {
                updateValue((v) => (v ? `${v} /compare ` : "/compare "));
                playInteractionSound("press");
                textareaRef.current?.focus();
              }}
              data-sound="press"
              className="flex size-7 items-center justify-center rounded-[6px] text-[var(--color-text-muted,#8d9aaf)] hover:text-[#f4f7fb] hover:bg-[#25252a] transition-colors"
            >
              <Slash size={14} />
            </button>
          </div>

          <div className="flex items-center gap-2">
            {isStreaming ? (
              <button
                type="button"
                onClick={() => {
                  playInteractionSound("release");
                  onStop?.();
                }}
                data-sound="release"
                className="inline-flex items-center gap-1 px-3 py-1 rounded-[6px] bg-[#ff6b7a]/20 border border-[#ff6b7a]/40 text-[#ff6b7a] text-[12px] font-medium hover:bg-[#ff6b7a]/30 transition-colors"
              >
                <X size={12} />
                <span>Stop</span>
              </button>
            ) : (
              <button
                type="button"
                disabled={!value.trim() && attachments.length === 0}
                onClick={handleSubmit}
                data-sound="pulse"
                aria-label="Send message"
                className="inline-flex items-center justify-center size-7 rounded-[6px] bg-[#f3f3f5] text-[#111015] hover:bg-white transition-colors disabled:opacity-20 disabled:pointer-events-none"
              >
                <Send size={13} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default PromptBar;

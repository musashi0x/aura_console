"use client";

import Link from "next/link";
import { Compass, ArrowRight } from "lucide-react";
import { playInteractionSound } from "./InteractionSounds";

export interface NavigationCardProps {
  destination: string;
  label?: string;
  onNavigate?: (destination: string) => void;
  className?: string;
}

const DESTINATION_LABELS: Record<string, string> = {
  "/runs": "Missions Workspace",
  "/runs/new": "Start New Mission",
  "/runs/example": "Example Mission",
  "/policies": "Guardrails & Policies",
  "/counterparties": "Counterparty Agents",
  "/system": "Network Readiness",
  "/chat": "Assistant Chat",
  "/ai-chat": "Chat Console",
  "/docs": "Documentation",
};

export function NavigationCard({
  destination,
  label,
  onNavigate,
  className = "",
}: NavigationCardProps) {
  const displayLabel = label || DESTINATION_LABELS[destination] || destination;

  const handleOpen = () => {
    playInteractionSound("press");
    if (onNavigate) {
      onNavigate(destination);
    }
  };

  return (
    <div
      role="region"
      aria-label="Console Navigation"
      className={`rounded-lg p-3 sm:p-3.5 my-2 text-left border border-[rgba(216,216,219,0.12)] bg-[#16151a] ${className}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-6 h-6 rounded-md bg-[rgba(216,216,219,0.08)] border border-[rgba(216,216,219,0.12)] flex items-center justify-center text-[#e2e2e5] shrink-0">
            <Compass size={13} />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted,#8d9aaf)]">
              Console Navigation
            </div>
            <div className="text-xs sm:text-[13px] font-medium text-[#f4f7fb] truncate">
              {displayLabel}
              <span className="ml-1.5 text-[11px] text-[var(--color-text-muted,#8d9aaf)] font-mono">
                {destination}
              </span>
            </div>
          </div>
        </div>

        <div className="shrink-0">
          {onNavigate ? (
            <button
              type="button"
              onClick={handleOpen}
              data-sound="press"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium bg-[#25252a] hover:bg-[#2e2d35] border border-[rgba(216,216,219,0.16)] text-[#f4f7fb] transition-colors cursor-pointer"
            >
              <span>Go to View</span>
              <ArrowRight size={12} />
            </button>
          ) : (
            <Link
              href={destination}
              onClick={handleOpen}
              data-sound="press"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium bg-[#25252a] hover:bg-[#2e2d35] border border-[rgba(216,216,219,0.16)] text-[#f4f7fb] transition-colors cursor-pointer"
            >
              <span>Go to View</span>
              <ArrowRight size={12} />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

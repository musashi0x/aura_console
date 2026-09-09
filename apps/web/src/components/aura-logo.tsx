"use client";

import type { FC, SVGProps } from "react";

interface AuraLogoProps extends SVGProps<SVGSVGElement> {
  size?: number;
  className?: string;
}

/**
 * Bespoke geometric emblem for Aura Memory.
 * Represents the 5-Tier dynamic memory hierarchy (Hot, Warm, Cold, Reference, Archive),
 * cryptographic on-chain verification, and autonomous agent coordination.
 */
export const AuraIcon: FC<AuraLogoProps> = ({
  size = 32,
  className = "",
  ...props
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <defs>
        <linearGradient id="aura-grad-core" x1="6" y1="6" x2="26" y2="26" gradientUnits="userSpaceOnUse">
          <stop stopColor="#10b981" />
          <stop offset="0.5" stopColor="#51e6a6" />
          <stop offset="1" stopColor="#38bdf8" />
        </linearGradient>
        <linearGradient id="aura-grad-ring" x1="16" y1="2" x2="16" y2="30" gradientUnits="userSpaceOnUse">
          <stop stopColor="#51e6a6" stopOpacity="0.9" />
          <stop offset="1" stopColor="#10b981" stopOpacity="0.3" />
        </linearGradient>
        <filter id="aura-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Tier 5: Outer Reference & Governance Hexagonal Boundary */}
      <polygon
        points="16,3 27.5,9.6 27.5,22.4 16,29 4.5,22.4 4.5,9.6"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeOpacity="0.25"
        strokeDasharray="3 2"
      />

      {/* Tier 4: Archive Vault Ring */}
      <circle
        cx="16"
        cy="16"
        r="11"
        stroke="currentColor"
        strokeWidth="1"
        strokeOpacity="0.35"
      />

      {/* Tier 3: Cold Memory Crystallographic Prism */}
      <polygon
        points="16,6.5 24.2,16 16,25.5 7.8,16"
        stroke="url(#aura-grad-ring)"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />

      {/* Tier 2: Warm Relationship Vector Hub */}
      <rect
        x="10.5"
        y="10.5"
        width="11"
        height="11"
        rx="2.5"
        transform="rotate(45 16 16)"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeOpacity="0.75"
      />

      {/* Tier 1: Hot Autonomous Cache Core (Glowing Emerald Kernel) */}
      <circle
        cx="16"
        cy="16"
        r="3.25"
        fill="url(#aura-grad-core)"
        filter="url(#aura-glow)"
      />
      <circle
        cx="16"
        cy="16"
        r="1.2"
        fill="#ffffff"
      />

      {/* Cryptographic Keypoints */}
      <circle cx="16" cy="3" r="1" fill="#51e6a6" />
      <circle cx="27.5" cy="9.6" r="1" fill="#51e6a6" opacity="0.8" />
      <circle cx="27.5" cy="22.4" r="1" fill="#38bdf8" opacity="0.8" />
      <circle cx="16" cy="29" r="1" fill="#10b981" />
      <circle cx="4.5" cy="22.4" r="1" fill="#38bdf8" opacity="0.8" />
      <circle cx="4.5" cy="9.6" r="1" fill="#51e6a6" opacity="0.8" />
    </svg>
  );
};

export interface AuraBrandLogoProps {
  variant?: "icon" | "full";
  ready?: boolean;
  className?: string;
  size?: number;
}

export const AuraLogo: FC<AuraBrandLogoProps> = ({
  variant = "full",
  ready = true,
  className = "",
  size = 34,
}) => {
  if (variant === "icon") {
    return (
      <div className={`relative flex items-center justify-center ${className}`}>
        <AuraIcon size={size} />
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-neutral-900 border border-neutral-700/60 shadow-inner overflow-hidden group-hover:border-emerald-500/50 transition-colors">
        <AuraIcon size={24} />
      </div>
      <div className="flex flex-col">
        <div className="flex items-center gap-1.5">
          <span className="text-foreground text-base leading-tight font-semibold tracking-tight">
            Aura Memory
          </span>
          <span className="bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 border border-emerald-500/20 rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-wide">
            v1.0
          </span>
          <span className="sr-only">
            {ready ? "SYSTEM READY" : "SYSTEM DEGRADED"}
          </span>
        </div>
        <span className="text-muted-foreground font-mono text-[10px] leading-none tracking-widest uppercase">
          Autonomous Console
        </span>
      </div>
    </div>
  );
};

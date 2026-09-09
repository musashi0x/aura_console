"use client";

import { ArrowDownRight, ChevronDown, Github } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useState, type ReactNode } from "react";

const menus = {
  architecture: [
    {
      label: "Architecture Overview",
      description: "Zero-amnesia multi-tier memory & execution engine",
      href: "#architecture",
    },
    {
      label: "5-Tier Dynamic Storage",
      description: "HOT, WARM, COLD, REFERENCE & ARCHIVE layers",
      href: "#architecture",
    },
    {
      label: "Load-Bearing Deletion Test",
      description: "Fail-closed invariant: zero blind spend without memory",
      href: "#deletion-test",
    },
    {
      label: "Base Sepolia Commitment",
      description: "Salted Keccak256 cryptographic notarization on-chain",
      href: "#base-sepolia",
    },
    {
      label: "Virtuals Protocol ACP",
      description: "Autonomous procurement settlement & job funding",
      href: "#virtuals-acp",
    },
  ],
  protocol: [
    {
      label: "Model Context Protocol",
      description: "Native MCP server for Claude Code, Cursor & swarms",
      href: "#mcp",
    },
    {
      label: "Bayesian Reputation FSM",
      description: "Alpha/beta reliability distributions & counterparty FSM",
      href: "#reputation-fsm",
    },
    {
      label: "Causal Replay Matrix",
      description: "Frozen decision context & counterfactual evaluation",
      href: "#replay-matrix",
    },
  ],
};

const ease = [0.23, 1, 0.32, 1] as const;

function HamburgerIcon({ isOpen }: { isOpen: boolean }): ReactNode {
  return (
    <div className="relative flex h-4 w-8 cursor-pointer flex-col justify-between">
      <motion.span
        className="bg-foreground block h-0.5 w-full origin-center rounded-full"
        animate={isOpen ? { rotate: 45, y: 4.5 } : { rotate: 0, y: 0 }}
        transition={{ duration: 0.25, ease }}
      />
      <motion.span
        className="bg-foreground block h-0.5 w-full origin-center rounded-full"
        animate={isOpen ? { rotate: -45, y: -9.5 } : { rotate: 0, y: 0 }}
        transition={{ duration: 0.25, ease }}
      />
    </div>
  );
}

function DesktopDropdown({
  label,
  menuKey,
  isOpen,
  onOpen,
  onClose,
}: {
  label: string;
  menuKey: keyof typeof menus;
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
}): ReactNode {
  return (
    <div className="relative" onMouseEnter={onOpen} onMouseLeave={onClose}>
      <a
        href={menuKey === "architecture" ? "#architecture" : "#mcp"}
        onClick={onClose}
        className="text-foreground/80 hover:text-foreground hover:bg-foreground/5 flex cursor-pointer items-center gap-1 rounded-full px-4 py-2 text-sm font-medium transition-colors max-[1200px]:px-3"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        {label}
        <ChevronDown
          className="h-4 w-4 transition-transform duration-200"
          style={{ transform: isOpen ? "rotate(180deg)" : "none" }}
          aria-hidden="true"
        />
      </a>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.2, ease }}
            className="absolute top-full left-0 w-80 pt-2"
          >
            <div className="bg-frame border-border overflow-hidden rounded-2xl border p-2 shadow-xl backdrop-blur-md">
              {menus[menuKey].map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  onClick={onClose}
                  className="hover:bg-muted group block rounded-xl px-4 py-3 transition-colors"
                >
                  <div className="text-foreground group-hover:text-accent text-sm font-medium transition-colors">
                    {item.label}
                  </div>
                  <div className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
                    {item.description}
                  </div>
                </a>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MobileExpandable({
  label,
  menuKey,
  isExpanded,
  onToggle,
  onClose,
}: {
  label: string;
  menuKey: keyof typeof menus;
  isExpanded: boolean;
  onToggle: () => void;
  onClose: () => void;
}): ReactNode {
  return (
    <div className="border-foreground/10 border-b">
      <button
        className="text-foreground flex w-full items-center justify-between py-4 text-left text-base font-medium"
        onClick={onToggle}
        aria-expanded={isExpanded}
      >
        {label}
        <motion.div
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown
            className="text-muted-foreground h-5 w-5"
            aria-hidden="true"
          />
        </motion.div>
      </button>
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="space-y-1 pb-3">
              {menus[menuKey].map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  className="text-foreground/80 hover:text-foreground hover:bg-muted block rounded-lg px-3 py-2.5 text-sm"
                  onClick={onClose}
                >
                  <span className="text-foreground block font-medium">
                    {item.label}
                  </span>
                  <span className="text-muted-foreground mt-0.5 block text-xs">
                    {item.description}
                  </span>
                </a>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const CornerSVG = ({ className }: { className: string }) => (
  <svg
    className={className}
    width="50"
    height="50"
    viewBox="0 0 50 50"
    fill="none"
    aria-hidden="true"
  >
    <path
      d="M5.50871e-06 0C-0.00788227 37.3001 8.99616 50.0116 50 50H5.50871e-06V0Z"
      fill="currentColor"
    />
  </svg>
);

export function Header({ ready = true }: { ready?: boolean }): ReactNode {
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileExpanded, setMobileExpanded] = useState<string | null>(null);

  const closeMobile = () => setMobileMenuOpen(false);
  const toggleExpanded = (key: string) =>
    setMobileExpanded(mobileExpanded === key ? null : key);

  return (
    <motion.header
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.5, ease }}
      className="bg-frame border-border/40 fixed top-2.5 left-0 right-0 mx-auto z-50 w-full max-w-5xl rounded-b-4xl border-b shadow-2xl/20 max-[1200px]:max-w-4xl max-[850px]:top-0 max-[850px]:w-full max-[850px]:max-w-none max-[850px]:rounded-none max-[850px]:rounded-b-4xl"
    >
      <div className="flex h-20 items-center justify-between px-4 max-[850px]:h-18 max-[850px]:px-6">
        <a
          href="#"
          className="group ml-2 flex items-center gap-2.5 max-[850px]:ml-0"
        >
          <div className="bg-foreground text-background relative flex h-8 w-8 items-center justify-center rounded-xl shadow-sm transition-transform group-hover:scale-105">
            <svg
              className="text-accent h-5 w-5"
              viewBox="0 0 32 32"
              fill="none"
              stroke="currentColor"
            >
              <circle
                cx="16"
                cy="16"
                r="10"
                strokeWidth="2"
                strokeDasharray="4 2"
              />
              <circle cx="16" cy="16" r="5" strokeWidth="2.5" />
              <circle cx="16" cy="16" r="2" fill="currentColor" />
            </svg>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="text-foreground text-base leading-tight font-semibold tracking-tight">
                Aura Memory
              </span>
              <span className="bg-accent/20 text-foreground rounded px-1.5 py-0.5 font-mono text-[10px] font-medium">
                v1.0
              </span>
              <span className="sr-only">
                {ready ? "SYSTEM READY" : "SYSTEM DEGRADED"}
              </span>
            </div>
            <span className="text-muted-foreground font-mono text-[10px] leading-none tracking-widest uppercase">
              Console
            </span>
          </div>
        </a>

        <nav className="flex items-center gap-1 max-[1200px]:gap-0 max-[850px]:hidden">
          <DesktopDropdown
            label="Architecture"
            menuKey="architecture"
            isOpen={activeMenu === "architecture"}
            onOpen={() => setActiveMenu("architecture")}
            onClose={() => setActiveMenu(null)}
          />
          <DesktopDropdown
            label="Protocol"
            menuKey="protocol"
            isOpen={activeMenu === "protocol"}
            onOpen={() => setActiveMenu("protocol")}
            onClose={() => setActiveMenu(null)}
          />
          <a
            href="#how-it-works"
            className="text-foreground/80 hover:text-foreground hover:bg-foreground/5 rounded-full px-4 py-2 text-sm font-medium transition-colors max-[1200px]:px-3"
          >
            How It Works
          </a>
          <a
            href="#architecture"
            className="text-foreground/80 hover:text-foreground hover:bg-foreground/5 rounded-full px-4 py-2 text-sm font-medium transition-colors max-[1200px]:px-3"
          >
            Tiers
          </a>
        </nav>

        <div className="flex items-center gap-2.5 max-[850px]:hidden">
          <Link
            href="/runs"
            className="flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-xs font-mono font-bold text-black shadow-sm transition-all hover:opacity-90 hover:scale-[1.02]"
            title="Launch Autonomous Agent Console"
          >
            <span>Console</span>
            <ArrowDownRight className="h-3.5 w-3.5 -rotate-45" />
          </Link>
          <a
            href="https://github.com/musashi0x/aura_memory"
            target="_blank"
            rel="noopener noreferrer"
            className="text-foreground/80 hover:text-foreground hover:bg-muted flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors"
            title="View GitHub Repository"
          >
            <Github className="h-4 w-4" />
            <span className="max-[1200px]:hidden">GitHub</span>
          </a>
          <a
            href="#waitlist"
            className="group relative inline-flex items-center"
          >
            <span className="bg-foreground/10 absolute inset-y-0 right-0 w-[calc(100%-1.5rem)] rounded-xl" />
            <span className="bg-foreground text-background relative z-10 rounded-xl px-4 py-2 text-sm font-medium">
              Join Pilot
            </span>
            <span className="relative -left-px z-10 flex h-8 w-8 items-center justify-center rounded-xl text-black">
              <ArrowDownRight className="h-4 w-4 transition-transform duration-300 group-hover:-rotate-45" />
            </span>
          </a>
        </div>

        <button
          className="hidden h-10 w-10 items-center justify-center max-[850px]:flex"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileMenuOpen}
        >
          <HamburgerIcon isOpen={mobileMenuOpen} />
        </button>
      </div>

      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease }}
            className="bg-frame hidden max-h-[calc(100vh-5rem)] overflow-y-auto max-[850px]:block"
          >
            <div className="px-6 pb-6">
              <nav className="space-y-0">
                <MobileExpandable
                  label="Architecture"
                  menuKey="architecture"
                  isExpanded={mobileExpanded === "architecture"}
                  onToggle={() => toggleExpanded("architecture")}
                  onClose={closeMobile}
                />
                <MobileExpandable
                  label="Protocol"
                  menuKey="protocol"
                  isExpanded={mobileExpanded === "protocol"}
                  onToggle={() => toggleExpanded("protocol")}
                  onClose={closeMobile}
                />
                <a
                  href="#how-it-works"
                  className="text-foreground border-foreground/10 flex items-center justify-between border-b py-4 text-base font-medium"
                  onClick={closeMobile}
                >
                  How It Works
                </a>
                <a
                  href="#architecture"
                  className="text-foreground border-foreground/10 flex items-center justify-between border-b py-4 text-base font-medium"
                  onClick={closeMobile}
                >
                  Tiers
                </a>
                <a
                  href="#faq"
                  className="text-foreground flex items-center justify-between py-4 text-base font-medium"
                  onClick={closeMobile}
                >
                  FAQ
                </a>
              </nav>

              <div className="flex flex-col gap-3 pt-6 pb-2">
                <Link
                  href="/runs"
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-accent py-3 font-mono text-sm font-bold text-black shadow-md transition-all"
                  onClick={closeMobile}
                >
                  <span>Launch Console</span>
                  <ArrowDownRight className="h-4 w-4 -rotate-45" />
                </Link>

                <div className="flex items-center justify-between">
                  <a
                    href="https://github.com/musashi0x/aura_memory"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-foreground flex items-center gap-2 text-sm font-medium"
                    onClick={closeMobile}
                  >
                    <Github className="h-4 w-4" />
                    GitHub Repository
                  </a>
                  <a
                    href="#waitlist"
                    className="group relative inline-flex items-center"
                    onClick={closeMobile}
                  >
                    <span className="bg-foreground/10 absolute inset-y-0 right-0 w-[calc(100%-1.5rem)] rounded-2xl" />
                    <span className="bg-foreground text-background relative z-10 rounded-2xl px-4 py-2 text-sm font-medium">
                      Join Pilot
                    </span>
                    <span className="text-foreground relative -left-px z-10 flex h-8 w-8 items-center justify-center rounded-2xl">
                      <ArrowDownRight className="h-4 w-4 transition-transform duration-300 group-hover:-rotate-45" />
                    </span>
                  </a>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <CornerSVG className="text-frame pointer-events-none absolute top-0 -left-12.25 rotate-180 max-[850px]:hidden" />
      <CornerSVG className="text-frame pointer-events-none absolute top-0 -right-12.25 rotate-90 max-[850px]:hidden" />
    </motion.header>
  );
}

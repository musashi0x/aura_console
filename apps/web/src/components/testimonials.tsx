"use client";

import { motion, AnimatePresence } from "motion/react";
import Image from "next/image";
import { useState, useEffect, type ReactNode } from "react";
import { ShieldCheck, CheckCircle2 } from "lucide-react";

const testimonials = [
  {
    quote:
      "Aura's fail-closed guardrails prevented our autonomous buyer from hiring an underperforming research agent on Virtuals ACP. Without Sibyl memory, our treasury would have lost $14,000 in unrecoverable task fees.",
    name: "Marcus Vance",
    title: "VP of Autonomous Risk @ TreasuryGuard AI",
    avatar:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face",
    network: "Base Sepolia",
    company: "TreasuryGuard AI",
    role: "DAO Treasury Escrow & Protection",
  },
  {
    quote:
      "The Bayesian reputation FSM is the missing link in autonomous commerce. Our agents don't just prompt-and-pray; they track alpha/beta success distributions across thousands of historical executions.",
    name: "Elena Rostova",
    title: "Protocol Architect @ AutonomousProcure",
    avatar:
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=face",
    network: "Virtuals ACP",
    company: "AutonomousProcure",
    role: "On-Chain RFP & Settlement",
  },
  {
    quote:
      "Aura's MCP integration lets our Claude Code workflows instantly recall counterparty trust scores before signing spend intents. It's the standard for verifiable agent reputation.",
    name: "Devin Zhao",
    title: "Autonomous Systems Lead @ Virtuals Fleet Alpha",
    avatar:
      "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face",
    network: "Virtuals ACP",
    company: "Virtuals Fleet Alpha",
    role: "Spend Authorization Fleet",
  },
  {
    quote:
      "The Base Sepolia cryptographic commitments give our DAO community absolute transparency into agent hiring decisions without exposing proprietary counterparty negotiation histories.",
    name: "Sarah Jenkins",
    title: "Governance Steward @ Base Autonomous DAO",
    avatar:
      "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&crop=face",
    network: "Base Sepolia",
    company: "Base Autonomous DAO",
    role: "Capital Allocation & Notarization",
  },
  {
    quote:
      "The continuous restart protocol is the real deal. Wiping the relational database while Sibyl memory.db survives gives autonomous agents true operational permanence across cold starts.",
    name: "Dr. Kaelen Thorne",
    title: "Lead Auditor @ Aura Protocol Security",
    avatar:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=face",
    network: "Cross-Chain",
    company: "Aura Protocol Security",
    role: "Multi-Agent Cold-Start Audit",
  },
];

export function Testimonials(): ReactNode {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % testimonials.length);
    }, 9000);

    return () => clearInterval(timer);
  }, []);

  const current = testimonials[activeIndex] ?? testimonials[0]!;

  return (
    <section
      id="partners"
      className="bg-frame border-accent/15 w-full scroll-mt-36 border-t border-b px-6 py-24 sm:scroll-mt-44 sm:py-32 dark:border-neutral-800/80 dark:bg-[#0e0d13]"
    >
      <div className="mx-auto max-w-5xl">
        <div className="mb-14">
          <div className="mb-2 flex items-center gap-2">
            <ShieldCheck className="text-accent h-4 w-4" />
            <span className="text-accent font-mono text-xs font-semibold tracking-widest uppercase">
              Verified Design Partners &amp; Pilot Fleet
            </span>
          </div>
          <h2 className="text-foreground text-3xl font-medium tracking-tight sm:text-5xl">
            Trusted by Autonomous Fleets &amp; DAOs
          </h2>
          <p className="text-muted-foreground mt-3 max-w-xl text-sm leading-relaxed sm:text-base">
            Real-world autonomous procurement protocols relying on Aura to
            protect treasury capital from counterparty failure.
          </p>
        </div>

        <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-12">
          {/* Partner Selector Tabs */}
          <div
            className="flex flex-col gap-3"
            role="tablist"
            aria-label="Design Partners"
          >
            {testimonials.map((t, index) => {
              const isSelected = activeIndex === index;
              return (
                <button
                  key={t.company}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => setActiveIndex(index)}
                  className={`flex cursor-pointer items-center justify-between rounded-2xl border p-4 text-left transition-all ${
                    isSelected
                      ? "bg-foreground text-background border-foreground shadow-lg dark:bg-neutral-100 dark:text-neutral-950"
                      : "border-border bg-muted/60 hover:bg-muted text-foreground dark:border-neutral-800 dark:bg-neutral-900/60"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full border border-neutral-500/20">
                      <Image
                        src={t.avatar}
                        alt={t.name}
                        width={40}
                        height={40}
                        unoptimized
                        className="object-cover"
                      />
                    </div>
                    <div>
                      <div className="text-sm leading-tight font-semibold">
                        {t.company}
                      </div>
                      <div
                        className={`mt-0.5 text-xs ${
                          isSelected ? "opacity-75" : "text-muted-foreground"
                        }`}
                      >
                        {t.role}
                      </div>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <span
                      className={`rounded px-2 py-0.5 font-mono text-[10px] ${
                        isSelected
                          ? "bg-accent font-semibold text-black"
                          : "border-border bg-background text-foreground/80 border font-medium dark:border-neutral-700"
                      }`}
                    >
                      {t.network}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Active Partner Quote Card */}
          <div className="relative flex min-h-[340px] flex-col justify-between rounded-3xl border border-neutral-800 bg-[#121118] p-8 text-white shadow-2xl">
            <AnimatePresence mode="wait">
              <motion.div
                key={current.company}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.35 }}
                className="flex h-full flex-col justify-between space-y-6"
              >
                <div>
                  <div className="mb-4 flex items-center justify-between">
                    <span className="flex items-center gap-1.5 font-mono text-xs font-semibold text-emerald-400">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Active Pilot Partner
                    </span>
                    <span className="rounded border border-neutral-800 bg-neutral-900 px-2 py-0.5 font-mono text-[10px] text-neutral-400">
                      {current.network}
                    </span>
                  </div>

                  <blockquote className="text-base leading-relaxed font-medium text-neutral-100 italic sm:text-lg">
                    &ldquo;{current.quote}&rdquo;
                  </blockquote>
                </div>

                <div className="flex items-center justify-between border-t border-neutral-800 pt-4">
                  <div>
                    <div className="text-sm font-semibold text-white">
                      {current.name}
                    </div>
                    <div className="mt-0.5 font-mono text-xs text-neutral-400">
                      {current.title}
                    </div>
                  </div>
                  <div className="text-accent text-right font-mono text-xs font-semibold">
                    {current.company}
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}

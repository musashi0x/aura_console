"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import {
  Database,
  ShieldCheck,
  FileCheck2,
  ArrowDownRight,
} from "lucide-react";
import type { ReactNode } from "react";

const steps = [
  {
    icon: Database,
    title: "1. Candidate Scoring & Bayesian Warm Recall",
    description:
      "When an autonomous procurement mission initiates, Aura queries Sibyl WARM tier to recall historical counterparty interactions. Reliability is derived using Bayesian Beta distributions (α/β parameters), filtering out underperforming agents and updating the counterparty FSM state (NEW → KNOWN → PREFERRED).",
  },
  {
    icon: ShieldCheck,
    title: "2. Economic Action Boundary & Fail-Closed Guardrails",
    description:
      "Decision context and inputs are frozen and cryptographically hashed. Aura verifies policy spend ceilings before any treasury funds can move. If Sibyl relationship memory is disconnected or unavailable, execution strictly halts with run.blocked — guaranteeing zero blind spending.",
  },
  {
    icon: FileCheck2,
    title: "3. Virtuals ACP Settlement & Base Sepolia Proof",
    description:
      "The approved procurement job is dispatched and funded via Virtuals Protocol's Agent Commerce Protocol (ACP). Execution outcomes write back to Sibyl COLD journal, and a salted Keccak256 hash notarizes on Base Sepolia. Even across total process restarts, fresh agents remember past performance.",
  },
];

function StepItem({
  step,
  isLast,
}: {
  step: (typeof steps)[0];
  isLast: boolean;
}): ReactNode {
  const Icon = step.icon;

  return (
    <div
      className={`relative flex gap-5 ${isLast ? "" : "pb-48 max-[850px]:pb-28"}`}
    >
      <div
        className="bg-accent relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl shadow-md"
        aria-hidden="true"
      >
        <Icon className="h-5 w-5 text-black" strokeWidth={2.2} />
      </div>

      <div className="pt-1">
        <h3 className="text-foreground text-xl font-semibold tracking-tight sm:text-2xl">
          {step.title}
        </h3>
        <p className="text-foreground/70 mt-2.5 max-w-lg text-base leading-relaxed">
          {step.description}
        </p>
      </div>
    </div>
  );
}

export function HowItWorks(): ReactNode {
  const containerRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start 0.3", "end 0.7"],
  });

  const lineHeight = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);

  return (
    <section
      id="how-it-works"
      ref={containerRef}
      className="bg-background relative w-full scroll-mt-36 py-20 sm:scroll-mt-44 sm:py-28"
    >
      <div className="mx-auto grid max-w-5xl gap-12 px-6 lg:grid-cols-2 lg:gap-20">
        <div className="lg:sticky lg:top-48 lg:h-fit lg:self-start">
          <span className="text-accent font-mono text-xs font-semibold tracking-widest uppercase">
            ✦ Execution Lifecycle
          </span>
          <h2 className="text-foreground mt-2 text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
            How Aura Works
          </h2>
          <p className="text-foreground/70 mt-6 max-w-md text-lg leading-relaxed">
            From candidate scoring to on-chain notarization, every mission run
            adheres to strict financial guardrails and load-bearing memory.
          </p>
          <motion.a
            href="https://github.com/musashi0x/aura_memory"
            target="_blank"
            rel="noopener noreferrer"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="bg-foreground text-background hover:bg-foreground/90 group mt-8 inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold transition-colors"
          >
            <span>Read Architecture Docs</span>
            <ArrowDownRight className="h-4 w-4 transition-transform duration-300 group-hover:-rotate-45" />
          </motion.a>
        </div>

        <div className="relative">
          <div
            className="bg-foreground/10 absolute top-6 left-6 h-[calc(100%-6rem)] w-0.5 -translate-x-1/2"
            aria-hidden="true"
          >
            <motion.div
              style={{ height: lineHeight, willChange: "height" }}
              className="bg-accent w-full"
            />
          </div>

          <ol className="relative m-0 list-none p-0">
            {steps.map((step, index) => (
              <li key={step.title}>
                <StepItem step={step} isLast={index === steps.length - 1} />
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

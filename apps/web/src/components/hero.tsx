"use client";

import { AuraChatConsole } from "@/components/aura-chat-console";
import { LogoLoop, type LogoItem } from "@/components/logo-loop";
import { ArrowDownRight } from "lucide-react";
import { motion, useMotionValue, useSpring } from "motion/react";
import Link from "next/link";
import { useRef, type ReactNode, type MouseEvent } from "react";

const ease = [0.23, 1, 0.32, 1] as const;

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.12, delayChildren: 0.1 },
  },
};

const fadeInUp = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease } },
};

const fadeInScale = {
  hidden: { opacity: 0, scale: 0.98 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.6, ease } },
};

function PartnerLogo({
  name,
  category,
  icon,
}: {
  name: string;
  category: string;
  icon: ReactNode;
}): ReactNode {
  return (
    <div className="border-border bg-frame/90 text-foreground hover:border-accent/40 flex items-center gap-2.5 rounded-xl border px-4 py-2 shadow-xs backdrop-blur-xs transition-all dark:border-neutral-800 dark:bg-neutral-900/90 dark:text-neutral-100">
      <div className="bg-foreground text-background flex h-6 w-6 items-center justify-center rounded-md font-mono text-xs font-bold dark:bg-neutral-100 dark:text-neutral-950">
        {icon}
      </div>
      <div className="flex flex-col text-left">
        <span className="text-foreground text-xs leading-tight font-semibold tracking-tight dark:text-neutral-100">
          {name}
        </span>
        <span className="text-muted-foreground font-mono text-[9px] leading-none tracking-wider uppercase dark:text-neutral-400">
          {category}
        </span>
      </div>
    </div>
  );
}

const logos: LogoItem[] = [
  {
    node: (
      <PartnerLogo
        name="Virtuals Protocol"
        category="ACP Settlement"
        icon={<span className="text-accent font-bold">V</span>}
      />
    ),
    title: "Virtuals Protocol Agent Commerce Protocol",
  },
  {
    node: (
      <PartnerLogo
        name="Base Sepolia"
        category="Cryptographic Proof"
        icon={<span className="font-bold text-blue-500">B</span>}
      />
    ),
    title: "Base Sepolia On-Chain Memory Notarization",
  },
  {
    node: (
      <PartnerLogo
        name="Sibyl Labs"
        category="5-Tier Memory DB"
        icon={<span className="font-bold text-emerald-500">S</span>}
      />
    ),
    title: "Sibyl Labs Persistent Memory Engine",
  },
  {
    node: (
      <PartnerLogo
        name="Claude Code"
        category="MCP Multi-Agent"
        icon={<span className="font-bold text-orange-500">C</span>}
      />
    ),
    title: "Anthropic Claude Code MCP Integration",
  },
  {
    node: (
      <PartnerLogo
        name="TreasuryGuard AI"
        category="DAO Risk Pilot"
        icon={<span className="font-bold text-amber-500">TG</span>}
      />
    ),
    title: "TreasuryGuard AI Pilot Partner",
  },
  {
    node: (
      <PartnerLogo
        name="AutonomousProcure"
        category="Agent Commerce"
        icon={<span className="font-bold text-purple-500">AP</span>}
      />
    ),
    title: "AutonomousProcure Protocol Pilot",
  },
  {
    node: (
      <PartnerLogo
        name="Drizzle ORM"
        category="Event Store"
        icon={<span className="font-bold text-yellow-500">D</span>}
      />
    ),
    title: "Drizzle Immutable Event Logging",
  },
  {
    node: (
      <PartnerLogo
        name="Fastify Engine"
        category="Low-Latency API"
        icon={<span className="font-bold text-cyan-500">F</span>}
      />
    ),
    title: "Fastify SSE & MCP Bridge",
  },
];

const PARALLAX_INTENSITY = 20;

export function Hero(): ReactNode {
  const sectionRef = useRef<HTMLElement>(null);

  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const springConfig = { damping: 25, stiffness: 150 };
  const x = useSpring(mouseX, springConfig);
  const y = useSpring(mouseY, springConfig);

  const handleMouseMove = (e: MouseEvent<HTMLElement>) => {
    if (!sectionRef.current) return;
    if (typeof window !== "undefined" && window.innerWidth < 850) return;

    const rect = sectionRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const offsetX = (e.clientX - centerX) / (rect.width / 2);
    const offsetY = (e.clientY - centerY) / (rect.height / 2);

    mouseX.set(offsetX * PARALLAX_INTENSITY);
    mouseY.set(offsetY * PARALLAX_INTENSITY);
  };

  const handleMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
  };

  return (
    <section
      ref={sectionRef}
      className="relative flex w-full flex-col overflow-hidden"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* Background layer: reactive to light and dark theme */}
      <motion.div
        className="absolute inset-0 -z-10 rounded-br-4xl rounded-bl-4xl bg-cover bg-center bg-no-repeat opacity-35 brightness-105 transition-opacity duration-500 min-[850px]:inset-2.5 min-[850px]:scale-105 dark:opacity-15 dark:brightness-50"
        style={{
          backgroundImage: "url(/BG.jpg)",
          x,
          y,
        }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_70%_50%_at_50%_15%,rgba(168,217,70,0.12),transparent_70%)] dark:bg-[radial-gradient(ellipse_70%_50%_at_50%_15%,rgba(168,217,70,0.08),transparent_70%)]"
        aria-hidden="true"
      />

      <div className="flex w-full items-start justify-center px-4 pt-36 sm:px-6 sm:pt-40 md:pt-44 lg:pt-48">
        <motion.div
          className="flex w-full max-w-4xl flex-col items-center text-center"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <motion.div
            className="border-border bg-frame/90 text-foreground mb-6 inline-flex items-center gap-2 rounded-xl border py-1.5 pr-3 pl-4 font-mono text-xs font-medium shadow-xs backdrop-blur-xs sm:text-sm"
            variants={fadeInUp}
            transition={{ duration: 0.8, ease }}
          >
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
            <span>SIBYL MEMORY • BASE SEPOLIA • VIRTUALS ACP</span>
            <span className="text-accent">✦</span>
          </motion.div>

          <h1 className="text-foreground mb-6 text-4xl leading-[1.1] font-medium tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
            <motion.span
              className="block"
              variants={fadeInUp}
              transition={{ duration: 0.8, ease }}
            >
              Autonomous Agents That
            </motion.span>
            <motion.span
              className="block"
              variants={fadeInUp}
              transition={{ duration: 0.8, ease }}
            >
              Never{" "}
              <span className="text-accent font-serif italic">Forget</span>
            </motion.span>
          </h1>

          <motion.p
            className="text-neutral-700 dark:text-neutral-300 mb-8 max-w-2xl font-sans text-base leading-relaxed sm:text-lg font-normal"
            variants={fadeInUp}
            transition={{ duration: 0.8, ease }}
          >
            The autonomous agent command console and persistent relationship
            memory layer. Equip AI buyer fleets with Bayesian counterparty
            reputation, fail-closed economic guardrails, and on-chain
            cryptographic proof.
          </motion.p>

          <motion.div
            className="flex w-full max-w-md flex-wrap items-center justify-center gap-3.5"
            variants={fadeInScale}
            transition={{ duration: 0.8, ease }}
          >
            <Link
              href="/runs"
              className="group relative inline-flex cursor-pointer items-center max-[850px]:w-full"
            >
              <span className="bg-accent absolute inset-y-0 right-0 w-[calc(100%-2rem)] rounded-xl max-[850px]:w-full" />
              <span className="bg-foreground text-background relative z-10 rounded-xl px-6 py-3 text-center text-sm font-medium max-[850px]:flex-1">
                Explore Live Console
              </span>
              <span className="relative -left-px z-10 flex h-11 w-11 items-center justify-center rounded-xl text-black">
                <ArrowDownRight className="h-5 w-5 transition-transform duration-300 group-hover:-rotate-45" />
              </span>
            </Link>

            <a
              href="#deletion-test"
              className="border-border bg-frame/80 text-foreground hover:bg-frame hover:border-accent/40 rounded-xl border px-5 py-3 font-mono text-xs font-semibold shadow-xs transition-all"
            >
              Run Deletion Test →
            </a>
          </motion.div>
        </motion.div>
      </div>

      {/* Interactive AI Chat Landing Zero-State Console */}
      <motion.div
        id="console-preview"
        className="relative mt-12 w-full px-4 scroll-mt-36 sm:mt-16 sm:px-6 sm:scroll-mt-44"
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.3, ease }}
      >
        <AuraChatConsole />
      </motion.div>

      {/* Partner Logo Loop */}
      <motion.div
        className="w-full pt-20 pb-12"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.5, ease }}
      >
        <div className="mb-6 text-center">
          <span className="text-muted-foreground font-mono text-xs font-medium tracking-widest uppercase">
            Powering Autonomous Agent Infrastructure Across
          </span>
        </div>
        <LogoLoop logos={logos} speed={40} logoHeight={46} gap={36} />
      </motion.div>
    </section>
  );
}

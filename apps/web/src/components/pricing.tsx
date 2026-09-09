"use client";

import { motion } from "motion/react";
import { Check } from "lucide-react";
import type { ReactNode } from "react";

const plans = [
  {
    name: "Developer & Single Agent",
    price: "0",
    monthlyNote: "Free & Open Source",
    description:
      "Ideal for individual developers building autonomous agent rigs locally.",
    features: [
      "Local Sibyl SQLite Bridge (~/.sibyl-memory/memory.db)",
      "5-Tier Dynamic Memory Hierarchy",
      "Fastify API & Stdio/HTTP MCP Server for Claude Code",
      "Load-Bearing Deletion Test verification suite",
      "Local simulated blockchain commitment verifier",
    ],
    popular: false,
    ctaText: "Get Started Free",
    ctaHref: "https://github.com/musashi0x/aura_memory",
  },
  {
    name: "Fleet Pilot (Design Partner)",
    price: "199",
    monthlyNote: "or Pilot Grant Allocation",
    description:
      "For autonomous agent protocols and multi-agent procurement fleets.",
    features: [
      "Everything in Developer tier included",
      "Automated Base Sepolia cryptographic notarization",
      "Virtuals Protocol ACP procurement settlement",
      "Real-time SSE execution stream & Console UI",
      "Bayesian reputation FSM (α/β parameter updates)",
      "Multi-agent coordination (up to 50 active agents)",
      "Priority engineering support with Sibyl Labs",
    ],
    popular: true,
    ctaText: "Apply for Pilot Access",
    ctaHref: "#waitlist",
  },
  {
    name: "Institutional Treasury",
    price: "Custom",
    monthlyNote: "Enterprise & DAO Protocol",
    description:
      "For on-chain treasuries and institutional autonomous capital allocation.",
    features: [
      "Unlimited autonomous agent fleets & counterparties",
      "Hardware-isolated fail-closed guardrail enclaves",
      "Multi-signature operator approval workflows",
      "Cross-chain commitment pipeline (Base + Mainnet)",
      "Dedicated Sibyl cluster with 99.99% uptime SLA",
      "Custom Bayesian risk models & 24/7 incident response",
    ],
    popular: false,
    ctaText: "Contact Protocol Team",
    ctaHref: "#waitlist",
  },
];

const ease = [0.23, 1, 0.32, 1] as const;

function PricingCard({
  plan,
  index,
}: {
  plan: (typeof plans)[0];
  index: number;
}): ReactNode {
  const isPopular = plan.popular;

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.6, ease, delay: index * 0.1 }}
      className="relative flex flex-col"
    >
      {isPopular && (
        <div
          className="bg-accent absolute -inset-1 rounded-[1.2em]"
          aria-hidden="true"
        />
      )}

      <div
        className={`bg-frame relative flex h-full flex-col justify-between rounded-2xl p-6 sm:p-8 ${
          isPopular ? "" : "border-border border"
        }`}
      >
        <div>
          {isPopular && (
            <div className="absolute -top-4 left-1/2 -translate-x-1/2">
              <span className="bg-accent inline-block rounded-full px-4 py-1.5 text-xs font-semibold tracking-wide text-black uppercase shadow-xs">
                Most Popular
              </span>
            </div>
          )}

          <h3 className="text-foreground text-xl font-semibold tracking-tight">
            {plan.name}
          </h3>

          <div className="mt-4">
            <div className="flex items-baseline gap-2">
              <span className="text-foreground font-mono text-4xl font-bold tracking-tight sm:text-5xl">
                {plan.price === "Custom" ? "Custom" : `$${plan.price}`}
              </span>
              {plan.price !== "Custom" && (
                <span className="text-muted-foreground font-mono text-sm">
                  /month
                </span>
              )}
            </div>
            <p className="text-muted-foreground mt-2 font-mono text-xs sm:text-sm">
              {plan.monthlyNote}
            </p>
            <p className="text-foreground/70 mt-3 text-sm leading-relaxed">
              {plan.description}
            </p>
          </div>

          <a
            href={plan.ctaHref}
            className={`mt-6 block w-full rounded-xl py-3 text-center text-sm font-semibold transition-all ${
              isPopular
                ? "bg-foreground text-background hover:bg-foreground/90 shadow-md"
                : "bg-muted text-foreground hover:bg-muted/80"
            }`}
          >
            {plan.ctaText}
          </a>

          <div className="mt-8">
            <p className="text-muted-foreground font-mono text-xs font-semibold tracking-wider uppercase">
              Capabilities Included:
            </p>
            <ul className="mt-4 space-y-3">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-start gap-3">
                  <div className="bg-accent/20 text-foreground flex h-5 w-5 shrink-0 items-center justify-center rounded-full">
                    <Check className="text-foreground h-3.5 w-3.5" />
                  </div>
                  <span className="text-foreground/80 text-xs leading-snug sm:text-sm">
                    {feature}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export function Pricing(): ReactNode {
  return (
    <section id="pricing" className="bg-background w-full scroll-mt-36 px-6 py-24 sm:scroll-mt-44 sm:py-32">
      <div className="mx-auto max-w-5xl">
        <div className="mb-16 text-center">
          <span className="text-accent font-mono text-xs font-semibold tracking-widest uppercase">
            ✦ Deployment Options
          </span>
          <h2 className="text-foreground mt-2 text-3xl font-medium tracking-tight sm:text-5xl">
            Infrastructure &amp; Pilot Access
          </h2>
          <p className="text-muted-foreground mx-auto mt-4 max-w-xl text-sm leading-relaxed sm:text-base">
            From zero-cost local SQLite prototyping to institutional DAO
            treasury defense, choose the deployment tier for your autonomous
            fleet.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {plans.map((plan, index) => (
            <PricingCard key={plan.name} plan={plan} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}

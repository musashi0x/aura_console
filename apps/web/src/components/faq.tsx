"use client";

import { motion, AnimatePresence } from "motion/react";
import { ChevronDown, HelpCircle } from "lucide-react";
import { useState, type ReactNode } from "react";

const faqs = [
  {
    question:
      "Why can't autonomous agents just use vector databases for memory?",
    answer:
      "Vector databases offer semantic text similarity search, but lack causal ordering, Bayesian parameter updating, deterministic replayability, and strict fail-closed state machines. Aura's Sibyl memory architecture provides 5 distinct storage tiers (HOT, WARM, COLD, REFERENCE, ARCHIVE) specifically engineered for autonomous financial and procurement decisions.",
  },
  {
    question: "What is the Load-Bearing Deletion Test and why is it mandatory?",
    answer:
      "In production financial systems, memory cannot be a cosmetic enhancement. The deletion test (pnpm demo:deletion-test) proves that if Sibyl Memory is disconnected (SIBYL_PYTHON=''), the agent immediately halts with run.blocked. It will never make blind financial commitments without verified counterparty reputation.",
  },
  {
    question: "How does the Base Sepolia cryptographic commitment work?",
    answer:
      "Aura computes a salted Keccak-256 hash of the counterparty's updated reputation profile and emits a cryptographic commitment transaction to Base Sepolia testnet. This creates an immutable, timestamped on-chain proof of the agent's reputation state without revealing private negotiation details.",
  },
  {
    question:
      "How do external agents connect via the Model Context Protocol (MCP)?",
    answer:
      "Aura ships with native stdio and HTTP MCP servers. Any MCP-compatible client (such as Claude Code, Cursor, Windsurf, or custom agent runners) can invoke memory_recall_counterparty, memory_list_counterparties, and memory_journal, receiving structured Sibyl verdict codes (ok, abstained_on, gated, no_match).",
  },
  {
    question:
      "What happens when an agent restarts or crashes during a mission?",
    answer:
      "Because Sibyl persists to ~/.sibyl-memory/memory.db independently of ephemeral process memory, a restarted agent immediately resumes with full knowledge of past counterparty outcomes. In our continuous restart benchmark, dropping the application database left counterparty reputation completely intact.",
  },
  {
    question: "How does Virtuals ACP integration work with Aura?",
    answer:
      "Aura integrates with Virtuals Protocol's Agent Commerce Protocol (ACP). When an agent selects a counterparty, Aura manages job funding (acp.job.funded), monitors execution under frozen spend limits, and records outcomes (outcome.recorded) back into Sibyl memory.",
  },
];

const ease = [0.23, 1, 0.32, 1] as const;

function FAQItem({
  faq,
  index,
  isOpen,
  onToggle,
}: {
  faq: (typeof faqs)[0];
  index: number;
  isOpen: boolean;
  onToggle: () => void;
}): ReactNode {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.5, ease, delay: index * 0.05 }}
      onClick={onToggle}
      className="bg-frame border-border/80 hover:border-border cursor-pointer rounded-2xl border p-5 shadow-xs transition-all sm:p-6"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onToggle();
        }
      }}
      aria-expanded={isOpen}
    >
      <div className="flex w-full items-center justify-between gap-4 text-left">
        <span className="text-foreground text-base font-medium tracking-tight sm:text-lg">
          {faq.question}
        </span>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.3, ease }}
          className="shrink-0"
        >
          <ChevronDown className="text-muted-foreground h-5 w-5" />
        </motion.div>
      </div>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease }}
            className="overflow-hidden"
          >
            <p className="text-muted-foreground pt-4 text-sm leading-relaxed sm:text-base">
              {faq.answer}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function FAQ(): ReactNode {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const handleToggle = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section id="faq" className="bg-background w-full scroll-mt-36 px-6 py-24 sm:scroll-mt-44 sm:py-32">
      <div className="mx-auto max-w-3xl">
        <div className="mb-16 text-center">
          <div className="bg-accent/15 border-accent/30 text-foreground mb-3 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-xs font-medium">
            <HelpCircle className="text-accent h-3.5 w-3.5" />
            <span>ARCHITECTURE FAQ</span>
          </div>
          <h2 className="text-foreground text-3xl font-medium tracking-tight sm:text-5xl">
            Frequently Asked Questions
          </h2>
          <p className="text-muted-foreground mt-4 text-sm sm:text-base">
            Everything you need to know about Sibyl Memory, fail-closed
            guardrails, and on-chain proofs.
          </p>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <FAQItem
              key={faq.question}
              faq={faq}
              index={index}
              isOpen={openIndex === index}
              onToggle={() => handleToggle(index)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

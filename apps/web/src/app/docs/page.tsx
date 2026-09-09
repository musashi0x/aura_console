"use client";

import Link from "next/link";

import { DocsPageShell } from "@/components/docs/docs-page-shell";

/**
 * The index leads with the console the product is about, not the interface kit
 * it is built from. Bodies are taken from each surface's own copy rather than
 * written fresh, so this page cannot describe a surface differently from the
 * surface itself.
 */
const guides = [
  {
    title: "Runs",
    href: "/runs",
    body: "One economic objective from start to finish: the evidence gathered, the decision made, any economic action, the outcome, and the memory it changed.",
  },
  {
    title: "Example Run",
    href: "/runs/example",
    body: "A labelled Run to read end to end before starting one of your own.",
  },
  {
    title: "Counterparties",
    href: "/counterparties",
    body: "Relationship intelligence behind a deny-by-default projection. Private episodes, profile bodies, and raw evidence never reach the surface.",
  },
  {
    title: "Policies",
    href: "/policies",
    body: "The economic-action boundary: whether an action runs automatically, needs approval, or is denied.",
  },
  {
    title: "Readiness",
    href: "/system",
    body: "Which dependencies answered, and what stays unavailable when one does not.",
  },
  {
    title: "Sibyl Memory Setup",
    href: "/docs/installation",
    body: "Give your AI a memory in two minutes: install sibyl-memory-cli[mcp], run sibyl init & setup, connect Claude Code, Codex, Hermes, and verify cold-start memory.",
  },
  {
    title: "AI agents",
    href: "/docs/ai-agents",
    body: "How a coding agent should read and extend this catalog.",
  },
];

export default function DocsPage() {
  return (
      <DocsPageShell
        rightPanel={
          <div>
            <span className="text-sm text-muted">Aura Console docs</span>
            <h2 className="mt-2 text-xl font-semibold">Console and guides</h2>
            <p className="mt-3 text-sm text-muted">
              The operator surfaces, and the guides for the interface they are built from.
            </p>
          </div>
        }
      >
        <article className="h-full w-full overflow-y-auto p-5 pt-[5.5rem] md:p-10 md:pt-16 lg:p-14 lg:pt-16">
          <div className="mx-auto max-w-[82ch]">
            <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
              Documentation
            </p>

            <h1 className="mb-2 text-3xl font-semibold tracking-tight text-ink">
              Aura Console
            </h1>
            <p className="mb-3 text-sm text-muted">
              Aura Console makes an agent&apos;s work inspectable: follow or replay a Run
              and see the evidence, decision context, economic-action boundary, outcome,
              and Memory Diff as one timeline.
            </p>
            {/* The v0.1 surfaces are not all built. Saying so here keeps the
 cards below from reading as a list of finished features. */}
            <p className="mb-8 text-sm text-muted">
              Some console surfaces are still deferred, and name what is missing when you
              open them.
            </p>

            <div className="grid gap-3 sm:grid-cols-2">
              {guides.map((guide) => (
                <Link
                  key={guide.href}
                  href={guide.href}
                  className="group rounded-xl border border-line bg-raised p-4 transition-colors hover:border-line-strong"
                >
                  <h2 className="text-sm font-medium text-ink group-hover:text-accent">
                    {guide.title}
                  </h2>
                  <p className="mt-1 text-[13px] leading-relaxed text-muted">
                    {guide.body}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </article>
      </DocsPageShell>
  );
}

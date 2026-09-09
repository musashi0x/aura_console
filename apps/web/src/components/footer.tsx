"use client";

import {
  ArrowRight,
  Bot,
  Building2,
  CheckCircle2,
  Shield,
  Layers,
  Sparkles,
} from "lucide-react";
import { useState, type ReactNode, type FormEvent } from "react";

const footerLinks = {
  architecture: [
    { label: "5-Tier Storage Map", href: "#architecture" },
    { label: "Load-Bearing Deletion Test", href: "#deletion-test" },
    { label: "Base Sepolia Verifier", href: "#base-sepolia" },
    { label: "Virtuals ACP Integration", href: "#virtuals-acp" },
  ],
  resources: [
    {
      label: "GitHub Repository",
      href: "https://github.com/musashi0x/aura_memory",
    },
    {
      label: "2-Min Evaluation Guide",
      href: "https://github.com/musashi0x/aura_memory#readme",
    },
    { label: "Model Context Protocol", href: "#mcp" },
    {
      label: "Sibyl Memory Engine",
      href: "https://github.com/musashi0x/aura_memory",
    },
  ],
  ecosystem: [
    {
      label: "Virtuals Protocol (@virtuals_io)",
      href: "https://x.com/virtuals_io",
    },
    { label: "Base Sepolia (@base)", href: "https://x.com/base" },
    { label: "Sibyl Labs (@sibylcap)", href: "https://x.com/sibylcap" },
    {
      label: "Aura Developer (@musashi0x)",
      href: "https://github.com/musashi0x",
    },
  ],
};

export function Footer(): ReactNode {
  const [waitlistCount, setWaitlistCount] = useState(142);
  const [agentId, setAgentId] = useState("");
  const [org, setOrg] = useState("");
  const [fleet, setFleet] = useState("Virtuals ACP Fleet");
  const [submitted, setSubmitted] = useState(false);
  const [confirmationMsg, setConfirmationMsg] = useState("");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const cleanId = agentId.trim();
    if (!cleanId) return;

    const nextCount = waitlistCount + 1;
    setWaitlistCount(nextCount);
    setConfirmationMsg(
      `Agent "${cleanId}" registered for ${fleet}. Waitlist position #${nextCount} confirmed.`
    );
    setSubmitted(true);
    setAgentId("");
    setOrg("");
  };

  return (
    <footer id="waitlist" className="relative w-full scroll-mt-36 pt-16 sm:scroll-mt-44">
      {/* Pilot Waitlist & Registration Card */}
      <div className="mx-auto max-w-5xl px-6 pb-20">
        <div className="border-border relative overflow-hidden rounded-4xl border bg-[#0d0c12] p-8 text-neutral-100 shadow-2xl sm:p-14 dark:border-neutral-800">
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(168,217,70,0.15),transparent_60%)]"
            aria-hidden="true"
          />

          <div className="relative z-10 flex flex-col items-center text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-neutral-800 bg-neutral-900/90 px-4 py-1 font-mono text-xs font-medium text-neutral-300 shadow-xs">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
              <span>
                LIVE PILOT WAITLIST: {waitlistCount} AGENTS REGISTERED
              </span>
            </div>

            <h2 className="mb-4 max-w-2xl text-3xl font-medium tracking-tight text-white sm:text-5xl">
              Equip Your Agent Fleet With Memory
            </h2>

            <p className="mb-8 max-w-xl text-sm leading-relaxed text-neutral-400 sm:text-base">
              Join leading autonomous DAOs, procurement protocols, and Virtuals
              ACP fleets protecting treasury capital with fail-closed
              relationship memory.
            </p>

            {submitted ? (
              <div className="flex flex-col items-center gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-950/30 px-6 py-5 text-center font-mono text-sm text-white shadow-xl">
                <div className="flex items-center gap-2 text-emerald-400">
                  <CheckCircle2 className="h-5 w-5 shrink-0" />
                  <span className="font-bold">PILOT POSITION RESERVED</span>
                </div>
                <p className="text-xs text-neutral-300">{confirmationMsg}</p>
                <button
                  type="button"
                  onClick={() => setSubmitted(false)}
                  className="text-accent hover:text-accent/80 mt-1 cursor-pointer text-xs underline"
                >
                  Register another agent
                </button>
              </div>
            ) : (
              <form
                onSubmit={handleSubmit}
                className="flex w-full max-w-2xl flex-col items-center gap-3 rounded-2xl border border-neutral-800 bg-neutral-900/90 p-3 shadow-xl backdrop-blur-md sm:flex-row"
              >
                <div className="flex w-full flex-1 items-center px-2">
                  <Bot className="mr-2 h-4 w-4 shrink-0 text-neutral-500" />
                  <input
                    type="text"
                    required
                    value={agentId}
                    onChange={(e) => setAgentId(e.target.value)}
                    placeholder="Agent ID or Wallet (0x...)"
                    aria-label="Agent Identifier"
                    className="w-full bg-transparent py-2 font-mono text-xs text-white placeholder:text-neutral-500 focus:outline-none sm:text-sm"
                  />
                </div>

                <div className="flex w-full flex-1 items-center border-t border-neutral-800 px-2 sm:border-t-0 sm:border-l">
                  <Building2 className="mr-2 h-4 w-4 shrink-0 text-neutral-500" />
                  <input
                    type="text"
                    value={org}
                    onChange={(e) => setOrg(e.target.value)}
                    placeholder="DAO / Fleet Name (Optional)"
                    aria-label="Fleet Name"
                    className="w-full bg-transparent py-2 text-xs text-white placeholder:text-neutral-500 focus:outline-none sm:text-sm"
                  />
                </div>

                <div className="flex w-full sm:w-auto">
                  <select
                    value={fleet}
                    onChange={(e) => setFleet(e.target.value)}
                    aria-label="Target Fleet Network"
                    className="w-full cursor-pointer rounded-xl border border-neutral-700 bg-neutral-800 px-3 py-2.5 font-mono text-xs text-neutral-200 focus:outline-none sm:w-auto"
                  >
                    <option value="Virtuals ACP Fleet">
                      Virtuals ACP Fleet
                    </option>
                    <option value="Base Sepolia DAO">Base Sepolia DAO</option>
                    <option value="Claude Code MCP Rig">
                      Claude Code MCP Rig
                    </option>
                    <option value="Custom Swarm">Custom Swarm</option>
                  </select>
                </div>

                <button
                  type="submit"
                  className="bg-accent hover:bg-accent/90 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-xs font-semibold whitespace-nowrap text-black shadow-md transition-all sm:w-auto sm:text-sm"
                >
                  Join Waitlist
                  <ArrowRight className="h-4 w-4" />
                </button>
              </form>
            )}

            <div className="mt-6 flex flex-wrap items-center justify-center gap-4 font-mono text-xs text-neutral-500">
              <span className="flex items-center gap-1.5">
                <Shield className="text-accent h-3.5 w-3.5" />
                Zero blind economic commitments
              </span>
              <span>•</span>
              <span className="flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-blue-400" />
                Base Sepolia &amp; Virtuals ACP Ready
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Footer Block */}
      <div className="border-border bg-frame border-t py-16 dark:border-neutral-800/80 dark:bg-[#0a0a0f]">
        <div className="mx-auto max-w-5xl px-6">
          <div className="flex items-start justify-between gap-12 max-[850px]:flex-col max-[850px]:gap-10">
            <div className="flex flex-col gap-3">
              <a
                href="#"
                className="flex items-center gap-2.5"
                aria-label="Aura Memory home"
              >
                <div className="bg-foreground text-background flex h-8 w-8 items-center justify-center rounded-xl shadow-sm">
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
                <span className="text-foreground text-xl font-bold tracking-tight">
                  Aura Memory
                </span>
              </a>
              <p className="text-muted-foreground max-w-xs font-mono text-xs leading-relaxed">
                Build with Agents That Don&apos;t Forget. Autonomous command
                console &amp; persistent relationship memory layer.
              </p>
              <div className="text-muted-foreground mt-1 font-mono text-[11px]">
                Repository:{" "}
                <a
                  href="https://github.com/musashi0x/aura_memory"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-foreground hover:text-accent font-semibold underline"
                >
                  musashi0x/aura_memory
                </a>{" "}
                (MIT)
              </div>
            </div>

            <nav
              className="flex gap-16 max-[850px]:flex-wrap max-[850px]:gap-10"
              aria-label="Footer navigation"
            >
              <div>
                <h3 className="text-muted-foreground mb-4 font-mono text-xs font-semibold tracking-wider uppercase">
                  Architecture
                </h3>
                <ul className="space-y-2.5">
                  {footerLinks.architecture.map((link) => (
                    <li key={link.label}>
                      <a
                        href={link.href}
                        className="text-foreground/80 hover:text-accent text-sm font-medium transition-colors"
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="text-muted-foreground mb-4 font-mono text-xs font-semibold tracking-wider uppercase">
                  Resources
                </h3>
                <ul className="space-y-2.5">
                  {footerLinks.resources.map((link) => (
                    <li key={link.label}>
                      <a
                        href={link.href}
                        target={
                          link.href.startsWith("http") ? "_blank" : undefined
                        }
                        rel={
                          link.href.startsWith("http")
                            ? "noopener noreferrer"
                            : undefined
                        }
                        className="text-foreground/80 hover:text-accent text-sm font-medium transition-colors"
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="text-muted-foreground mb-4 font-mono text-xs font-semibold tracking-wider uppercase">
                  Ecosystem
                </h3>
                <ul className="space-y-2.5">
                  {footerLinks.ecosystem.map((link) => (
                    <li key={link.label}>
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-foreground/80 hover:text-accent text-sm font-medium transition-colors"
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </nav>
          </div>

          <div className="border-border text-muted-foreground mt-16 flex flex-col items-center justify-between gap-4 border-t pt-8 font-mono text-xs sm:flex-row">
            <div className="flex items-center gap-2">
              <Sparkles className="text-accent h-3.5 w-3.5" />
              <span>
                © 2026 Aura Protocol &amp; Sibyl Labs. Hackathon: Agents That
                Don&apos;t Forget.
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="border-border bg-muted text-foreground rounded border px-2 py-0.5 font-semibold">
                NON-MAINNET DEMO
              </span>
              <span>STRICT ECONOMIC GUARDRAILS</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

"use client";

import { CatalogPage, CodeBlock, Section } from "@/components/catalog";
import { SibylCliWalkthrough } from "@/features/console/components/sibyl-cli-walkthrough";
import { ExternalLink, CheckCircle2, AlertTriangle, ShieldCheck, Terminal, Sparkles } from "lucide-react";

/* The page's own sections, so "On this page" links at anchors that exist. */
const TOC = [
  { id: "overview", title: "Overview" },
  { id: "step-1", title: "Step 1: Install it" },
  { id: "step-2", title: "Step 2: Sign in" },
  { id: "step-3", title: "Step 3: Connect to your AI" },
  { id: "step-4", title: "Step 4: Test it works" },
  { id: "interactive-walkthrough", title: "Interactive simulator" },
  { id: "troubleshooting", title: "If something did not work" },
  { id: "architecture", title: "5-Tier memory architecture" },
  { id: "open-source", title: "Open source & resources" },
];

export default function InstallationPage() {
  return (
    <CatalogPage
      toc={TOC}
      kicker="GETTING STARTED / WALKTHROUGH"
      title="Sibyl Memory Setup"
      lede="Give your AI a memory, in about two minutes. Sibyl Memory is a plugin that lets your AI remember your work between sessions. No account needed to start. No config files to edit. Here is the whole setup, and how to manage it after."
      rightPanel={
        <div className="space-y-6 text-xs text-muted">
          <div>
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted">
              QUICK REFERENCE
            </span>
            <h2 className="mt-1 text-sm font-semibold text-ink">
              Official Walkthrough
            </h2>
            <p className="mt-2 text-xs leading-relaxed">
              Three steps, about two minutes. Install it, sign in, and connect it to your AI.
            </p>
          </div>

          <div className="rounded-lg border border-line bg-raised p-3 space-y-2 font-mono text-[11px]">
            <div className="text-ink font-semibold">Setup Sequence:</div>
            <div className="text-accent">1. pip install &apos;sibyl-memory-cli[mcp]&apos;</div>
            <div className="text-accent">2. sibyl init</div>
            <div className="text-accent">3. sibyl setup</div>
            <div className="text-accent">4. Test cold recall</div>
          </div>

          <div className="space-y-2">
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted">
              SUPPORTED AI APPS
            </span>
            <ul className="space-y-1 text-ink">
              <li className="flex items-center gap-1.5">
                <CheckCircle2 size={13} className="text-green-500" />
                <span>Claude Code (~/.claude.json)</span>
              </li>
              <li className="flex items-center gap-1.5">
                <CheckCircle2 size={13} className="text-green-500" />
                <span>OpenAI Codex CLI</span>
              </li>
              <li className="flex items-center gap-1.5">
                <CheckCircle2 size={13} className="text-green-500" />
                <span>Hermes Agent Runtime</span>
              </li>
              <li className="flex items-center gap-1.5">
                <CheckCircle2 size={13} className="text-green-500" />
                <span>Aura Console (Base + Virtuals ACP)</span>
              </li>
            </ul>
          </div>

          <div className="space-y-2 pt-2 border-t border-line">
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted">
              OFFICIAL SIBYL LABS
            </span>
            <div className="space-y-1.5">
              <a
                href="https://sibyllabs.org/get-started#walkthrough"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between text-ink hover:text-accent transition-colors"
              >
                <span>Official Walkthrough Spec</span>
                <ExternalLink size={12} />
              </a>
              <a
                href="https://github.com/Sibyl-Labs/Sibyl-Memory"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between text-ink hover:text-accent transition-colors"
              >
                <span>GitHub: Sibyl-Memory</span>
                <ExternalLink size={12} />
              </a>
              <a
                href="https://sibyllabs.org/products"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between text-ink hover:text-accent transition-colors"
              >
                <span>Products Overview</span>
                <ExternalLink size={12} />
              </a>
              <a
                href="https://sibyllabs.org/brain"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between text-ink hover:text-accent transition-colors"
              >
                <span>The Connectome</span>
                <ExternalLink size={12} />
              </a>
            </div>
          </div>
        </div>
      }
    >
      {/* 1. Overview */}
      <Section id="overview" title="Overview">
        <p className="text-sm leading-relaxed text-muted mb-4">
          Sibyl Memory gives autonomous AI agents load-bearing, persistent memory across process restarts, sessions, and sandboxes.
          Unlike transient context windows or ephemeral prompts, Sibyl stores state in a local SQLite database (<code>~/.sibyl-memory/memory.db</code>),
          notarizes state diff roots to Base Sepolia smart contracts, and interfaces directly through the standard Model Context Protocol (MCP).
        </p>
        <div className="grid gap-3 sm:grid-cols-3 mb-2">
          <div className="rounded-xl border border-line bg-raised p-3.5">
            <div className="text-accent font-mono text-xs font-semibold mb-1">2 MINUTES</div>
            <div className="text-sm font-medium text-ink">Zero Configuration</div>
            <p className="text-xs text-muted mt-1">No JSON editing, no API keys to manually wire, no credit card required.</p>
          </div>
          <div className="rounded-xl border border-line bg-raised p-3.5">
            <div className="text-accent font-mono text-xs font-semibold mb-1">LOAD-BEARING</div>
            <div className="text-sm font-medium text-ink">Zero Blind Spend</div>
            <p className="text-xs text-muted mt-1">Fail-closed invariant: if memory cannot be loaded, autonomous economic actions halt.</p>
          </div>
          <div className="rounded-xl border border-line bg-raised p-3.5">
            <div className="text-accent font-mono text-xs font-semibold mb-1">PARTNER STACKS</div>
            <div className="text-sm font-medium text-ink">Base + Virtuals ACP</div>
            <p className="text-xs text-muted mt-1">Base Sepolia on-chain diff anchoring and Virtuals Protocol ACP runtime coordination.</p>
          </div>
        </div>
      </Section>

      {/* 2. Step 1: Install it */}
      <Section id="step-1" title="Step 1: Install it">
        <p className="mb-3 text-sm leading-relaxed text-muted">
          Pick either one. Both install everything you need in one go, including the CLI, SQLite dynamic store, and MCP server runtime.
        </p>
        <div className="space-y-4 mb-4">
          <div>
            <span className="block text-xs font-semibold text-ink mb-1.5">
              Option A: With Python pip (Recommended)
            </span>
            <CodeBlock>{`pip install 'sibyl-memory-cli[mcp]'`}</CodeBlock>
          </div>
          <div>
            <span className="block text-xs font-semibold text-ink mb-1.5">
              Option B: One-line shell installer
            </span>
            <CodeBlock>{`curl -fsSL https://sibyllabs.org/install | sh`}</CodeBlock>
          </div>
        </div>
        <div className="rounded-lg border border-line bg-raised p-3.5 text-xs text-muted leading-relaxed">
          <strong className="text-ink font-semibold">Platform Support: </strong>
          Sibyl Memory runs on Linux, macOS (Apple Silicon and Intel), and Windows through{" "}
          <a
            href="https://docs.sibyllabs.org/memory/install#windows"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent underline underline-offset-2"
          >
            WSL2
          </a>
          . Native Windows is not supported. Both options pull in the full toolkit. If you see an &quot;externally managed environment&quot; error, jump to{" "}
          <a href="#troubleshooting" className="text-accent underline underline-offset-2">
            If something did not work
          </a>{" "}
          at the bottom for the one-time fix.
        </div>
      </Section>

      {/* 3. Step 2: Sign in */}
      <Section id="step-2" title="Step 2: Sign in">
        <p className="mb-3 text-sm leading-relaxed text-muted">
          Run this. It opens a sign-in page in your browser:
        </p>
        <CodeBlock>{`sibyl init`}</CodeBlock>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Sign in there with a wallet, or with your email and a code. The terminal picks it up on its own.
          The free plan gives you the full memory system at no cost, no card needed. Credentials are automatically written to <code>~/.sibyl-memory/credentials.json</code>.
        </p>
      </Section>

      {/* 4. Step 3: Connect it to your AI */}
      <Section id="step-3" title="Step 3: Connect it to your AI">
        <p className="mb-3 text-sm leading-relaxed text-muted">
          This finds your AI app and connects Sibyl to it for you. No settings to edit.
        </p>
        <CodeBlock>{`sibyl setup`}</CodeBlock>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Then restart your AI app. That is it, Sibyl is connected.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          It connects automatically to <strong>Claude Code</strong>, <strong>Codex</strong>, and <strong>Hermes</strong>.
          If you use a different app, <code>sibyl setup</code> wires the ones it recognizes; for anything else, add Sibyl in your app&apos;s own memory or connections settings.
        </p>
        <div className="mt-4 rounded-xl border border-line bg-raised p-4">
          <span className="text-xs font-semibold text-ink uppercase tracking-wider block mb-2 font-mono">
            ✦ AI SUPERPOWERS UNLOCKED
          </span>
          <div className="grid gap-2 text-xs text-muted">
            <div className="flex items-start gap-2">
              <span className="font-semibold text-ink">1. SAVE:</span>
              <span>Episodic outcomes, counterparty delivery ratings, and operational learnings persist to SQLite WARM storage.</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="font-semibold text-ink">2. RECALL:</span>
              <span>Queries historical relationship memory before autonomous actions, evaluating Bayesian reliability scores.</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="font-semibold text-ink">3. SEARCH:</span>
              <span>Fast structured and semantic retrieval across memory items, ensuring zero context amnesia.</span>
            </div>
          </div>
        </div>
      </Section>

      {/* 5. Step 4: Test it works */}
      <Section id="step-4" title="Step 4: Test it works">
        <p className="mb-3 text-sm leading-relaxed text-muted">
          Open your AI and tell it something worth remembering, like:
        </p>
        <CodeBlock>{`remember that I like short, direct answers.`}</CodeBlock>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Close it, open it again later in a completely fresh terminal or process, and ask:
        </p>
        <CodeBlock>{`how do I like my answers?`}</CodeBlock>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          It will know. That is the whole thing, your AI remembers now.
        </p>
      </Section>

      {/* 6. Interactive Simulator Component */}
      <Section id="interactive-walkthrough" title="Interactive simulator">
        <p className="mb-4 text-sm leading-relaxed text-muted">
          Test and preview the entire 4-step sequence interactively: inspect commands, copy snippets with one click, and view live terminal output.
        </p>
        <SibylCliWalkthrough />
      </Section>

      {/* 7. Troubleshooting */}
      <Section id="troubleshooting" title="If something did not work">
        <p className="mb-3 text-sm leading-relaxed text-muted">
          The steps above work for almost everyone. If you encounter an edge case, use these targeted remedies:
        </p>

        <div className="space-y-4 text-xs text-muted">
          <div className="rounded-xl border border-line bg-raised p-4">
            <div className="flex items-center gap-2 text-ink font-semibold text-sm mb-2">
              <AlertTriangle size={15} className="text-amber-500" />
              <span>&quot;Externally managed environment&quot; error (PEP 668)</span>
            </div>
            <p className="mb-3 leading-relaxed">
              If the install showed an &quot;externally managed environment&quot; error, your system wants a sandbox first.
              These two lines make one and install Sibyl inside it:
            </p>
            <CodeBlock>{`python3 -m venv ~/.sibyl-memory/venv && source ~/.sibyl-memory/venv/bin/activate
pip install 'sibyl-memory-cli[mcp]'`}</CodeBlock>
            <p className="mt-2">
              Then carry on from Step 2 (<code>sibyl init</code>).
            </p>
          </div>

          <div className="rounded-xl border border-line bg-raised p-4">
            <div className="flex items-center gap-2 text-ink font-semibold text-sm mb-2">
              <Terminal size={15} className="text-accent" />
              <span>Connected nothing in Step 3?</span>
            </div>
            <p>
              Make sure your AI app was open, then run <code>sibyl setup</code> again.
            </p>
          </div>

          <div className="rounded-xl border border-line bg-raised p-4">
            <div className="flex items-center gap-2 text-ink font-semibold text-sm mb-2">
              <ShieldCheck size={15} className="text-accent" />
              <span>Installed on native Windows?</span>
            </div>
            <p>
              That path is not supported; see{" "}
              <a
                href="https://docs.sibyllabs.org/memory/install#windows"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent underline underline-offset-2"
              >
                Windows: run it in WSL2
              </a>
              . You can install Ubuntu on WSL with <code>wsl --install -d Ubuntu</code>.
            </p>
          </div>
        </div>
      </Section>

      {/* 8. 5-Tier Memory Architecture & Partner Stacks */}
      <Section id="architecture" title="5-Tier memory architecture">
        <p className="mb-4 text-sm leading-relaxed text-muted">
          Aura Console and Sibyl Labs implement a 5-tier dynamic memory hierarchy designed specifically for autonomous agent governance:
        </p>
        <div className="space-y-2.5 text-xs text-muted mb-5">
          <div className="flex items-start gap-3 rounded-lg border border-line bg-raised p-3">
            <span className="font-mono text-accent font-bold shrink-0">TIER 1 (HOT):</span>
            <div><strong className="text-ink">In-Memory Active Session Cache (&lt;1ms):</strong> Ephemeral working memory during an active conversation or multi-tool invocation loop.</div>
          </div>
          <div className="flex items-start gap-3 rounded-lg border border-line bg-raised p-3">
            <span className="font-mono text-accent font-bold shrink-0">TIER 2 (WARM):</span>
            <div><strong className="text-ink">Local SQLite Store (&lt;5ms):</strong> Persistent SQLite database at <code>~/.sibyl-memory/memory.db</code> with indexed FTS5 full-text and counterparty SLA scores.</div>
          </div>
          <div className="flex items-start gap-3 rounded-lg border border-line bg-raised p-3">
            <span className="font-mono text-accent font-bold shrink-0">TIER 3 (COLD):</span>
            <div><strong className="text-ink">Episodic History & Bayesian Scoring:</strong> Historical delivery evaluations updated with Beta distribution parameters (α/β).</div>
          </div>
          <div className="flex items-start gap-3 rounded-lg border border-line bg-raised p-3">
            <span className="font-mono text-accent font-bold shrink-0">TIER 4 (GLACIER):</span>
            <div><strong className="text-ink">Salted Keccak256 State Diffs:</strong> Irreversible cryptographic digests generated at each state transition to prevent tampering.</div>
          </div>
          <div className="flex items-start gap-3 rounded-lg border border-line bg-raised p-3">
            <span className="font-mono text-accent font-bold shrink-0">TIER 5 (PROOF):</span>
            <div><strong className="text-ink">Base Sepolia L2 Commitment:</strong> Notarized on-chain transactions verifying memory state integrity before financial disbursement.</div>
          </div>
        </div>
      </Section>

      {/* 9. Open Source & Resources */}
      <Section id="open-source" title="Open source & resources">
        <p className="mb-3 text-sm leading-relaxed text-muted">
          Sibyl Memory is open source. Read the code, file an issue, or star it on GitHub:
        </p>
        <div className="flex flex-wrap gap-3 mb-4">
          <a
            href="https://github.com/Sibyl-Labs/Sibyl-Memory"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl bg-ink text-surface px-4 py-2 text-xs font-semibold hover:opacity-90 transition-opacity"
          >
            <Sparkles size={14} />
            <span>View on GitHub &rarr;</span>
          </a>
          <a
            href="https://sibyllabs.org/products"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl border border-line bg-raised text-ink px-4 py-2 text-xs font-medium hover:border-line-strong transition-colors"
          >
            <span>Back to products &rarr;</span>
          </a>
        </div>
        <p className="text-xs text-muted leading-relaxed">
          &copy; 2026 Sibyl Labs, LLC. Formed April 2026. Operates on Base. Research and infrastructure for autonomous AI agents. Memory that is proven, not guessed. Built on Base. The agent ships at{" "}
          <a
            href="https://sibylcap.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent underline underline-offset-2"
          >
            sibylcap.com
          </a>
          .
        </p>
      </Section>
    </CatalogPage>
  );
}

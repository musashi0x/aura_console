"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { HStack } from "@astryxdesign/core/Stack";
import { Token } from "@astryxdesign/core/Token";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  HelpCircle,
  Play,
  Sparkles,
} from "lucide-react";

export interface SibylCliWalkthroughProps {
  onJumpToTool?: (toolName: string) => void;
  className?: string;
}

type InstallOption = "pip" | "curl";
type WalkthroughStepId = "install" | "init" | "setup" | "test" | "troubleshoot";

interface StepData {
  id: WalkthroughStepId;
  stepNumber: string;
  badge: string;
  title: string;
  lead: string;
  primaryCommand: string;
  secondaryCommand?: string;
  description: string;
  highlights: string[];
  terminalOutput: string[];
}

const STEPS: StepData[] = [
  {
    id: "install",
    stepNumber: "Step 1",
    badge: "INSTALLATION",
    title: "Install Sibyl Memory CLI & MCP",
    lead: "Pick either one. Both install everything you need in one go.",
    primaryCommand: "pip install 'sibyl-memory-cli[mcp]'",
    secondaryCommand: "curl -fsSL https://sibyllabs.org/install | sh",
    description:
      "Sibyl Memory runs on Linux, macOS (Apple Silicon and Intel), and Windows through WSL2. Native Windows is not supported. Both options pull in the full toolkit with MCP runtime bridge.",
    highlights: [
      "Zero account registration required to install",
      "Includes fast local SQLite store (~/.sibyl-memory/memory.db)",
      "Standard Model Context Protocol (MCP) server bundled",
    ],
    terminalOutput: [
      "$ pip install 'sibyl-memory-cli[mcp]'",
      "Collecting sibyl-memory-cli[mcp]",
      "  Downloading sibyl_memory_cli-0.4.1-py3-none-any.whl (184 kB)",
      "Collecting mcp>=1.0.0",
      "  Downloading mcp-1.3.0-py3-none-any.whl (76 kB)",
      "Installing collected packages: mcp, sibyl-memory-cli",
      "Successfully installed sibyl-memory-cli-0.4.1 mcp-1.3.0",
      "✓ Sibyl Memory binary ready at /usr/local/bin/sibyl",
    ],
  },
  {
    id: "init",
    stepNumber: "Step 2",
    badge: "AUTHENTICATION",
    title: "Sign in (Free Tier, No Card Needed)",
    lead: "Run this. It opens a sign-in page in your browser.",
    primaryCommand: "sibyl init",
    description:
      "Sign in there with a wallet, or with your email and a code. The terminal picks it up on its own. The free plan gives you the full memory system at no cost, no card needed.",
    highlights: [
      "Terminal auto-detects browser authentication callback",
      "Keys and credentials securely saved to ~/.sibyl-memory/credentials.json",
      "Free tier grants unlimited local memory & SQLite storage",
    ],
    terminalOutput: [
      "$ sibyl init",
      "✦ Sibyl Memory Client v0.4.1",
      "→ Opening browser at https://sibyllabs.org/auth?session=sibyl_session_8f3a",
      "✓ Waiting for browser authentication...",
      "✓ Authenticated as operator (Free Tier — Unlimited local memory)",
      "✓ Session token stored in ~/.sibyl-memory/credentials.json",
      "✓ Initialized local SQLite dynamic store at ~/.sibyl-memory/memory.db",
      "Ready for AI connection. Run 'sibyl setup' next.",
    ],
  },
  {
    id: "setup",
    stepNumber: "Step 3",
    badge: "MCP AUTOCONNECT",
    title: "Connect it to your AI (Claude, Codex, Hermes, Aura)",
    lead: "This finds your AI app and connects Sibyl to it for you. No settings to edit.",
    primaryCommand: "sibyl setup",
    description:
      "Then restart your AI app. That is it, Sibyl is connected. It connects automatically to Claude Code, Codex, and Hermes. If you use a different app, sibyl setup wires the ones it recognizes; for anything else, add Sibyl in your app's own memory or connections settings.",
    highlights: [
      "Auto-wires Claude Code (~/.claude.json), Codex, Hermes & Aura",
      "AI gains 3 new abilities: SAVE, RECALL, and SEARCH",
      "No manual JSON editing or schema troubleshooting",
    ],
    terminalOutput: [
      "$ sibyl setup",
      "✦ Scanning local environment for AI clients...",
      "  ✓ Found Claude Code config (~/.claude.json)",
      "    → Injected MCP toolserver: 'sibyl-memory' [stdio: sibyl-memory-mcp]",
      "  ✓ Found OpenAI Codex CLI environment",
      "    → Registered tools: memory_save, memory_recall, memory_search",
      "  ✓ Found Hermes Agent runtime",
      "    → Connected to Hermes persistent memory socket",
      "  ✓ Found Aura Console workspace",
      "    → Verified Base Sepolia & Virtuals ACP bridge",
      "✓ Success! Restart your AI applications to activate persistent memory.",
    ],
  },
  {
    id: "test",
    stepNumber: "Step 4",
    badge: "COLD-START RECALL",
    title: "Test it works (Stateful Cold Recall)",
    lead: "Open your AI and tell it something worth remembering. Close it, open it again later, and ask. It will know.",
    primaryCommand: 'remember that I like short, direct answers.',
    secondaryCommand: 'how do I like my answers?',
    description:
      "Close your terminal or kill the AI process completely. Open a brand new session later and ask: 'how do I like my answers?' It will know. That is the whole thing, your AI remembers now.",
    highlights: [
      "Cold-start proof: memory survives total process reboot",
      "Stored in SQLite WARM tier and hashed with salted Keccak256",
      "Zero prompt drift between independent agent sessions",
    ],
    terminalOutput: [
      "$ claude",
      "> User: remember that I like short, direct answers.",
      "> Claude: Understood. I have saved this preference to Sibyl Memory.",
      "[Sibyl MCP: committed record #42 to ~/.sibyl-memory/memory.db]",
      "",
      "$ exit",
      "# Terminal closed. Agent process destroyed.",
      "# Reopening AI hours later in a fresh environment...",
      "",
      "$ claude",
      "> User: how do I like my answers?",
      "> Claude: You prefer short, direct answers.",
      "[Sibyl MCP: recalled record #42 from SQLite WARM tier (relevance: 1.00)]",
    ],
  },
];

const VENV_FIX = [
  "python3 -m venv ~/.sibyl-memory/venv && source ~/.sibyl-memory/venv/bin/activate",
  "pip install 'sibyl-memory-cli[mcp]'",
];

export function SibylCliWalkthrough({ onJumpToTool, className = "" }: SibylCliWalkthroughProps) {
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [installOption, setInstallOption] = useState<InstallOption>("pip");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [showTroubleshoot, setShowTroubleshoot] = useState(false);

  const currentStep = STEPS[activeStepIndex] ?? STEPS[0]!;

  const handleCopy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      // clipboard fallback
    }
  };

  const handleSimulate = () => {
    setIsSimulating(true);
    setTimeout(() => {
      setIsSimulating(false);
    }, 800);
  };

  return (
    <div
      className={`mw__walkthrough-container ${className}`.trim()}
      data-testid="sibyl-cli-walkthrough"
    >
      {/* Header Banner */}
      <div className="rounded-xl border border-line bg-surface p-5 mb-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-line-strong bg-raised px-3 py-1 font-mono text-[11px] font-semibold text-accent mb-2">
              <Sparkles size={12} />
              <span>SIBYL LABS // 2-MINUTE SETUP WALKTHROUGH</span>
            </div>
            <h2 className="text-xl font-bold tracking-tight text-ink">
              Give your AI a memory, in about two minutes.
            </h2>
            <p className="mt-1 text-sm text-muted max-w-2xl">
              Sibyl Memory is a plugin that lets your AI remember your work between sessions. No
              account needed to start. No config files to edit. Here is the whole setup, and how to
              manage it after.
            </p>
          </div>

          <HStack gap={2} align="center" wrap="wrap">
            <Link
              href="/docs/installation"
              className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-raised px-3 py-2 text-xs font-medium text-ink hover:border-line-strong transition-colors"
            >
              <ExternalLink size={13} />
              <span>Full Guide Docs</span>
            </Link>
            <a
              href="https://github.com/Sibyl-Labs/Sibyl-Memory"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-raised px-3 py-2 text-xs font-medium text-ink hover:border-line-strong transition-colors"
            >
              <Sparkles size={13} />
              <span>GitHub Code &rarr;</span>
            </a>
          </HStack>
        </div>
      </div>

      {/* Stepper Navigation Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6" role="tablist" aria-label="Walkthrough Steps">
        {STEPS.map((step, idx) => {
          const isActive = idx === activeStepIndex;
          return (
            <button
              key={step.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => {
                setActiveStepIndex(idx);
                onJumpToTool?.(step.id);
              }}
              className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all ${
                isActive
                  ? "border-accent bg-accent/10 shadow-sm"
                  : "border-line bg-surface hover:border-line-strong hover:bg-raised"
              }`}
            >
              <div className="flex items-center justify-between w-full mb-1">
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted">
                  {step.stepNumber}
                </span>
                {isActive && <CheckCircle2 size={13} className="text-accent" />}
              </div>
              <span className={`text-xs font-semibold truncate w-full ${isActive ? "text-accent font-bold" : "text-ink"}`}>
                {step.title.split("(")[0]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Step Detail Card & Interactive Terminal Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Side: Step Instructions & Actions */}
        <div className="lg:col-span-6 flex flex-col justify-between rounded-xl border border-line bg-surface p-5">
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <Token label={currentStep.badge} size="sm" color="blue" />
              <span className="font-mono text-xs text-muted">
                Step {activeStepIndex + 1} of {STEPS.length}
              </span>
            </div>

            <h3 className="text-lg font-semibold tracking-tight text-ink mb-1">
              {currentStep.title}
            </h3>
            <p className="text-xs text-muted mb-4 leading-relaxed">
              {currentStep.lead}
            </p>

            {/* Install Step Special Toggle */}
            {currentStep.id === "install" && (
              <div className="mb-4">
                <div className="flex items-center gap-1.5 p-1 rounded-lg border border-line bg-raised mb-3 w-fit">
                  <button
                    type="button"
                    onClick={() => setInstallOption("pip")}
                    className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${
                      installOption === "pip"
                        ? "bg-surface text-ink shadow-xs"
                        : "text-muted hover:text-ink"
                    }`}
                  >
                    Option A (pip)
                  </button>
                  <button
                    type="button"
                    onClick={() => setInstallOption("curl")}
                    className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${
                      installOption === "curl"
                        ? "bg-surface text-ink shadow-xs"
                        : "text-muted hover:text-ink"
                    }`}
                  >
                    Option B (curl one-liner)
                  </button>
                </div>
              </div>
            )}

            {/* Main Command Box */}
            <div className="relative rounded-lg border border-line bg-raised p-3 mb-4 font-mono text-xs">
              <div className="flex items-center justify-between text-ink mb-1">
                <span className="text-muted text-[11px] font-sans">
                  {currentStep.id === "test" ? "Tell your AI:" : "Run in terminal:"}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const cmd =
                      currentStep.id === "install"
                        ? installOption === "pip"
                          ? currentStep.primaryCommand
                          : currentStep.secondaryCommand!
                        : currentStep.primaryCommand;
                    handleCopy(cmd, `cmd-${currentStep.id}`);
                  }}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] text-muted hover:text-ink hover:bg-surface transition-colors"
                  aria-label={`Copy command for ${currentStep.title}`}
                >
                  {copiedKey === `cmd-${currentStep.id}` ? (
                    <>
                      <Check size={12} className="text-green-500" />
                      <span className="text-green-500 font-medium">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy size={12} />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
              <div className="text-accent font-semibold overflow-x-auto py-1">
                {currentStep.id === "install"
                  ? installOption === "pip"
                    ? currentStep.primaryCommand
                    : currentStep.secondaryCommand
                  : currentStep.primaryCommand}
              </div>

              {/* Step 4 Cold Recall Follow-up Command */}
              {currentStep.id === "test" && (
                <div className="mt-3 pt-3 border-t border-line">
                  <div className="flex items-center justify-between text-ink mb-1">
                    <span className="text-muted text-[11px] font-sans">
                      Restart AI & ask later:
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(currentStep.secondaryCommand!, "cmd-test-2")}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] text-muted hover:text-ink hover:bg-surface transition-colors"
                    >
                      {copiedKey === "cmd-test-2" ? (
                        <>
                          <Check size={12} className="text-green-500" />
                          <span className="text-green-500 font-medium">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy size={12} />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                  <div className="text-accent font-semibold overflow-x-auto py-1">
                    {currentStep.secondaryCommand}
                  </div>
                </div>
              )}
            </div>

            <p className="text-xs leading-relaxed text-muted mb-4">
              {currentStep.description}
            </p>

            {/* Highlights bullet points */}
            <ul className="space-y-1.5 mb-5 text-xs text-muted">
              {currentStep.highlights.map((point) => (
                <li key={point} className="flex items-start gap-2">
                  <CheckCircle2 size={13} className="text-accent shrink-0 mt-0.5" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Stepper Navigation Buttons */}
          <div className="pt-4 border-t border-line flex items-center justify-between">
            <button
              type="button"
              disabled={activeStepIndex === 0}
              onClick={() => setActiveStepIndex((idx) => Math.max(0, idx - 1))}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-line text-xs font-medium text-ink hover:bg-raised disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Previous Step
            </button>

            <button
              type="button"
              onClick={() => {
                if (activeStepIndex < STEPS.length - 1) {
                  setActiveStepIndex((idx) => idx + 1);
                } else {
                  setShowTroubleshoot(true);
                }
              }}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-ink text-surface text-xs font-semibold hover:opacity-90 transition-opacity"
            >
              {activeStepIndex < STEPS.length - 1 ? (
                <>
                  <span>Next: {STEPS[activeStepIndex + 1]?.title.split("(")[0]}</span>
                  <ArrowRight size={13} />
                </>
              ) : (
                <span>Troubleshooting Guide &rarr;</span>
              )}
            </button>
          </div>
        </div>

        {/* Right Side: Interactive Terminal & Output */}
        <div className="lg:col-span-6 rounded-xl border border-line bg-[#0c0d0e] p-4 flex flex-col justify-between font-mono text-xs text-neutral-300 shadow-inner">
          <div>
            {/* Terminal Header */}
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-neutral-800">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-rose-500/80" />
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-500/80" />
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
                </div>
                <span className="text-[11px] text-neutral-400 font-sans ml-2">
                  bash // ~/.sibyl-memory
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSimulate}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-neutral-800 text-[11px] text-neutral-300 hover:text-white hover:bg-neutral-700 transition-colors"
                  title="Simulate Step in Terminal"
                >
                  <Play size={11} className={isSimulating ? "animate-spin" : ""} />
                  <span>{isSimulating ? "Running..." : "Simulate"}</span>
                </button>
              </div>
            </div>

            {/* Terminal Body */}
            <div className="space-y-1 overflow-x-auto min-h-[220px] max-h-[300px]">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentStep.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className="space-y-1"
                >
                  {currentStep.terminalOutput.map((line, idx) => {
                    const isCommand = line.startsWith("$");
                    const isSuccess = line.startsWith("✓");
                    const isClaude = line.startsWith("> Claude:");
                    const isComment = line.startsWith("#");
                    const isMcp = line.startsWith("[Sibyl MCP");

                    return (
                      <div
                        key={idx}
                        className={`text-[11.5px] leading-relaxed ${
                          isCommand
                            ? "text-emerald-400 font-bold"
                            : isSuccess
                            ? "text-emerald-300"
                            : isClaude
                            ? "text-cyan-300 font-semibold"
                            : isMcp
                            ? "text-purple-400 italic"
                            : isComment
                            ? "text-neutral-500"
                            : "text-neutral-300"
                        }`}
                      >
                        {line}
                      </div>
                    );
                  })}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          {/* Terminal Footer Status */}
          <div className="pt-3 mt-3 border-t border-neutral-800 flex items-center justify-between text-[10.5px] text-neutral-500 font-sans">
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <span>Daemon active &bull; Base Sepolia L2 proof ready</span>
            </span>
            <span className="font-mono">SQLite ~/.sibyl-memory/memory.db</span>
          </div>
        </div>
      </div>

      {/* Troubleshooting Expandable Box: "If something did not work" */}
      <div className="mt-6 rounded-xl border border-line bg-surface p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <HelpCircle size={15} className="text-accent" />
            <h4 className="text-sm font-semibold text-ink">
              If something did not work (Troubleshooting)
            </h4>
          </div>
          <button
            type="button"
            onClick={() => setShowTroubleshoot(!showTroubleshoot)}
            className="text-xs text-accent hover:underline"
          >
            {showTroubleshoot ? "Hide troubleshooting" : "Show troubleshooting"}
          </button>
        </div>

        {showTroubleshoot && (
          <div className="space-y-4 pt-2 border-t border-line text-xs text-muted">
            <div>
              <p className="font-medium text-ink mb-1">
                1. &quot;Externally managed environment&quot; error (PEP 668):
              </p>
              <p className="mb-2">
                Your system requires a virtual environment first. Run these two lines to create a dedicated sandbox and install Sibyl inside it:
              </p>
              <div className="relative rounded-lg border border-line bg-raised p-3 font-mono text-xs">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[10px] text-muted">Virtualenv Sandbox Fix</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(VENV_FIX.join("\n"), "venv-fix")}
                    className="inline-flex items-center gap-1 text-[11px] text-muted hover:text-ink"
                  >
                    {copiedKey === "venv-fix" ? (
                      <span className="text-green-500">Copied!</span>
                    ) : (
                      <>
                        <Copy size={11} />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="text-accent">{VENV_FIX[0]}</div>
                <div className="text-accent">{VENV_FIX[1]}</div>
              </div>
              <p className="mt-2 text-[11px]">
                Then carry on from Step 2 (<code>sibyl init</code>).
              </p>
            </div>

            <div>
              <p className="font-medium text-ink mb-1">
                2. Connected nothing in Step 3?
              </p>
              <p>
                Make sure your AI app (Claude Code, Codex, or Hermes) was open, then run <code>sibyl setup</code> again.
              </p>
            </div>

            <div>
              <p className="font-medium text-ink mb-1">
                3. Installed on native Windows?
              </p>
              <p>
                Native Windows is not supported. Please run Sibyl in Windows Subsystem for Linux (WSL2):{" "}
                <code className="text-accent">wsl --install -d Ubuntu</code>.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

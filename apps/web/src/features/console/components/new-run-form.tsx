"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  DollarSign,
  Sparkles,
  AlertCircle,
  Bot,
  Sliders,
} from "lucide-react";

import { Button, playInteractionSound } from "@/components/primitives";
import { env } from "@/lib/env";
import { useWeb3Wallet } from "@/features/web3";
import { McpMissionBuilder } from "./mcp-mission-builder";

const BUDGET_PRESETS = ["10.00", "25.00", "50.00", "100.00"];

/**
 * Create a Run against the real endpoint.
 *
 * Supports both:
 * 1. AI Agent Auto-Create (MCP Bridge) - with presets, memory checks, and 1-click orchestration
 * 2. Manual Specification - standard direct operator input
 */
export function NewRunForm({ disabled }: { disabled: boolean }) {
  const router = useRouter();
  const { isConnected, isBaseSepolia, usdcBalance } = useWeb3Wallet();
  const [mode, setMode] = useState<"agent" | "manual">("agent");
  const [objective, setObjective] = useState("");
  const [budget, setBudget] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createRun({
    objective: runObjective,
    budgetUsdc: runBudget,
    source = "CONSOLE",
  }: {
    objective: string;
    budgetUsdc: string | null;
    source?: "CONSOLE" | "AGENT";
  }) {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`${env.NEXT_PUBLIC_API_URL}/api/runs`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          objective: runObjective.trim(),
          source,
          budgetUsdc: runBudget === null || runBudget.trim() === "" ? null : runBudget.trim(),
        }),
      });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const message =
          typeof body === "object" && body !== null && "error" in body
            ? String((body as { error: { message?: string } }).error?.message ?? "")
            : "";
        setError(message === "" ? `The Run was not created (HTTP ${response.status}).` : message);
        return;
      }
      const runId = (body as { run: { id: string } }).run.id;
      playInteractionSound("pulse");
      router.push(`/runs/${runId}`);
    } catch {
      setError("The API could not be reached, so no Run was created.");
    } finally {
      setPending(false);
    }
  }

  async function submitManual(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await createRun({
      objective,
      budgetUsdc: budget,
      source: "CONSOLE",
    });
  }

  const handleAgentDraft = (data: { objective: string; budgetUsdc: string }) => {
    setObjective(data.objective);
    setBudget(data.budgetUsdc);
    setMode("manual");
  };

  const handleAgentCreate = async (data: { objective: string; budgetUsdc: string }) => {
    await createRun({
      objective: data.objective,
      budgetUsdc: data.budgetUsdc,
      source: "AGENT",
    });
  };

  const selectPreset = (val: string) => {
    playInteractionSound("tick");
    setBudget(val);
  };

  return (
    <div className="new-run-container max-w-2xl flex flex-col gap-4 my-4">
      {/* Mode Switcher Tabs */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-1 rounded-xl bg-[var(--color-surface,#111015)] border border-[var(--color-border)]">
        <button
          type="button"
          onClick={() => {
            playInteractionSound("tick");
            setMode("agent");
          }}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-medium transition-all ${
            mode === "agent"
              ? "bg-[var(--color-surface-raised,#1b1b1f)] text-[var(--color-text,#f4f7fb)] shadow-sm border border-[var(--color-border)]"
              : "text-[var(--color-text-muted,#8d9aaf)] hover:text-[var(--color-text,#f4f7fb)]"
          }`}
        >
          <Bot size={14} className={mode === "agent" ? "text-[var(--color-accent)]" : ""} />
          <span>AI Agent Auto-Create (MCP)</span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-800/60">
            DEMO
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            playInteractionSound("tick");
            setMode("manual");
          }}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-medium transition-all ${
            mode === "manual"
              ? "bg-[var(--color-surface-raised,#1b1b1f)] text-[var(--color-text,#f4f7fb)] shadow-sm border border-[var(--color-border)]"
              : "text-[var(--color-text-muted,#8d9aaf)] hover:text-[var(--color-text,#f4f7fb)]"
          }`}
        >
          <Sliders size={14} className={mode === "manual" ? "text-[var(--color-accent)]" : ""} />
          <span>Manual Specification</span>
        </button>
      </div>

      {error === null ? null : (
        <div
          className="cs__form-error p-3 rounded-lg bg-red-950/40 border border-red-900/60 text-xs text-red-300 flex items-center gap-2"
          role="alert"
        >
          <AlertCircle size={14} className="flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {mode === "agent" ? (
        <McpMissionBuilder
          disabled={disabled}
          pending={pending}
          onDraft={handleAgentDraft}
          onCreate={handleAgentCreate}
        />
      ) : (
        <form
          className="cs__form p-6 rounded-2xl bg-[var(--color-surface-raised,#1b1b1f)] border border-[var(--color-border)] flex flex-col gap-6 shadow-sm"
          onSubmit={submitManual}
        >
          <div className="flex flex-col gap-2">
            <label className="cs__field flex flex-col gap-2" htmlFor="objective">
              <div className="flex items-center justify-between">
                <span className="cs__label font-medium text-sm text-[var(--color-text,#f4f7fb)] flex items-center gap-1.5">
                  <Sparkles size={14} className="text-[var(--color-accent)]" />
                  <span>Objective</span>
                </span>
                <span className="text-[11px] text-[var(--color-text-muted,#8d9aaf)]">Required</span>
              </div>
              <input
                id="objective"
                name="objective"
                className="cs__input w-full px-3.5 py-2.5 rounded-lg bg-[var(--color-surface,#111015)] border border-[var(--color-border)] text-sm text-[var(--color-text,#f4f7fb)] focus:border-[var(--color-accent)] focus:outline-none transition-colors"
                value={objective}
                onChange={(event) => setObjective(event.target.value)}
                required
                maxLength={500}
                placeholder="Buy one market dataset under a 25 USDC ceiling"
              />
            </label>
            <span className="cs__hint text-xs text-[var(--color-text-muted,#8d9aaf)]">
              Describe the single economic goal Aura should achieve.
            </span>
          </div>

          <div className="flex flex-col gap-2">
            <div className="cs__field flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label
                  className="cs__label font-medium text-sm text-[var(--color-text,#f4f7fb)] flex items-center gap-1.5"
                  htmlFor="budget"
                >
                  <DollarSign size={14} className="text-[var(--color-accent)]" />
                  <span>Budget ceiling, USDC</span>
                </label>
                {isConnected && isBaseSepolia && usdcBalance !== null ? (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-[var(--color-text-muted,#8d9aaf)]">
                      Wallet:{" "}
                      <span
                        className="font-mono text-[var(--color-cyan)] font-medium"
                        data-testid="form-wallet-usdc-balance"
                      >
                        {usdcBalance} USDC
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        playInteractionSound("tick");
                        setBudget(usdcBalance);
                      }}
                      className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-[var(--color-surface,#111015)] border border-[var(--color-border)] hover:border-[var(--color-cyan)] text-[var(--color-cyan)] transition-colors"
                      data-testid="use-max-budget-btn"
                      title="Set ceiling to connected wallet USDC balance"
                    >
                      Use Max
                    </button>
                  </div>
                ) : (
                  <span className="text-[11px] text-[var(--color-text-muted,#8d9aaf)]">Optional</span>
                )}
              </div>
              <input
                id="budget"
                name="budget"
                className="cs__input w-full px-3.5 py-2.5 rounded-lg bg-[var(--color-surface,#111015)] border border-[var(--color-border)] text-sm text-[var(--color-text,#f4f7fb)] focus:border-[var(--color-accent)] focus:outline-none transition-colors"
                value={budget}
                onChange={(event) => setBudget(event.target.value)}
                inputMode="decimal"
                pattern="\d+(\.\d{1,6})?"
                placeholder="25.000000"
              />
            </div>

            {(() => {
              const parsedBudget = parseFloat(budget);
              const parsedBalance = usdcBalance !== null ? parseFloat(usdcBalance) : null;
              const isExceeding =
                isConnected &&
                isBaseSepolia &&
                parsedBalance !== null &&
                !Number.isNaN(parsedBudget) &&
                parsedBudget > parsedBalance;

              if (!isExceeding) return null;

              return (
                <div
                  className="p-2.5 rounded-lg bg-amber-950/40 border border-amber-800/60 text-xs text-amber-300 flex items-center justify-between gap-2"
                  role="status"
                  data-testid="budget-exceeds-warning"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <AlertCircle size={14} className="flex-shrink-0 text-amber-400" />
                    <span className="truncate">
                      Ceiling ({budget} USDC) exceeds wallet balance ({usdcBalance} USDC).
                    </span>
                  </div>
                  <a
                    href="https://portal.cdp.coinbase.com/products/faucet"
                    target="_blank"
                    rel="noreferrer noopener"
                    className="underline hover:text-amber-100 flex-shrink-0 font-mono text-[11px] flex items-center gap-1"
                    data-testid="faucet-warning-link"
                  >
                    <span>Get USDC Faucet</span>
                    <span aria-hidden="true">↗</span>
                  </a>
                </div>
              );
            })()}

            <div className="flex items-center gap-2 pt-1">
              <span className="text-xs text-[var(--color-text-muted,#8d9aaf)]">Quick Presets:</span>
              {BUDGET_PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => selectPreset(p)}
                  className="text-xs font-mono px-2 py-0.5 rounded-md bg-[var(--color-surface,#111015)] border border-[var(--color-border)] hover:border-[var(--color-accent)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
                >
                  {p} USDC
                </button>
              ))}
            </div>
            <span className="cs__hint text-xs text-[var(--color-text-muted,#8d9aaf)]">
              A declared ceiling, not an amount spent. Leave it empty for no ceiling.
            </span>
          </div>

          <div className="pt-2 flex items-center justify-between border-t border-[var(--color-border)]">
            <Button
              type="submit"
              disabled={disabled || pending || objective.trim() === ""}
              className="flex items-center gap-2"
            >
              <span>{pending ? "Creating…" : "Create Run"}</span>
              <ArrowRight size={14} />
            </Button>

            {disabled ? (
              <p className="cs__hint text-xs text-[var(--color-text-muted)]" role="status">
                The event store is unreachable, so a Run cannot be created right now.
              </p>
            ) : null}
          </div>
        </form>
      )}
    </div>
  );
}

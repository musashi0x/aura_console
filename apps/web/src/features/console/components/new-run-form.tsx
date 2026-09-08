"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, DollarSign, Sparkles, AlertCircle } from "lucide-react";

import { Button, playInteractionSound } from "@/components/primitives";
import { env } from "@/lib/env";

const BUDGET_PRESETS = ["10.00", "25.00", "50.00", "100.00"];

/**
 * Create a Run against the real endpoint.
 *
 * The form claims nothing until the server answers. There is no optimistic
 * navigation and no "Run created" message written before the response arrives:
 * the whole product rests on not reporting what did not happen, and a create
 * form is the easiest place to break that.
 *
 * It posts directly rather than through `apiClient`, because that module is the
 * server-side typed client and this runs in the browser.
 */
export function NewRunForm({ disabled }: { disabled: boolean }) {
  const router = useRouter();
  const [objective, setObjective] = useState("");
  const [budget, setBudget] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`${env.NEXT_PUBLIC_API_URL}/api/runs`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          objective: objective.trim(),
          source: "CONSOLE",
          budgetUsdc: budget.trim() === "" ? null : budget.trim(),
        }),
      });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        // Show the server's own reason. A generic failure message hides which
        // field was wrong and turns a fixable mistake into a dead end.
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

  const selectPreset = (val: string) => {
    playInteractionSound("tick");
    setBudget(val);
  };

  return (
    <form
      className="cs__form p-6 rounded-2xl bg-[var(--color-surface-raised,#1b1b1f)] border border-[var(--color-border)] max-w-2xl flex flex-col gap-6 shadow-sm my-4"
      onSubmit={submit}
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
        <label className="cs__field flex flex-col gap-2" htmlFor="budget">
          <div className="flex items-center justify-between">
            <span className="cs__label font-medium text-sm text-[var(--color-text,#f4f7fb)] flex items-center gap-1.5">
              <DollarSign size={14} className="text-[var(--color-accent)]" />
              <span>Budget ceiling, USDC</span>
            </span>
            <span className="text-[11px] text-[var(--color-text-muted,#8d9aaf)]">Optional</span>
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
        </label>
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

      {error === null ? null : (
        <div className="cs__form-error p-3 rounded-lg bg-red-950/40 border border-red-900/60 text-xs text-red-300 flex items-center gap-2" role="alert">
          <AlertCircle size={14} className="flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

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
  );
}

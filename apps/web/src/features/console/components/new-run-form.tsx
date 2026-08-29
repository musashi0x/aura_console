"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/primitives";
import { env } from "@/lib/env";

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
      router.push(`/runs/${runId}`);
    } catch {
      setError("The API could not be reached, so no Run was created.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="cs__form" onSubmit={submit}>
      <label className="cs__field" htmlFor="objective">
        <span className="cs__label">Objective</span>
        <input
          id="objective"
          name="objective"
          className="cs__input"
          value={objective}
          onChange={(event) => setObjective(event.target.value)}
          required
          maxLength={500}
          placeholder="Buy one market dataset under a 25 USDC ceiling"
        />
      </label>

      <label className="cs__field" htmlFor="budget">
        <span className="cs__label">Budget ceiling, USDC</span>
        <input
          id="budget"
          name="budget"
          className="cs__input"
          value={budget}
          onChange={(event) => setBudget(event.target.value)}
          inputMode="decimal"
          pattern="\d+(\.\d{1,6})?"
          placeholder="25.000000"
        />
        <span className="cs__hint">
          A declared ceiling, not an amount spent. Leave it empty for no ceiling.
        </span>
      </label>

      {error === null ? null : (
        <p className="cs__form-error" role="alert">
          {error}
        </p>
      )}

      <Button type="submit" disabled={disabled || pending || objective.trim() === ""}>
        {pending ? "Creating…" : "Create Run"}
      </Button>

      {disabled ? (
        <p className="cs__hint" role="status">
          The event store is unreachable, so a Run cannot be created right now.
        </p>
      ) : null}
    </form>
  );
}

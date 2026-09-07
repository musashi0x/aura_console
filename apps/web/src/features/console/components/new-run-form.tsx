"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@astryxdesign/core/Button";
import { ButtonGroup } from "@astryxdesign/core/ButtonGroup";
import { env } from "@/lib/env";
import {
  MISSION_TEMPLATES,
  getDraftMission,
  subscribeDraftMission,
} from "../model/draft-run-store";

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

  useEffect(() => {
    return subscribeDraftMission(() => {
      const draft = getDraftMission();
      if (draft.objective) setObjective(draft.objective);
      if (draft.budget !== undefined) setBudget(draft.budget);
    });
  }, []);

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
      <div className="cs__prompt-quickpicks">
        <span className="cs__hint">Objective templates:</span>
        <ButtonGroup label="Objective templates" size="sm">
          {MISSION_TEMPLATES.map((tmpl) => (
            <Button
              key={tmpl.id}
              type="button"
              label={tmpl.title}
              variant={objective === tmpl.objective ? "primary" : "secondary"}
              onClick={() => {
                setObjective(tmpl.objective);
                setBudget(tmpl.budgetUsdc);
              }}
            />
          ))}
        </ButtonGroup>
      </div>

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

      <div className="cs__budget-presets">
        <span className="cs__hint">Quick budget presets:</span>
        <ButtonGroup label="Budget presets" size="sm">
          {["10.000000", "25.000000", "50.000000", "100.000000"].map((preset) => (
            <Button
              key={preset}
              type="button"
              label={`${parseInt(preset, 10)} USDC`}
              variant={budget === preset ? "primary" : "secondary"}
              onClick={() => setBudget(preset)}
            />
          ))}
          <Button
            type="button"
            label="No limit"
            variant={budget === "" ? "primary" : "secondary"}
            onClick={() => setBudget("")}
          />
        </ButtonGroup>
      </div>

      {error === null ? null : (
        <p className="cs__form-error" role="alert">
          {error}
        </p>
      )}

      <div className="cs__form-actions">
        <ButtonGroup label="Run actions" size="md">
          <Button
            type="submit"
            label={pending ? "Creating…" : "Create Run"}
            variant="primary"
            isDisabled={disabled || pending || objective.trim() === ""}
            isLoading={pending}
          />
          <Button
            label="Cancel"
            variant="secondary"
            as={Link}
            href="/runs"
          />
        </ButtonGroup>
      </div>

      {disabled ? (
        <p className="cs__hint" role="status">
          The event store is unreachable, so a Run cannot be created right now.
        </p>
      ) : null}
    </form>
  );
}

"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";

import { copyToClipboard } from "@/features/console/components/sibyl-cli-walkthrough";
import { readProgress, writeProgress } from "../acknowledgement";
import { copy } from "../copy";
import { canContinue, initialState, onboardingReducer } from "../onboarding-reducer";
import { runCheck } from "../readiness";
import type { OnboardingStep } from "../types";
import { ReadinessRowItem } from "./readiness-row";

const STEP_LABELS: { id: OnboardingStep; label: string }[] = [
  { id: "welcome", label: "Welcome" },
  { id: "readiness", label: "Readiness" },
  { id: "disclosure", label: "What Aura stores" },
  { id: "complete", label: "Done" },
];

export interface OnboardingFlowProps {
  /** Injected so tests drive navigation without a router. */
  onFinish?: (destination: "run" | "example") => void;
  onSkip?: () => void;
}

export function OnboardingFlow({ onFinish, onSkip }: OnboardingFlowProps) {
  const [state, dispatch] = useReducer(onboardingReducer, initialState);
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const restored = useRef(false);

  const copyCommand = (cmd: string, key: string) => {
    void copyToClipboard(cmd);
    setCopiedCommand(key);
    setTimeout(() => setCopiedCommand(null), 2000);
  };

  // Resume where the operator left off, before anything is rendered as new.
  useEffect(() => {
    const progress = readProgress();
    restored.current = true;
    if (progress.step !== "welcome" || progress.acknowledgedAt) {
      dispatch({
        type: "restore",
        state: {
          step: progress.step,
          acknowledgedAt: progress.acknowledgedAt,
          skippedAt: progress.skippedAt,
        },
      });
    }
  }, []);

  useEffect(() => {
    if (!restored.current) return;
    writeProgress({
      step: state.step,
      acknowledgedAt: state.acknowledgedAt,
      skippedAt: state.skippedAt,
    });
  }, [state.step, state.acknowledgedAt, state.skippedAt]);

  const check = useCallback(async (id: string) => {
    dispatch({ type: "checkStarted", id });
    const outcome = await runCheck(id);
    dispatch({ type: "checkSettled", id, status: outcome.status, detail: outcome.detail });
  }, []);

  // Run the real checks once the operator reaches the readiness step.
  useEffect(() => {
    if (state.step !== "readiness") return;
    void check("api");
    void check("database");
  }, [state.step, check]);

  // Move focus to the step heading so keyboard and screen reader users are not
  // stranded at the top of the document after each transition.
  useEffect(() => {
    headingRef.current?.focus();
  }, [state.step]);

  const skip = () => {
    dispatch({ type: "skip", at: new Date().toISOString() });
    onSkip?.();
  };

  const position = STEP_LABELS.findIndex((entry) => entry.id === state.step) + 1;

  return (
    <div className="onboarding-shell">
      <section className="onboarding" aria-labelledby="onboarding-heading">
        {/* Decoration. It names the surface and carries no state, so losing it
            costs atmosphere and nothing else. */}
        <p aria-hidden="true" className="onboarding__boot">
          {copy.boot}
        </p>
        <nav aria-label="Onboarding progress">
          <p className="visually-hidden">
            Step {position} of {STEP_LABELS.length}
          </p>
          <ol className="onboarding__steps">
            {STEP_LABELS.map((entry, index) => {
              const stepState =
                index < position - 1 ? "done" : index === position - 1 ? "current" : "todo";

              return (
                <li
                  key={entry.id}
                  className="onboarding__step"
                  aria-current={entry.id === state.step ? "step" : undefined}
                  data-state={stepState}
                >
                  <span aria-hidden="true" className="onboarding__step-index">
                    {stepState === "done" ? (
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="onboarding__step-check"
                      >
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                    ) : (
                      index + 1
                    )}
                  </span>
                  {/* Hidden by width, not removed: the label is how a screen
                      reader names the step, and the counter above only says
                      which number it is. */}
                  <span className="onboarding__step-label">{entry.label}</span>
                  {index < STEP_LABELS.length - 1 && (
                    <span
                      aria-hidden="true"
                      className="onboarding__step-line"
                      data-state={stepState}
                    />
                  )}
                </li>
              );
            })}
          </ol>
        </nav>

      {state.step === "welcome" ? (
        <>
          <h1 id="onboarding-heading" ref={headingRef} tabIndex={-1}>
            {copy.welcome.title}
          </h1>
          <p className="onboarding__lead">{copy.welcome.lead}</p>
          <p>{copy.welcome.body}</p>
          <p className="onboarding__note">{copy.welcome.noSignIn}</p>
          <div className="onboarding__actions">
            <button type="button" className="btn btn--primary" onClick={() => dispatch({ type: "next" })}>
              {copy.welcome.primary}
            </button>
            <button type="button" className="btn" onClick={skip}>
              {copy.welcome.secondary}
            </button>
          </div>
        </>
      ) : null}

      {state.step === "readiness" ? (
        <>
          <h1 id="onboarding-heading" ref={headingRef} tabIndex={-1}>
            {copy.readiness.title}
          </h1>
          <p>{copy.readiness.body}</p>
          <ul className="readiness" aria-live="polite">
            {state.rows.map((row, index) => (
              <ReadinessRowItem
                key={row.id}
                row={row}
                index={index}
                onRetry={(id) => void check(id)}
              />
            ))}
          </ul>
          <div className="onboarding__actions">
            <button type="button" className="btn btn--primary" onClick={() => dispatch({ type: "next" })}>
              {copy.readiness.primary}
            </button>
            <button type="button" className="btn" onClick={() => dispatch({ type: "back" })}>
              Back
            </button>
            <button type="button" className="btn" onClick={skip}>
              {copy.readiness.secondary}
            </button>
          </div>
        </>
      ) : null}

      {state.step === "disclosure" ? (
        <>
          <h1 id="onboarding-heading" ref={headingRef} tabIndex={-1}>
            {copy.disclosure.title}
          </h1>
          <p>{copy.disclosure.body}</p>
          <dl className="disclosure">
            {copy.disclosure.points.map((point) => (
              <div key={point.heading}>
                <dt className="disclosure__heading">{point.heading}</dt>
                <dd className="disclosure__text">{point.text}</dd>
              </div>
            ))}
          </dl>
          <div className="ack ack--panel">
            <input
              id="ack"
              type="checkbox"
              checked={state.acknowledgedAt !== null}
              onChange={(event) =>
                dispatch(
                  event.target.checked
                    ? { type: "acknowledge", at: new Date().toISOString() }
                    : { type: "decline" },
                )
              }
            />
            <label htmlFor="ack">
              {copy.disclosure.acknowledgeLabel}
              <br />
              <span className="onboarding__note">{copy.disclosure.storageNote}</span>
            </label>
          </div>
          <div className="onboarding__actions">
            <button
              type="button"
              className="btn btn--primary"
              disabled={!canContinue(state)}
              onClick={() => dispatch({ type: "next" })}
            >
              {copy.disclosure.primary}
            </button>
            <button type="button" className="btn" onClick={() => dispatch({ type: "back" })}>
              Back
            </button>
            <button type="button" className="btn" onClick={skip}>
              {copy.disclosure.secondary}
            </button>
          </div>
        </>
      ) : null}

      {state.step === "complete" ? (
        <>
          <h1 id="onboarding-heading" ref={headingRef} tabIndex={-1}>
            {copy.complete.title}
          </h1>
          <p>{copy.complete.body}</p>

          <div
            style={{
              marginTop: "1.25rem",
              marginBottom: "1.25rem",
              padding: "1rem",
              borderRadius: "0.75rem",
              border: "1px solid var(--color-border)",
              background: "var(--color-surface-raised)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "0.5rem",
              }}
            >
              <span
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  color: "var(--color-text)",
                }}
              >
                ✦ Sibyl Memory CLI Setup (2-Minute Walkthrough)
              </span>
              <a
                href="/docs/installation"
                style={{
                  fontSize: "0.75rem",
                  color: "var(--color-accent)",
                  textDecoration: "underline",
                }}
              >
                Full Docs &rarr;
              </a>
            </div>
            <p
              style={{
                fontSize: "0.75rem",
                color: "var(--color-text-muted)",
                marginBottom: "0.75rem",
                lineHeight: "1.4",
              }}
            >
              Connect Claude Code, Codex, Hermes, or Aura to persistent Sibyl memory:
            </p>
            <div
              style={{
                display: "grid",
                gap: "0.5rem",
                fontSize: "0.75rem",
                fontFamily: "var(--font-mono, monospace)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "0.375rem 0.5rem",
                  borderRadius: "0.375rem",
                  background: "var(--color-surface)",
                  border: "1px solid var(--color-border-subtle)",
                }}
              >
                <span style={{ color: "var(--color-accent)" }}>
                  1. pip install &apos;sibyl-memory-cli[mcp]&apos;
                </span>
                <button
                  type="button"
                  className="btn"
                  style={{
                    padding: "0.125rem 0.375rem",
                    fontSize: "0.7rem",
                    height: "auto",
                  }}
                  onClick={() =>
                    copyCommand("pip install 'sibyl-memory-cli[mcp]'", "cmd-install")
                  }
                >
                  {copiedCommand === "cmd-install" ? "Copied" : "Copy"}
                </button>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "0.375rem 0.5rem",
                  borderRadius: "0.375rem",
                  background: "var(--color-surface)",
                  border: "1px solid var(--color-border-subtle)",
                }}
              >
                <span style={{ color: "var(--color-accent)" }}>2. sibyl init</span>
                <button
                  type="button"
                  className="btn"
                  style={{
                    padding: "0.125rem 0.375rem",
                    fontSize: "0.7rem",
                    height: "auto",
                  }}
                  onClick={() => copyCommand("sibyl init", "cmd-init")}
                >
                  {copiedCommand === "cmd-init" ? "Copied" : "Copy"}
                </button>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "0.375rem 0.5rem",
                  borderRadius: "0.375rem",
                  background: "var(--color-surface)",
                  border: "1px solid var(--color-border-subtle)",
                }}
              >
                <span style={{ color: "var(--color-accent)" }}>3. sibyl setup</span>
                <button
                  type="button"
                  className="btn"
                  style={{
                    padding: "0.125rem 0.375rem",
                    fontSize: "0.7rem",
                    height: "auto",
                  }}
                  onClick={() => copyCommand("sibyl setup", "cmd-setup")}
                >
                  {copiedCommand === "cmd-setup" ? "Copied" : "Copy"}
                </button>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "0.375rem 0.5rem",
                  borderRadius: "0.375rem",
                  background: "var(--color-surface)",
                  border: "1px solid var(--color-border-subtle)",
                }}
              >
                <span style={{ color: "var(--color-text-muted)" }}>
                  4. &quot;remember that I like short, direct answers.&quot;
                </span>
                <button
                  type="button"
                  className="btn"
                  style={{
                    padding: "0.125rem 0.375rem",
                    fontSize: "0.7rem",
                    height: "auto",
                  }}
                  onClick={() =>
                    copyCommand(
                      "remember that I like short, direct answers.",
                      "cmd-test",
                    )
                  }
                >
                  {copiedCommand === "cmd-test" ? "Copied" : "Copy"}
                </button>
              </div>
            </div>
          </div>

          <div className="onboarding__actions">
            <button type="button" className="btn btn--primary" onClick={() => onFinish?.("run")}>
              {copy.complete.primary}
            </button>
            <button type="button" className="btn" onClick={() => onFinish?.("example")}>
              {copy.complete.secondary}
            </button>
          </div>
          <p className="onboarding__note">{copy.complete.exampleNote}</p>
        </>
      ) : null}
      </section>

      {/* Context, not decoration. It never asserts state the flow has not verified. */}
      <aside className="onboarding-aside" aria-label={copy.aside.heading}>
        <h2 className="onboarding-aside__heading">{copy.aside.heading}</h2>
        <ul className="onboarding-aside__list">
          {copy.aside.points.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
        <p className="onboarding__note">{copy.aside.footnote}</p>

        <div style={{ marginTop: "1.5rem", paddingTop: "1rem", borderTop: "1px solid var(--color-border)" }}>
          <span style={{ fontFamily: "var(--font-mono, monospace)", fontSize: "0.625rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--color-text-muted)", display: "block", marginBottom: "0.25rem" }}>
            TERMINAL WALKTHROUGH
          </span>
          <p style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", lineHeight: "1.4", marginBottom: "0.5rem" }}>
            Looking for CLI instructions? Install Sibyl Memory and connect your AI in two minutes.
          </p>
          <a
            href="/docs/installation"
            style={{ fontSize: "0.75rem", color: "var(--color-accent)", textDecoration: "underline", fontWeight: 500 }}
          >
            Open setup walkthrough &rarr;
          </a>
        </div>
      </aside>
    </div>
  );
}

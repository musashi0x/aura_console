"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";

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
  const headingRef = useRef<HTMLHeadingElement>(null);
  const restored = useRef(false);

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

  return (
    <section className="onboarding" aria-labelledby="onboarding-heading">
      <ol className="onboarding__steps">
        {STEP_LABELS.map((entry) => (
          <li
            key={entry.id}
            className="onboarding__step"
            aria-current={entry.id === state.step ? "step" : undefined}
          >
            {entry.label}
          </li>
        ))}
      </ol>

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
            {state.rows.map((row) => (
              <ReadinessRowItem key={row.id} row={row} onRetry={(id) => void check(id)} />
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
          <div className="ack">
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
  );
}

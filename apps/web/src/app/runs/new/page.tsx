import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Start a Run — Aura Console" };

/**
 * Placeholder. The New Run form and the Runs screen belong to the Console
 * shell (task #44) and the run skeleton (task #30). This exists so onboarding
 * hands off to a real destination instead of a dead button, and it says
 * plainly that the surface is not built rather than implying it works.
 */
export default function NewRunPlaceholder() {
  return (
    <main id="main">
      <h1>Start a Run</h1>
      <p className="subtitle">Not built yet.</p>
      <section className="card">
        <p>
          The New Run form is part of the Aura Console shell and the run skeleton, which
          are still in progress. Nothing has been created and no economic action has been
          taken.
        </p>
        <p className="detail">
          Tracked by task #44 (Console shell and replayable Run timeline) and task #30
          (run skeleton and replayable event shell).
        </p>
        <p>
          <Link href="/">Back to the Console</Link>
        </p>
      </section>
    </main>
  );
}

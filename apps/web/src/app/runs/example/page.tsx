import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Example Run — Aura Console" };

/**
 * Placeholder. The example Run replays the canonical Alpha and Beta fixture
 * through the same projection as a live Run, which does not exist yet. It is
 * labelled an example here for the same reason it will be later: it must never
 * be mistaken for live commerce.
 */
export default function ExampleRunPlaceholder() {
  return (
    <main id="main">
      <h1>Example Run</h1>
      <p className="subtitle">Not built yet. This is an example, not live commerce.</p>
      <section className="card">
        <p>
          The example Run replays the canonical fixture through the same projection as a
          real Run. That timeline is part of the Console shell and is still in progress.
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

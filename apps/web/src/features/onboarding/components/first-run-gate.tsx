"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";

import { hasAcknowledged, readProgress } from "../acknowledgement";
import { copy } from "../copy";

interface Progress {
  acknowledged: boolean;
  skipped: boolean;
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

// Cached so useSyncExternalStore sees a stable reference between reads.
let cachedRaw = "";
let cached: Progress = { acknowledged: true, skipped: true };

function getSnapshot(): Progress {
  const progress = readProgress();
  const raw = `${progress.acknowledgedAt ?? ""}|${progress.skippedAt ?? ""}`;
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cached = { acknowledged: hasAcknowledged(progress), skipped: progress.skippedAt !== null };
  }
  return cached;
}

// Storage is unreadable on the server. Assuming the operator has already been
// through onboarding is the safe default: it renders nothing rather than
// flashing a redirect that is about to be cancelled. The object is hoisted
// because useSyncExternalStore compares snapshots by reference and a fresh
// literal on every call is an infinite render loop.
const SERVER_SNAPSHOT: Progress = { acknowledged: true, skipped: true };
const getServerSnapshot = (): Progress => SERVER_SNAPSHOT;

/**
 * Sends a genuinely first-time operator to onboarding. Skipping is respected:
 * once skipped, this only offers the banner and never redirects again, so the
 * operator cannot be trapped in a loop they already opted out of.
 */
export function FirstRunGate() {
  const router = useRouter();
  const { acknowledged, skipped } = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );
  const [dismissed, setDismissed] = useState(false);

  const shouldRedirect = !acknowledged && !skipped;

  useEffect(() => {
    if (shouldRedirect) router.replace("/onboarding");
  }, [shouldRedirect, router]);

  if (shouldRedirect) {
    return (
      <p role="status" className="onboarding__note">
        Opening onboarding…
      </p>
    );
  }

  if (acknowledged || dismissed) return null;

  return (
    <aside className="banner" aria-label="Getting started">
      <span>{copy.banner.text}</span>
      <Link className="btn btn--primary" href="/onboarding">
        {copy.banner.action}
      </Link>
      <button type="button" className="btn" onClick={() => setDismissed(true)}>
        {copy.banner.dismiss}
      </button>
    </aside>
  );
}

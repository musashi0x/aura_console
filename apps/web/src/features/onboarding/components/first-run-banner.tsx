"use client";

import { useState, useSyncExternalStore } from "react";

import { hasAcknowledged, readProgress } from "../acknowledgement";
import { copy } from "../copy";

/** Another tab completing onboarding should settle this one too. */
function subscribe(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

const getSnapshot = (): boolean => hasAcknowledged(readProgress());

// Storage is unreadable while rendering on the server, and claiming the
// operator has acknowledged is the safe default: it shows nothing rather than
// flashing a banner that is about to disappear.
const getServerSnapshot = (): boolean => true;

/**
 * Offers onboarding to a browser that has not acknowledged the disclosure. It
 * never forces onboarding and never blocks anything the operator could
 * otherwise do.
 */
export function FirstRunBanner() {
  const acknowledged = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [dismissed, setDismissed] = useState(false);

  if (acknowledged || dismissed) return null;

  return (
    <aside className="banner" aria-label="Getting started">
      <span>{copy.banner.text}</span>
      <a className="btn btn--primary" href="/onboarding">
        {copy.banner.action}
      </a>
      <button type="button" className="btn" onClick={() => setDismissed(true)}>
        {copy.banner.dismiss}
      </button>
    </aside>
  );
}

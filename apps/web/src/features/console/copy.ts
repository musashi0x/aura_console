/**
 * Console copy. Kept out of layout components so the honesty boundary stays
 * reviewable in one file: nothing here may claim a Run, a spend, or a verified
 * state that the product cannot produce.
 */
export const console_ = {
  brand: "AURA CONSOLE",
  environment: "NON-MAINNET",
  status: {
    ready: "SYSTEM READY",
    degraded: "SYSTEM DEGRADED",
    checking: "CHECKING",
    /* The accessible name for the degraded badge, which links to the detail.
       "SYSTEM DEGRADED" alone tells a screen reader nothing about where the
       link goes. */
    degradedAction: "System degraded. See what failed on the readiness page.",
  },
  nav: {
    label: "Console",
    primary: [
      { href: "/runs", label: "Runs" },
      { href: "/counterparties", label: "Counterparties" },
      { href: "/policies", label: "Policies" },
    ],
    secondary: [
      { href: "/runs/example", label: "Example Run" },
      { href: "/system", label: "Readiness" },
    ],
    back: { href: "/", label: "Back to landing" },
  },
  empty: {
    // Nothing was queried, so this must not claim a verified empty list.
    title: "Runs cannot be listed yet",
    body: "A Run is one economic objective from start to finish: the evidence gathered, the decision made, any economic action, the outcome, and the memory it changed.",
    example: "Open example Run",
    create: "Start a new Run",
    unavailableNote: "Not yet available.",
  },
  loading: {
    label: "Checking readiness",
  },
  degraded: {
    title: "A dependency is unavailable",
    retry: "Retry",
    guidance: "The Console keeps working, but anything that needs this dependency will stay unavailable until it recovers.",
  },
  memoryUnavailable: {
    badge: "MEMORY UNAVAILABLE",
    body: "Private relationship memory was not available for this view.",
    note: "No historical conclusion was inferred.",
  },
  transport: {
    live: "LIVE",
    paused: "PAUSED",
    history: "HISTORY",
  },
} as const;

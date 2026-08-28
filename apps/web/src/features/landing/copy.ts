/**
 * Landing copy. Every claim here is true of the product as it exists, or is
 * plainly labelled a preview. No pricing, no testimonials, no invented users,
 * and no statement that a Run was created.
 *
 * Copy lives here rather than in layout components so the honesty boundary is
 * reviewable in one file.
 */
export const landing = {
  header: {
    brand: "AURA CONSOLE",
    example: "View example Run",
  },
  opening: {
    statement: "See what your agents decided — and why.",
    windowLabel: "Aura Console",
  },
  statement: {
    headline: ["A better way", "to understand agents."],
    body: "Follow evidence, decisions, outcomes, and memory changes as one replayable story.",
  },
  principles: [
    {
      index: "01",
      title: ["Trace every", "decision"],
      body: "Evidence, reasoning, outcome, and the memory it changed, in one causal timeline.",
    },
    {
      index: "02",
      title: ["Keep memory", "private"],
      body: "Private relationship memory stays private. Unavailable memory is never presented as history.",
    },
    {
      index: "03",
      title: ["Know what", "is ready"],
      body: "Readiness comes from verified dependencies, not assumptions hidden in configuration.",
    },
  ],
  console: {
    kicker: "THE CONSOLE",
    headline: ["One Run,", "start to finish."],
    label: "STATIC PREVIEW",
    runId: "RUN_7F3A2C",
    rows: [
      { key: "STATUS", value: "REPLAYABLE", tone: "ready" as const },
      { key: "MEMORY", value: "AVAILABLE", tone: "ready" as const },
      { key: "POLICY", value: "NOT CHECKED", tone: "neutral" as const },
    ],
    events: [
      { title: "Evidence collected", detail: "Discovery and prior episodes are gathered before anything is decided." },
      { title: "Decision context frozen", detail: "Inputs are fixed and hashed, so the decision can be replayed exactly." },
      { title: "Economic action boundary", detail: "Policy decides automatic, approval, or denied. This is where money could move." },
      { title: "Outcome recorded", detail: "Provider failure and infrastructure failure are separated, never merged." },
      { title: "Memory diff generated", detail: "Every changed field traces back to the evidence that changed it." },
    ],
    note: "Illustrative only. Not live data and not a Run.",
  },
  replay: {
    kicker: "REPLAY",
    headline: ["Pause it.", "Replay it.", "Understand it."],
    body: "Historical events stay ordered and labelled. Live state and recorded history are never shown as the same thing.",
    modes: [
      { key: "LIVE", value: "following the newest event" },
      { key: "PAUSED", value: "playhead held" },
      { key: "HISTORY", value: "labelled with its timestamp" },
    ],
    counterfactual: {
      title: "Memory changes the decision",
      available: {
        label: "MEMORY AVAILABLE",
        provider: "Beta Research",
        amount: "0.12 USDC",
        reason: "Alpha failed a relevant research job.",
        tone: "ready" as const,
      },
      unavailable: {
        label: "MEMORY UNAVAILABLE",
        provider: "No decision",
        amount: "—",
        reason: "Required memory could not be loaded, so nothing runs automatically.",
        tone: "warning" as const,
      },
      note: "The comparison is simulated. No second job was created or funded.",
    },
  },
  cta: {
    headline: ["Start with one Run.", "Understand the whole system."],
    primary: "Open example Run",
    secondary: "Start a new Run",
    note: "Nothing is created and no economic action runs.",
  },
  footer: {
    brand: "AURA CONSOLE",
    lines: ["NON-MAINNET DEMO", "NO ECONOMIC ACTION EXECUTED"],
  },
} as const;

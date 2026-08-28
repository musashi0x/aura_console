/**
 * Landing copy. Every claim here has to be true of the product as it exists,
 * or be plainly labelled as a preview. No pricing, no testimonials, no
 * invented users, and no statement that a Run was created.
 */
export const landing = {
  header: {
    brand: "AURA CONSOLE",
    example: "VIEW EXAMPLE RUN",
  },
  hero: {
    headline: ["See what your agents", "decided, and why."],
    sub: "Aura Console turns agent activity into an inspectable, replayable decision timeline.",
    primary: "Open example Run",
    secondary: "Explore the Console",
  },
  preview: {
    label: "STATIC PREVIEW",
    note: "Illustrative only. Not live data and not a Run.",
    runId: "RUN_7F3A2C",
    rows: [
      { key: "STATUS", value: "REPLAYABLE", tone: "ready" as const },
      { key: "MEMORY", value: "AVAILABLE", tone: "ready" as const },
      { key: "POLICY", value: "NOT CHECKED", tone: "neutral" as const },
    ],
    timeline: [
      "Evidence collected",
      "Decision context frozen",
      "Economic action boundary",
      "Outcome recorded",
      "Memory diff generated",
    ],
  },
  capabilities: [
    {
      index: "01",
      kicker: "TRACE THE DECISION",
      headline: ["Every important decision", "leaves a trail."],
      body: "Follow evidence, reasoning, outcomes, and memory changes in one causal timeline.",
      points: [
        { key: "EVIDENCE", value: "evt_07 · discovery" },
        { key: "CONTEXT", value: "ctx_123 · frozen" },
        { key: "DECISION", value: "dec_88 · recorded" },
      ],
    },
    {
      index: "02",
      kicker: "KEEP MEMORY PRIVATE",
      headline: ["Useful memory.", "Clear boundaries."],
      body: "Private relationship memory stays private. Unavailable memory is never presented as history.",
      points: [
        { key: "EPISODES", value: "private, never projected" },
        { key: "COMMITMENT", value: "salted hash only" },
        { key: "UNAVAILABLE", value: "shown as unavailable" },
      ],
    },
    {
      index: "03",
      kicker: "KNOW WHAT IS READY",
      headline: ["The console tells you", "what it actually knows."],
      body: "Readiness is based on verified dependencies, not assumptions hidden in configuration.",
      points: [
        { key: "API REACHABILITY", value: "VERIFIED" },
        { key: "DATABASE", value: "VERIFIED" },
        { key: "OPERATOR POLICY", value: "NOT CHECKED" },
        { key: "AGENT IDENTITY", value: "NOT CHECKED" },
      ],
    },
  ],
  replay: {
    index: "04",
    kicker: "PAUSE AND REPLAY",
    headline: ["Pause it.", "Replay it.", "Understand it."],
    body: "Historical events stay ordered and labelled. Live state and recorded history are never shown as the same thing.",
    states: [
      { key: "LIVE", value: "following the newest event" },
      { key: "PAUSED", value: "playhead held" },
      { key: "HISTORY", value: "labelled with its timestamp" },
    ],
  },
  cta: {
    headline: ["Start with one Run.", "Understand the whole system."],
    primary: "Start a new Run",
    secondary: "Open example Run",
    note: "Opening either takes you to the Console. Nothing is created and no economic action runs.",
  },
  footer: {
    brand: "AURA CONSOLE",
    lines: ["NON-MAINNET DEMO", "NO ECONOMIC ACTION EXECUTED"],
  },
} as const;

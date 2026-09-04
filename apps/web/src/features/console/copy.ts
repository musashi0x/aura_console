/**
 * Console copy. Kept out of layout components so the honesty boundary stays
 * reviewable in one file: nothing here may claim a Run, a spend, or a verified
 * state that the product cannot produce.
 */
export const console_ = {
  brand: "AURA CONSOLE",
  /* Names the context bar as its own landmark. AppShell renders the top and
     side navigation as two separate landmarks, and a screen reader lists them
     by name, so an unnamed one reads as a bare "navigation". */
  topNavLabel: "Console context",
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
    /* Missions, Agents, Network, Guardrails, Docs.
     *
     * These are the operator's words for the same routes. `Run` stays the
     * system word — it is the event stream's own vocabulary (`run_id`,
     * `(run_id, sequence)`, `RunStatus`) and renaming a projection concept to
     * change a label on screen is the mistake this avoids. `Mission` is what
     * the operator reads; one Mission is one Run.
     *
     * `Chat` is not here. A rail item called Chat implies a place to go and
     * talk to an assistant that is not doing the work; conversation is the
     * default mode INSIDE a Mission.
     *
     * `Example Run`, `Readiness` and `Back to landing` are not here either: the
     * example Mission belongs in Missions, readiness belongs to Network and the
     * status chip, and the landing page is reachable from the brand mark.
     *
     * No Settings and no user menu. With no account model behind them they
     * would be navigation that opens nothing. */
    primary: [
      { href: "/runs", label: "Missions" },
      { href: "/counterparties", label: "Agents" },
      { href: "/system", label: "Network" },
      { href: "/policies", label: "Guardrails" },
      { href: "/docs", label: "Docs" },
    ],
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
  /* Chat copy. The panel may never answer on the agent's behalf, so there is no
     canned reply here: every string below either labels the surface or states a
     condition the console actually observed. */
  chat: {
    title: "Ask the agent",
    lede: "Questions are answered from the Run's own evidence and the agent's relationship memory.",
    scopeLabel: "Scoped to Run",
    noScope: "No Run selected. Open a Run to ask about it.",
    placeholder: "Why was this counterparty chosen?",
    connecting: "CONNECTING",
    /* The agent surface has no endpoint behind it yet. Saying "unavailable" is
       the whole point: a placeholder answer here would be the console inventing
       agent reasoning, which is the failure this product exists to prevent. */
    /* A statement about wiring, not about a lookup. The console has not asked
       Sibyl anything, so it must not report what an answer would have been. */
    groundingBadge: "GROUNDING NOT CONNECTED",
    groundingBody:
      "Answers are grounded in Sibyl relationship memory retrieval, which has no endpoint in this console yet.",
    groundingNote:
      "No question can be answered here until it does, and nothing will be inferred without it.",
    memoryOff:
      "Memory is switched off in the command palette, so an answer would not use it even once retrieval is connected.",
    unavailableBadge: "AGENT UNAVAILABLE",
    unavailableBody:
      "The agent answer stream is not reachable, so no reply was produced.",
    unavailableNote: "Nothing was inferred on the agent's behalf.",
    disconnected:
      "The answer stream dropped before the reply finished. Reconnecting.",
    readOnly: "Read-only. Asking here cannot start or approve an economic action.",
    /* The sources rail. It lists the memory records an answer actually cited —
       never a catalogue of what might exist, which would imply a retrieval the
       console has not performed. */
    sourcesTitle: "Cited evidence",
    you: "Operator",
    agent: "Agent",
    consoleRole: "Console",
    /* Reported after a command ran, in the past tense and describing only what
       happened. The chat may drive the console; it may never narrate an
       outcome it did not observe. */
    did: {
      navigated: (surface: string) => `Opened ${surface}.`,
      memory: (on: boolean) =>
        on
          ? "Memory view is on. The spine shows every record the Run used."
          : "Memory view is off. Memory-derived evidence is hidden from the spine; nothing was re-run.",
      /* The one thing the console can do about a question today. */
      cannotAnswer:
        "That is a question, not a console command. Answering it needs the agent's memory retrieval, which is not connected here yet.",
    },
    /* The zero state: the moment before any question has been asked. It offers
       the things that actually work here, so an empty surface is not a dead
       end. No greeting by name — the console has no account and does not know
       who is reading it. */
    zero: {
      title: "What do you want to know?",
      lede: "The chat runs console commands, and answers about a Run once the agent's memory retrieval is connected.",
      worksLabel: "These run now",
      needsAgentLabel: "This needs the agent",
      needsAgentNote:
        "It will be answered from the Run's own evidence once retrieval is wired. Until then the console says so rather than inventing a reply.",
    },
    /* The dock. Chat is reachable from every console surface, not only a Run. */
    dock: {
      open: "Ask the agent",
      close: "Close chat",
      label: "Agent chat",
      commandsTitle: "What the chat can do here",
      commandsNote:
        "Navigation and views only, the same set the command palette runs. Nothing here starts, approves, or pays for anything.",
    },
  },
  /* The five-stage causal spine (#68). Each explanation says what the stage
     means, never what the Console expects to happen next: a node that
     pre-announced an economic action would be predicting spend. */
  spine: {
    title: "Causal spine",
    stages: {
      EVIDENCE: {
        label: "Evidence",
        explanation: "What the agent gathered and could verify before it decided.",
      },
      DECISION: {
        label: "Decision",
        explanation: "The policy evaluation and the choice that policy permitted.",
      },
      ECONOMIC_ACTION: {
        label: "Economic action",
        explanation: "Value committed or moved, exactly as the Run's events report it.",
      },
      OUTCOME: {
        label: "Outcome",
        explanation: "What was delivered, and how the agent evaluated it.",
      },
      MEMORY_DIFF: {
        label: "Memory diff",
        explanation: "What this Run changed in the agent's private relationship memory.",
      },
    },
    /* The rail carries the shape of the whole spine so the reader can see
       where the Mission stopped, now that an unreached stage renders no card.
       "Not reached" reports the Run, not a prediction: "Pending" would promise
       a stage that a blocked or cancelled Run will never have. */
    rail: {
      label: "Stages",
      reached: (label: string) => `${label}: reached`,
      notReached: (label: string) => `${label}: not reached`,
    },
    inspect: (label: string) => `Inspect ${label}`,
    events: (n: number) => `${n} ${n === 1 ? "event" : "events"}`,
    hidden: (n: number) =>
      `${n} memory ${n === 1 ? "event is" : "events are"} hidden by the Memory Off view.`,
    offSpine: "Lifecycle events",
    offSpineNote: "These belong to no stage in the decision story, and are listed so nothing is dropped.",
  },
  drawer: {
    title: "Evidence",
    close: "Close evidence",
    emptyStage: "Nothing has been recorded for this stage.",
    provenance: "Provenance",
    envelope: "Decision context",
    envelopeNote: "The redacted envelope. The frozen context itself never leaves the server.",
    noEnvelope: "No decision context has been built in this Run yet.",
  },
  /* Memory Off is a VIEW. It hides memory-derived evidence so the operator can
     see what a decision rested on. It never re-runs and never re-decides, so
     the label may not say "counterfactual result". */
  memoryView: {
    on: "Memory: On",
    off: "Memory: Off (view)",
    banner: "Memory Off view. Memory-derived evidence is hidden; nothing was re-run and no decision was recomputed.",
  },
  palette: {
    label: "Command palette",
    open: "Open command palette",
    placeholder: "Search commands",
    empty: "No command matches.",
    close: "Close",
    /* The palette is navigation and views only. Saying so where the operator
       reads it is cheaper than making them find out. */
    readOnly: "Navigation and views only. Nothing here starts, approves, or pays for anything.",
    /* Only the keys the palette binds. Anything listed here that does not
       work is a control that lies, the same as a dead button. */
    keys: {
      navigate: "Move",
      select: "Run",
      close: "Close",
    },
    groupNavigate: "Go to",
    groupView: "View",
    commands: {
      runs: "Go to Runs",
      newRun: "Start a Run",
      example: "Open example Run",
      system: "Inspect system health",
      policies: "Go to Policies",
      counterparties: "Go to Counterparties",
      memoryToggle: "Toggle Memory On/Off view",
    },
  },
} as const;

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
      { href: "/runs/new", label: "New Mission" },
      { href: "/ai-chat", label: "Chat Console" },
      { href: "/counterparties", label: "Agents" },
      { href: "/policies", label: "Guardrails" },
      { href: "/system", label: "Network" },
      { href: "/docs", label: "Docs" },
    ],
  },
  agents: {
    title: "Agents",
    lede: "Agents Aura has dealt with, and what its own relationship memory holds about each one. This is the operator's first-party view; nothing here is a counterparty's view of itself.",
    /* Sibyl knows the name but holds no profile. Listed rather than hidden: an
       entity we cannot read a profile from is a real thing to know about, and
       dropping it would make the list claim a completeness it does not have. */
    noProfile: "No relationship profile yet",
    fields: {
      status: "Relationship",
      version: "Memory version",
      episodes: "Episodes used",
      reliability: "Overall reliability",
      taskFit: "Task fit",
      confidence: "Confidence",
    },
    updated: (at: string) => `Sibyl last updated this ${at}.`,
    /* Sibyl marks these records as fixtures. Seeded memory that read as lived
       history would be the most damaging thing this surface could do: it is
       the evidence an operator uses to decide whether to trust a counterparty
       with money. */
    fixtureBadge: "DEMO",
    fixtureNote: "Sibyl marks this record as fixture data. It is not a relationship Aura has actually had.",
    episodesTitle: "What Aura remembers",
    noEpisodes: "No episodes recorded against this counterparty.",
    price: "Observed price",
    risk: "Risk note",
    /* The store holds ratios in one record and whole numbers in another, so the
       value is shown exactly as Sibyl stored it. A percent sign here would
       assert a scale nothing measured. */
    scoreNote: "Scores are shown exactly as Sibyl stored them.",
    /* An empty list is only sayable once Sibyl has answered. */
    empty: "Sibyl answered, and holds no relationship memory yet.",
    emptyNote: "A Mission that deals with a counterparty writes the first record.",
  },
  missions: {
    title: "Missions",
    /* The example Mission sits in this list rather than in a rail item of its
       own, so the badge is what stops it reading as a Run that happened. */
    demoBadge: "DEMO",
  },
  empty: {
    /* This state is reached ONLY after the API answered with an empty list, so
       it may say there are none. The old wording — "Runs cannot be listed yet"
       — was written when nothing was queried, and kept claiming we could not
       look long after we could. "We could not look" now belongs to the error
       state, which is the branch that actually knows it. */
    title: "No Missions yet",
    body: "A Mission is one economic objective from start to finish: the evidence gathered, the decision made, any economic action, the outcome, and the memory it changed.",
    example: "Open the demo Mission",
    create: "Start a Mission",
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
    /* Never checked is its own state. Reporting it as connected would be a
       guess, and reporting it as disconnected would be one too. */
    groundingUnchecked:
      "The console has not checked whether the agent and its memory are reachable, so it cannot say whether an answer here would be grounded.",
    /* The boundary, stated so it cannot be read as "nothing here works".
       Console commands run on every surface whether or not the answering path
       is up; it is QUESTIONS that need grounding. Without this line the banner
       reads as a dead panel, and an operator stops typing. */
    groundingNote:
      "Console commands still run. It is questions that need grounding, and nothing will be inferred without it.",
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
  cards: {
    /* One label per card, so the wording of a claim about money is reviewed in
       this file rather than scattered across components. */
    decision: { title: "Decision", chose: "Chose", mode: "Authorization", reasons: "Why" },
    policy: { title: "Policy gate", rule: "Rule", result: "Result", passed: "PASSED", failed: "FAILED" },
    approval: {
      title: "Approval",
      granted: "Approved by the operator",
      /* The console never approves. There is no control here, because the
         only path to an economic action is an operator's own click and this
         card reports one that already happened. */
      ceiling: "Ceiling",
      note: "Recorded from the Run's events. This card approves nothing.",
      /* The pending request — the one card in the console that carries a
         control which changes the world. Every string here names what the
         click authorizes, because an approval whose wording is vague is an
         approval the operator did not really give. */
      pending: {
        title: "Approval needed",
        lede: "Nothing settles until you approve this.",
        action: "Action",
        counterparty: "Counterparty",
        ceilingLabel: "Maximum spend",
        approve: "Approve",
        approving: "Approving…",
        /* Said next to the button, not buried in a tooltip. */
        note: "Approving records your authorization against this Mission. It is non-mainnet and moves no real funds.",
        failed: "The approval was not recorded, so nothing was authorized.",
        missingCeiling: "This request carries no ceiling, so there is nothing to approve against.",
      },
    },
    counterfactual: {
      open: "Compare without memory",
      close: "Hide the comparison",
      withMemory: "With Sibyl",
      withoutMemory: "Without previous memory",
      whatChanged: "What changed",
      /* Only rendered when the winner actually moves. Everywhere else this
         product says memory was consulted, never that it decided. */
      changed: "Memory changed this decision.",
      unchanged: "Memory checked, recommendation unchanged.",
      simulated: "Simulated from the evidence this Mission recorded. It re-runs nothing and authorizes nothing.",
    },
    job: { title: "Agent job", provider: "Provider", amount: "Amount", state: "State" },
    transaction: { title: "Transaction", network: "Network", amount: "Amount", reference: "Reference" },
    outcome: { title: "Outcome", result: "Result", evaluator: "Evaluated by", failure: "Failure" },
    memory: {
      title: "Memory",
      /* Retrieval state, in the operator's language. The five RetrievalStatus
         values are unchanged; only the wording is, and none of these claims
         that memory changed a decision — that needs a counterfactual. */
      status: {
        NOT_REQUESTED: "Memory has not been consulted for this step yet",
        LOADING: "Checking memory",
        NO_HISTORY: "No previous relationship found",
        AVAILABLE: "Memory was consulted",
        ERROR: "Memory unavailable, historical risk unknown",
      },
      counterparty: "Counterparty",
      episodes: "Episodes used",
      version: "Memory version",
    },
    /* An event type with no card yet. Shown exactly as recorded rather than
       dropped or paraphrased — the treatment an unrecognised type already
       gets, for the same reason. */
    raw: { note: "No card reads this event type yet. Shown as recorded." },
    unknownValue: "—",
  },
  mission: {
    /* "Mission" is the operator's word for a Run. `Run` stays the system word
       everywhere in code — run_id, (run_id, sequence), RunStatus, POST
       /api/runs — for the same reason LIVE stays the projection's mode name
       under the LATEST SNAPSHOT label: renaming a projection concept to fix a
       word on screen introduces a second vocabulary and, eventually, a second
       identifier. */
    modeLabel: "Mission view",
    modes: {
      OPERATOR: "Operator",
      BOARD: "Board",
      TRACE: "Trace",
    },
    rail: {
      label: "Mission progress",
      steps: {
        UNDERSTAND: "Understand",
        REMEMBER: "Remember",
        DECIDE: "Decide",
        ACT: "Act",
        VERIFY: "Verify",
        LEARN: "Learn",
      },
      reached: (label: string) => `${label}: reached`,
      notReached: (label: string) => `${label}: not reached`,
      jump: (label: string) => `Go to ${label}`,
    },
    board: {
      label: "Mission board",
      columns: {
        QUEUED: "Queued",
        RUNNING: "Running",
        NEEDS_YOU: "Needs you",
        DONE: "Done",
      },
      /* Board is another projection of the same events, not a task tracker. It
         never gains a card an event did not create, so an empty column says so
         plainly rather than offering somewhere to add one. */
      emptyColumn: "Nothing here",
      count: (n: number) => `${n} ${n === 1 ? "step" : "steps"}`,
      note: "The same events as Operator and Trace, grouped by what they are waiting on.",
    },
    operator: {
      label: "Conversation",
      /* A Mission with no events shows the composer and a prompt, not six
         empty stage cards. */
      emptyTitle: "What should Aura accomplish?",
      emptyBody: "Nothing has happened in this Mission yet. Ask in the chat to direct it.",
      /* Until the event-to-card renderer exists, every event renders as an
         inspectable raw entry — the treatment an unrecognised type already
         gets. That is deliberately a placeholder for cards, not for facts: it
         shows exactly what the event said and adds nothing. */
      rawNote: "Each event as recorded. Cards that read these are not built yet.",
      scrubTo: (summary: string) => `Show the Mission as of ${summary}`,
    },
    /* Memory read as causal information, in the operator's language.
       `Memory: NOT_REQUESTED` is correct and product-dead.
       The five RetrievalStatus values are unchanged; only the wording is.
       NO_HISTORY and ERROR never collapse into each other, and unavailable
       memory is never treated as history.

       AVAILABLE deliberately stops at "was consulted". The doc's stronger
       lines — "Memory changed this decision" and "recommendation unchanged" —
       are both claims about a counterfactual, and the counterfactual is not
       built (step 10, blocked on tracker #32). Picking either one without it
       would be inventing the most persuasive sentence in the product. */
    memory: {
      NOT_REQUESTED: "Memory has not been consulted for this step yet",
      LOADING: "Checking memory",
      NO_HISTORY: "No previous relationship found",
      AVAILABLE: "Memory was consulted for this Mission",
      ERROR: "Memory unavailable, historical risk unknown",
    },
    trace: {
      label: "Trace",
      note: "Raw lifecycle events, the ten-stage spine, and the transport that carried them.",
      connectionTitle: "Connection",
      /* The strip reports the real transport. There is no stream, so it may
         never say "live events connected". */
      events: (n: number) => `${n} ${n === 1 ? "event" : "events"}`,
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
    /* The operator's words, the same ones the rail uses. The palette still
       said Runs, Counterparties and Policies after the rail became Missions,
       Agents and Guardrails, so the two halves of the console named the same
       four routes differently. What someone TYPES is unchanged: the aliases
       still accept "runs", "policies" and "counterparties", because a rename
       that breaks the words already in someone's fingers is not a rename, it
       is a removal. */
    commands: {
      runs: "Go to Missions",
      newRun: "Start a Mission",
      example: "Open the demo Mission",
      system: "Inspect Network readiness",
      policies: "Go to Guardrails",
      counterparties: "Go to Agents",
      memoryToggle: "Toggle Memory On/Off view",
    },
  },
} as const;

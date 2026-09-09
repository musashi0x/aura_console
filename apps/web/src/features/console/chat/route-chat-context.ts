export interface ActiveEntityContext {
  key: string;
  label: string;
  status: "PREFERRED" | "WATCH" | "KNOWN" | "EVALUATING" | "BLOCKED";
  score: string;
  note: string;
}

export interface RoutePromptSuggestion {
  id: string;
  label: string;
  prompt: string;
  tier: string;
  description: string;
}

export interface RouteSuggestionGroup {
  title: string;
  description?: string;
  suggestions: RoutePromptSuggestion[];
}

export interface RouteChatContext {
  surfaceId: "counterparties" | "runs" | "policies" | "system" | "docs" | "chat" | "boost" | "general";
  surfaceTitle: string;
  scopeLabel: string;
  activeSummary: string;
  badge: string;
  groundingDescription: string;
  entities?: ActiveEntityContext[];
  suggestionGroups: RouteSuggestionGroup[];
}

export const ACTIVE_COUNTERPARTIES: ActiveEntityContext[] = [
  {
    key: "virtuals:agent:alpha",
    label: "Alpha Research (Alpha)",
    status: "WATCH",
    score: "42%",
    note: "SLA breach in Run #98 (41h late): -11 penalty inside 30-day window",
  },
  {
    key: "virtuals:agent:beta",
    label: "Agent Beta",
    status: "PREFERRED",
    score: "94%",
    note: "14 verified episodes, 0 failures, unblemished delivery track record",
  },
  {
    key: "base:agent:charlie",
    label: "Charlie Compute (Charlie)",
    status: "EVALUATING",
    score: "78%",
    note: "Base L2 compute worker node, 8 recorded episodes",
  },
];

const COUNTERPARTIES_SUGGESTIONS: RoutePromptSuggestion[] = [
  {
    id: "audit-beta-prior",
    label: "Audit counterparty Beta's Bayesian prior",
    prompt: "Audit counterparty Beta's Bayesian prior",
    tier: "BAYESIAN PRIOR",
    description: "Inspect Beta(α=14, β=1) distribution, 95% credible interval, and 14 verified episodes",
  },
  {
    id: "why-alpha-penalized",
    label: "Why was Alpha penalized?",
    prompt: "Why was Alpha penalized?",
    tier: "PENALTY AUDIT",
    description: "Inspect 41h late SLA breach in Run #98 and -11 point composite score penalty",
  },
  {
    id: "compare-alpha-beta",
    label: "Compare Alpha vs Beta risk score",
    prompt: "Compare Alpha vs Beta risk score",
    tier: "HEAD-TO-HEAD",
    description: "Side-by-side comparison of Bayesian reliability (42% vs 94%), task fit, and decision flips",
  },
  {
    id: "simulate-preferred-transition",
    label: "Simulate counterparty transition to PREFERRED",
    prompt: "Simulate counterparty transition to PREFERRED",
    tier: "REPUTATION SIM",
    description: "Simulate trajectory from WATCH to PREFERRED: 5 consecutive verified runs and penalty window decay",
  },
  {
    id: "audit-charlie",
    label: "Audit Charlie's cold journal",
    prompt: "Audit Charlie's cold journal",
    tier: "COLD JOURNAL",
    description: "Query base:agent:charlie compute node verified episodes and Base L2 settlement",
  },
  {
    id: "recall-counterparty-inventory",
    label: "Inventory all counterparty memory",
    prompt: "Recall what Sibyl memory knows about virtuals:agent:beta",
    tier: "WARM RECALL",
    description: "Full inventory of active agents in Sibyl WARM tier with Bayesian reliability scores",
  },
];

const RUNS_SUGGESTIONS: RoutePromptSuggestion[] = [
  {
    id: "explain-mission-steps",
    label: "Explain mission running steps",
    prompt: "Explain the recorded execution steps of this mission so far, including memory recall, candidate scoring, and the chosen counterparty.",
    tier: "RUN PIPELINE",
    description: "Walk through causal execution spine: budget ceiling, Sibyl reputation queries, and candidate ranking",
  },
  {
    id: "why-chosen",
    label: "Why was this counterparty chosen?",
    prompt: "Why was this counterparty chosen for this mission based on Sibyl relationship memory?",
    tier: "DECISION REASONING",
    description: "Inspect Bayesian composite scores, reliability ratings, and past delivery episodes",
  },
  {
    id: "trace-sibyl-memory",
    label: "Trace Sibyl memory & load-bearing proof",
    prompt: "Trace the exact Sibyl Memory event IDs, queried counterparties, WARM and COLD storage tiers, and prove why memory was load-bearing for this mission.",
    tier: "SIBYL GATE (40/40)",
    description: "Inspect canonical event IDs, WARM/COLD tiers, Bayesian score adjustments, and load-bearing deletion proof",
  },
  {
    id: "verify-base-commitment",
    label: "Verify Base Sepolia Keccak256 hash",
    prompt: "Verify on-chain memory commitment for virtuals:agent:beta on Base Sepolia",
    tier: "BASE SEPOLIA",
    description: "Recompute Keccak256(canonical || salt) against Base Sepolia calldata",
  },
  {
    id: "inspect-decision-flips",
    label: "Inspect decision flips & counterfactuals",
    prompt: "Explain counterfactual candidate decision flips between Alpha and Beta",
    tier: "DECISION FLIPS",
    description: "Analyze how memory penalties flipped selection from Alpha to Beta under guardrails",
  },
];

const POLICIES_SUGGESTIONS: RoutePromptSuggestion[] = [
  {
    id: "audit-spend-ceilings",
    label: "Audit spend ceiling invariants",
    prompt: "Audit active guardrail spend ceilings and auto-spend invariants",
    tier: "SPEND CEILINGS",
    description: "Inspect 10.00 USDC auto-spend limit and 25.00 USDC operator approval boundary",
  },
  {
    id: "explain-fail-closed",
    label: "Explain fail-closed guardrail policy",
    prompt: "Explain the fail-closed policy when memory is unreachable or candidate reliability is below 65%",
    tier: "FAIL-CLOSED",
    description: "Verify how missing memory and low-reliability candidates are blocked by default",
  },
  {
    id: "simulate-spend-breach",
    label: "Simulate auto-spend breach (50 USDC)",
    prompt: "Simulate an approval proposal for 50 USDC with virtuals:agent:beta exceeding spend limit",
    tier: "BREACH SIM",
    description: "Test how policy halts execution and routes spend to operator authorization",
  },
  {
    id: "inspect-reliability-threshold",
    label: "Inspect minimum reliability requirement",
    prompt: "What is the minimum counterparty reliability threshold required for autonomous execution?",
    tier: "REPUTATION GATE",
    description: "Review policy rules requiring candidate reliability score ≥ 65%",
  },
];

const SYSTEM_SUGGESTIONS: RoutePromptSuggestion[] = [
  {
    id: "audit-system-health",
    label: "Audit multi-node infrastructure health",
    prompt: "Perform a full system readiness check across Postgres, Sibyl memory, and ADK agent",
    tier: "NODE HEALTH",
    description: "Query multi-runtime database latency, memory bridge state, and agent health",
  },
  {
    id: "inspect-sqlite-store",
    label: "Inspect SQLite WARM/COLD memory store",
    prompt: "Inspect the Sibyl SQLite memory file size, soft cap limit, and FTS5 indexing",
    tier: "SQLITE STORE",
    description: "Audit SQLite memory storage metrics, soft cap limits, and query latency",
  },
  {
    id: "test-base-rpc",
    label: "Test Base Sepolia L2 RPC connectivity",
    prompt: "Verify on-chain memory commitment for virtuals:agent:alpha on Base Sepolia",
    tier: "BASE L2 RPC",
    description: "Check Base Sepolia block height, RPC responsiveness, and commitment contracts",
  },
  {
    id: "check-virtuals-acp",
    label: "Check Virtuals ACP bridge status",
    prompt: "Check Virtuals ACP and agent runtime connectivity",
    tier: "ACP PROTOCOL",
    description: "Inspect Agent Communication Protocol bridge status and signing key readiness",
  },
];

const DOCS_SUGGESTIONS: RoutePromptSuggestion[] = [
  {
    id: "walkthrough-setup",
    label: "Walkthrough Aura memory setup & SDK",
    prompt: "How do I install and configure the Aura memory SDK and Sibyl bridge?",
    tier: "SDK SETUP",
    description: "Step-by-step developer walkthrough for configuring @aura/memory and Python bridge",
  },
  {
    id: "how-bayesian-works",
    label: "How does Bayesian scoring work in Sibyl?",
    prompt: "Explain the mathematical formulas for Bayesian reliability scoring in Sibyl memory",
    tier: "SCORING MATH",
    description: "Beta distribution priors, Laplace smoothing, and rolling 30-day penalty decay",
  },
  {
    id: "explain-5-tiers",
    label: "Explain 5-Tier Sibyl memory architecture",
    prompt: "Explain the 5 tiers of Sibyl Labs memory architecture from HOT to ARCHIVE",
    tier: "5 TIERS",
    description: "Detailed overview of HOT, WARM SQLite, COLD journal, REFERENCE, and ARCHIVE",
  },
  {
    id: "how-commitments-verified",
    label: "How are on-chain commitments verified?",
    prompt: "How does Base Sepolia salted Keccak256 commitment verification work?",
    tier: "BASE SEPOLIA",
    description: "Cryptographic salt hashing, transaction calldata matching, and tamper proofs",
  },
];

export function getRouteChatContext(
  surface?: string,
  pathname?: string,
  runId?: string,
): RouteChatContext {
  const normSurface = surface?.toLowerCase().trim() ?? "";
  const normPath = pathname?.toLowerCase().trim() ?? "";

  // 1. Counterparties / Agents surface
  if (
    normPath.startsWith("/counterparties") ||
    normSurface.includes("agent") ||
    normSurface.includes("counterpart")
  ) {
    return {
      surfaceId: "counterparties",
      surfaceTitle: "Agents & Counterparties",
      scopeLabel: "COUNTERPARTIES & AGENTS",
      activeSummary: "Active Registry (Alpha, Beta, Charlie)",
      badge: "WARM TIER · FTS5",
      groundingDescription:
        "Grounded in Sibyl 5-Tier Memory, Bayesian reliability priors, and verified episode records.",
      entities: ACTIVE_COUNTERPARTIES,
      suggestionGroups: [
        {
          title: "Counterparty Reputation & Bayesian Priors",
          description: "Audit agent priors, risk penalties, score comparisons, and state transitions",
          suggestions: COUNTERPARTIES_SUGGESTIONS,
        },
      ],
    };
  }

  // 2. Runs / Missions surface
  if (
    runId ||
    normPath.startsWith("/runs") ||
    normSurface.includes("mission") ||
    normSurface.includes("run")
  ) {
    const isSpecificRun = Boolean(runId);
    return {
      surfaceId: "runs",
      surfaceTitle: isSpecificRun ? `Mission ${runId}` : "Missions",
      scopeLabel: isSpecificRun ? "MISSION RUN" : "MISSION TELEMETRY",
      activeSummary: isSpecificRun ? `Run ${runId}` : "Mission Execution History",
      badge: "CAUSAL SPINE · 40/40",
      groundingDescription:
        "Grounded in canonical event log, load-bearing memory traces, and Keccak256 proof calldata.",
      suggestionGroups: [
        {
          title: "Mission Telemetry & Memory Proofs",
          description: "Explain causal execution spine, candidate ranking, and on-chain proofs",
          suggestions: RUNS_SUGGESTIONS,
        },
      ],
    };
  }

  // 3. Policies / Guardrails surface
  if (
    normPath.startsWith("/policies") ||
    normSurface.includes("guardrail") ||
    normSurface.includes("polic")
  ) {
    return {
      surfaceId: "policies",
      surfaceTitle: "Guardrails & Policies",
      scopeLabel: "GUARDRAILS & POLICIES",
      activeSummary: "Auto-Spend: $10.00 USDC · Approval: $25.00 USDC",
      badge: "FAIL-CLOSED · HITL",
      groundingDescription:
        "Grounded in PolicyStore invariants, spend ceiling boundaries, and fail-closed gatekeeping.",
      suggestionGroups: [
        {
          title: "Guardrails & Policy Invariants",
          description: "Inspect auto-spend boundaries, human approval gates, and reliability thresholds",
          suggestions: POLICIES_SUGGESTIONS,
        },
      ],
    };
  }

  // 4. System / Readiness surface
  if (
    normPath.startsWith("/system") ||
    normSurface.includes("system") ||
    normSurface.includes("readiness") ||
    normSurface.includes("network")
  ) {
    return {
      surfaceId: "system",
      surfaceTitle: "Network Readiness",
      scopeLabel: "NETWORK READINESS",
      activeSummary: "Postgres · SQLite WARM/COLD · Base Sepolia",
      badge: "MULTI-RUNTIME · L2",
      groundingDescription:
        "Grounded in multi-runtime telemetry, SQLite storage metrics, and Base Sepolia L2 RPC status.",
      suggestionGroups: [
        {
          title: "Infrastructure & Network Telemetry",
          description: "Audit multi-node health, SQLite memory metrics, and Base Sepolia RPC",
          suggestions: SYSTEM_SUGGESTIONS,
        },
      ],
    };
  }

  // 5. Documentation surface
  if (normPath.startsWith("/docs") || normSurface.includes("doc")) {
    return {
      surfaceId: "docs",
      surfaceTitle: "Documentation",
      scopeLabel: "DOCUMENTATION",
      activeSummary: "Aura Memory Protocol & SDK Specification",
      badge: "SIBYL 5-TIER PROTOCOL",
      groundingDescription:
        "Grounded in technical documentation, SDK guides, and cryptographic protocol specs.",
      suggestionGroups: [
        {
          title: "Documentation & Architecture Walkthroughs",
          description: "Setup walkthroughs, Bayesian formulas, 5-tier architecture, and proofs",
          suggestions: DOCS_SUGGESTIONS,
        },
      ],
    };
  }

  // 6. Chat Console surface
  if (
    normPath.startsWith("/chat") ||
    normPath.startsWith("/ai-chat") ||
    normSurface.includes("chat")
  ) {
    return {
      surfaceId: "chat",
      surfaceTitle: "Assistant Console",
      scopeLabel: "ASSISTANT CONSOLE",
      activeSummary: "Universal Operator Interface & Tool Runtime",
      badge: "UNIVERSAL MCP",
      groundingDescription:
        "Universal autonomous agent interface connected to Postgres, Sibyl 5-Tier Memory, and Base Sepolia.",
      suggestionGroups: [
        {
          title: "Agent Capabilities & Multi-Route Intelligence",
          suggestions: [
            ...COUNTERPARTIES_SUGGESTIONS.slice(0, 2),
            ...RUNS_SUGGESTIONS.slice(0, 2),
            ...POLICIES_SUGGESTIONS.slice(0, 2),
          ],
        },
      ],
    };
  }

  // 7. Boost surface
  if (normPath.startsWith("/boost") || normSurface.includes("boost")) {
    return {
      surfaceId: "boost",
      surfaceTitle: "Aura Boost",
      scopeLabel: "BOOST SHOWCASE",
      activeSummary: "Autonomous Agent Memory & Visual Architecture",
      badge: "BOOST PROTOCOL",
      groundingDescription:
        "Grounded in Aura 5-tier memory, Base Sepolia verification, and live architecture ciphers.",
      suggestionGroups: [
        {
          title: "Boost & Architecture Intelligence",
          description: "Audit agent priors, review on-chain commitments, and explore 5-tier architecture",
          suggestions: [
            COUNTERPARTIES_SUGGESTIONS[0]!,
            COUNTERPARTIES_SUGGESTIONS[1]!,
            RUNS_SUGGESTIONS[0]!,
            RUNS_SUGGESTIONS[2]!,
          ],
        },
      ],
    };
  }

  // Fallback: general / unmapped
  return {
    surfaceId: "general",
    surfaceTitle: "Console Runtime",
    scopeLabel: "AURA CONSOLE",
    activeSummary: "Autonomous Operator Interface",
    badge: "AURA RUNTIME",
    groundingDescription:
      "Answers are read from the answering agent and can trigger no economic action.",
    suggestionGroups: [],
  };
}

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { console_ } from "@/features/console/copy";
import type {
  CounterpartyDossier,
  ExecutiveRiskDigest,
  ReflectionRecord,
  TemporalReputationReconstruction,
} from "@/lib/api-client";

const dbHealth = vi.fn();
const listSibylCounterparties = vi.fn();
const getCounterpartySummary = vi.fn();
const getCounterpartyReflections = vi.fn();
const getCounterpartyDossier = vi.fn();
const getCounterpartyTemporal = vi.fn();
const searchMemory = vi.fn();

vi.mock("@/lib/api-client", () => ({
  apiClient: {
    dbHealth: () => dbHealth(),
    listSibylCounterparties: () => listSibylCounterparties(),
    agentHealth: async () => ({ ok: true, data: { configured: false, reachable: false } }),
    sibylHealth: async () => ({ ok: true, data: { configured: false, reachable: false } }),
    getCounterpartySummary: (key: string) => getCounterpartySummary(key),
    getCounterpartyReflections: (key: string) => getCounterpartyReflections(key),
    getCounterpartyDossier: (key: string) => getCounterpartyDossier(key),
    getCounterpartyTemporal: (key: string, asOf?: string | number) => getCounterpartyTemporal(key, asOf),
    searchMemory: (query: string, options?: unknown) => searchMemory(query, options),
  },
}));

const { default: CounterpartiesPage } = await import("./page");

/* The shape a real Sibyl record has: scores as ratios, episodes carrying the
   evidence behind them, no memory_version, and a source marking. */
const profile = (over: Record<string, unknown> = {}) => ({
  counterpartyKey: "beta_labs",
  displayName: "Beta Labs",
  hasProfile: true,
  isFixture: true,
  relationshipStatus: "PREFERRED",
  memoryVersion: null,
  overallReliability: 0.91,
  taskFit: 0.83,
  confidence: 0.9,
  observedPriceUsdc: "12.00",
  riskNote: "No acceptance failures on record.",
  episodes: [
    {
      run: "116",
      taskType: "market-research",
      outcome: "accepted",
      note: "Delivered early; deliverable accepted without revision.",
      occurredAt: "2026-08-22T11:05:00Z",
    },
  ],
  updatedAt: "2026-09-05T13:19:14.916Z",
  ...over,
});

const mockExecutiveSummary: ExecutiveRiskDigest = {
  counterpartyKey: "beta_labs",
  displayName: "Beta Labs",
  headline: "Beta Labs: 100% verified deliveries, zero defects, currently PREFERRED",
  riskLevel: "LOW",
  reliabilityRating: "91.0%",
  relationshipStatus: "PREFERRED",
  consecutiveFailures: 0,
  totalMissions: 1,
  successRate: 1.0,
  keyFindings: ["Deliverable accepted without revision"],
  recommendations: ["HIRE"],
  generatedAt: "2026-09-10T12:00:00Z",
};

const mockReflections: ReflectionRecord[] = [
  {
    id: "refl-01",
    counterpartyKey: "beta_labs",
    runId: "run-116",
    failureCategory: "SCHEMA_VIOLATION",
    rootCause: "Minor schema discrepancy in draft",
    lesson: "Ensure schema strictness before final dispatch",
    schemaErrors: ["competitors.0.sources is missing"],
    remediationGuidance: "Pre-validate before submitting",
    createdAt: "2026-08-22T11:00:00Z",
  },
];

const mockDossier: CounterpartyDossier = {
  counterpartyKey: "beta_labs",
  displayName: "Beta Labs",
  totalMissions: 1,
  acceptedCount: 1,
  rejectedCount: 0,
  successRate: 1.0,
  recurringDefects: {},
  probationHistory: [
    {
      fromStatus: "KNOWN",
      toStatus: "PREFERRED",
      runId: "run-116",
      reason: "Consistent delivery accuracy",
      timestamp: "2026-08-22T11:05:00Z",
    },
  ],
  auditTrailHash: "c0ffee1234567890abcdef1234567890abcdef1234567890abcdef1234567890ab",
  lastConsolidatedAt: "2026-09-10T10:00:00Z",
};

const mockTemporal: TemporalReputationReconstruction = {
  counterpartyKey: "beta_labs",
  asOf: "0",
  asOfType: "episode_index",
  historicalState: {
    relationshipStatus: "KNOWN",
    overallReliability: 0.8,
    confidence: 0.5,
    alpha: 2.0,
    beta: 1.0,
    consecutiveFailures: 0,
    totalMissions: 1,
    episodesCount: 0,
  },
  currentState: {
    relationshipStatus: "PREFERRED",
    overallReliability: 0.91,
    confidence: 0.9,
    alpha: 4.0,
    beta: 1.0,
    consecutiveFailures: 0,
    totalMissions: 1,
    episodesCount: 1,
  },
  delta: {
    statusChanged: true,
    pastStatus: "KNOWN",
    currentStatus: "PREFERRED",
    reliabilityDelta: 0.11,
    failuresDelta: 0,
    missionsDelta: 0,
  },
};

beforeEach(() => {
  dbHealth.mockReset();
  listSibylCounterparties.mockReset();
  getCounterpartySummary.mockReset();
  getCounterpartyReflections.mockReset();
  getCounterpartyDossier.mockReset();
  getCounterpartyTemporal.mockReset();
  searchMemory.mockReset();

  dbHealth.mockResolvedValue({ ok: true, data: { status: "ok", latencyMs: 1 } });
  getCounterpartySummary.mockResolvedValue(null);
  getCounterpartyReflections.mockResolvedValue([]);
  getCounterpartyDossier.mockResolvedValue(null);
  getCounterpartyTemporal.mockResolvedValue(null);
  searchMemory.mockResolvedValue([]);
});

/**
 * The three outcomes of asking Sibyl are not interchangeable. This surface used
 * to render "unavailable" unconditionally while nothing was wired up, which was
 * honest then and would be a lie now.
 */
describe("Agents, from Sibyl", () => {
  it("renders the profile Sibyl actually returned", async () => {
    listSibylCounterparties.mockResolvedValue({ ok: true, data: { items: [profile()] } });

    const { container } = render(await CounterpartiesPage());

    expect(screen.getByText("Beta Labs")).toBeInTheDocument();
    expect(screen.getByText("PREFERRED")).toBeInTheDocument();
    // The score exactly as Sibyl stored it. Scaling 0.91 to 91 would assert a
    // scale nothing measured, and the store holds whole numbers elsewhere.
    expect(screen.getByText(/Overall reliability 0\.91/)).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/Overall reliability 91/);
  });

  it("shows the episodes the scores are a summary of", async () => {
    listSibylCounterparties.mockResolvedValue({ ok: true, data: { items: [profile()] } });

    render(await CounterpartiesPage());

    // An operator deciding whether to trust someone with money needs the
    // evidence, not just the number derived from it.
    expect(
      screen.getByText("Delivered early; deliverable accepted without revision."),
    ).toBeInTheDocument();
    expect(screen.getByText("accepted")).toBeInTheDocument();
  });

  it("marks fixture memory so it cannot pass for lived history", async () => {
    listSibylCounterparties.mockResolvedValue({ ok: true, data: { items: [profile()] } });

    render(await CounterpartiesPage());

    expect(screen.getByText(console_.agents.fixtureBadge)).toBeInTheDocument();
    expect(screen.getByText(console_.agents.fixtureNote)).toBeInTheDocument();
  });

  it("treats a profile with no version as a profile, and shows no version", async () => {
    listSibylCounterparties.mockResolvedValue({ ok: true, data: { items: [profile()] } });

    const { container } = render(await CounterpartiesPage());

    // A version is metadata about a profile, not the thing that makes one.
    // Requiring it reported two fully populated records as no history.
    expect(screen.queryByText(console_.agents.noProfile)).toBeNull();
    expect(container.textContent).not.toMatch(/Memory version/);
  });

  it("says memory could not be read rather than showing an empty page", async () => {
    listSibylCounterparties.mockResolvedValue({
      ok: false,
      error: { code: "db_absent", message: "No Sibyl database at /nowhere" },
    });

    render(await CounterpartiesPage());

    // "We could not look" must never render as "we looked and there is nobody".
    expect(screen.getByText("No Sibyl database at /nowhere")).toBeInTheDocument();
    expect(screen.queryByText(console_.agents.empty)).toBeNull();
  });

  it("claims an empty memory only because Sibyl answered with one", async () => {
    listSibylCounterparties.mockResolvedValue({ ok: true, data: { items: [] } });

    render(await CounterpartiesPage());

    expect(screen.getByText(console_.agents.empty)).toBeInTheDocument();
    expect(screen.queryByText("MEMORY UNAVAILABLE")).toBeNull();
  });

  it("lists a counterparty with no profile without inventing one", async () => {
    listSibylCounterparties.mockResolvedValue({
      ok: true,
      data: {
        items: [
          profile({
            counterpartyKey: "atlas-agent",
            displayName: null,
            hasProfile: false,
            isFixture: false,
            relationshipStatus: null,
            memoryVersion: null,
            overallReliability: null,
            taskFit: null,
            confidence: null,
            observedPriceUsdc: null,
            riskNote: null,
            episodes: [],
          }),
        ],
      },
    });

    const { container } = render(await CounterpartiesPage());

    expect(screen.getByText("atlas-agent")).toBeInTheDocument();
    expect(screen.getByText(console_.agents.noProfile)).toBeInTheDocument();
    // A missing score is not a zero, and an absent profile renders no numbers
    // at all rather than a row of them.
    expect(container.textContent).not.toMatch(/Memory version/);
  });

  it("renders the R4 semantic memory search bar at the top of the counterparties page", async () => {
    listSibylCounterparties.mockResolvedValue({ ok: true, data: { items: [profile()] } });

    render(await CounterpartiesPage());

    expect(screen.getByTestId("semantic-search-container")).toBeInTheDocument();
    expect(screen.getByTestId("semantic-search-input")).toBeInTheDocument();
  });

  it("renders the R5 executive risk digest hero banner when present", async () => {
    listSibylCounterparties.mockResolvedValue({ ok: true, data: { items: [profile()] } });
    getCounterpartySummary.mockResolvedValue(mockExecutiveSummary);

    render(await CounterpartiesPage());

    expect(screen.getByTestId("executive-summary-hero")).toBeInTheDocument();
    expect(screen.getByText(/RISK: LOW/i)).toBeInTheDocument();
    expect(screen.getByText(/Action: Recommended for Hire/i)).toBeInTheDocument();
    expect(screen.getByText(/Beta Labs: 100% verified deliveries/i)).toBeInTheDocument();
  });

  it("renders R1 reflections, R2 dossier, and R3 temporal reconstructions", async () => {
    listSibylCounterparties.mockResolvedValue({ ok: true, data: { items: [profile()] } });
    getCounterpartyReflections.mockResolvedValue(mockReflections);
    getCounterpartyDossier.mockResolvedValue(mockDossier);
    getCounterpartyTemporal.mockResolvedValue(mockTemporal);

    render(await CounterpartiesPage());

    // R1 Reflections
    expect(screen.getByTestId("reflections-container")).toBeInTheDocument();
    expect(screen.getByText("SCHEMA_VIOLATION")).toBeInTheDocument();
    expect(screen.getByTestId("schema-errors-block")).toBeInTheDocument();

    // R2 Dossier
    expect(screen.getByTestId("dossier-container")).toBeInTheDocument();
    expect(screen.getByTestId("dossier-audit-hash")).toHaveTextContent(mockDossier.auditTrailHash);

    // R3 Temporal View
    expect(screen.getByTestId("temporal-view-container")).toBeInTheDocument();
    expect(screen.getByTestId("historical-state-card")).toBeInTheDocument();
    expect(screen.getByTestId("current-state-card")).toBeInTheDocument();
    expect(screen.getByTestId("temporal-deltas-bar")).toBeInTheDocument();
  });
});

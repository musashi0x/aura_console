import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { expectNoAxeViolations } from "@/test-support/axe";
import type {
  CounterpartyDossier,
  ExecutiveRiskDigest,
  MemorySearchResult,
  ReflectionRecord,
  TemporalReputationReconstruction,
} from "@/lib/api-client";
import { CounterpartyExecutiveSummary } from "./counterparty-executive-summary";
import { CounterpartyReflections } from "./counterparty-reflections";
import { CounterpartyDossierView } from "./counterparty-dossier";
import { CounterpartyTemporalView } from "./counterparty-temporal-view";
import { CounterpartySemanticSearch } from "./counterparty-semantic-search";

const mockSummaryAlpha: ExecutiveRiskDigest = {
  counterpartyKey: "virtuals:agent:alpha",
  displayName: "Alpha Research",
  headline: "Alpha Research: 1 failure due to unverified citations, 0 successful deliveries, currently under WATCH status",
  riskLevel: "CRITICAL",
  reliabilityRating: "33.3%",
  relationshipStatus: "WATCH",
  consecutiveFailures: 1,
  totalMissions: 1,
  successRate: 0.0,
  keyFindings: ["Deliverable failed schema validation: missing citations", "1 consecutive failure recorded"],
  recommendations: ["DO_NOT_HIRE", "Require strict citation proof before future consideration"],
  generatedAt: "2026-09-10T12:00:00Z",
};

const mockSummaryBeta: ExecutiveRiskDigest = {
  counterpartyKey: "virtuals:agent:beta",
  displayName: "Beta Labs",
  headline: "Beta Labs: 100% verified deliveries, zero defects, currently PREFERRED",
  riskLevel: "LOW",
  reliabilityRating: "91.0%",
  relationshipStatus: "PREFERRED",
  consecutiveFailures: 0,
  totalMissions: 2,
  successRate: 1.0,
  keyFindings: ["All deliverables passed schema validation with verified URLs"],
  recommendations: ["HIRE"],
  generatedAt: "2026-09-10T12:00:00Z",
};

const mockReflections: ReflectionRecord[] = [
  {
    id: "refl-01",
    counterpartyKey: "virtuals:agent:alpha",
    runId: "run-alpha-001",
    failureCategory: "MISSING_CITATIONS",
    rootCause: "Provider Alpha generated deliverable without competitor source URLs",
    lesson: "Alpha omits required citation URLs in market intelligence tasks",
    schemaErrors: ["competitors.0.sources is missing", "competitors.1.sources is missing"],
    remediationGuidance: "Do not allocate budget without enforceable citation validation",
    createdAt: "2026-09-09T15:30:00Z",
  },
];

const mockDossier: CounterpartyDossier = {
  counterpartyKey: "virtuals:agent:alpha",
  displayName: "Alpha Research",
  totalMissions: 3,
  acceptedCount: 1,
  rejectedCount: 2,
  successRate: 0.333,
  recurringDefects: { missing_citations: 2, timeout: 0 },
  probationHistory: [
    {
      fromStatus: "NEW",
      toStatus: "WATCH",
      runId: "run-alpha-001",
      reason: "Deliverable verification failure (missing citations)",
      timestamp: "2026-09-09T15:30:00Z",
    },
  ],
  auditTrailHash: "a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0",
  lastConsolidatedAt: "2026-09-10T10:00:00Z",
};

const mockTemporal: TemporalReputationReconstruction = {
  counterpartyKey: "virtuals:agent:alpha",
  asOf: "0",
  asOfType: "episode_index",
  historicalState: {
    relationshipStatus: "NEW",
    overallReliability: 0.5,
    confidence: 0.0,
    alpha: 1.0,
    beta: 1.0,
    consecutiveFailures: 0,
    totalMissions: 0,
    episodesCount: 0,
  },
  currentState: {
    relationshipStatus: "WATCH",
    overallReliability: 0.333,
    confidence: 0.25,
    alpha: 1.0,
    beta: 2.0,
    consecutiveFailures: 1,
    totalMissions: 1,
    episodesCount: 1,
  },
  delta: {
    statusChanged: true,
    pastStatus: "NEW",
    currentStatus: "WATCH",
    reliabilityDelta: -0.167,
    failuresDelta: 1,
    missionsDelta: 1,
  },
};

describe("CounterpartyExecutiveSummary (R5)", () => {
  it("renders critical risk banner with action pill and findings", () => {
    render(<CounterpartyExecutiveSummary summary={mockSummaryAlpha} />);
    expect(screen.getByTestId("executive-summary-hero")).toBeInTheDocument();
    expect(screen.getByText(/RISK: CRITICAL/i)).toBeInTheDocument();
    expect(screen.getByText(/Action: Do Not Hire/i)).toBeInTheDocument();
    expect(screen.getByText(/Alpha Research: 1 failure due to unverified citations/i)).toBeInTheDocument();
    expect(screen.getByText("33.3%")).toBeInTheDocument();
    expect(screen.getByText(/missing citations/i)).toBeInTheDocument();
  });

  it("renders low risk summary for verified provider", () => {
    render(<CounterpartyExecutiveSummary summary={mockSummaryBeta} />);
    expect(screen.getByText(/RISK: LOW/i)).toBeInTheDocument();
    expect(screen.getByText(/Action: Recommended for Hire/i)).toBeInTheDocument();
  });

  it("renders empty state gracefully when summary is null", () => {
    render(<CounterpartyExecutiveSummary summary={null} counterpartyKey="gamma" />);
    expect(screen.getByTestId("executive-summary-empty")).toBeInTheDocument();
    expect(screen.getByText(/No executive summary available for gamma/i)).toBeInTheDocument();
  });

  it("passes axe accessibility audit", async () => {
    const { container } = render(<CounterpartyExecutiveSummary summary={mockSummaryAlpha} />);
    await expectNoAxeViolations(container);
  });
});

describe("CounterpartyReflections (R1)", () => {
  it("renders reflected lessons with defect badges and mono schema errors", () => {
    render(<CounterpartyReflections reflections={mockReflections} />);
    expect(screen.getByTestId("reflections-container")).toBeInTheDocument();
    expect(screen.getByText("MISSING_CITATIONS")).toBeInTheDocument();
    expect(screen.getByText(/Alpha omits required citation URLs/i)).toBeInTheDocument();
    expect(screen.getByTestId("schema-errors-block")).toBeInTheDocument();
    expect(screen.getByText(/competitors.0.sources is missing/i)).toBeInTheDocument();
  });

  it("renders clean state when reflections array is empty", () => {
    render(<CounterpartyReflections reflections={[]} counterpartyKey="beta_labs" />);
    expect(screen.getByTestId("reflections-clean-state")).toBeInTheDocument();
    expect(screen.getByText(/Clean verification history: 0 defect reflections/i)).toBeInTheDocument();
    expect(screen.getByText("Zero Defects")).toBeInTheDocument();
  });

  it("passes axe accessibility audit", async () => {
    const { container } = render(<CounterpartyReflections reflections={mockReflections} />);
    await expectNoAxeViolations(container);
  });
});

describe("CounterpartyDossierView (R2)", () => {
  it("renders consolidated dossier metrics, defects, and audit hash", () => {
    render(<CounterpartyDossierView dossier={mockDossier} />);
    expect(screen.getByTestId("dossier-container")).toBeInTheDocument();
    expect(screen.getByText(/33% \(1 \/ 3 missions\)/i)).toBeInTheDocument();
    expect(screen.getByText("missing_citations: 2")).toBeInTheDocument();
    expect(screen.getByText(/Probation State Transitions \(1\)/i)).toBeInTheDocument();
    expect(screen.getByTestId("dossier-audit-hash")).toHaveTextContent(mockDossier.auditTrailHash);
  });

  it("renders pending state when dossier is null", () => {
    render(<CounterpartyDossierView dossier={null} counterpartyKey="new_agent" />);
    expect(screen.getByTestId("dossier-pending-state")).toBeInTheDocument();
    expect(screen.getByText(/Awaiting first mission consolidation for new_agent/i)).toBeInTheDocument();
  });

  it("passes axe accessibility audit", async () => {
    const { container } = render(<CounterpartyDossierView dossier={mockDossier} />);
    await expectNoAxeViolations(container);
  });
});

describe("CounterpartyTemporalView (R3)", () => {
  it("renders past vs present side-by-side state and deltas", () => {
    render(
      <CounterpartyTemporalView
        counterpartyKey="virtuals:agent:alpha"
        initialReconstruction={mockTemporal}
        totalEpisodes={1}
      />
    );
    expect(screen.getByTestId("temporal-view-container")).toBeInTheDocument();
    expect(screen.getByTestId("historical-state-card")).toBeInTheDocument();
    expect(screen.getByTestId("current-state-card")).toBeInTheDocument();
    expect(screen.getByTestId("temporal-deltas-bar")).toBeInTheDocument();
    expect(screen.getByText("Status Shifted")).toBeInTheDocument();
    expect(screen.getByText("-16.7%")).toBeInTheDocument();
  });

  it("passes axe accessibility audit", async () => {
    const { container } = render(
      <CounterpartyTemporalView
        counterpartyKey="virtuals:agent:alpha"
        initialReconstruction={mockTemporal}
        totalEpisodes={1}
      />
    );
    await expectNoAxeViolations(container);
  });
});

describe("CounterpartySemanticSearch (R4)", () => {
  it("renders search bar and handles query submission", async () => {
    const user = userEvent.setup();
    const searchMock = vi.fn().mockResolvedValue([
      {
        id: "search-01",
        category: "reflection",
        name: "Alpha Citation Failure",
        score: 95,
        matchedTerms: ["missing", "citation"],
        headline: "Alpha omitted citations",
        snippet: "Failed verification due to empty sources list",
        createdAt: "2026-09-09T15:30:00Z",
        body: {},
      },
    ] satisfies MemorySearchResult[]);

    const apiModule = await import("@/lib/api-client");
    vi.spyOn(apiModule, "apiClient", "get").mockReturnValue({
      ...apiModule.apiClient,
      searchMemory: searchMock,
    });

    render(<CounterpartySemanticSearch counterpartyKey="virtuals:agent:alpha" />);

    const input = screen.getByTestId("semantic-search-input");
    await user.type(input, "missing citations");
    const submitBtn = screen.getByTestId("semantic-search-submit");
    await user.click(submitBtn);

    expect(screen.getByTestId("semantic-search-results")).toBeInTheDocument();
    expect(screen.getByText("Alpha Citation Failure")).toBeInTheDocument();
    expect(screen.getByText(/Relevance: 95/i)).toBeInTheDocument();
  });

  it("passes axe accessibility audit", async () => {
    const { container } = render(<CounterpartySemanticSearch />);
    await expectNoAxeViolations(container);
  });
});

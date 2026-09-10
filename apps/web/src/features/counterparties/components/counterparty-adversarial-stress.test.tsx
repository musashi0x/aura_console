import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { expectNoAxeViolations } from "@/test-support/axe";
import type {
  CounterpartyDossier,
  ExecutiveRiskDigest,
  MemorySearchResult,
  ReflectionRecord,
  TemporalReputationReconstruction,
} from "@/lib/api-client";
import { apiClient } from "@/lib/api-client";
import { CounterpartyExecutiveSummary } from "./counterparty-executive-summary";
import { CounterpartyReflections } from "./counterparty-reflections";
import { CounterpartyDossierView } from "./counterparty-dossier";
import { CounterpartyTemporalView } from "./counterparty-temporal-view";
import { CounterpartySemanticSearch } from "./counterparty-semantic-search";

describe("Milestone 4 Web UI Adversarial & Empirical Stress Tests", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // 1. CounterpartyExecutiveSummary Stress Tests
  // =========================================================================
  describe("1. CounterpartyExecutiveSummary Edge Cases", () => {
    it("renders empty state gracefully when summary is null with and without counterpartyKey", () => {
      const { rerender } = render(
        <CounterpartyExecutiveSummary summary={null} counterpartyKey="virtuals:agent:omega" />
      );
      expect(screen.getByTestId("executive-summary-empty")).toBeInTheDocument();
      expect(
        screen.getByText(/No executive summary available for virtuals:agent:omega/i)
      ).toBeInTheDocument();

      rerender(<CounterpartyExecutiveSummary summary={null} />);
      expect(
        screen.getByText(/No executive summary available for this counterparty/i)
      ).toBeInTheDocument();
    });

    it("survives empty keyFindings and empty recommendations without crashing", () => {
      const emptyListsSummary: ExecutiveRiskDigest = {
        counterpartyKey: "agent:empty",
        displayName: "Empty Agent",
        headline: "Agent has no findings or recommendations yet",
        riskLevel: "CRITICAL",
        reliabilityRating: "50.0%",
        relationshipStatus: "WATCH",
        consecutiveFailures: 2,
        totalMissions: 2,
        successRate: 0.5,
        keyFindings: [],
        recommendations: [],
        generatedAt: "2026-09-10T12:00:00Z",
      };

      render(<CounterpartyExecutiveSummary summary={emptyListsSummary} />);
      expect(screen.getByTestId("executive-summary-hero")).toBeInTheDocument();
      // When recommendations are empty, primaryAction falls back to DO_NOT_HIRE for CRITICAL risk
      expect(screen.getByText(/Action: Do Not Hire/i)).toBeInTheDocument();
      expect(screen.queryByText(/Key Findings:/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Remediation & Recommendation:/i)).not.toBeInTheDocument();
    });

    it("handles CRITICAL risk with DO_NOT_HIRE correctly", () => {
      const criticalSummary: ExecutiveRiskDigest = {
        counterpartyKey: "agent:critical",
        displayName: "Critical Agent",
        headline: "Severe failures detected across multiple runs",
        riskLevel: "CRITICAL",
        reliabilityRating: "12.5%",
        relationshipStatus: "BLOCKED",
        consecutiveFailures: 3,
        totalMissions: 4,
        successRate: 0.0,
        keyFindings: ["Repeated schema invalidation", "Missing citations in 100% of runs"],
        recommendations: ["DO_NOT_HIRE"],
        generatedAt: "2026-09-10T12:00:00Z",
      };

      render(<CounterpartyExecutiveSummary summary={criticalSummary} />);
      expect(screen.getByText("RISK: CRITICAL")).toBeInTheDocument();
      expect(screen.getByText("Action: Do Not Hire")).toBeInTheDocument();
      expect(screen.getByText("Status: BLOCKED")).toBeInTheDocument();
      expect(screen.getByText("3")).toHaveClass("text-[var(--color-error)]");
      expect(screen.getByText("4")).toBeInTheDocument();
      expect(screen.getByText("0%")).toBeInTheDocument();
    });

    it("handles LOW risk with HIRE correctly", () => {
      const lowRiskSummary: ExecutiveRiskDigest = {
        counterpartyKey: "agent:trusted",
        displayName: "Trusted Agent",
        headline: "Clean execution with zero recorded defects",
        riskLevel: "LOW",
        reliabilityRating: "96.4%",
        relationshipStatus: "PREFERRED",
        consecutiveFailures: 0,
        totalMissions: 10,
        successRate: 1.0,
        keyFindings: ["Flawless schema compliance", "All citations verified on-chain"],
        recommendations: ["HIRE"],
        generatedAt: "2026-09-10T12:00:00Z",
      };

      render(<CounterpartyExecutiveSummary summary={lowRiskSummary} />);
      expect(screen.getByText("RISK: LOW")).toBeInTheDocument();
      expect(screen.getByText("Action: Recommended for Hire")).toBeInTheDocument();
      expect(screen.getByText("Status: PREFERRED")).toBeInTheDocument();
      expect(screen.getByText("0")).not.toHaveClass("text-[var(--color-error)]");
      expect(screen.getByText("100%")).toBeInTheDocument();
    });

    it("handles custom and unrecognized recommendation strings gracefully", () => {
      const customSummary: ExecutiveRiskDigest = {
        counterpartyKey: "agent:custom",
        displayName: "Custom Agent",
        headline: "Requires strict verification and sandboxed limits",
        riskLevel: "HIGH",
        reliabilityRating: "65.0%",
        relationshipStatus: "KNOWN",
        consecutiveFailures: 1,
        totalMissions: 5,
        successRate: 0.6,
        keyFindings: ["High latency observed"],
        recommendations: ["PROCEED_WITH_STRICT_VERIFICATION", "CUSTOM_GUARD_REQUIRED"],
        generatedAt: "2026-09-10T12:00:00Z",
      };

      const { rerender } = render(<CounterpartyExecutiveSummary summary={customSummary} />);
      expect(screen.getByText("Action: Strict Verification")).toBeInTheDocument();

      const unknownActionSummary: ExecutiveRiskDigest = {
        ...customSummary,
        recommendations: ["MANUAL_AUDIT_STAGE"],
      };
      rerender(<CounterpartyExecutiveSummary summary={unknownActionSummary} />);
      expect(screen.getByText("Action: MANUAL_AUDIT_STAGE")).toBeInTheDocument();
    });
  });

  // =========================================================================
  // 2. CounterpartyReflections Stress Tests
  // =========================================================================
  describe("2. CounterpartyReflections Edge Cases", () => {
    it("renders clean history state when 0 reflections are present", () => {
      const { rerender } = render(
        <CounterpartyReflections reflections={[]} counterpartyKey="clean:provider:01" />
      );
      expect(screen.getByTestId("reflections-clean-state")).toBeInTheDocument();
      expect(
        screen.getByText(
          /Clean verification history: 0 defect reflections on record for clean:provider:01/i
        )
      ).toBeInTheDocument();
      expect(screen.getByText("Zero Defects")).toBeInTheDocument();

      // Test with no counterpartyKey provided
      rerender(<CounterpartyReflections reflections={[]} />);
      expect(
        screen.getByText(
          /Clean verification history: 0 defect reflections on record for this counterparty/i
        )
      ).toBeInTheDocument();
    });

    it("stress-tests high density rendering with 50+ reflection cards", () => {
      const bulkReflections: ReflectionRecord[] = Array.from({ length: 55 }, (_, i) => ({
        id: `refl-stress-${i}`,
        counterpartyKey: "virtuals:agent:alpha",
        runId: `run-stress-${i}`,
        failureCategory: i % 2 === 0 ? "MISSING_CITATIONS" : "SCHEMA_VIOLATION",
        rootCause: `Root cause description for failed run execution index ${i}`,
        lesson: `Lesson learned: Enforce strict parameter verification on step ${i}`,
        schemaErrors: [`Error at path index ${i}: required parameter missing`],
        remediationGuidance: `Apply filter patch ${i}`,
        createdAt: "2026-09-10T10:00:00Z",
      }));

      const startTime = performance.now();
      render(<CounterpartyReflections reflections={bulkReflections} />);
      const renderDuration = performance.now() - startTime;

      expect(screen.getByTestId("reflections-container")).toBeInTheDocument();
      expect(screen.getByText("Reflected Lessons & Root Causes (55)")).toBeInTheDocument();

      // Verify first, middle, and last cards are present in the DOM
      expect(screen.getByTestId("reflection-card-refl-stress-0")).toBeInTheDocument();
      expect(screen.getByTestId("reflection-card-refl-stress-27")).toBeInTheDocument();
      expect(screen.getByTestId("reflection-card-refl-stress-54")).toBeInTheDocument();

      // Render duration must be rapid and non-blocking
      expect(renderDuration).toBeLessThan(1000);
    });

    it("verifies scroll containment on massive schema error stack traces", () => {
      const massiveStackTrace = Array.from({ length: 40 }, (_, idx) => 
        `[StackFrame ${idx}] at evaluateMissionStep (/aura/apps/api/src/services/verifier-agent.ts:${100 + idx}:24) -> SchemaViolation: Expected string with minimum length 20, received empty string at root.payload.sections[${idx}].metadata.auditHash`
      );

      const heavyReflection: ReflectionRecord[] = [
        {
          id: "refl-heavy-01",
          counterpartyKey: "agent:heavy",
          runId: "run-heavy-999",
          failureCategory: "SCHEMA_VIOLATION",
          rootCause: "Extensive JSON schema serialization failure across payload components",
          lesson: "Never ingest unvalidated raw provider outputs into memory graph",
          schemaErrors: massiveStackTrace,
          remediationGuidance: "Introduce pre-serialization JSON validator",
          createdAt: "2026-09-10T11:00:00Z",
        },
      ];

      render(<CounterpartyReflections reflections={heavyReflection} />);
      const schemaBlock = screen.getByTestId("schema-errors-block");
      expect(schemaBlock).toBeInTheDocument();
      // Asserts strict CSS containment classes preventing DOM overflow
      expect(schemaBlock).toHaveClass("overflow-x-auto");
      expect(schemaBlock).toHaveClass("max-h-40");

      // Verify that contents are rendered
      expect(schemaBlock).toHaveTextContent("[StackFrame 0]");
      expect(schemaBlock).toHaveTextContent("[StackFrame 39]");
    });

    it("handles reflections without schemaErrors or remediationGuidance safely", () => {
      const minimalReflection: ReflectionRecord[] = [
        {
          id: "refl-min-01",
          counterpartyKey: "agent:minimal",
          runId: "run-min-001",
          failureCategory: "TIMEOUT",
          rootCause: "Task exceeded sandbox timeout limit of 30s",
          lesson: "Allocate higher timeout for heavy computational queries",
          schemaErrors: [],
          remediationGuidance: "",
          createdAt: "2026-09-10T11:30:00Z",
        },
      ];

      render(<CounterpartyReflections reflections={minimalReflection} />);
      expect(screen.getByText("TIMEOUT")).toBeInTheDocument();
      expect(screen.queryByTestId("schema-errors-block")).not.toBeInTheDocument();
      expect(screen.queryByText(/Remediation Guidance:/i)).not.toBeInTheDocument();
    });
  });

  // =========================================================================
  // 3. CounterpartyDossierView Stress Tests
  // =========================================================================
  describe("3. CounterpartyDossierView Edge Cases", () => {
    it("safely guards against divide-by-zero when totalMissions is 0", () => {
      const zeroMissionsDossier: CounterpartyDossier = {
        counterpartyKey: "agent:zero",
        displayName: "Zero Agent",
        totalMissions: 0,
        acceptedCount: 0,
        rejectedCount: 0,
        successRate: 0,
        recurringDefects: {},
        probationHistory: [],
        auditTrailHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        lastConsolidatedAt: "2026-09-10T10:00:00Z",
      };

      const { rerender } = render(
        <CounterpartyDossierView dossier={zeroMissionsDossier} counterpartyKey="agent:zero" />
      );

      expect(screen.getByTestId("dossier-pending-state")).toBeInTheDocument();
      expect(
        screen.getByText(/Awaiting first mission consolidation for agent:zero/i)
      ).toBeInTheDocument();
      expect(screen.getByText("Pending Consolidation")).toBeInTheDocument();
      expect(screen.queryByTestId("dossier-container")).not.toBeInTheDocument();

      // Test with dossier: null
      rerender(<CounterpartyDossierView dossier={null} counterpartyKey="agent:null" />);
      expect(screen.getByTestId("dossier-pending-state")).toBeInTheDocument();
    });

    it("renders 100% failure rate correctly with zero divide error", () => {
      const fullFailureDossier: CounterpartyDossier = {
        counterpartyKey: "agent:failed",
        displayName: "Failed Agent",
        totalMissions: 8,
        acceptedCount: 0,
        rejectedCount: 8,
        successRate: 0.0,
        recurringDefects: { missing_citations: 5, schema_violation: 3 },
        probationHistory: [
          {
            fromStatus: "KNOWN",
            toStatus: "WATCH",
            runId: "run-001",
            reason: "First verification rejection",
            timestamp: "2026-09-09T10:00:00Z",
          },
          {
            fromStatus: "WATCH",
            toStatus: "BLOCKED",
            runId: "run-002",
            reason: "Two consecutive rejections in WATCH state",
            timestamp: "2026-09-09T12:00:00Z",
          },
        ],
        auditTrailHash: "deadbeef00000000deadbeef00000000deadbeef00000000deadbeef00000000",
        lastConsolidatedAt: "2026-09-10T10:00:00Z",
      };

      render(<CounterpartyDossierView dossier={fullFailureDossier} />);
      expect(screen.getByTestId("dossier-container")).toBeInTheDocument();
      expect(screen.getByText("0% (0 / 8 missions)")).toBeInTheDocument();
      expect(screen.getByText("Accepted: 0")).toBeInTheDocument();
      expect(screen.getByText("Rejected: 8")).toBeInTheDocument();
      expect(screen.getByText("Total: 8")).toBeInTheDocument();
    });

    it("renders multiple recurring defect tags and handles zero defects state", () => {
      const multiDefectsDossier: CounterpartyDossier = {
        counterpartyKey: "agent:multi",
        displayName: "Multi Defect Agent",
        totalMissions: 15,
        acceptedCount: 9,
        rejectedCount: 6,
        successRate: 0.6,
        recurringDefects: {
          missing_citations: 4,
          schema_violation: 2,
          timeout: 1,
          bad_formatting: 1,
        },
        probationHistory: [],
        auditTrailHash: "c0ffee0000000000c0ffee0000000000c0ffee0000000000c0ffee0000000000",
        lastConsolidatedAt: "2026-09-10T10:00:00Z",
      };

      const { rerender } = render(<CounterpartyDossierView dossier={multiDefectsDossier} />);
      expect(screen.getByText("missing_citations: 4")).toBeInTheDocument();
      expect(screen.getByText("schema_violation: 2")).toBeInTheDocument();
      expect(screen.getByText("timeout: 1")).toBeInTheDocument();
      expect(screen.getByText("bad_formatting: 1")).toBeInTheDocument();

      // Rerender with zero defects
      const zeroDefectsDossier: CounterpartyDossier = {
        ...multiDefectsDossier,
        recurringDefects: {},
      };
      rerender(<CounterpartyDossierView dossier={zeroDefectsDossier} />);
      expect(
        screen.getByText(/Zero recurring defects identified across consolidated episodes/i)
      ).toBeInTheDocument();
    });

    it("survives missing or empty auditTrailHash and handles copy action safely", async () => {
      const user = userEvent.setup();
      const mockClipboardWrite = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, "clipboard", {
        value: {
          writeText: mockClipboardWrite,
        },
        configurable: true,
        writable: true,
      });

      const missingHashDossier: CounterpartyDossier = {
        counterpartyKey: "agent:nohash",
        displayName: "No Hash Agent",
        totalMissions: 2,
        acceptedCount: 2,
        rejectedCount: 0,
        successRate: 1.0,
        recurringDefects: {},
        probationHistory: [],
        auditTrailHash: "",
        lastConsolidatedAt: "2026-09-10T10:00:00Z",
      };

      const { rerender } = render(<CounterpartyDossierView dossier={missingHashDossier} />);
      expect(screen.getByTestId("dossier-container")).toBeInTheDocument();
      const copyBtn = screen.getByRole("button", { name: /Copy Hash/i });
      await user.click(copyBtn);
      // Empty hash should not attempt to write to clipboard
      expect(mockClipboardWrite).not.toHaveBeenCalled();

      // With valid hash
      const validHashDossier: CounterpartyDossier = {
        ...missingHashDossier,
        auditTrailHash: "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
      };
      rerender(<CounterpartyDossierView dossier={validHashDossier} />);
      await user.click(screen.getByRole("button", { name: /Copy Hash/i }));
      expect(mockClipboardWrite).toHaveBeenCalledWith(validHashDossier.auditTrailHash);
      expect(await screen.findByText("Copied")).toBeInTheDocument();
    });
  });

  // =========================================================================
  // 4. CounterpartyTemporalView Stress Tests
  // =========================================================================
  describe("4. CounterpartyTemporalView Edge Cases", () => {
    const mockReconstruction: TemporalReputationReconstruction = {
      counterpartyKey: "agent:temporal",
      asOf: "0",
      asOfType: "episode_index",
      historicalState: {
        relationshipStatus: "NEW",
        overallReliability: 0.5,
        confidence: 0.05,
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

    it("handles totalEpisodes=0 and totalEpisodes=1 without infinite loops", () => {
      const { rerender } = render(
        <CounterpartyTemporalView
          counterpartyKey="agent:temporal"
          initialReconstruction={mockReconstruction}
          totalEpisodes={0}
        />
      );

      expect(screen.getByTestId("temporal-view-container")).toBeInTheDocument();
      // Even with totalEpisodes=0, maxEpisodes is at least 1, creating t_0 and t_1
      expect(screen.getByTestId("checkpoint-btn-t0")).toBeInTheDocument();
      expect(screen.getByTestId("checkpoint-btn-t1")).toBeInTheDocument();

      rerender(
        <CounterpartyTemporalView
          counterpartyKey="agent:temporal"
          initialReconstruction={mockReconstruction}
          totalEpisodes={1}
        />
      );
      expect(screen.getByTestId("checkpoint-btn-t0")).toBeInTheDocument();
      expect(screen.getByTestId("checkpoint-btn-t1")).toBeInTheDocument();
    });

    it("handles scrubber interaction and gracefully handles API null returns for out-of-bounds queries", async () => {
      const user = userEvent.setup();
      const temporalSpy = vi
        .spyOn(apiClient, "getCounterpartyTemporal")
        .mockResolvedValueOnce({
          ...mockReconstruction,
          asOf: "1",
          historicalState: {
            ...mockReconstruction.currentState,
          },
          delta: {
            statusChanged: false,
            pastStatus: "WATCH",
            currentStatus: "WATCH",
            reliabilityDelta: 0.0,
            failuresDelta: 0,
            missionsDelta: 0,
          },
        })
        .mockResolvedValueOnce(null); // out-of-bounds or non-existent checkpoint

      render(
        <CounterpartyTemporalView
          counterpartyKey="agent:temporal"
          initialReconstruction={mockReconstruction}
          totalEpisodes={2}
        />
      );

      // Click checkpoint 1
      const t1Btn = screen.getByTestId("checkpoint-btn-t1");
      await user.click(t1Btn);

      await waitFor(() => {
        expect(temporalSpy).toHaveBeenCalledWith("agent:temporal", 1);
      });

      // Click checkpoint 2 which returns null
      const t2Btn = screen.getByTestId("checkpoint-btn-t2");
      await user.click(t2Btn);

      await waitFor(() => {
        expect(temporalSpy).toHaveBeenCalledWith("agent:temporal", 2);
      });

      // Component remains intact and doesn't crash
      expect(screen.getByTestId("temporal-view-container")).toBeInTheDocument();
    });

    it("renders future timestamp reconstruction safely", () => {
      const futureReconstruction: TemporalReputationReconstruction = {
        ...mockReconstruction,
        asOf: "2099-12-31T23:59:59Z",
        asOfType: "timestamp",
        delta: {
          statusChanged: true,
          pastStatus: "PREFERRED",
          currentStatus: "BLOCKED",
          reliabilityDelta: -0.65,
          failuresDelta: 3,
          missionsDelta: 5,
        },
      };

      render(
        <CounterpartyTemporalView
          counterpartyKey="agent:future"
          initialReconstruction={futureReconstruction}
        />
      );

      expect(screen.getByTestId("temporal-view-container")).toBeInTheDocument();
      expect(screen.getByText("Status Shifted")).toBeInTheDocument();
      expect(screen.getByText("-65.0%")).toBeInTheDocument();
      expect(screen.getByText("+5")).toBeInTheDocument();
    });

    it("handles negative totalEpisodes and negative scrubber queries gracefully", async () => {
      const negativeReconstruction: TemporalReputationReconstruction = {
        ...mockReconstruction,
        asOf: "-1",
        asOfType: "episode_index",
      };

      render(
        <CounterpartyTemporalView
          counterpartyKey="agent:negative"
          initialReconstruction={negativeReconstruction}
          totalEpisodes={-5}
        />
      );

      expect(screen.getByTestId("temporal-view-container")).toBeInTheDocument();
      // Even with negative totalEpisodes, Math.max(1, -5, ...) clamps to at least 1
      expect(screen.getByTestId("checkpoint-btn-t0")).toBeInTheDocument();
      expect(screen.getByTestId("checkpoint-btn-t1")).toBeInTheDocument();
    });
  });

  // =========================================================================
  // 5. CounterpartySemanticSearch Stress Tests
  // =========================================================================
  describe("5. CounterpartySemanticSearch Edge Cases", () => {
    it("disables search on empty or whitespace queries and clears results on submit", async () => {
      const user = userEvent.setup();
      const searchSpy = vi.spyOn(apiClient, "searchMemory").mockResolvedValue([]);

      render(<CounterpartySemanticSearch counterpartyKey="virtuals:agent:alpha" />);
      const input = screen.getByTestId("semantic-search-input");
      const submitBtn = screen.getByTestId("semantic-search-submit");

      // Initial state: empty query, submit disabled
      expect(submitBtn).toBeDisabled();

      // Type spaces
      await user.type(input, "   ");
      expect(submitBtn).toBeDisabled();
      expect(searchSpy).not.toHaveBeenCalled();
    });

    it("handles SQL-like queries safely without XSS or crashing", async () => {
      const user = userEvent.setup();
      const searchSpy = vi.spyOn(apiClient, "searchMemory").mockResolvedValue([]);

      render(<CounterpartySemanticSearch />);
      const input = screen.getByTestId("semantic-search-input");
      const submitBtn = screen.getByTestId("semantic-search-submit");

      const sqlPayload = "' OR 1=1 --; DROP TABLE memories;";
      await user.type(input, sqlPayload);
      expect(submitBtn).toBeEnabled();

      await user.click(submitBtn);

      await waitFor(() => {
        expect(searchSpy).toHaveBeenCalledWith(sqlPayload, {
          category: undefined,
          counterpartyKey: undefined,
        });
      });

      // Shows empty state with sanitized query string in quotes
      expect(screen.getByTestId("semantic-search-empty")).toBeInTheDocument();
      expect(
        screen.getByText(new RegExp(`No matching memory records found for "${sqlPayload}"`))
      ).toBeInTheDocument();
    });

    it("displays empty state correctly when API returns 0 results", async () => {
      const user = userEvent.setup();
      vi.spyOn(apiClient, "searchMemory").mockResolvedValue([]);

      render(<CounterpartySemanticSearch counterpartyKey="virtuals:agent:beta" />);
      const input = screen.getByTestId("semantic-search-input");
      await user.type(input, "zero_results_query");
      await user.click(screen.getByTestId("semantic-search-submit"));

      await waitFor(() => {
        expect(screen.getByTestId("semantic-search-results")).toBeInTheDocument();
      });

      const resultsContainer = screen.getByTestId("semantic-search-results");
      expect(resultsContainer).toHaveTextContent(
        'Found 0 matching memory records for "zero_results_query"'
      );
      expect(screen.getByTestId("semantic-search-empty")).toBeInTheDocument();
      expect(screen.getByText("Filtered: virtuals:agent:beta")).toBeInTheDocument();
    });

    it("switches category filters and passes correct category to API", async () => {
      const user = userEvent.setup();
      const searchSpy = vi.spyOn(apiClient, "searchMemory").mockResolvedValue([]);

      render(<CounterpartySemanticSearch counterpartyKey="agent:cat" />);
      const input = screen.getByTestId("semantic-search-input");
      await user.type(input, "verification");

      // 1. Switch to reflection
      await user.click(screen.getByTestId("category-filter-reflection"));
      await user.click(screen.getByTestId("semantic-search-submit"));
      await waitFor(() => {
        expect(searchSpy).toHaveBeenCalledWith("verification", {
          category: "reflection",
          counterpartyKey: "agent:cat",
        });
      });

      // 2. Switch to episode
      await user.click(screen.getByTestId("category-filter-episode"));
      await user.click(screen.getByTestId("semantic-search-submit"));
      await waitFor(() => {
        expect(searchSpy).toHaveBeenCalledWith("verification", {
          category: "episode",
          counterpartyKey: "agent:cat",
        });
      });

      // 3. Switch to dossier
      await user.click(screen.getByTestId("category-filter-dossier"));
      await user.click(screen.getByTestId("semantic-search-submit"));
      await waitFor(() => {
        expect(searchSpy).toHaveBeenCalledWith("verification", {
          category: "dossier",
          counterpartyKey: "agent:cat",
        });
      });

      // 4. Switch back to all
      await user.click(screen.getByTestId("category-filter-all"));
      await user.click(screen.getByTestId("semantic-search-submit"));
      await waitFor(() => {
        expect(searchSpy).toHaveBeenCalledWith("verification", {
          category: undefined,
          counterpartyKey: "agent:cat",
        });
      });
    });

    it("renders search result cards with correct category tokens and calls onSelectRecord", async () => {
      const user = userEvent.setup();
      const mockResults: MemorySearchResult[] = [
        {
          id: "rec-refl",
          category: "reflection",
          name: "Citation Defect Record",
          score: 95,
          matchedTerms: ["citations", "missing"],
          headline: "Alpha dropped competitor citations",
          snippet: "Missing URLs in competitor analysis table",
          createdAt: "2026-09-09T14:00:00Z",
          body: {},
        },
        {
          id: "rec-doss",
          category: "dossier",
          name: "Consolidated Profile",
          score: 72,
          matchedTerms: ["citations"],
          headline: "Alpha overall dossier",
          snippet: "Cumulative rating 33%",
          createdAt: "2026-09-09T15:00:00Z",
          body: {},
        },
        {
          id: "rec-ep",
          category: "episode",
          name: "Episode #1",
          score: 45,
          matchedTerms: ["citations"],
          headline: "Run alpha-001 outcome",
          snippet: "Rejected on verification step",
          createdAt: "2026-09-09T16:00:00Z",
          body: {},
        },
      ];

      vi.spyOn(apiClient, "searchMemory").mockResolvedValue(mockResults);
      const onSelectRecordMock = vi.fn();

      render(<CounterpartySemanticSearch onSelectRecord={onSelectRecordMock} />);
      const input = screen.getByTestId("semantic-search-input");
      await user.type(input, "citations");
      await user.click(screen.getByTestId("semantic-search-submit"));

      await waitFor(() => {
        expect(screen.getByTestId("semantic-search-results")).toBeInTheDocument();
      });

      // Verify category tokens and badges
      expect(screen.getByText("REFLECTION")).toBeInTheDocument();
      expect(screen.getByText("DOSSIER")).toBeInTheDocument();
      expect(screen.getByText("EPISODE")).toBeInTheDocument();

      expect(screen.getByText("Relevance: 95")).toBeInTheDocument();
      expect(screen.getByText("Relevance: 72")).toBeInTheDocument();
      expect(screen.getByText("Relevance: 45")).toBeInTheDocument();

      // Verify click callback
      await user.click(screen.getByTestId("search-result-card-rec-refl"));
      expect(onSelectRecordMock).toHaveBeenCalledWith(mockResults[0]);

      // Test clear button
      const clearBtn = screen.getByRole("button", { name: /Clear query/i });
      await user.click(clearBtn);
      expect(screen.queryByTestId("semantic-search-results")).not.toBeInTheDocument();
      expect(input).toHaveValue("");
    });
  });

  // =========================================================================
  // 6. Accessibility Audits on Adversarial Edge-Case States
  // =========================================================================
  describe("6. Accessibility Audits on Adversarial Edge-Case States", () => {
    it("executive summary empty state passes axe audit", async () => {
      const { container } = render(<CounterpartyExecutiveSummary summary={null} />);
      await expectNoAxeViolations(container);
    });

    it("reflections clean state (0 reflections) passes axe audit", async () => {
      const { container } = render(
        <CounterpartyReflections reflections={[]} counterpartyKey="clean:agent" />
      );
      await expectNoAxeViolations(container);
    });

    it("dossier pending state (0 missions) passes axe audit", async () => {
      const { container } = render(
        <CounterpartyDossierView dossier={null} counterpartyKey="pending:agent" />
      );
      await expectNoAxeViolations(container);
    });

    it("semantic search empty results state passes axe audit", async () => {
      const user = userEvent.setup();
      vi.spyOn(apiClient, "searchMemory").mockResolvedValue([]);
      const { container } = render(<CounterpartySemanticSearch />);
      const input = screen.getByTestId("semantic-search-input");
      await user.type(input, "empty_search");
      await user.click(screen.getByTestId("semantic-search-submit"));
      await screen.findByTestId("semantic-search-empty");
      await expectNoAxeViolations(container);
    });
  });
});


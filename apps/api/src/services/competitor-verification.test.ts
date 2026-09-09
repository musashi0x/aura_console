import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  CompetitorEntrySchema,
  CompetitorReportSchema,
  validateCompetitorReport,
  verifyCompetitorReportDeliverable,
  verifyWorktree,
  VerifierAgent,
} from "./verifier-agent.js";
import type { CompetitorReport } from "./verifier-agent.js";

describe("Competitor Research Deliverable Verification Test Suite", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "aura-verifier-test-"));
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  // =========================================================================
  // TIER 1: FEATURE COVERAGE & SCHEMA VALIDATION
  // =========================================================================
  describe("Tier 1: Schema & Data Validation", () => {
    it("T1.1: validates minimal valid competitor report (exactly 3 competitors, valid URLs, valid citations)", () => {
      const validPayload: CompetitorReport = {
        competitors: [
          {
            name: "Competitor Alpha",
            website: "https://alpha.example.com",
            sources: ["https://crunchbase.com/alpha"],
          },
          {
            name: "Competitor Beta",
            website: "https://beta.example.com",
            sources: ["https://techcrunch.com/beta"],
          },
          {
            name: "Competitor Gamma",
            website: "http://gamma.example.com",
            sources: ["https://news.ycombinator.com/item?id=123"],
          },
        ],
      };

      const result = validateCompetitorReport(validPayload);
      expect(result.tests_passed).toBe(true);
      expect(result.score).toBe(1.0);
      expect(result.competitorsCount).toBe(3);
      expect(result.failure_reason).toBeUndefined();
      expect(result.errors).toBeUndefined();
      expect(result.summary).toContain("3 competitors validated");
    });

    it("T1.2: validates rich competitor report with optional metadata and descriptions", () => {
      const richPayload = {
        taskGoal: "Research top AI developer tooling competitors",
        summary: "Identified 4 key market competitors with verified pricing",
        generatedAt: new Date().toISOString(),
        competitors: [
          {
            name: "Tool A",
            website: "https://toola.dev",
            sources: ["https://github.com/toola", "https://docs.toola.dev"],
            description: "Autonomous agent execution framework",
            notes: "Series A funded",
          },
          {
            name: "Tool B",
            website: "https://toolb.ai",
            sources: ["https://toolb.ai/about"],
            description: "Agent memory and state persistence",
          },
          {
            name: "Tool C",
            website: "https://toolc.io",
            sources: ["https://toolc.io/whitepaper.pdf"],
          },
          {
            name: "Tool D",
            website: "https://toold.org",
            sources: ["https://toold.org/about"],
          },
        ],
      };

      const result = validateCompetitorReport(richPayload);
      expect(result.tests_passed).toBe(true);
      expect(result.score).toBe(1.0);
      expect(result.competitorsCount).toBe(4);
      expect(result.data?.competitors).toHaveLength(4);
    });

    it("T1.3: verifies deliverable from default 'competitor-report.json' in worktree", async () => {
      const deliverable: CompetitorReport = {
        competitors: [
          { name: "C1", website: "https://c1.com", sources: ["https://s1.com"] },
          { name: "C2", website: "https://c2.com", sources: ["https://s2.com"] },
          { name: "C3", website: "https://c3.com", sources: ["https://s3.com"] },
        ],
      };
      fs.writeFileSync(path.join(tempDir, "competitor-report.json"), JSON.stringify(deliverable));

      const evaluation = await verifyCompetitorReportDeliverable(tempDir);
      expect(evaluation.tests_passed).toBe(true);
      expect(evaluation.score).toBe(1.0);
      expect(evaluation.competitorsCount).toBe(3);
      expect(evaluation.deliverablePath).toContain("competitor-report.json");
    });

    it("T1.4: verifies deliverable from fallback 'deliverable.json' in worktree", async () => {
      const deliverable: CompetitorReport = {
        competitors: [
          { name: "C1", website: "https://c1.com", sources: ["https://s1.com"] },
          { name: "C2", website: "https://c2.com", sources: ["https://s2.com"] },
          { name: "C3", website: "https://c3.com", sources: ["https://s3.com"] },
        ],
      };
      fs.writeFileSync(path.join(tempDir, "deliverable.json"), JSON.stringify(deliverable));

      const evaluation = await verifyCompetitorReportDeliverable(tempDir);
      expect(evaluation.tests_passed).toBe(true);
      expect(evaluation.score).toBe(1.0);
      expect(evaluation.deliverablePath).toContain("deliverable.json");
    });

    it("T1.5: verifies deliverable from custom relative path via deliverableRelPath", async () => {
      const subDir = path.join(tempDir, "artifacts", "reports");
      fs.mkdirSync(subDir, { recursive: true });
      const customPath = path.join(subDir, "market-analysis.json");

      const deliverable: CompetitorReport = {
        competitors: [
          { name: "C1", website: "https://c1.com", sources: ["https://s1.com"] },
          { name: "C2", website: "https://c2.com", sources: ["https://s2.com"] },
          { name: "C3", website: "https://c3.com", sources: ["https://s3.com"] },
        ],
      };
      fs.writeFileSync(customPath, JSON.stringify(deliverable));

      const evaluation = await verifyCompetitorReportDeliverable(
        tempDir,
        "artifacts/reports/market-analysis.json",
      );
      expect(evaluation.tests_passed).toBe(true);
      expect(evaluation.score).toBe(1.0);
      expect(evaluation.deliverablePath).toBe(customPath);
    });
  });

  // =========================================================================
  // TIER 2: BOUNDARY VALUE ANALYSIS & ERROR HANDLING
  // =========================================================================
  describe("Tier 2: Boundary Values & Defect Rejection", () => {
    it("T2.1: rejects defective deliverable with fewer than 3 competitors (2 competitors)", () => {
      const defectivePayload = {
        competitors: [
          { name: "Comp 1", website: "https://comp1.com", sources: ["https://src1.com"] },
          { name: "Comp 2", website: "https://comp2.com", sources: ["https://src2.com"] },
        ],
      };

      const result = validateCompetitorReport(defectivePayload);
      expect(result.tests_passed).toBe(false);
      expect(result.score).toBe(0.0);
      expect(result.failure_reason).toMatch(/Expected >= 3 competitors|at least 3 competitors/i);
      expect(result.errors?.[0]).toMatch(/Expected >= 3 competitors|at least 3 competitors/i);
    });

    it("T2.2: rejects defective deliverable with 0 competitors", () => {
      const emptyCompetitors = { competitors: [] };

      const result = validateCompetitorReport(emptyCompetitors);
      expect(result.tests_passed).toBe(false);
      expect(result.score).toBe(0.0);
      expect(result.failure_reason).toMatch(/Expected >= 3 competitors|at least 3 competitors/i);
    });

    it("T2.3: rejects competitor with invalid website URL (not a URL format)", () => {
      const invalidUrlPayload = {
        competitors: [
          { name: "Comp 1", website: "not-a-valid-url", sources: ["https://src1.com"] },
          { name: "Comp 2", website: "https://comp2.com", sources: ["https://src2.com"] },
          { name: "Comp 3", website: "https://comp3.com", sources: ["https://src3.com"] },
        ],
      };

      const result = validateCompetitorReport(invalidUrlPayload);
      expect(result.tests_passed).toBe(false);
      expect(result.score).toBe(0.0);
      expect(result.failure_reason).toMatch(/Invalid competitor website URL/i);
    });

    it("T2.4: rejects competitor with non-http/https protocol (e.g. ftp:// or javascript:)", () => {
      const ftpPayload = {
        competitors: [
          { name: "Comp 1", website: "ftp://files.comp1.com", sources: ["https://src1.com"] },
          { name: "Comp 2", website: "https://comp2.com", sources: ["https://src2.com"] },
          { name: "Comp 3", website: "https://comp3.com", sources: ["https://src3.com"] },
        ],
      };

      const result = validateCompetitorReport(ftpPayload);
      expect(result.tests_passed).toBe(false);
      expect(result.score).toBe(0.0);
      expect(result.failure_reason).toMatch(/URL must start with http:\/\/ or https:\/\/|Invalid competitor website URL/i);
    });

    it("T2.5: rejects competitor with empty or missing citations array", () => {
      const emptyCitationsPayload = {
        competitors: [
          { name: "Comp 1", website: "https://comp1.com", sources: [] },
          { name: "Comp 2", website: "https://comp2.com", sources: ["https://src2.com"] },
          { name: "Comp 3", website: "https://comp3.com", sources: ["https://src3.com"] },
        ],
      };

      const result = validateCompetitorReport(emptyCitationsPayload);
      expect(result.tests_passed).toBe(false);
      expect(result.score).toBe(0.0);
      expect(result.failure_reason).toMatch(/At least one source citation URL is required/i);
    });

    it("T2.6: rejects competitor with invalid citation URL in sources array", () => {
      const badCitationPayload = {
        competitors: [
          { name: "Comp 1", website: "https://comp1.com", sources: ["htp://bad-scheme.com"] },
          { name: "Comp 2", website: "https://comp2.com", sources: ["https://src2.com"] },
          { name: "Comp 3", website: "https://comp3.com", sources: ["https://src3.com"] },
        ],
      };

      const result = validateCompetitorReport(badCitationPayload);
      expect(result.tests_passed).toBe(false);
      expect(result.score).toBe(0.0);
      expect(result.failure_reason).toMatch(/Invalid source URL/i);
    });

    it("T2.7: rejects competitor with missing or blank name", () => {
      const blankNamePayload = {
        competitors: [
          { name: "   ", website: "https://comp1.com", sources: ["https://src1.com"] },
          { name: "Comp 2", website: "https://comp2.com", sources: ["https://src2.com"] },
          { name: "Comp 3", website: "https://comp3.com", sources: ["https://src3.com"] },
        ],
      };

      const result = validateCompetitorReport(blankNamePayload);
      expect(result.tests_passed).toBe(false);
      expect(result.score).toBe(0.0);
      expect(result.failure_reason).toMatch(/Competitor name is required|empty/i);
    });

    it("T2.8: rejects missing deliverable file with clear failure reason", async () => {
      // tempDir exists but contains no deliverable files
      const evaluation = await verifyCompetitorReportDeliverable(tempDir);
      expect(evaluation.tests_passed).toBe(false);
      expect(evaluation.score).toBe(0.0);
      expect(evaluation.summary).toContain("Deliverable file not found");
      expect(evaluation.failure_reason).toContain("Deliverable file not found");
      expect(evaluation.failure_reason).toContain("competitor-report.json");
    });

    it("T2.9: rejects malformed JSON deliverable syntax cleanly", async () => {
      fs.writeFileSync(
        path.join(tempDir, "competitor-report.json"),
        "{ competitors: [ not valid json !!!",
      );

      const evaluation = await verifyCompetitorReportDeliverable(tempDir);
      expect(evaluation.tests_passed).toBe(false);
      expect(evaluation.score).toBe(0.0);
      expect(evaluation.summary).toContain("malformed JSON");
      expect(evaluation.failure_reason).toMatch(/JSON Parse Error|Invalid JSON/i);
    });

    it("T2.10: rejects empty deliverable file (0 bytes)", async () => {
      fs.writeFileSync(path.join(tempDir, "competitor-report.json"), "");

      const evaluation = await verifyCompetitorReportDeliverable(tempDir);
      expect(evaluation.tests_passed).toBe(false);
      expect(evaluation.score).toBe(0.0);
      expect(evaluation.failure_reason).toContain("is empty");
    });

    it("T2.11: rejects non-object JSON root (e.g. array or primitive)", async () => {
      fs.writeFileSync(
        path.join(tempDir, "competitor-report.json"),
        JSON.stringify(["just", "an", "array"]),
      );

      const evaluation = await verifyCompetitorReportDeliverable(tempDir);
      expect(evaluation.tests_passed).toBe(false);
      expect(evaluation.score).toBe(0.0);
      expect(evaluation.failure_reason).toMatch(/validation failed/i);
    });

    it("T2.12: validates missing worktreePath argument", async () => {
      const evaluation = await verifyCompetitorReportDeliverable("");
      expect(evaluation.tests_passed).toBe(false);
      expect(evaluation.score).toBe(0.0);
      expect(evaluation.failure_reason).toBe("worktreePath is required");
    });
  });

  // =========================================================================
  // TIER 3: WORKTREE ISOLATION & VERIFIER AGENT INTEGRATION
  // =========================================================================
  describe("Tier 3: Worktree Isolation & Agent Integration", () => {
    it("T3.1: verifies valid deliverable in an authentic isolated git worktree", async () => {
      // Initialize a real Git repository in tempDir
      execSync("git init -q", { cwd: tempDir });
      execSync("git config user.email 'tester@aura.local'", { cwd: tempDir });
      execSync("git config user.name 'Aura Tester'", { cwd: tempDir });

      const deliverable: CompetitorReport = {
        competitors: [
          { name: "Alpha AI", website: "https://alpha.ai", sources: ["https://alpha.ai/blog"] },
          { name: "Beta AI", website: "https://beta.ai", sources: ["https://beta.ai/docs"] },
          { name: "Gamma AI", website: "https://gamma.ai", sources: ["https://gamma.ai/about"] },
        ],
      };
      fs.writeFileSync(path.join(tempDir, "competitor-report.json"), JSON.stringify(deliverable));

      const evaluation = await verifyWorktree({
        worktreePath: tempDir,
        verifyDeliverable: true,
      });

      expect(evaluation.tests_passed).toBe(true);
      expect(evaluation.score).toBe(1.0);
      expect(evaluation.summary).toContain("verified successfully");
      expect(evaluation.competitorsCount).toBe(3);
    });

    it("T3.2: rejects defective deliverable in an authentic isolated git worktree", async () => {
      execSync("git init -q", { cwd: tempDir });

      const defective = {
        competitors: [
          { name: "Only One", website: "https://one.ai", sources: [] },
        ],
      };
      fs.writeFileSync(path.join(tempDir, "competitor-report.json"), JSON.stringify(defective));

      const evaluation = await verifyWorktree({
        worktreePath: tempDir,
        verifyDeliverable: true,
      });

      expect(evaluation.tests_passed).toBe(false);
      expect(evaluation.score).toBe(0.0);
      expect(evaluation.failure_reason).toBeDefined();
    });

    it("T3.3: VerifierAgent instance successfully verifies deliverable", async () => {
      const agent = new VerifierAgent({
        verifyDeliverable: true,
      });

      const deliverable: CompetitorReport = {
        competitors: [
          { name: "C1", website: "https://c1.com", sources: ["https://s1.com"] },
          { name: "C2", website: "https://c2.com", sources: ["https://s2.com"] },
          { name: "C3", website: "https://c3.com", sources: ["https://s3.com"] },
        ],
      };
      fs.writeFileSync(path.join(tempDir, "competitor-report.json"), JSON.stringify(deliverable));

      const evaluation = await agent.verify({
        worktreePath: tempDir,
      });

      expect(evaluation.tests_passed).toBe(true);
      expect(evaluation.score).toBe(1.0);
    });

    it("T3.4: preserves backward compatibility: verifyWorktree executes shell commands when verifyDeliverable is false", async () => {
      const mockExecutor = async (command: string, args: string[]) => {
        if (command === "git" && args[0] === "diff") {
          return { exitCode: 0, stdout: "diff --git a b\n+code", stderr: "", timedOut: false };
        }
        if (command === "pnpm" && args[0] === "test") {
          return { exitCode: 0, stdout: "Passed all tests", stderr: "", timedOut: false };
        }
        return { exitCode: 0, stdout: "", stderr: "", timedOut: false };
      };

      const evaluation = await verifyWorktree({
        worktreePath: "/tmp/mock-legacy-worktree",
        executor: mockExecutor,
        verifyDeliverable: false,
      });

      expect(evaluation.tests_passed).toBe(true);
      expect(evaluation.score).toBe(1.0);
      expect(evaluation.diff).toContain("+code");
    });
  });

  // =========================================================================
  // TIER 4: SCHEMA EXPORTS VALIDATION
  // =========================================================================
  describe("Tier 4: Schema Direct Verification", () => {
    it("T4.1: CompetitorEntrySchema validates URL scheme and field requirements directly", () => {
      const validEntry = {
        name: "Test",
        website: "https://test.com",
        sources: ["https://source.com"],
      };
      const parsed = CompetitorEntrySchema.safeParse(validEntry);
      expect(parsed.success).toBe(true);

      const invalidEntry = {
        name: "",
        website: "ftp://bad.com",
        sources: [],
      };
      const invalidParsed = CompetitorEntrySchema.safeParse(invalidEntry);
      expect(invalidParsed.success).toBe(false);
    });

    it("T4.2: CompetitorReportSchema rejects less than 3 competitors directly", () => {
      const parsed = CompetitorReportSchema.safeParse({
        competitors: [
          { name: "C1", website: "https://c1.com", sources: ["https://s1.com"] },
          { name: "C2", website: "https://c2.com", sources: ["https://s2.com"] },
        ],
      });
      expect(parsed.success).toBe(false);
    });
  });
});

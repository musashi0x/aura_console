import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  validateCompetitorReport,
  verifyCompetitorReportDeliverable,
  verifyWorktree,
} from "./verifier-agent.js";
import type { CompetitorReport } from "./verifier-agent.js";

describe("Adversarial Stress & Edge Case Test Suite — Verifier Agent", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "aura-verifier-stress-"));
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  // =========================================================================
  // SUITE 1: MALFORMED JSON & CORRUPT INPUTS
  // =========================================================================
  describe("Suite 1: Malformed JSON & Corrupt Inputs", () => {
    it("S1.1: rejects truncated JSON payload (unexpected EOF)", async () => {
      const truncatedJson = '{"competitors": [{"name": "A", "website": "https://a.com", "sour';
      fs.writeFileSync(path.join(tempDir, "deliverable.json"), truncatedJson);

      const result = await verifyCompetitorReportDeliverable(tempDir);
      expect(result.tests_passed).toBe(false);
      expect(result.score).toBe(0.0);
      expect(result.summary).toContain("malformed JSON");
      expect(result.failure_reason).toMatch(/JSON Parse Error|Unexpected end of JSON/i);
    });

    it("S1.2: rejects JSON with trailing commas (invalid JSON syntax)", async () => {
      const trailingCommaJson = `{
        "competitors": [
          { "name": "C1", "website": "https://c1.com", "sources": ["https://s1.com"], },
          { "name": "C2", "website": "https://c2.com", "sources": ["https://s2.com"], },
          { "name": "C3", "website": "https://c3.com", "sources": ["https://s3.com"], },
        ],
      }`;
      fs.writeFileSync(path.join(tempDir, "deliverable.json"), trailingCommaJson);

      const result = await verifyCompetitorReportDeliverable(tempDir);
      expect(result.tests_passed).toBe(false);
      expect(result.score).toBe(0.0);
      expect(result.failure_reason).toMatch(/JSON Parse Error/i);
    });

    it("S1.3: rejects raw binary data and null bytes in file", async () => {
      const binaryData = Buffer.from([0x00, 0x1f, 0x8b, 0x08, 0x00, 0x00, 0xff, 0xfe]);
      fs.writeFileSync(path.join(tempDir, "deliverable.json"), binaryData);

      const result = await verifyCompetitorReportDeliverable(tempDir);
      expect(result.tests_passed).toBe(false);
      expect(result.score).toBe(0.0);
      expect(result.failure_reason).toMatch(/JSON Parse Error|Invalid JSON/i);
    });

    it("S1.4: handles UTF-8 BOM cleanly with JSON syntax failure", async () => {
      const bomContent = "\uFEFF" + 'not a valid json { "competitors": [] }';
      fs.writeFileSync(path.join(tempDir, "deliverable.json"), bomContent, "utf-8");

      const result = await verifyCompetitorReportDeliverable(tempDir);
      expect(result.tests_passed).toBe(false);
      expect(result.score).toBe(0.0);
      expect(result.failure_reason).toMatch(/JSON Parse Error/i);
    });

    it("S1.5: rejects JavaScript-style unquoted keys and Python-style booleans/None", async () => {
      const jsStyle = `{
        competitors: [
          { name: 'C1', website: 'https://c1.com', sources: ['https://s1.com'], description: None }
        ]
      }`;
      fs.writeFileSync(path.join(tempDir, "deliverable.json"), jsStyle);

      const result = await verifyCompetitorReportDeliverable(tempDir);
      expect(result.tests_passed).toBe(false);
      expect(result.score).toBe(0.0);
      expect(result.failure_reason).toMatch(/JSON Parse Error/i);
    });

    it("S1.6: rejects whitespace-only file with clear 'is empty' failure reason", async () => {
      fs.writeFileSync(path.join(tempDir, "deliverable.json"), "   \t\n   \r\n   ");

      const result = await verifyCompetitorReportDeliverable(tempDir);
      expect(result.tests_passed).toBe(false);
      expect(result.score).toBe(0.0);
      expect(result.failure_reason).toContain("is empty");
    });

    it("S1.7: rejects non-object JSON roots (primitive number, boolean, null, array)", async () => {
      const primitives = ["42", "true", "null", "[]"];
      for (const prim of primitives) {
        fs.writeFileSync(path.join(tempDir, "deliverable.json"), prim);
        const result = await verifyCompetitorReportDeliverable(tempDir);
        expect(result.tests_passed).toBe(false);
        expect(result.score).toBe(0.0);
        expect(result.failure_reason).toMatch(/validation failed/i);
      }
    });

    it("S1.8: pure validator rejects corrupt in-memory primitives and objects without throwing", () => {
      const corruptInputs: unknown[] = [
        undefined,
        null,
        0,
        123,
        NaN,
        Infinity,
        "string",
        [],
        [1, 2, 3],
        {},
        { competitors: null },
        { competitors: "invalid" },
        { competitors: 42 },
        { competitors: {} },
      ];

      for (const input of corruptInputs) {
        const result = validateCompetitorReport(input);
        expect(result.tests_passed).toBe(false);
        expect(result.score).toBe(0.0);
        expect(result.failure_reason).toBeDefined();
      }
    });

    it("S1.10: pure validator accepts valid deliverable with unicode characters in name/summary", () => {
      const result = validateCompetitorReport({
        taskGoal: "Goal with emoji 🚀 and unicode: 日本語 / العربية",
        summary: "Summary with symbols: © ® ™ § ¶",
        competitors: [
          { name: "Соперник 1", website: "https://c1.com", sources: ["https://s1.com"] },
          { name: "مُنافِس 2", website: "https://c2.com", sources: ["https://s2.com"] },
          { name: "競合 3", website: "https://c3.com", sources: ["https://s3.com"] },
        ],
      });
      expect(result.tests_passed).toBe(true);
      expect(result.score).toBe(1.0);
    });

    it("S1.11: handles unknown extra properties cleanly without failing schema", () => {
      // Zod object default strips unknown keys
      const result = validateCompetitorReport({
        taskGoal: "Goal",
        unexpectedExtraField: { nested: [1, 2, 3], secret: "data" },
        competitors: [
          { name: "C1", website: "https://c1.com", sources: ["https://s1.com"], extraField: 123 },
          { name: "C2", website: "https://c2.com", sources: ["https://s2.com"] },
          { name: "C3", website: "https://c3.com", sources: ["https://s3.com"] },
        ],
      });
      expect(result.tests_passed).toBe(true);
      expect(result.score).toBe(1.0);
    });
  });

  // =========================================================================
  // SUITE 2: SCHEMA BOUNDARY CONDITIONS & URL PROTOCOL RESTRICTIONS
  // =========================================================================
  describe("Suite 2: Schema Boundary Conditions & URL Protocol Restrictions", () => {
    it("S2.1: rejects exactly 2 competitors with explicit count violation", () => {
      const result = validateCompetitorReport({
        competitors: [
          { name: "C1", website: "https://c1.com", sources: ["https://s1.com"] },
          { name: "C2", website: "https://c2.com", sources: ["https://s2.com"] },
        ],
      });
      expect(result.tests_passed).toBe(false);
      expect(result.score).toBe(0.0);
      expect(result.failure_reason).toContain("Expected >= 3 competitors, received 2");
    });

    it("S2.2: accepts exactly 3 competitors (exact boundary threshold)", () => {
      const result = validateCompetitorReport({
        competitors: [
          { name: "C1", website: "https://c1.com", sources: ["https://s1.com"] },
          { name: "C2", website: "https://c2.com", sources: ["https://s2.com"] },
          { name: "C3", website: "https://c3.com", sources: ["https://s3.com"] },
        ],
      });
      expect(result.tests_passed).toBe(true);
      expect(result.score).toBe(1.0);
      expect(result.competitorsCount).toBe(3);
    });

    it("S2.3: rejects competitor name consisting only of whitespace", () => {
      const result = validateCompetitorReport({
        competitors: [
          { name: "    \t  \n  ", website: "https://c1.com", sources: ["https://s1.com"] },
          { name: "C2", website: "https://c2.com", sources: ["https://s2.com"] },
          { name: "C3", website: "https://c3.com", sources: ["https://s3.com"] },
        ],
      });
      expect(result.tests_passed).toBe(false);
      expect(result.score).toBe(0.0);
      expect(result.failure_reason).toMatch(/Competitor name is required/i);
    });

    it("S2.4: rejects non-HTTP website protocol schemes (javascript:, file:, ftp:, data:, ws:, mailto:)", () => {
      const maliciousSchemes = [
        "javascript:alert('pwned')",
        "file:///etc/passwd",
        "ftp://ftp.competitor.com/dump.zip",
        "data:text/html,<script>alert(1)</script>",
        "ws://live.competitor.com/socket",
        "mailto:info@competitor.com",
        "gopher://gopher.floodgap.com",
      ];

      for (const schemeUrl of maliciousSchemes) {
        const result = validateCompetitorReport({
          competitors: [
            { name: "C1", website: schemeUrl, sources: ["https://source.com"] },
            { name: "C2", website: "https://c2.com", sources: ["https://s2.com"] },
            { name: "C3", website: "https://c3.com", sources: ["https://s3.com"] },
          ],
        });
        expect(result.tests_passed).toBe(false);
        expect(result.score).toBe(0.0);
        expect(result.failure_reason).toMatch(
          /Invalid competitor website URL format: URL must start with http:\/\/ or https:\/\/|Invalid competitor website URL/i,
        );
      }
    });

    it("S2.5: rejects sources with empty citation array", () => {
      const result = validateCompetitorReport({
        competitors: [
          { name: "C1", website: "https://c1.com", sources: [] },
          { name: "C2", website: "https://c2.com", sources: ["https://s2.com"] },
          { name: "C3", website: "https://c3.com", sources: ["https://s3.com"] },
        ],
      });
      expect(result.tests_passed).toBe(false);
      expect(result.score).toBe(0.0);
      expect(result.failure_reason).toMatch(/At least one source citation URL is required/i);
    });

    it("S2.6: rejects sources with non-HTTP protocols in citations", () => {
      const result = validateCompetitorReport({
        competitors: [
          { name: "C1", website: "https://c1.com", sources: ["file:///etc/passwd"] },
          { name: "C2", website: "https://c2.com", sources: ["https://s2.com"] },
          { name: "C3", website: "https://c3.com", sources: ["https://s3.com"] },
        ],
      });
      expect(result.tests_passed).toBe(false);
      expect(result.score).toBe(0.0);
      expect(result.failure_reason).toMatch(/URL must start with http:\/\/ or https:\/\//i);
    });

    it("S2.7: accepts diverse valid HTTP and HTTPS URL formats", () => {
      const validUrlVariations = [
        // IPv4 host
        "http://127.0.0.1:3000/api",
        // Custom port
        "https://sub.domain.co.uk:8443/deep/path/resource",
        // Query parameters and fragment
        "https://example.com/search?q=ai+verifier&filter=prod&sort=desc#results-anchor",
        // Basic auth URL
        "https://user:pass@example.com/protected",
        // Punycode internationalized domain
        "https://xn--mnchen-3ya.de/stadt",
        // Long query string (1500+ chars)
        `https://analytics.example.com/events?payload=${"a".repeat(1500)}`,
      ];

      for (let i = 0; i < validUrlVariations.length; i++) {
        const testUrl = validUrlVariations[i];
        const result = validateCompetitorReport({
          competitors: [
            { name: `Comp ${i}`, website: testUrl, sources: ["https://source.com/page"] },
            { name: "C2", website: "https://c2.com", sources: [testUrl] },
            { name: "C3", website: "https://c3.com", sources: ["https://s3.com"] },
          ],
        });
        expect(result.tests_passed).toBe(true);
        expect(result.score).toBe(1.0);
      }
    });

    it("S2.8: validates internationalized domain names (IDN) and rejects URLs with invalid hosts/ports", () => {
      // Modern WhatWG URL parser supports IDN domains like münchen.de
      const idnResult = validateCompetitorReport({
        competitors: [
          { name: "C1", website: "https://münchen.de", sources: ["https://s1.com"] },
          { name: "C2", website: "https://xn--mnchen-3ya.de", sources: ["https://s2.com"] },
          { name: "C3", website: "https://c3.com", sources: ["https://s3.com"] },
        ],
      });
      expect(idnResult.tests_passed).toBe(true);
      expect(idnResult.score).toBe(1.0);

      // Rejects URLs with space in domain / host
      const spaceHostResult = validateCompetitorReport({
        competitors: [
          { name: "C1", website: "https://example .com/test", sources: ["https://s1.com"] },
          { name: "C2", website: "https://c2.com", sources: ["https://s2.com"] },
          { name: "C3", website: "https://c3.com", sources: ["https://s3.com"] },
        ],
      });
      expect(spaceHostResult.tests_passed).toBe(false);
      expect(spaceHostResult.failure_reason).toMatch(/Invalid competitor website URL format/i);

      // Rejects URLs with non-numeric port
      const invalidPortResult = validateCompetitorReport({
        competitors: [
          { name: "C1", website: "https://example.com:abc/path", sources: ["https://s1.com"] },
          { name: "C2", website: "https://c2.com", sources: ["https://s2.com"] },
          { name: "C3", website: "https://c3.com", sources: ["https://s3.com"] },
        ],
      });
      expect(invalidPortResult.tests_passed).toBe(false);
      expect(invalidPortResult.failure_reason).toMatch(/Invalid competitor website URL format/i);

      // Rejects URLs with missing host (bare scheme)
      const missingHostResult = validateCompetitorReport({
        competitors: [
          { name: "C1", website: "https://", sources: ["https://s1.com"] },
          { name: "C2", website: "https://c2.com", sources: ["https://s2.com"] },
          { name: "C3", website: "https://c3.com", sources: ["https://s3.com"] },
        ],
      });
      expect(missingHostResult.tests_passed).toBe(false);
    });

    it("S2.9: accepts localhost URLs with and without port", () => {
      const localhostResult = validateCompetitorReport({
        competitors: [
          { name: "C1", website: "http://localhost:3000/api", sources: ["https://s1.com"] },
          { name: "C2", website: "http://localhost", sources: ["https://s2.com"] },
          { name: "C3", website: "http://127.0.0.1", sources: ["https://s3.com"] },
        ],
      });
      expect(localhostResult.tests_passed).toBe(true);
      expect(localhostResult.score).toBe(1.0);
    });

    it("S2.10: handles massive text in summary and taskGoal (1 MB strings)", () => {
      const hugeString = "B".repeat(1_000_000);
      const result = validateCompetitorReport({
        taskGoal: hugeString,
        summary: hugeString,
        competitors: [
          { name: "C1", website: "https://c1.com", sources: ["https://s1.com"] },
          { name: "C2", website: "https://c2.com", sources: ["https://s2.com"] },
          { name: "C3", website: "https://c3.com", sources: ["https://s3.com"] },
        ],
      });
      expect(result.tests_passed).toBe(true);
      expect(result.score).toBe(1.0);
    });

    it("S2.11: handles 10,000-character long URL without catastrophic backtracking", () => {
      const longUrl = `https://analytics.example.com/track?payload=${"c".repeat(10_000)}`;
      const startTime = performance.now();
      const result = validateCompetitorReport({
        competitors: [
          { name: "C1", website: longUrl, sources: [longUrl] },
          { name: "C2", website: "https://c2.com", sources: ["https://s2.com"] },
          { name: "C3", website: "https://c3.com", sources: ["https://s3.com"] },
        ],
      });
      const durationMs = performance.now() - startTime;
      expect(result.tests_passed).toBe(true);
      expect(result.score).toBe(1.0);
      expect(durationMs).toBeLessThan(100); // Must be near-instantaneous (no ReDoS)
    });
  });

  // =========================================================================
  // SUITE 3: PATH TRAVERSAL & DIRECTORY ESCAPE RESILIENCE
  // =========================================================================
  describe("Suite 3: Path Traversal & Directory Resolution", () => {
    it("S3.1: rejects relative path traversal attempts to system files like ../../etc/passwd", async () => {
      // Even if /etc/passwd exists, verify it fails cleanly (non-JSON parse failure)
      const result = await verifyCompetitorReportDeliverable(
        tempDir,
        "../../../../../../../../../../etc/passwd",
      );
      expect(result.tests_passed).toBe(false);
      expect(result.score).toBe(0.0);
      expect(result.failure_reason).toBeDefined();
    });

    it("S3.2: rejects path traversal to nonexistent file with clean 'not found' failure", async () => {
      const result = await verifyCompetitorReportDeliverable(
        tempDir,
        "../../../../../../../../../../nonexistent_super_secret_file.json",
      );
      expect(result.tests_passed).toBe(false);
      expect(result.score).toBe(0.0);
      expect(result.summary).toContain("Deliverable file not found");
      expect(result.failure_reason).toContain("Deliverable file not found");
    });

    it("S3.3: rejects traversal pointing to valid external JSON (package.json) via schema failure", async () => {
      // Point deliverableRelPath to this project's package.json (valid JSON, but invalid deliverable schema)
      const packageJsonPath = path.resolve(__dirname, "../../../../package.json");
      expect(fs.existsSync(packageJsonPath)).toBe(true);

      const result = await verifyCompetitorReportDeliverable(tempDir, packageJsonPath);
      expect(result.tests_passed).toBe(false);
      expect(result.score).toBe(0.0);
      expect(result.failure_reason).toMatch(/schema validation failed|Expected >= 3 competitors/i);
    });

    it("S3.4: handles directory path passed as deliverableRelPath without crashing", async () => {
      // Passing a directory path instead of a file
      const subDir = path.join(tempDir, "empty-dir");
      fs.mkdirSync(subDir);

      const result = await verifyCompetitorReportDeliverable(tempDir, "empty-dir");
      expect(result.tests_passed).toBe(false);
      expect(result.score).toBe(0.0);
      expect(result.summary).toContain("Failed to read deliverable file");
      expect(result.failure_reason).toMatch(/EISDIR|illegal operation on a directory/i);
    });

    it("S3.5: handles symlink pointing to invalid file safely", async () => {
      const outsideDummy = path.join(tempDir, "..", "outside-file.txt");
      fs.writeFileSync(outsideDummy, "not json");

      try {
        const symlinkPath = path.join(tempDir, "deliverable.json");
        fs.symlinkSync(outsideDummy, symlinkPath);

        const result = await verifyCompetitorReportDeliverable(tempDir);
        expect(result.tests_passed).toBe(false);
        expect(result.score).toBe(0.0);
        expect(result.failure_reason).toMatch(/JSON Parse Error/i);
      } finally {
        if (fs.existsSync(outsideDummy)) {
          fs.unlinkSync(outsideDummy);
        }
      }
    });

    it("S3.6: handles null byte injection in deliverableRelPath cleanly or catches invalid path error", async () => {
      try {
        const result = await verifyCompetitorReportDeliverable(
          tempDir,
          "deliverable.json\0../../etc/passwd",
        );
        expect(result.tests_passed).toBe(false);
        expect(result.score).toBe(0.0);
      } catch (err) {
        // In Node.js, fs.existsSync throws TypeError on null bytes
        expect(err).toBeInstanceOf(TypeError);
        expect((err as TypeError).message).toMatch(/null byte/i);
      }
    });

    it("S3.7: honors DEFAULT_DELIVERABLE_FILENAMES priority order when multiple deliverable files exist", async () => {
      // Create deliverable.json (valid) and competitor-report.json (defective)
      const validDeliverable: CompetitorReport = {
        competitors: [
          { name: "C1", website: "https://c1.com", sources: ["https://s1.com"] },
          { name: "C2", website: "https://c2.com", sources: ["https://s2.com"] },
          { name: "C3", website: "https://c3.com", sources: ["https://s3.com"] },
        ],
      };
      const defectiveDeliverable = { competitors: [] };

      // Write deliverable.json first (index 0 in DEFAULT_DELIVERABLE_FILENAMES)
      fs.writeFileSync(path.join(tempDir, "deliverable.json"), JSON.stringify(validDeliverable));
      // Write competitor-report.json second (index 1)
      fs.writeFileSync(path.join(tempDir, "competitor-report.json"), JSON.stringify(defectiveDeliverable));

      const result = await verifyCompetitorReportDeliverable(tempDir);
      // deliverable.json is checked first, so it succeeds
      expect(result.tests_passed).toBe(true);
      expect(result.score).toBe(1.0);
      expect(result.deliverablePath).toContain("deliverable.json");
    });

    it("S3.8: URL-encoded traversal string is treated as literal non-existent filename", async () => {
      const result = await verifyCompetitorReportDeliverable(
        tempDir,
        "..%2F..%2Fetc%2Fpasswd",
      );
      expect(result.tests_passed).toBe(false);
      expect(result.score).toBe(0.0);
      expect(result.summary).toContain("Deliverable file not found at specified path");
    });

    it("S3.9: handles worktree path with trailing slashes and relative references", async () => {
      const validDeliverable: CompetitorReport = {
        competitors: [
          { name: "C1", website: "https://c1.com", sources: ["https://s1.com"] },
          { name: "C2", website: "https://c2.com", sources: ["https://s2.com"] },
          { name: "C3", website: "https://c3.com", sources: ["https://s3.com"] },
        ],
      };
      fs.writeFileSync(path.join(tempDir, "deliverable.json"), JSON.stringify(validDeliverable));

      const trailingSlashPath = tempDir + path.sep;
      const result = await verifyCompetitorReportDeliverable(trailingSlashPath);
      expect(result.tests_passed).toBe(true);
      expect(result.score).toBe(1.0);
    });
  });

  // =========================================================================
  // SUITE 4: LARGE PAYLOADS & STRESS PERFORMANCE
  // =========================================================================
  describe("Suite 4: Large Payload Stress & Scale", () => {
    it("S4.1: validates large report with 100 competitors and 10 sources each (1,000 sources total)", () => {
      const competitors = Array.from({ length: 100 }, (_, i) => ({
        name: `Competitor Entity #${i + 1}`,
        website: `https://competitor-${i + 1}.ai/product`,
        sources: Array.from(
          { length: 10 },
          (_, s) => `https://source-archive-${s + 1}.com/entity/${i + 1}`,
        ),
        description: `Detailed description for competitor ${i + 1} with features and pricing breakdown.`,
        notes: `Observed valuation ${i * 10}M`,
      }));

      const startTime = performance.now();
      const result = validateCompetitorReport({
        taskGoal: "Market Analysis for 100 Autonomous Agent Frameworks",
        summary: "Extensive market benchmarking report",
        generatedAt: new Date().toISOString(),
        competitors,
      });
      const durationMs = performance.now() - startTime;

      expect(result.tests_passed).toBe(true);
      expect(result.score).toBe(1.0);
      expect(result.competitorsCount).toBe(100);
      expect(durationMs).toBeLessThan(1000); // Must complete under 1 second
    });

    it("S4.2: validates massive report with 100 competitors and 100 sources each (10,000 sources total)", () => {
      const competitors = Array.from({ length: 100 }, (_, i) => ({
        name: `Scale Corp ${i}`,
        website: `https://scale-corp-${i}.io`,
        sources: Array.from(
          { length: 100 },
          (_, s) => `https://citations-aggregator.org/source/${i}/${s}`,
        ),
      }));

      const startTime = performance.now();
      const result = validateCompetitorReport({ competitors });
      const durationMs = performance.now() - startTime;

      expect(result.tests_passed).toBe(true);
      expect(result.score).toBe(1.0);
      expect(result.competitorsCount).toBe(100);
      expect(durationMs).toBeLessThan(3000); // 10k sources validated in under 3 seconds
    });

    it("S4.3: disk verifier verifies 2 MB deliverable JSON file on disk smoothly", async () => {
      // Generate ~2MB+ deliverable JSON file
      const competitors = Array.from({ length: 400 }, (_, i) => ({
        name: `Enterprise Vendor ${i}`,
        website: `https://vendor-${i}.com/enterprise`,
        sources: Array.from(
          { length: 20 },
          (_, s) => `https://research.partner-${s}.org/whitepaper/vendor-${i}`,
        ),
        description: "A".repeat(3000), // 3KB description each -> 400 * 3KB = ~1.5 - 2MB
      }));

      const filePath = path.join(tempDir, "competitor-report.json");
      fs.writeFileSync(filePath, JSON.stringify({ competitors }));

      const stat = fs.statSync(filePath);
      expect(stat.size).toBeGreaterThan(1_500_000); // > 1.5 MB

      const startTime = performance.now();
      const result = await verifyCompetitorReportDeliverable(tempDir);
      const durationMs = performance.now() - startTime;

      expect(result.tests_passed).toBe(true);
      expect(result.score).toBe(1.0);
      expect(result.competitorsCount).toBe(400);
      expect(durationMs).toBeLessThan(5000);
    });
  });

  // =========================================================================
  // SUITE 5: NON-DELIVERABLE WORKTREE FALLBACK & HYBRID EXECUTION
  // =========================================================================
  describe("Suite 5: Fallback & Generic Worktree Execution", () => {
    it("S5.1: falls back to testCommand when worktree contains NO deliverable files", async () => {
      let testCommandExecuted = false;
      const mockExecutor = async (cmd: string, args: string[]) => {
        if (cmd === "git" && args[0] === "diff") {
          return { exitCode: 0, stdout: "diff --git a/file b/file\n+code", stderr: "", timedOut: false };
        }
        if (cmd === "pnpm" && args[0] === "test") {
          testCommandExecuted = true;
          return { exitCode: 0, stdout: "All 12 tests passed", stderr: "", timedOut: false };
        }
        return { exitCode: 0, stdout: "", stderr: "", timedOut: false };
      };

      const result = await verifyWorktree({
        worktreePath: tempDir, // No deliverable file in tempDir
        executor: mockExecutor,
        testCommand: "pnpm test",
      });

      expect(testCommandExecuted).toBe(true);
      expect(result.tests_passed).toBe(true);
      expect(result.score).toBe(1.0);
      expect(result.summary).toContain("Tests passed successfully");
      expect(result.diff).toContain("+code");
    });

    it("S5.2: fallback fails when testCommand fails", async () => {
      const mockExecutor = async (cmd: string, args: string[]) => {
        if (cmd === "git" && args[0] === "diff") {
          return { exitCode: 0, stdout: "diff --git a/file b/file\n+code", stderr: "", timedOut: false };
        }
        if (cmd === "pnpm" && args[0] === "test") {
          return { exitCode: 1, stdout: "", stderr: "AssertionError: expected true to be false", timedOut: false };
        }
        return { exitCode: 0, stdout: "", stderr: "", timedOut: false };
      };

      const result = await verifyWorktree({
        worktreePath: tempDir,
        executor: mockExecutor,
        testCommand: "pnpm test",
      });

      expect(result.tests_passed).toBe(false);
      expect(result.score).toBe(0.0);
      expect(result.failure_reason).toContain("AssertionError");
    });

    it("S5.3: fallback fails when tests pass but no git modifications exist in worktree", async () => {
      const mockExecutor = async (cmd: string, args: string[]) => {
        if (cmd === "git" && args[0] === "diff") {
          return { exitCode: 0, stdout: "", stderr: "", timedOut: false };
        }
        if (cmd === "git" && args[0] === "status") {
          return { exitCode: 0, stdout: "", stderr: "", timedOut: false };
        }
        if (cmd === "pnpm" && args[0] === "test") {
          return { exitCode: 0, stdout: "Tests passed", stderr: "", timedOut: false };
        }
        return { exitCode: 0, stdout: "", stderr: "", timedOut: false };
      };

      const result = await verifyWorktree({
        worktreePath: tempDir,
        executor: mockExecutor,
        testCommand: "pnpm test",
      });

      expect(result.tests_passed).toBe(false);
      expect(result.score).toBe(0.0);
      expect(result.summary).toContain("No modifications detected");
      expect(result.failure_reason).toContain("No changes made in worktree");
    });

    it("S5.4: verifyDeliverable: true fails immediately when deliverable file is missing, without executing testCommand", async () => {
      let testCommandRan = false;
      const mockExecutor = async (cmd: string, _args: string[]) => {
        if (cmd === "pnpm") {
          testCommandRan = true;
          return { exitCode: 0, stdout: "Passed", stderr: "", timedOut: false };
        }
        return { exitCode: 0, stdout: "", stderr: "", timedOut: false };
      };

      const result = await verifyWorktree({
        worktreePath: tempDir,
        executor: mockExecutor,
        verifyDeliverable: true,
        testCommand: "pnpm test",
      });

      expect(result.tests_passed).toBe(false);
      expect(result.score).toBe(0.0);
      expect(result.summary).toContain("Deliverable file not found in worktree");
      expect(testCommandRan).toBe(false); // Short-circuits without running shell tests
    });

    it("S5.5: verifyDeliverable: false bypasses deliverable check even if deliverable file is present", async () => {
      // Put a defective deliverable file in worktree
      fs.writeFileSync(path.join(tempDir, "deliverable.json"), JSON.stringify({ competitors: [] }));

      let testCommandRan = false;
      const mockExecutor = async (cmd: string, args: string[]) => {
        if (cmd === "git" && args[0] === "diff") {
          return { exitCode: 0, stdout: "diff --git a b\n+fix", stderr: "", timedOut: false };
        }
        if (cmd === "pnpm" && args[0] === "test") {
          testCommandRan = true;
          return { exitCode: 0, stdout: "All tests passed", stderr: "", timedOut: false };
        }
        return { exitCode: 0, stdout: "", stderr: "", timedOut: false };
      };

      const result = await verifyWorktree({
        worktreePath: tempDir,
        executor: mockExecutor,
        verifyDeliverable: false,
        testCommand: "pnpm test",
      });

      expect(testCommandRan).toBe(true);
      expect(result.tests_passed).toBe(true);
      expect(result.score).toBe(1.0);
    });

    it("S5.6: hybrid verification: runs both deliverable check and testCommand when both are present", async () => {
      // Put a valid deliverable file
      const validDeliverable: CompetitorReport = {
        competitors: [
          { name: "C1", website: "https://c1.com", sources: ["https://s1.com"] },
          { name: "C2", website: "https://c2.com", sources: ["https://s2.com"] },
          { name: "C3", website: "https://c3.com", sources: ["https://s3.com"] },
        ],
      };
      fs.writeFileSync(path.join(tempDir, "deliverable.json"), JSON.stringify(validDeliverable));

      let testCommandRan = false;
      const mockExecutor = async (cmd: string, args: string[]) => {
        if (cmd === "git" && args[0] === "diff") {
          return { exitCode: 0, stdout: "diff --git deliverable.json b/deliverable.json\n+added", stderr: "", timedOut: false };
        }
        if (cmd === "pnpm" && args[0] === "test") {
          testCommandRan = true;
          return { exitCode: 0, stdout: "Passed", stderr: "", timedOut: false };
        }
        return { exitCode: 0, stdout: "", stderr: "", timedOut: false };
      };

      const result = await verifyWorktree({
        worktreePath: tempDir,
        executor: mockExecutor,
        testCommand: "pnpm test",
      });

      expect(testCommandRan).toBe(true);
      expect(result.tests_passed).toBe(true);
      expect(result.score).toBe(1.0);
    });

    it("S5.7: handles command timeout in test execution cleanly", async () => {
      const mockExecutor = async (cmd: string, _args: string[]) => {
        if (cmd === "git") {
          return { exitCode: 0, stdout: "diff --git a b\n+code", stderr: "", timedOut: false };
        }
        if (cmd === "pnpm") {
          return { exitCode: 143, stdout: "", stderr: "", timedOut: true };
        }
        return { exitCode: 0, stdout: "", stderr: "", timedOut: false };
      };

      const result = await verifyWorktree({
        worktreePath: tempDir,
        executor: mockExecutor,
        timeoutMs: 5000,
        testCommand: "pnpm test",
      });

      expect(result.tests_passed).toBe(false);
      expect(result.score).toBe(0.0);
      expect(result.failure_reason).toContain("timed out after 5000ms");
    });

    it("S5.8: handles git diff failure cleanly", async () => {
      const mockExecutor = async (cmd: string, _args: string[]) => {
        if (cmd === "git") {
          return { exitCode: 128, stdout: "", stderr: "fatal: not a git repository", timedOut: false };
        }
        return { exitCode: 0, stdout: "", stderr: "", timedOut: false };
      };

      const result = await verifyWorktree({
        worktreePath: tempDir,
        executor: mockExecutor,
        testCommand: "pnpm test",
      });

      expect(result.tests_passed).toBe(false);
      expect(result.score).toBe(0.0);
      expect(result.summary).toContain("Failed to inspect git diff");
      expect(result.failure_reason).toContain("fatal: not a git repository");
    });
  });
});

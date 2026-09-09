import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import type { CommandExecutor } from "./cli-runner.js";
import { defaultCommandExecutor } from "./cli-runner.js";

/**
 * Zod schema for a single competitor research entry.
 */
export const CompetitorEntrySchema = z.object({
  name: z.string().trim().min(1, "Competitor name is required"),
  website: z
    .string()
    .url("Invalid competitor website URL format")
    .refine((url) => /^https?:\/\//i.test(url), "Invalid competitor website URL format: URL must start with http:// or https://"),
  sources: z
    .array(
      z
        .string()
        .url("Invalid source URL format")
        .refine((url) => /^https?:\/\//i.test(url), "Invalid source URL format: URL must start with http:// or https://"),
    )
    .min(1, "At least one source citation URL is required"),
  description: z.string().optional(),
  notes: z.string().optional(),
});

export type CompetitorEntry = z.infer<typeof CompetitorEntrySchema>;

/**
 * Zod schema for a complete competitor research deliverable report.
 * Requires at least 3 valid competitors.
 */
export const CompetitorReportSchema = z.object({
  competitors: z
    .array(CompetitorEntrySchema)
    .min(3, "Competitor report must contain at least 3 competitors"),
  taskGoal: z.string().optional(),
  summary: z.string().optional(),
  generatedAt: z.string().optional(),
});

export type CompetitorReport = z.infer<typeof CompetitorReportSchema>;

export const DEFAULT_DELIVERABLE_FILENAMES = [
  "deliverable.json",
  "competitor-report.json",
  "competitors.json",
  "report.json",
] as const;

export interface DeliverableVerificationResult {
  score: number;
  tests_passed: boolean;
  summary: string;
  failure_reason?: string;
  errors?: string[];
  competitorsCount?: number;
  deliverablePath?: string;
  data?: CompetitorReport;
}

export interface VerifierOptions {
  worktreePath: string;
  testCommand?: string;
  testArgs?: string[];
  diffRef?: string;
  timeoutMs?: number;
  passingScore?: number;
  skipTestsIfNoDiff?: boolean;
  executor?: CommandExecutor;
  /** If true, verifies competitor research deliverable report in worktree */
  verifyDeliverable?: boolean;
  /** Custom relative or absolute path to deliverable file */
  deliverableRelPath?: string;
}

export interface VerifierEvaluation {
  score: number;
  tests_passed: boolean;
  summary: string;
  failure_reason?: string;
  diff?: string;
  stdout?: string;
  stderr?: string;
  durationMs?: number;
  errors?: string[];
  competitorsCount?: number;
  deliverablePath?: string;
  data?: CompetitorReport;
}

/**
 * Formats Zod validation issues into human-readable error messages.
 */
function formatZodIssues(issues: z.ZodIssue[], rawData?: unknown): string[] {
  return issues.map((issue) => {
    const pathStr = issue.path.length > 0 ? issue.path.join(".") : "root";
    if (
      pathStr === "competitors" &&
      (issue.code === "too_small" || issue.message.includes("at least 3 competitors"))
    ) {
      const rawCompetitors = (rawData as Record<string, unknown> | null | undefined)?.competitors;
      const received = Array.isArray(rawCompetitors) ? rawCompetitors.length : 0;
      return `Expected >= 3 competitors, received ${received}`;
    }
    return `${pathStr}: ${issue.message}`;
  });
}

/**
 * Pure validator: validates parsed JSON or in-memory data against CompetitorReportSchema.
 */
export function validateCompetitorReport(data: unknown): DeliverableVerificationResult {
  const parseResult = CompetitorReportSchema.safeParse(data);

  if (!parseResult.success) {
    const errors = formatZodIssues(parseResult.error.issues, data);
    const failureReason = `Deliverable schema validation failed: ${errors.join("; ")}`;
    return {
      score: 0.0,
      tests_passed: false,
      summary: `Deliverable rejected: ${errors.length} schema violation(s) detected`,
      failure_reason: failureReason,
      errors,
    };
  }

  const competitorsCount = parseResult.data.competitors.length;
  return {
    score: 1.0,
    tests_passed: true,
    summary: `Competitor research deliverable verified successfully (${competitorsCount} competitors validated)`,
    competitorsCount,
    data: parseResult.data,
  };
}

/**
 * Locates, parses, and validates a competitor research deliverable JSON file in the target worktree.
 */
export async function verifyCompetitorReportDeliverable(
  worktreePath: string,
  deliverableRelPath?: string,
): Promise<DeliverableVerificationResult> {
  if (!worktreePath || worktreePath.trim().length === 0) {
    return {
      score: 0.0,
      tests_passed: false,
      summary: "Missing target worktree path for deliverable verification.",
      failure_reason: "worktreePath is required",
      errors: ["worktreePath is required"],
    };
  }

  // 1. Locate file
  let targetPath: string | null = null;
  if (deliverableRelPath && deliverableRelPath.trim().length > 0) {
    const resolved = path.isAbsolute(deliverableRelPath)
      ? deliverableRelPath
      : path.resolve(worktreePath, deliverableRelPath);
    if (fs.existsSync(resolved)) {
      targetPath = resolved;
    } else {
      return {
        score: 0.0,
        tests_passed: false,
        summary: `Deliverable file not found at specified path: ${deliverableRelPath}`,
        failure_reason: `Deliverable file not found: ${resolved}`,
        errors: [`File not found: ${resolved}`],
        deliverablePath: resolved,
      };
    }
  } else {
    for (const filename of DEFAULT_DELIVERABLE_FILENAMES) {
      const candidate = path.resolve(worktreePath, filename);
      if (fs.existsSync(candidate)) {
        targetPath = candidate;
        break;
      }
    }

    if (!targetPath) {
      return {
        score: 0.0,
        tests_passed: false,
        summary: "Deliverable file not found in worktree.",
        failure_reason: `Deliverable file not found in ${worktreePath}. Expected one of: ${DEFAULT_DELIVERABLE_FILENAMES.join(", ")}`,
        errors: [`Deliverable file not found. Expected one of: ${DEFAULT_DELIVERABLE_FILENAMES.join(", ")}`],
      };
    }
  }

  // 2. Read file safely
  let rawContent: string;
  try {
    rawContent = await fs.promises.readFile(targetPath, "utf-8");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      score: 0.0,
      tests_passed: false,
      summary: "Failed to read deliverable file.",
      failure_reason: `Failed to read deliverable file at ${targetPath}: ${msg}`,
      errors: [msg],
      deliverablePath: targetPath,
    };
  }

  if (rawContent.trim().length === 0) {
    return {
      score: 0.0,
      tests_passed: false,
      summary: "Deliverable file is empty.",
      failure_reason: `Deliverable file at ${targetPath} is empty`,
      errors: ["Deliverable file is empty"],
      deliverablePath: targetPath,
    };
  }

  // 3. Parse JSON safely
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawContent);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      score: 0.0,
      tests_passed: false,
      summary: "Deliverable JSON parsing failed: malformed JSON.",
      failure_reason: `Invalid JSON format in deliverable: JSON Parse Error: ${msg}`,
      errors: [`Invalid JSON: ${msg}`],
      deliverablePath: targetPath,
    };
  }

  // 4. Validate schema
  const result = validateCompetitorReport(parsedJson);
  return {
    ...result,
    deliverablePath: targetPath,
  };
}

/**
 * Runs deterministic tests and inspects Git diffs in the target worktree.
 * Produces structured evaluation reports with score, tests_passed, and summary/failure_reason.
 */
export async function verifyWorktree(options: VerifierOptions): Promise<VerifierEvaluation> {
  if (!options.worktreePath || options.worktreePath.trim().length === 0) {
    return {
      score: 0.0,
      tests_passed: false,
      summary: "Missing target worktree path for verification.",
      failure_reason: "worktreePath is required",
    };
  }

  // Check if deliverable verification should be run
  const shouldVerifyDeliverable =
    options.verifyDeliverable === true ||
    options.deliverableRelPath !== undefined ||
    (options.verifyDeliverable !== false &&
      DEFAULT_DELIVERABLE_FILENAMES.some((f) =>
        fs.existsSync(path.resolve(options.worktreePath, f)),
      ));

  if (shouldVerifyDeliverable) {
    const deliverableResult = await verifyCompetitorReportDeliverable(
      options.worktreePath,
      options.deliverableRelPath,
    );
    if (!deliverableResult.tests_passed || !options.testCommand) {
      return {
        ...deliverableResult,
        diff: "",
        durationMs: 0,
      };
    }
  }

  const executor = options.executor ?? defaultCommandExecutor;
  const diffRef = options.diffRef ?? "HEAD";

  // 1. Inspect git diff
  const diffResult = await executor("git", ["diff", diffRef], {
    cwd: options.worktreePath,
  });

  if (diffResult.exitCode !== 0 || diffResult.error) {
    return {
      score: 0.0,
      tests_passed: false,
      summary: "Failed to inspect git diff in worktree.",
      failure_reason:
        diffResult.stderr.trim() ||
        diffResult.error?.message ||
        `git diff failed with exit code ${diffResult.exitCode}`,
      diff: "",
    };
  }

  let diffOutput = diffResult.stdout;
  let hasModifications = diffOutput.trim().length > 0;

  // If working tree diff against diffRef is empty, check status for untracked or staged changes
  if (!hasModifications) {
    const statusResult = await executor("git", ["status", "--porcelain"], {
      cwd: options.worktreePath,
    });
    if (statusResult.exitCode === 0 && statusResult.stdout.trim().length > 0) {
      hasModifications = true;
      diffOutput = statusResult.stdout;
    }
  }

  // If configured to skip tests when no modifications exist
  if (options.skipTestsIfNoDiff && !hasModifications) {
    return {
      score: 0.0,
      tests_passed: false,
      summary: "No modifications detected in worktree: changes required to pass verification.",
      failure_reason: "No changes made in worktree",
      diff: "",
    };
  }

  // 2. Deterministic test execution
  const testCommandStr = options.testCommand ?? "pnpm test";
  let cmd: string;
  let args: string[];

  if (options.testArgs && options.testArgs.length > 0) {
    cmd = testCommandStr;
    args = options.testArgs;
  } else {
    const parts = testCommandStr.trim().split(/\s+/).filter(Boolean);
    cmd = parts[0] ?? "pnpm";
    args = parts.slice(1);
  }

  const startTime = Date.now();
  const testResult = await executor(cmd, args, {
    cwd: options.worktreePath,
    timeoutMs: options.timeoutMs ?? 60_000,
  });
  const durationMs = Date.now() - startTime;

  const testsFailed =
    testResult.exitCode !== 0 || testResult.timedOut || testResult.error !== undefined;

  if (testsFailed) {
    const failureReason = testResult.timedOut
      ? `Test execution timed out after ${options.timeoutMs ?? 60_000}ms`
      : testResult.stderr.trim() ||
        testResult.stdout.trim() ||
        testResult.error?.message ||
        `Tests failed with exit code ${testResult.exitCode}`;

    return {
      score: 0.0,
      tests_passed: false,
      summary: `Test execution failed with exit code ${testResult.exitCode ?? "null"}.`,
      failure_reason: failureReason,
      diff: diffOutput,
      stdout: testResult.stdout,
      stderr: testResult.stderr,
      durationMs,
    };
  }

  // 3. Tests passed: verify that modifications were actually made
  if (!hasModifications) {
    return {
      score: 0.0,
      tests_passed: false,
      summary: "No modifications detected in worktree: changes required to pass verification.",
      failure_reason: "No changes made in worktree",
      diff: "",
      stdout: testResult.stdout,
      stderr: testResult.stderr,
      durationMs,
    };
  }

  return {
    score: options.passingScore ?? 1.0,
    tests_passed: true,
    summary: "Tests passed successfully and changes verified.",
    diff: diffOutput,
    stdout: testResult.stdout,
    stderr: testResult.stderr,
    durationMs,
  };
}

/**
 * Agent class wrapper for deterministic test execution and diff verification.
 */
export class VerifierAgent {
  constructor(private defaultOptions: Partial<VerifierOptions> = {}) {}

  async verify(options: VerifierOptions): Promise<VerifierEvaluation> {
    return verifyWorktree({ ...this.defaultOptions, ...options });
  }

  async verifyCompetitorReport(
    worktreePath: string,
    deliverableRelPath?: string,
  ): Promise<DeliverableVerificationResult> {
    return verifyCompetitorReportDeliverable(worktreePath, deliverableRelPath);
  }
}

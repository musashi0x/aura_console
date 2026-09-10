import { randomBytes, randomUUID } from "node:crypto";
import { eq, getDb, schema } from "@aura/db";

import {
  type CommandExecutor,
  executeLocalAiCli,
  withWorktree,
} from "./cli-runner.js";
import {
  type CandidateReputation,
  createInitialReputation,
  rehydrateFromSibyl,
  updateReputation,
} from "./reputation-fsm.js";
import { commitMemoryToBaseSepolia } from "./memory-commitment.js";
import fs from "node:fs";
import path from "node:path";
import { RunStore } from "./run-store.js";
import {
  recordEpisodeToSibyl,
  retrieveFromSibyl,
  updateCounterpartyInSibyl,
} from "./sibyl.js";
import { missionLogs } from "./mission-logs.js";
import {
  type VerifierEvaluation,
  verifyWorktree,
  verifyCompetitorReportDeliverable,
  DEFAULT_DELIVERABLE_FILENAMES,
} from "./verifier-agent.js";

export interface ExecuteMissionOptions {
  runId: string;
  mode?: "DETERMINISTIC" | "CLI_WORKER";
  worktreePath?: string;
  executor?: CommandExecutor;
  network?: string;
  /** Explicit verification override for testing or dry-runs */
  evaluationOverride?: Partial<VerifierEvaluation>;
  /** Optional relative or absolute path to deliverable file (e.g. 'competitor-report.json') */
  deliverablePath?: string;
  /** Optional custom test command */
  testCommand?: string;
  /** If true, explicitly verify competitor research deliverable */
  verifyDeliverable?: boolean;
}

export interface MissionExecutionResult {
  runId: string;
  status: "COMPLETED" | "FAILED" | "REJECTED";
  counterpartyKey: string;
  amountUsdc: string;
  evaluation: VerifierEvaluation;
  reputation: CandidateReputation;
  sibylRecorded: boolean;
}

const GRANTED = "approval.granted";
const RESUMED = "run.resumed";
const JOB_FUNDED = "acp.job.funded";
const EVALUATED = "evaluation.completed";
const SETTLED = "commitment.settled";
const OUTCOME = "outcome.recorded";

export class MissionExecutionService {
  constructor(private readonly store: RunStore = new RunStore()) {}

  async execute(options: ExecuteMissionOptions): Promise<MissionExecutionResult> {
    const { runId } = options;
    const run = await this.store.getRun(runId);
    if (!run) {
      throw new Error(`Run ${runId} not found`);
    }

    const events = await this.store.listEvents(runId);
    const grantEvent = events.filter((e) => e.type === GRANTED).at(-1);
    if (!grantEvent) {
      throw new Error(`Cannot execute mission ${runId}: no approval has been granted.`);
    }

    // Check if execution was already finalized
    const existingOutcome = events.find((e) => e.type === OUTCOME);
    if (existingOutcome) {
      const outcomeData = (existingOutcome.data ?? {}) as Record<string, unknown>;
      const evalEvent = events.find((e) => e.type === EVALUATED);
      const evalData = (evalEvent?.data ?? {}) as Record<string, unknown>;
      const grantData = (grantEvent.data ?? {}) as Record<string, unknown>;

      const cpKey = String(grantData.counterparty_key ?? "unknown");
      let rep = createInitialReputation(cpKey);
      if (cpKey !== "unknown") {
        try {
          const sibylRetrieval = await retrieveFromSibyl(cpKey);
          if (sibylRetrieval.status === "AVAILABLE") {
            rep = rehydrateFromSibyl(cpKey, sibylRetrieval);
          }
        } catch {
          // fallback to initial
        }
      }

      return {
        runId,
        status: outcomeData.result === "ACCEPTED" ? "COMPLETED" : "REJECTED",
        counterpartyKey: cpKey,
        amountUsdc: String(grantData.ceiling_usdc ?? "0"),
        evaluation: {
          score: Number(evalData.score ?? 0),
          tests_passed: evalData.result === "ACCEPTED",
          summary: String(evalData.summary ?? ""),
        },
        reputation: rep,
        sibylRecorded: true,
      };
    }

    const grantData = (grantEvent.data ?? {}) as Record<string, unknown>;
    const counterpartyKey = String(grantData.counterparty_key ?? "unknown");
    const amountUsdc = String(grantData.ceiling_usdc ?? grantData.amount_usdc ?? "0.000000");

    // 1. Resume run
    await this.append(runId, RESUMED, {
      summary: "Work resumed under the approved ceiling",
      ceiling_usdc: amountUsdc,
      counterparty_key: counterpartyKey,
    });

    // 2. Fund job
    await this.append(runId, JOB_FUNDED, {
      summary: "Job funded within the approved ceiling",
      counterparty_key: counterpartyKey,
      amount_usdc: amountUsdc,
      job_state: "FUNDED",
    });

    // 3. Evaluate work
    let evaluation: VerifierEvaluation;
    const isCliWorker = options.mode === "CLI_WORKER" || grantData.mode === "CLI_WORKER";

    missionLogs.append(
      runId,
      "system",
      `Starting mission execution for run ${runId} (mode: ${isCliWorker ? "CLI_WORKER" : "DETERMINISTIC"}, ceiling: ${amountUsdc} USDC)`,
    );

    if (options.evaluationOverride) {
      evaluation = {
        score: options.evaluationOverride.score ?? 1.0,
        tests_passed: options.evaluationOverride.tests_passed ?? true,
        summary: options.evaluationOverride.summary ?? "Delivery verified against the objective",
        diff: options.evaluationOverride.diff ?? "diff --git a/pkg b/pkg",
        failure_reason: options.evaluationOverride.failure_reason,
        errors: options.evaluationOverride.errors,
      };
      missionLogs.append(runId, "system", `Execution override applied: ${evaluation.summary}`);
    } else if (isCliWorker) {
      try {
        missionLogs.append(
          runId,
          "system",
          `Creating ephemeral worktree .worktrees/mission-${runId.slice(0, 8)}...`,
        );

        evaluation = await withWorktree(runId, { executor: options.executor }, async (worktreePath) => {
          const prompt = `Complete mission objective: "${run.objective}". Deliverable for counterparty "${counterpartyKey}" within ceiling ${amountUsdc} USDC. Implement code and verify tests pass.`;
          
          missionLogs.append(runId, "system", `Spawning AI CLI inside worktree '${worktreePath}'...`);

          await executeLocalAiCli({
            prompt,
            worktreePath,
            executor: options.executor,
            timeoutMs: 60_000,
            onStdout: (data) => missionLogs.append(runId, "stdout", data),
            onStderr: (data) => missionLogs.append(runId, "stderr", data),
          });

          missionLogs.append(runId, "system", "Executing Verifier Agent in sandbox worktree...");

          const hasDeliverable = DEFAULT_DELIVERABLE_FILENAMES.some((f) =>
            fs.existsSync(path.resolve(worktreePath, f)),
          );

          if (hasDeliverable || options.deliverablePath || options.verifyDeliverable || run.objective.toLowerCase().includes("competitor")) {
            return verifyCompetitorReportDeliverable(worktreePath, options.deliverablePath);
          }

          return verifyWorktree({
            worktreePath,
            executor: options.executor,
            testCommand: options.testCommand ?? "pnpm test",
          });
        });
      } catch (err) {
        evaluation = {
          score: 0.0,
          tests_passed: false,
          summary: "CLI worker execution or verification failed",
          failure_reason: err instanceof Error ? err.message : String(err),
        };
        missionLogs.append(runId, "stderr", `Error: ${evaluation.failure_reason}`);
      }
    } else {
      // Run deterministic verifier
      try {
        missionLogs.append(runId, "system", "Running deterministic verifier...");
        const targetPath = options.worktreePath ?? process.cwd();
        const hasDeliverable = DEFAULT_DELIVERABLE_FILENAMES.some((f) =>
          fs.existsSync(path.resolve(targetPath, f)),
        );

        if (hasDeliverable || options.deliverablePath || options.verifyDeliverable || run.objective.toLowerCase().includes("competitor")) {
          evaluation = await verifyCompetitorReportDeliverable(targetPath, options.deliverablePath);
        } else {
          evaluation = await verifyWorktree({
            worktreePath: targetPath,
            executor: options.executor,
            testCommand: options.testCommand ?? "pnpm test",
          });
        }
      } catch (err) {
        evaluation = {
          score: 0.0,
          tests_passed: false,
          summary: "Verifier failed during test execution",
          failure_reason: err instanceof Error ? err.message : String(err),
        };
        missionLogs.append(runId, "stderr", `Verifier failure: ${evaluation.failure_reason}`);
      }
    }

    // 4. Record evaluation outcome
    const isPassed = evaluation.tests_passed && evaluation.score > 0;
    missionLogs.append(
      runId,
      "system",
      `Evaluation complete: ${isPassed ? "ACCEPTED" : "REJECTED"} (score: ${evaluation.score}). ${evaluation.summary}`,
    );

    await this.append(runId, EVALUATED, {
      summary: evaluation.summary || (isPassed ? "Delivery verified against the objective" : "Delivery failed verification"),
      result: isPassed ? "ACCEPTED" : "REJECTED",
      evaluated_by: "verifier_agent",
      score: evaluation.score,
      ...(evaluation.failure_reason ? { failure_reason: evaluation.failure_reason } : {}),
      ...(evaluation.diff ? { diff: evaluation.diff } : {}),
      ...(evaluation.errors && evaluation.errors.length > 0 ? { errors: evaluation.errors } : {}),
      ...(evaluation.competitorsCount !== undefined ? { competitors_count: evaluation.competitorsCount } : {}),
      ...(evaluation.deliverablePath ? { deliverable_path: evaluation.deliverablePath } : {}),
    });

    // 5. If passed, settle commitment
    if (isPassed) {
      const txHash = `0x${randomBytes(32).toString("hex")}`;
      missionLogs.append(
        runId,
        "system",
        `Payment approved (simulated settlement): ${txHash} (${amountUsdc} USDC simulated on ${options.network ?? "base-sepolia"})`,
      );
      await this.append(runId, SETTLED, {
        summary: "Payment approved (simulated settlement)",
        network: options.network ?? "base-sepolia",
        amount_usdc: amountUsdc,
        tx_hash: txHash,
        reference: txHash,
        simulated: true,
      });
    } else {
      missionLogs.append(
        runId,
        "system",
        "Settlement omitted due to failed verification (fail-closed invariant).",
      );
    }

    // 6. Record mission outcome
    missionLogs.append(
      runId,
      "system",
      `Mission outcome recorded to relationship memory: ${isPassed ? "ACCEPTED" : "REJECTED"}. Delivery result saved for next time.`,
    );
    await this.append(runId, OUTCOME, {
      summary: isPassed
        ? (evaluation.summary || "Mission outcome recorded to relationship memory")
        : `Mission failure recorded to relationship memory: ${evaluation.failure_reason ?? evaluation.summary ?? "failed verification"}`,
      outcome: isPassed ? "accepted" : "rejected",
      result: isPassed ? "ACCEPTED" : "REJECTED",
      score: evaluation.score,
      counterparty_key: counterpartyKey,
      ...(evaluation.failure_reason ? { failure_reason: evaluation.failure_reason, reason: evaluation.failure_reason } : {}),
      ...(evaluation.diff ? { diff: evaluation.diff } : {}),
      ...(evaluation.errors && evaluation.errors.length > 0 ? { errors: evaluation.errors } : {}),
    });

    // 7. Update Bayesian reputation & FSM
    let candidateRep = createInitialReputation(counterpartyKey);
    let sibylRecorded = false;

    if (counterpartyKey && counterpartyKey !== "unknown") {
      const sibylRetrieval = await retrieveFromSibyl(counterpartyKey);
      if (sibylRetrieval.status === "AVAILABLE") {
        candidateRep = rehydrateFromSibyl(counterpartyKey, sibylRetrieval);
      }

      // Apply Bayesian update
      candidateRep = updateReputation(candidateRep, isPassed ? "success" : "failure");

      // 8. Write back to Sibyl
      try {
        await updateCounterpartyInSibyl(counterpartyKey, {
          relationshipStatus: candidateRep.status,
          overallReliability: candidateRep.overallReliability,
          confidence: candidateRep.confidence,
          alpha: candidateRep.alpha,
          beta: candidateRep.beta,
          consecutiveFailures: candidateRep.consecutiveFailures,
          totalMissions: candidateRep.totalMissions,
          blockedReason: candidateRep.blockedReason,
          riskNote:
            candidateRep.status === "WATCH"
              ? "One acceptance failure inside the last 30 days applies a risk penalty."
              : candidateRep.blockedReason,
        });

        const epResult = await recordEpisodeToSibyl(counterpartyKey, {
          run: runId,
          taskType: "mission",
          outcome: isPassed ? "accepted" : "rejected",
          note: isPassed
            ? (evaluation.summary || "Delivered on time and verified against objective.")
            : `Failed verification: ${evaluation.failure_reason ?? evaluation.summary ?? "deliverable rejected"}`,
          occurredAt: new Date().toISOString(),
        });
        sibylRecorded = epResult.ok;

        // 9. Base Sepolia memory commitment
        try {
          const commitmentResult = await commitMemoryToBaseSepolia({
            counterpartyKey,
            version: candidateRep.totalMissions,
            profile: {
              relationshipStatus: candidateRep.status,
              overallReliability: candidateRep.overallReliability,
              confidence: candidateRep.confidence,
              memoryVersion: candidateRep.totalMissions,
            },
            runId,
            onSubmitted: async ({ txHash }) => {
              await this.append(runId, "memory.commitment.submitted", {
                summary: `Submitting memory v${candidateRep.totalMissions} commitment to Base Sepolia`,
                counterparty_key: counterpartyKey,
                memory_version: candidateRep.totalMissions,
                tx_hash: txHash,
              });
            },
          });

          await this.append(runId, "memory.commitment.confirmed", {
            summary: `Memory v${candidateRep.totalMissions} committed to Base Sepolia`,
            counterparty_key: counterpartyKey,
            memory_version: candidateRep.totalMissions,
            network: "Base Sepolia",
            tx_hash: commitmentResult.txHash,
            commitment: commitmentResult.commitment,
            explorer_url: commitmentResult.explorerUrl,
          });

          missionLogs.append(
            runId,
            "system",
            `Memory v${candidateRep.totalMissions} committed to Base Sepolia: ${commitmentResult.txHash}`,
          );
        } catch (e) {
          console.error("[mission-execution] Base memory commitment failed:", e);
        }

        // 10. Emit memory.diff.published
        await this.append(runId, "memory.diff.published", {
          summary: `Relationship memory updated for ${counterpartyKey}`,
          counterparty_key: counterpartyKey,
          status: candidateRep.status,
          after_reliability: candidateRep.overallReliability,
          after_version: candidateRep.totalMissions,
          sibyl_recorded: sibylRecorded,
        });
      } catch (e) {
        console.error("[mission-execution] Sibyl write-back failed:", e);
      }
    } else {
      candidateRep = updateReputation(candidateRep, isPassed ? "success" : "failure");
    }

    return {
      runId,
      status: isPassed ? "COMPLETED" : "REJECTED",
      counterpartyKey,
      amountUsdc,
      evaluation,
      reputation: candidateRep,
      sibylRecorded,
    };
  }

  async recordAcpOutcome(input: {
    runId: string;
    action: "complete" | "reject";
    reason?: string;
    counterpartyKey?: string;
  }): Promise<{
    runId: string;
    status: "COMPLETED" | "REJECTED";
    counterpartyKey: string;
    reputation: CandidateReputation;
    sibylRecorded: boolean;
  }> {
    const { runId, action, reason } = input;
    const isPassed = action === "complete";

    const run = await this.store.getRun(runId);
    if (!run) {
      throw new Error(`Run ${runId} not found`);
    }

    const events = await this.store.listEvents(runId);

    // Resolve counterpartyKey
    let counterpartyKey = input.counterpartyKey;
    if (!counterpartyKey) {
      for (const e of events) {
        const d = (e.data ?? {}) as Record<string, unknown>;
        if (typeof d.counterparty_key === "string" && d.counterparty_key !== "unknown") {
          counterpartyKey = d.counterparty_key;
          break;
        }
      }
    }

    // Check for linked run
    let linkedRunId: string | null = null;
    const linkedEvent = events.find((e) => e.type === "acp.job.linked");
    if (linkedEvent?.data) {
      const d = linkedEvent.data as Record<string, unknown>;
      linkedRunId = typeof d.run_id === "string" ? d.run_id : typeof d.runId === "string" ? d.runId : null;
    }
    if (!linkedRunId) {
      const db = getDb();
      const linkedByEvents = await db
        .select()
        .from(schema.runEvents)
        .where(eq(schema.runEvents.type, "acp.job.linked"));
      for (const evt of linkedByEvents) {
        const d = (evt.data ?? {}) as Record<string, unknown>;
        if (d.run_id === runId || d.runId === runId) {
          linkedRunId = evt.runId;
          break;
        }
      }
    }

    if (!counterpartyKey && linkedRunId) {
      const linkedEvents = await this.store.listEvents(linkedRunId);
      for (const e of linkedEvents) {
        const d = (e.data ?? {}) as Record<string, unknown>;
        if (typeof d.counterparty_key === "string" && d.counterparty_key !== "unknown") {
          counterpartyKey = d.counterparty_key;
          break;
        }
      }
    }

    if (!counterpartyKey) {
      counterpartyKey = "unknown";
    }

    const appendToBoth = async (type: string, data: Record<string, unknown>) => {
      await this.append(runId, type, data);
      if (linkedRunId && linkedRunId !== runId) {
        await this.append(linkedRunId, type, data);
      }
    };

    // 1. Emits outcome.recorded
    missionLogs.append(
      runId,
      "system",
      `Mission outcome recorded to relationship memory: ${isPassed ? "ACCEPTED" : "REJECTED"}.`,
    );
    await appendToBoth(OUTCOME, {
      summary: isPassed
        ? "ACP deliverable verified and accepted into relationship memory"
        : "ACP deliverable rejected by operator and recorded into relationship memory",
      outcome: isPassed ? "accepted" : "rejected",
      result: isPassed ? "ACCEPTED" : "REJECTED",
      reason: reason ?? (isPassed ? "Deliverable accepted" : "Deliverable rejected"),
      ...(!isPassed && reason ? { failure_reason: reason } : {}),
      counterparty_key: counterpartyKey,
    });

    // 2. Updates Bayesian reputation (updateReputation)
    let candidateRep = createInitialReputation(counterpartyKey);
    let sibylRecorded = false;

    if (counterpartyKey && counterpartyKey !== "unknown") {
      const sibylRetrieval = await retrieveFromSibyl(counterpartyKey);
      if (sibylRetrieval.status === "AVAILABLE") {
        candidateRep = rehydrateFromSibyl(counterpartyKey, sibylRetrieval);
      }

      // Apply Bayesian update
      candidateRep = updateReputation(candidateRep, isPassed ? "success" : "failure");

      // 3. Updates profile in Sibyl (updateCounterpartyInSibyl)
      try {
        await updateCounterpartyInSibyl(counterpartyKey, {
          relationshipStatus: candidateRep.status,
          overallReliability: candidateRep.overallReliability,
          confidence: candidateRep.confidence,
          alpha: candidateRep.alpha,
          beta: candidateRep.beta,
          consecutiveFailures: candidateRep.consecutiveFailures,
          totalMissions: candidateRep.totalMissions,
          blockedReason: candidateRep.blockedReason,
          riskNote:
            candidateRep.status === "WATCH"
              ? "One acceptance failure inside the last 30 days applies a risk penalty."
              : candidateRep.blockedReason,
        });

        // 4. Records episode to Sibyl (recordEpisodeToSibyl)
        const epResult = await recordEpisodeToSibyl(counterpartyKey, {
          run: runId,
          taskType: "acp_job",
          outcome: isPassed ? "accepted" : "rejected",
          note: isPassed
            ? "ACP deliverable approved by operator."
            : `ACP deliverable rejected: ${reason ?? "operator rejection"}`,
          occurredAt: new Date().toISOString(),
        });
        sibylRecorded = epResult.ok;

        // 5. Computes and commits salted memory to Base Sepolia (commitMemoryToBaseSepolia)
        try {
          const commitmentResult = await commitMemoryToBaseSepolia({
            counterpartyKey,
            version: candidateRep.totalMissions,
            profile: {
              relationshipStatus: candidateRep.status,
              overallReliability: candidateRep.overallReliability,
              confidence: candidateRep.confidence,
              memoryVersion: candidateRep.totalMissions,
            },
            runId,
            onSubmitted: async ({ txHash }) => {
              await appendToBoth("memory.commitment.submitted", {
                summary: `Submitting memory v${candidateRep.totalMissions} commitment to Base Sepolia`,
                counterparty_key: counterpartyKey,
                memory_version: candidateRep.totalMissions,
                tx_hash: txHash,
              });
            },
          });

          await appendToBoth("memory.commitment.confirmed", {
            summary: `Memory v${candidateRep.totalMissions} committed to Base Sepolia`,
            counterparty_key: counterpartyKey,
            memory_version: candidateRep.totalMissions,
            network: "Base Sepolia",
            tx_hash: commitmentResult.txHash,
            commitment: commitmentResult.commitment,
            explorer_url: commitmentResult.explorerUrl,
          });

          missionLogs.append(
            runId,
            "system",
            `Memory v${candidateRep.totalMissions} committed to Base Sepolia: ${commitmentResult.txHash}`,
          );
        } catch (e) {
          console.error("[mission-execution] Base memory commitment failed for ACP outcome:", e);
        }

        // 6. Emits memory.diff.published
        await appendToBoth("memory.diff.published", {
          summary: `Relationship memory updated for ${counterpartyKey}`,
          counterparty_key: counterpartyKey,
          status: candidateRep.status,
          after_reliability: candidateRep.overallReliability,
          after_version: candidateRep.totalMissions,
          sibyl_recorded: sibylRecorded,
        });
      } catch (e) {
        console.error("[mission-execution] Sibyl write-back failed for ACP outcome:", e);
      }
    } else {
      candidateRep = updateReputation(candidateRep, isPassed ? "success" : "failure");
    }

    return {
      runId,
      status: isPassed ? "COMPLETED" : "REJECTED",
      counterpartyKey,
      reputation: candidateRep,
      sibylRecorded,
    };
  }

  private append(runId: string, type: string, data: Record<string, unknown>) {
    return this.store.appendEvent({
      runId,
      eventId: randomUUID(),
      type,
      eventTime: new Date(),
      data,
    });
  }
}

import { randomUUID } from "node:crypto";
import { and, eq, getDb, schema, type Database } from "@aura/db";
import type { AcpAgent } from "@virtuals-protocol/acp-node-v2";

import { RunStore } from "../../services/run-store.js";
import { MissionExecutionService } from "../../services/mission-execution.js";
import { jsonLogger, type AcpLogger } from "../log.js";

export type EvaluatorOptions = {
  agent?: Pick<AcpAgent, "getSession">;
  db?: Database;
  runStore?: RunStore;
  executionService?: MissionExecutionService;
  log?: AcpLogger;
};

/**
 * Outbound evaluator for ACP jobs.
 *
 * It executes an operator's decision to complete (accept deliverable) or reject a job.
 * Contract / session calls (`session.complete`, `session.reject`) are strictly isolated
 * here in `outbound/` so the inbound runtime and event stream can never trigger them automatically.
 */
export class AcpEvaluator {
  private readonly db: Database;
  private readonly runStore: RunStore;
  private readonly executionService: MissionExecutionService;
  private readonly agent?: Pick<AcpAgent, "getSession">;
  private readonly log: AcpLogger;

  constructor(options: EvaluatorOptions = {}) {
    this.db = options.db ?? getDb();
    this.runStore = options.runStore ?? new RunStore(this.db);
    this.executionService = options.executionService ?? new MissionExecutionService(this.runStore);
    this.agent = options.agent;
    this.log = options.log ?? jsonLogger;
  }

  /**
   * Evaluates an ACP job as either completed (accepted) or rejected.
   * This is an operator-initiated action; the runtime never calls it automatically.
   */
  async evaluate(params: {
    chainId: number;
    jobId: string;
    action: "complete" | "reject";
    reason: string;
    evaluatorAddress?: string;
    runId?: string;
  }): Promise<{
    success: boolean;
    action: "complete" | "reject";
    reason: string;
    eventId: string;
    runId?: string;
  }> {
    const { chainId, jobId, action, reason } = params;

    // 1. If an active ACP agent session is available, call session.complete / session.reject
    if (this.agent) {
      const session = this.agent.getSession(chainId, jobId);
      if (session) {
        if (action === "complete") {
          await session.complete(reason);
        } else {
          await session.reject(reason);
        }
        this.log("info", `acp job ${action}d via session`, { chainId, jobId, reason });
      }
    }

    // 2. Resolve runId
    let runId = params.runId;
    if (!runId) {
      const [job] = await this.db
        .select({ runId: schema.acpJobs.runId })
        .from(schema.acpJobs)
        .where(and(eq(schema.acpJobs.chainId, chainId), eq(schema.acpJobs.jobId, jobId)))
        .limit(1);
      runId = job?.runId;
    }

    // 3. Append on-chain outcome event (acp.job.completed or acp.job.rejected)
    const eventType = action === "complete" ? "acp.job.completed" : "acp.job.rejected";
    const eventId = randomUUID();
    const eventTime = new Date();
    const eventData: Record<string, unknown> = {
      chain_id: chainId,
      job_id: jobId,
      reason,
      ...(action === "complete"
        ? { evaluator: params.evaluatorAddress ?? "operator" }
        : { rejector: params.evaluatorAddress ?? "operator" }),
    };

    if (runId) {
      await this.runStore.appendEvent({
        runId,
        eventId,
        type: eventType,
        eventTime,
        data: eventData,
      });

      // 4. Feed back into MissionExecutionService for episode write-back & Base memory commitment
      await this.executionService.recordAcpOutcome({
        runId,
        action,
        reason,
      });
    }

    return {
      success: true,
      action,
      reason,
      eventId,
      runId,
    };
  }
}

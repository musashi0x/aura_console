import { and, eq, getDb, schema, type Database } from "@aura/db";
import type { JobRoomEntry } from "@virtuals-protocol/acp-node-v2";

import { RunStore } from "../services/run-store.js";
import { runSeedForJob, translateEntry } from "./translate.js";

export type JobDescriptionFetcher = (chainId: number, jobId: string) => Promise<string | null>;

export type BridgeLogger = (
  level: "info" | "error",
  msg: string,
  fields: Record<string, unknown>,
) => void;

export type AcpBridgeOptions = {
  fetchJobDescription: JobDescriptionFetcher;
  db?: Database;
  runStore?: RunStore;
  log?: BridgeLogger;
};

const defaultLog: BridgeLogger = (level, msg, fields) => {
  const line = JSON.stringify({ level, msg, ...fields });
  if (level === "error") console.error(line);
  else console.log(line);
};

/**
 * Records what the ACP runtime observes, and nothing else.
 *
 * Every entry becomes one append-only `run_events` row through `RunStore`, the
 * only writer. The bridge never allocates a sequence — `RunStore` does that
 * inside the insert transaction — and it never calls a job action, so no
 * observation can move money.
 */
export class AcpBridge {
  private readonly db: Database;
  private readonly runStore: RunStore;
  private readonly fetchJobDescription: JobDescriptionFetcher;
  private readonly log: BridgeLogger;

  /**
   * One promise chain per job. The database serialises appends for a Run
   * anyway (`SELECT ... FOR UPDATE`), so this is not what keeps sequences
   * distinct — it is what keeps them in *arrival* order, which the lock alone
   * does not. Different jobs never wait on each other.
   */
  private readonly queues = new Map<string, Promise<unknown>>();

  constructor(options: AcpBridgeOptions) {
    this.db = options.db ?? getDb();
    this.runStore = options.runStore ?? new RunStore(this.db);
    this.fetchJobDescription = options.fetchJobDescription;
    this.log = options.log ?? defaultLog;
  }

  private static key(chainId: number, jobId: string): string {
    return `${chainId}:${jobId}`;
  }

  /**
   * Never rejects. A failure here must not tear down the stream handler or
   * stop the job's later entries from being recorded, so it is logged with
   * enough identity to find the row that is missing.
   */
  async handleEntry(entry: JobRoomEntry): Promise<void> {
    const key = AcpBridge.key(entry.chainId, entry.onChainJobId);
    const previous = this.queues.get(key) ?? Promise.resolve();

    const next = previous.then(() => this.appendEntry(entry));
    this.queues.set(
      key,
      next.catch(() => undefined),
    );

    try {
      await next;
    } finally {
      // Only the tail clears itself, so a queue still being appended to is
      // never dropped mid-chain.
      if (this.queues.get(key) === next || this.queues.get(key) === undefined) {
        this.queues.delete(key);
      }
    }
  }

  private async appendEntry(entry: JobRoomEntry): Promise<void> {
    const translated = translateEntry(entry);

    try {
      const runId = await this.resolveRunId(entry.chainId, entry.onChainJobId);
      const { created } = await this.runStore.appendEvent({
        runId,
        eventId: translated.eventId,
        type: translated.type,
        eventTime: translated.eventTime,
        data: translated.data,
      });

      this.log("info", created ? "acp event appended" : "acp event already recorded", {
        chainId: entry.chainId,
        jobId: entry.onChainJobId,
        eventId: translated.eventId,
        type: translated.type,
        runId,
      });
    } catch (error) {
      this.log("error", "acp event append failed", {
        chainId: entry.chainId,
        jobId: entry.onChainJobId,
        eventId: translated.eventId,
        type: translated.type,
        error: String(error),
      });
    }
  }

  /**
   * Resolves the job's Run, creating it on first sight. The Run and its
   * mapping commit together, so a crash cannot leave a Run nothing points at.
   */
  private async resolveRunId(chainId: number, jobId: string): Promise<string> {
    const existing = await this.findRunId(chainId, jobId);
    if (existing) return existing;

    const description = await this.fetchJobDescription(chainId, jobId);
    const seed = runSeedForJob({ chainId, jobId, description });

    try {
      return await this.db.transaction(async (tx) => {
        const run = await this.runStore.createRun(seed, tx);
        await tx.insert(schema.acpJobs).values({ chainId, jobId, runId: run.id });
        return run.id;
      });
    } catch (error) {
      // Another writer won the (chain_id, job_id) unique index between the
      // read and the insert. Its Run is the right one; ours rolled back.
      const winner = await this.findRunId(chainId, jobId);
      if (winner) return winner;
      throw error;
    }
  }

  private async findRunId(chainId: number, jobId: string): Promise<string | null> {
    const [row] = await this.db
      .select({ runId: schema.acpJobs.runId })
      .from(schema.acpJobs)
      .where(and(eq(schema.acpJobs.chainId, chainId), eq(schema.acpJobs.jobId, jobId)))
      .limit(1);

    return row?.runId ?? null;
  }
}

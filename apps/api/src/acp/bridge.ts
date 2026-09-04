import { and, asc, eq, getDb, isNull, schema, sql, type Database } from "@aura/db";
import type { JobRoomEntry } from "@virtuals-protocol/acp-node-v2";

import { RunStore } from "../services/run-store.js";
import { describedEvent, runSeedForJob, translateEntry } from "./events.js";
import { jsonLogger, type AcpLogger } from "./log.js";

export type JobDescriptionFetcher = (chainId: number, jobId: string) => Promise<string | null>;

export type AcpBridgeOptions = {
  /**
   * Optional. Used only to enrich a Run after its events are already recorded,
   * never on the path that records them.
   */
  fetchJobDescription?: JobDescriptionFetcher;
  db?: Database;
  runStore?: RunStore;
  log?: AcpLogger;
};

/** How many unprocessed rows one retry sweep will attempt. */
const SWEEP_BATCH = 100;

/**
 * Ceiling on the description fetch. It runs after the entry is durable, so a
 * slow host cannot lose anything — but without a bound it could stall the
 * job's queue indefinitely, and a missing description is cheaper than that.
 */
const ENRICH_TIMEOUT_MS = 5_000;

/**
 * Records what the ACP runtime observes, and nothing else.
 *
 * Two steps, deliberately separate. **Capture** writes the raw entry to
 * `acp_inbox` in a single statement with no external calls, which is the only
 * moment an entry can be lost — the ACP stream replays just its active jobs, so
 * anything dropped during an outage never comes back. **Projection** turns a
 * captured row into `run_events` through `RunStore`, and can be retried for as
 * long as it takes.
 *
 * The bridge never allocates a sequence (`RunStore` does that inside the insert
 * transaction) and never calls a job action, so no observation can move money.
 */
export class AcpBridge {
  private readonly db: Database;
  private readonly runStore: RunStore;
  private readonly fetchJobDescription: JobDescriptionFetcher | undefined;
  private readonly log: AcpLogger;

  /**
   * One promise chain per job. The database serialises appends for a Run
   * anyway (`SELECT ... FOR UPDATE`), so this is not what keeps sequences
   * distinct — it is what keeps them in *arrival* order, which the lock alone
   * does not. Different jobs never wait on each other.
   */
  private readonly queues = new Map<string, Promise<unknown>>();

  /** Jobs this process has already tried to enrich, so it asks the host once. */
  private readonly enriched = new Set<string>();

  constructor(options: AcpBridgeOptions = {}) {
    this.db = options.db ?? getDb();
    this.runStore = options.runStore ?? new RunStore(this.db);
    this.fetchJobDescription = options.fetchJobDescription;
    this.log = options.log ?? jsonLogger;
  }

  private static key(chainId: number, jobId: string): string {
    return `${chainId}:${jobId}`;
  }

  /**
   * Capture, then project. Never rejects: a projection failure must not tear
   * down the stream handler, and the captured row outlives it either way.
   *
   * Capture happens *before* the per-job queue on purpose. Behind the queue, a
   * hung projection would block the capture of everything after it — the exact
   * loss this design exists to prevent. The cost is that two `handleEntry`
   * calls racing for the same job reach the queue in whichever order their
   * inserts return, so arrival order is preserved for sequential delivery (how
   * the stream actually delivers) and not guaranteed under concurrent dispatch.
   * Domain time is the ordering fact either way; `sequence` records the order
   * we saw.
   */
  async handleEntry(entry: JobRoomEntry): Promise<void> {
    const captured = await this.capture(entry);
    if (captured.status !== "captured") return;

    await this.enqueue(entry.chainId, entry.onChainJobId, () => this.project(captured.row));
  }

  /**
   * One insert, no external calls, no transaction spanning anything else. A
   * duplicate delivery collides on the primary key and is skipped.
   *
   * Three outcomes, named rather than collapsed into a null: a fresh row to
   * project now, a row someone already captured, and a failure to capture at
   * all. Only the last one loses anything.
   */
  private async capture(entry: JobRoomEntry): Promise<CaptureResult> {
    const { eventId } = translateEntry(entry);

    try {
      const [row] = await this.db
        .insert(schema.acpInbox)
        .values({
          eventId,
          chainId: entry.chainId,
          jobId: entry.onChainJobId,
          entry,
        })
        .onConflictDoNothing()
        .returning();

      if (row) {
        return {
          status: "captured",
          row: { eventId, chainId: entry.chainId, jobId: entry.onChainJobId, entry },
        };
      }

      // It may still be unprocessed, so let the sweep own it rather than
      // racing a second projection for the same row here.
      return { status: "already_captured" };
    } catch (error) {
      this.log("error", "acp entry capture failed", {
        chainId: entry.chainId,
        jobId: entry.onChainJobId,
        eventId,
        error: String(error),
        lost: true,
      });
      return { status: "lost" };
    }
  }

  /**
   * Projects everything still unprocessed. Run at startup to pick up whatever a
   * crash left behind, and on an interval so a transient database or ACP
   * outage heals without an operator.
   */
  async sweep(limit: number = SWEEP_BATCH): Promise<{ attempted: number; projected: number }> {
    const rows = await this.db
      .select()
      .from(schema.acpInbox)
      .where(isNull(schema.acpInbox.processedAt))
      .orderBy(asc(schema.acpInbox.receivedAt))
      .limit(limit);

    let projected = 0;

    for (const row of rows) {
      const done = await this.enqueue(row.chainId, row.jobId, () =>
        this.project({
          eventId: row.eventId,
          chainId: row.chainId,
          jobId: row.jobId,
          entry: row.entry as JobRoomEntry,
        }),
      );
      if (done) projected += 1;
    }

    if (rows.length > 0) {
      this.log("info", "acp inbox swept", { attempted: rows.length, projected });
    }

    return { attempted: rows.length, projected };
  }

  /** Serialises work for one job while letting different jobs run in parallel. */
  private async enqueue<T>(chainId: number, jobId: string, work: () => Promise<T>): Promise<T> {
    const key = AcpBridge.key(chainId, jobId);
    const previous = this.queues.get(key) ?? Promise.resolve();
    const next = previous.then(work);
    const settled = next.catch(() => undefined);

    this.queues.set(key, settled);

    try {
      return await next;
    } finally {
      // Only the tail clears itself. If something was chained behind us the map
      // now holds that instead, and deleting it would let the next caller start
      // a parallel chain for the same job.
      if (this.queues.get(key) === settled) this.queues.delete(key);
    }
  }

  /**
   * Turns one captured row into a `run_events` row. A failure leaves
   * `processed_at` null and records the reason on the row, so the next sweep
   * retries it and a stuck entry explains itself without a log search.
   */
  private async project(row: InboxRow): Promise<boolean> {
    const translated = translateEntry(row.entry);

    try {
      const runId = await this.resolveRunId(row.chainId, row.jobId);
      const { created } = await this.runStore.appendEvent({
        runId,
        eventId: translated.eventId,
        type: translated.type,
        eventTime: translated.eventTime,
        data: translated.data,
      });

      await this.db
        .update(schema.acpInbox)
        .set({ processedAt: new Date(), lastError: null })
        .where(eq(schema.acpInbox.eventId, row.eventId));

      this.log("info", created ? "acp event appended" : "acp event already recorded", {
        chainId: row.chainId,
        jobId: row.jobId,
        eventId: translated.eventId,
        type: translated.type,
        runId,
      });

      // After the append and after the row is marked processed: nothing that
      // has already been observed can be delayed into loss by this call.
      await this.enrich(row.chainId, row.jobId, runId, translated.eventTime);
      return true;
    } catch (error) {
      await this.db
        .update(schema.acpInbox)
        .set({
          attempts: sql`${schema.acpInbox.attempts} + 1`,
          lastError: String(error),
        })
        .where(eq(schema.acpInbox.eventId, row.eventId));

      this.log("error", "acp event projection failed", {
        chainId: row.chainId,
        jobId: row.jobId,
        eventId: translated.eventId,
        type: translated.type,
        error: String(error),
        retryable: true,
      });
      return false;
    }
  }

  /**
   * Fetches the job's description and records it as an event. Deliberately
   * after the append and outside its transaction: this is the one call that
   * leaves the process, and nothing that has already been observed should wait
   * on it or be lost to it. A failure is logged and dropped.
   */
  private async enrich(
    chainId: number,
    jobId: string,
    runId: string,
    observedAt: Date,
  ): Promise<void> {
    if (!this.fetchJobDescription) return;

    const key = AcpBridge.key(chainId, jobId);
    if (this.enriched.has(key)) return;
    this.enriched.add(key);

    try {
      const description = (await withTimeout(
        this.fetchJobDescription(chainId, jobId),
        ENRICH_TIMEOUT_MS,
      ))?.trim();
      if (!description) return;

      const event = describedEvent({ chainId, jobId, description, observedAt });
      await this.runStore.appendEvent({ runId, ...event });
    } catch (error) {
      // Enrichment is not history. Losing it costs a description, not an event.
      this.enriched.delete(key);
      this.log("error", "acp job description fetch failed", {
        chainId,
        jobId,
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

    const seed = runSeedForJob({ chainId, jobId });

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

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms);
    timer.unref?.();
    promise.then(resolve, reject).finally(() => clearTimeout(timer));
  });
}

type InboxRow = {
  eventId: string;
  chainId: number;
  jobId: string;
  entry: JobRoomEntry;
};

type CaptureResult =
  | { status: "captured"; row: InboxRow }
  | { status: "already_captured" }
  | { status: "lost" };

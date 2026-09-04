import { eq, getDb, schema, sql, type Database } from "@aura/db";
import { AssetToken, type AcpAgent } from "@virtuals-protocol/acp-node-v2";

import { RunStore } from "../services/run-store.js";
import type { BridgeLogger } from "./bridge.js";
import { fundFailedEvent, fundSubmittedEvent, usdcRawFromString } from "./translate.js";

/**
 * How many times an authorization is retried before the runtime stops and
 * records a failure. A spend that keeps failing is a decision for a person,
 * not something to hammer at.
 */
const MAX_ATTEMPTS = 3;

export type SpendExecutorOptions = {
  agent: Pick<AcpAgent, "getSession">;
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
 * Executes authorizations that an operator has already made. It decides
 * nothing.
 *
 * The only input is an `acp_spend_intents` row, written by the authorization
 * route inside the same transaction as its `acp.fund.authorized` event. The
 * executor never reads `run_events` looking for something to do, so an
 * authorization event appended through the generic events route — which accepts
 * any type — produces no spend. That separation is what keeps the runtime
 * unable to spend on its own while still letting a person spend through it.
 *
 * A row is claimed before the chain is touched, so two workers cannot fund the
 * same job twice.
 */
export class AcpSpendExecutor {
  private readonly db: Database;
  private readonly runStore: RunStore;
  private readonly agent: Pick<AcpAgent, "getSession">;
  private readonly log: BridgeLogger;

  constructor(options: SpendExecutorOptions) {
    this.db = options.db ?? getDb();
    this.runStore = options.runStore ?? new RunStore(this.db);
    this.agent = options.agent;
    this.log = options.log ?? defaultLog;
  }

  /** Executes every authorization waiting. Returns what it managed to do. */
  async sweep(): Promise<{ claimed: number; submitted: number }> {
    let claimed = 0;
    let submitted = 0;

    for (;;) {
      const intent = await this.claim();
      if (!intent) break;

      claimed += 1;
      if (await this.execute(intent)) submitted += 1;
    }

    return { claimed, submitted };
  }

  /**
   * Takes the oldest unclaimed authorization, atomically. `FOR UPDATE SKIP
   * LOCKED` means a second worker moves to the next row instead of waiting for
   * one it must not also execute.
   */
  private async claim(): Promise<Claimed | null> {
    const result = await this.db.execute<Claimed>(sql`
      update acp_spend_intents
      set claimed_at = now(), attempts = attempts + 1
      where authorization_event_id = (
        select authorization_event_id
        from acp_spend_intents
        where claimed_at is null
          and submitted_at is null
          and attempts < ${MAX_ATTEMPTS}
        order by authorized_at
        limit 1
        for update skip locked
      )
      returning
        authorization_event_id as "authorizationEventId",
        run_id as "runId",
        chain_id as "chainId",
        job_id as "jobId",
        amount_usdc as "amountUsdc",
        attempts
    `);

    return result.rows[0] ?? null;
  }

  private async execute(intent: Claimed): Promise<boolean> {
    const chainId = Number(intent.chainId);
    const amountUsdc = intent.amountUsdc;

    try {
      const session = this.agent.getSession(chainId, intent.jobId);
      if (!session) {
        throw new Error(`No active ACP session for job ${intent.jobId} on chain ${chainId}`);
      }

      // Exact: the decimal string becomes a raw integer by integer arithmetic,
      // never through AssetToken.usdc, which takes a number.
      const amount = AssetToken.usdcFromRaw(usdcRawFromString(amountUsdc), chainId);
      await session.fund(amount);

      const submittedAt = new Date();
      await this.db.transaction(async (tx) => {
        await this.runStore.appendEvent(
          {
            runId: intent.runId,
            ...fundSubmittedEvent({
              authorizationEventId: intent.authorizationEventId,
              chainId,
              jobId: intent.jobId,
              amountUsdc,
              submittedAt,
            }),
          },
          tx,
        );

        await tx
          .update(schema.acpSpendIntents)
          .set({ submittedAt, lastError: null })
          .where(eq(schema.acpSpendIntents.authorizationEventId, intent.authorizationEventId));
      });

      this.log("info", "acp fund submitted", {
        chainId,
        jobId: intent.jobId,
        runId: intent.runId,
        amountUsdc,
        authorizationEventId: intent.authorizationEventId,
      });
      return true;
    } catch (error) {
      await this.recordFailure(intent, chainId, String(error));
      return false;
    }
  }

  /**
   * Releases the claim so the next sweep can retry, until the attempt ceiling.
   * Only the final failure becomes an event: a retry is operational noise, a
   * giving-up is history an operator needs.
   */
  private async recordFailure(intent: Claimed, chainId: number, reason: string): Promise<void> {
    const exhausted = intent.attempts >= MAX_ATTEMPTS;

    await this.db
      .update(schema.acpSpendIntents)
      .set({ claimedAt: null, lastError: reason })
      .where(eq(schema.acpSpendIntents.authorizationEventId, intent.authorizationEventId));

    if (exhausted) {
      await this.runStore.appendEvent({
        runId: intent.runId,
        ...fundFailedEvent({
          authorizationEventId: intent.authorizationEventId,
          chainId,
          jobId: intent.jobId,
          amountUsdc: intent.amountUsdc,
          reason,
          attempts: intent.attempts,
          failedAt: new Date(),
        }),
      });
    }

    this.log("error", "acp fund failed", {
      chainId,
      jobId: intent.jobId,
      runId: intent.runId,
      amountUsdc: intent.amountUsdc,
      authorizationEventId: intent.authorizationEventId,
      attempts: intent.attempts,
      exhausted,
      error: reason,
    });
  }
}

type Claimed = {
  authorizationEventId: string;
  runId: string;
  chainId: number | string;
  jobId: string;
  amountUsdc: string;
  attempts: number;
};

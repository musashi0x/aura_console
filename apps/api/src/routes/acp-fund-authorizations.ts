import { and, eq, getDb, schema } from "@aura/db";
import { z } from "zod";

import { fundAuthorizedEvent } from "../acp/domain/events.js";
import { httpError } from "../errors.js";
import { RunStore } from "../services/run-store.js";

const store = new RunStore();

export const authorizeFundSchema = z.object({
  /** Producer-supplied, same idempotency contract as the generic append route. */
  eventId: z.uuid(),
  // A string, not a number. This value becomes an on-chain integer, so it must
  // never pass through a double on its way there.
  amountUsdc: z
    .string()
    .regex(/^\d+(\.\d{1,6})?$/, "amountUsdc must be a decimal amount with at most 6 decimals")
    .refine((value) => Number.parseFloat(value) > 0, "amountUsdc must be greater than zero"),
  /** Domain time of the operator's decision. The server never substitutes now. */
  authorizedAt: z.iso.datetime({ offset: true }),
});

export type AuthorizeFundInput = z.infer<typeof authorizeFundSchema>;

/**
 * Records an operator's authorization to spend, and the instruction that
 * executes it, in one transaction.
 *
 * Two things are written and both are load-bearing. The `acp.fund.authorized`
 * event is the history: who decided what, in the same log as everything else.
 * The `acp_spend_intents` row is the instruction: it is the only thing the
 * runtime acts on. `POST /api/runs/:id/events` accepts any event type, so
 * without that separation a hand-written authorization event would move money.
 *
 * The runtime still never decides to spend. It executes a decision a person
 * already made, and the decision is auditable because it is an event.
 */
export async function authorizeFund(runId: string, input: AuthorizeFundInput) {
  const run = await store.getRun(runId);
  if (!run) {
    throw httpError(404, "run_not_found", `No Run with id ${runId}`);
  }

  const db = getDb();

  const [job] = await db
    .select()
    .from(schema.acpJobs)
    .where(eq(schema.acpJobs.runId, runId))
    .limit(1);

  if (!job) {
    // Not an empty result dressed up as success: this Run has no ACP job
    // behind it, so there is nothing that could be funded.
    throw httpError(
      409,
      "not_an_acp_run",
      `Run ${runId} has no ACP job, so there is nothing to fund`,
    );
  }

  const [pending] = await db
    .select({ id: schema.acpSpendIntents.authorizationEventId })
    .from(schema.acpSpendIntents)
    .where(
      and(
        eq(schema.acpSpendIntents.chainId, job.chainId),
        eq(schema.acpSpendIntents.jobId, job.jobId),
      ),
    )
    .limit(1);

  if (pending) {
    throw httpError(
      409,
      "fund_already_authorized",
      `Job ${job.jobId} already has an authorization (${pending.id}). Authorizing twice is how a double spend happens.`,
    );
  }

  const authorizedAt = new Date(input.authorizedAt);

  return db.transaction(async (tx) => {
    const { event } = await store.appendEvent(
      {
        runId,
        ...fundAuthorizedEvent({
          eventId: input.eventId,
          chainId: job.chainId,
          jobId: job.jobId,
          amountUsdc: input.amountUsdc,
          authorizedAt,
        }),
      },
      tx,
    );

    await tx.insert(schema.acpSpendIntents).values({
      authorizationEventId: input.eventId,
      runId,
      chainId: job.chainId,
      jobId: job.jobId,
      amountUsdc: input.amountUsdc,
      authorizedAt,
    });

    return { event, job };
  });
}

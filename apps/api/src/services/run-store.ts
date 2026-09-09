import { and, asc, desc, eq, getDb, gt, max, schema, sql, type Database } from "@aura/db";

import { httpError } from "../errors.js";

export type RunSource = "CONSOLE" | "AGENT" | "FIXTURE";

export interface CreateRunInput {
  objective: string;
  source: RunSource;
  /** Free text; the column defaults to base-sepolia when this is omitted. */
  environment?: string;
  budgetUsdc?: string | null;
  /** Domain time for the seed event. Defaults to now, explicitly, not implicitly. */
  occurredAt?: Date;
}

export interface AppendEventInput {
  runId: string;
  /** Producer-supplied so a retried append is recognisable. */
  eventId: string;
  type: string;
  eventTime: Date;
  data: unknown;
}

export interface RecordApprovalDecisionInput {
  runId: string;
  eventId: string;
  decision: "approve" | "reject";
  eventTime?: Date;
  ceilingUsdc?: string;
  reason?: string;
}

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

/**
 * Every write goes through here. Route handlers never allocate a sequence
 * number themselves, because sequence allocation is only safe inside the
 * transaction that also inserts the row.
 */
export class RunStore {
  constructor(private readonly db: Database = getDb()) {}

  /**
   * Creates the Run row and its `run.created` event in one transaction, so a
   * Run can never exist with no history.
   *
   * A caller that must commit something else alongside the Run — the ACP
   * bridge writing its job mapping — passes its own transaction in, so the two
   * writes land together or not at all.
   */
  async createRun(input: CreateRunInput, tx?: Tx) {
    const eventTime = input.occurredAt ?? new Date();

    const body = async (tx: Tx) => {
      const [run] = await tx
        .insert(schema.runs)
        .values({
          objective: input.objective,
          source: input.source,
          environment: input.environment ?? "base-sepolia",
          budgetUsdc: input.budgetUsdc ?? null,
        })
        .returning();

      if (!run) throw new Error("insert into runs returned no row");

      await tx.insert(schema.runEvents).values({
        eventId: crypto.randomUUID(),
        runId: run.id,
        sequence: 0,
        type: "run.created",
        eventTime,
        data: {
          objective: run.objective,
          source: run.source,
          environment: run.environment,
          budget_usdc: run.budgetUsdc,
        },
      });

      return run;
    };

    return tx ? body(tx) : this.db.transaction(body);
  }

  async listRuns(limit: number) {
    return this.db
      .select()
      .from(schema.runs)
      .orderBy(desc(schema.runs.createdAt), desc(schema.runs.id))
      .limit(limit);
  }

  async getRun(runId: string) {
    const [run] = await this.db
      .select()
      .from(schema.runs)
      .where(eq(schema.runs.id, runId))
      .limit(1);
    return run ?? null;
  }

  /** Canonical order, always by sequence, never by arrival or insertion time. */
  async listEvents(runId: string, afterSequence: number | null = null) {
    const bySequence = asc(schema.runEvents.sequence);
    if (afterSequence === null) {
      return this.db
        .select()
        .from(schema.runEvents)
        .where(eq(schema.runEvents.runId, runId))
        .orderBy(bySequence);
    }
    return this.db
      .select()
      .from(schema.runEvents)
      .where(and(eq(schema.runEvents.runId, runId), gt(schema.runEvents.sequence, afterSequence)))
      .orderBy(bySequence);
  }

  /**
   * Calculates total dynamic spend across all runs in the rolling 24-hour window.
   * Looks for settled, funded, or approved spend events and sums them by run.
   */
  async get24HourSpend(since?: Date): Promise<{ spentUsdc: string; runCount: number }> {
    const windowStart = since ?? new Date(Date.now() - 24 * 60 * 60 * 1000);
    try {
      const events = await this.db
        .select({
          runId: schema.runEvents.runId,
          type: schema.runEvents.type,
          data: schema.runEvents.data,
        })
        .from(schema.runEvents)
        .where(
          and(
            gt(schema.runEvents.eventTime, windowStart),
            sql`${schema.runEvents.type} in ('commitment.settled', 'acp.job.funded', 'approval.granted')`
          )
        )
        .orderBy(asc(schema.runEvents.sequence));

      const spendByRun = new Map<string, number>();
      for (const ev of events) {
        const data = (ev.data ?? {}) as Record<string, unknown>;
        const rawAmount =
          data.amount_usdc ??
          data.ceiling_usdc ??
          data.amount ??
          data.settled_amount_usdc;
        if (typeof rawAmount === "string" || typeof rawAmount === "number") {
          const num = typeof rawAmount === "number" ? rawAmount : parseFloat(String(rawAmount));
          if (!Number.isNaN(num) && num > 0) {
            if (ev.type === "commitment.settled" || ev.type === "acp.job.funded") {
              spendByRun.set(ev.runId, num);
            } else if (!spendByRun.has(ev.runId)) {
              spendByRun.set(ev.runId, num);
            }
          }
        }
      }

      let total = 0;
      for (const amount of spendByRun.values()) {
        total += amount;
      }
      return { spentUsdc: total.toFixed(2), runCount: spendByRun.size };
    } catch {
      return { spentUsdc: "0.00", runCount: 0 };
    }
  }

  /**
   * Appends one event. Replaying the same `event_id` with the same content
   * returns the stored event; replaying it with different content is a
   * conflict, because silently keeping either version would make the history
   * depend on delivery order.
   *
   * As with `createRun`, a caller that must commit something else alongside
   * the event passes its own transaction in. The spend route does this so an
   * authorization event and the instruction it creates land together.
   */
  async appendEvent(input: AppendEventInput, outerTx?: Tx) {
    const body = async (tx: Tx) => {
      const existing = await this.findEvent(tx, input.eventId);
      if (existing) return this.reconcile(existing, input);

      // Serialises appends for this Run so two writers cannot read the same
      // max(sequence). The unique index is the backstop, not the mechanism.
      const [locked] = await tx
        .select({ id: schema.runs.id })
        .from(schema.runs)
        .where(eq(schema.runs.id, input.runId))
        .for("update");

      if (!locked) {
        throw httpError(404, "run_not_found", `No Run with id ${input.runId}`);
      }

      const [head] = await tx
        .select({ max: max(schema.runEvents.sequence) })
        .from(schema.runEvents)
        .where(eq(schema.runEvents.runId, input.runId));

      const [row] = await tx
        .insert(schema.runEvents)
        .values({
          eventId: input.eventId,
          runId: input.runId,
          sequence: (head?.max ?? -1) + 1,
          type: input.type,
          eventTime: input.eventTime,
          data: input.data ?? {},
        })
        .returning();

      if (!row) throw new Error("insert into run_events returned no row");
      return { event: row, created: true };
    };

    return outerTx ? body(outerTx) : this.db.transaction(body);
  }

  /**
   * Records an operator's approval or rejection decision atomically.
   *
   * Holding the `runs` row lock for update ensures checking pending requests,
   * checking for prior settlement (already_approved / already_rejected), and
   * allocating the event sequence are performed in a single serialised critical section.
   */
  async recordApprovalDecision(input: RecordApprovalDecisionInput) {
    const eventTime = input.eventTime ?? new Date();

    return this.db.transaction(async (tx) => {
      const [locked] = await tx
        .select({ id: schema.runs.id })
        .from(schema.runs)
        .where(eq(schema.runs.id, input.runId))
        .for("update");

      if (!locked) {
        throw httpError(404, "run_not_found", `No Run ${input.runId}`);
      }

      const existing = await this.findEvent(tx, input.eventId);
      if (existing) {
        const expectedType = input.decision === "approve" ? "approval.granted" : "approval.rejected";
        if (existing.type !== expectedType || existing.runId !== input.runId) {
          throw httpError(
            409,
            "event_conflict",
            `Event ${input.eventId} already exists with different content`,
          );
        }
        return { event: existing, created: false };
      }

      const events = await tx
        .select()
        .from(schema.runEvents)
        .where(eq(schema.runEvents.runId, input.runId))
        .orderBy(asc(schema.runEvents.sequence));

      const REQUESTED = "approval.requested";
      const GRANTED = "approval.granted";
      const REJECTED = "approval.rejected";

      const lastRequested = events.filter((e) => e.type === REQUESTED).at(-1);
      if (!lastRequested) {
        throw httpError(
          409,
          "no_pending_approval",
          input.decision === "approve"
            ? "Nothing has asked for approval on this Mission, so there is nothing to approve."
            : "Nothing has asked for approval on this Mission, so there is nothing to reject.",
        );
      }

      const grantedAfter = events.some(
        (e) => e.type === GRANTED && e.sequence > lastRequested.sequence,
      );
      if (grantedAfter) {
        throw httpError(
          409,
          "already_approved",
          input.decision === "approve"
            ? "This request was already approved. A second grant would authorize a second action."
            : "This request was already approved.",
        );
      }

      const rejectedAfter = events.some(
        (e) => e.type === REJECTED && e.sequence > lastRequested.sequence,
      );
      if (rejectedAfter) {
        throw httpError(
          409,
          "already_rejected",
          "This request was already rejected.",
        );
      }

      const [head] = await tx
        .select({ max: max(schema.runEvents.sequence) })
        .from(schema.runEvents)
        .where(eq(schema.runEvents.runId, input.runId));

      const requested = (lastRequested.data ?? {}) as Record<string, unknown>;
      let eventType: string;
      let eventData: Record<string, unknown>;

      if (input.decision === "approve") {
        eventType = GRANTED;
        eventData = {
          summary: "Operator approved the requested action",
          ceiling_usdc: input.ceilingUsdc!,
          approves_event_id: lastRequested.eventId,
          action: requested.action ?? null,
          counterparty_key: requested.counterparty_key ?? null,
          granted_via: "console_operator_click",
        };
      } else {
        eventType = REJECTED;
        const ceilingUsdc = (requested.ceiling_usdc ?? requested.amount_usdc ?? null) as string | null;
        const reason = input.reason ?? "Operator rejected the requested action";
        eventData = {
          summary: reason,
          reason,
          ceiling_usdc: ceilingUsdc,
          rejected_event_id: lastRequested.eventId,
          action: requested.action ?? null,
          counterparty_key: requested.counterparty_key ?? null,
          granted_via: "console_operator_click",
        };
      }

      const [row] = await tx
        .insert(schema.runEvents)
        .values({
          eventId: input.eventId,
          runId: input.runId,
          sequence: (head?.max ?? -1) + 1,
          type: eventType,
          eventTime,
          data: eventData,
        })
        .returning();

      if (!row) throw new Error("insert into run_events returned no row");
      return { event: row, created: true };
    });
  }

  private async findEvent(tx: Tx, eventId: string) {
    const [row] = await tx
      .select()
      .from(schema.runEvents)
      .where(eq(schema.runEvents.eventId, eventId))
      .limit(1);
    return row ?? null;
  }

  private reconcile(existing: schema.RunEvent, input: AppendEventInput) {
    const same =
      existing.runId === input.runId &&
      existing.type === input.type &&
      existing.eventTime.getTime() === input.eventTime.getTime() &&
      JSON.stringify(existing.data) === JSON.stringify(input.data ?? {});

    if (!same) {
      throw httpError(
        409,
        "event_conflict",
        `Event ${input.eventId} already exists with different content`,
      );
    }
    return { event: existing, created: false };
  }
}

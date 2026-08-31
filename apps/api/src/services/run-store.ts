import { and, asc, desc, eq, getDb, schema, sql, type Database } from "@aura/db";

import { httpError } from "../errors.js";

export type RunSource = "CONSOLE" | "AGENT" | "FIXTURE";

export interface CreateRunInput {
  objective: string;
  source: RunSource;
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
   */
  async createRun(input: CreateRunInput) {
    const eventTime = input.occurredAt ?? new Date();

    return this.db.transaction(async (tx) => {
      const [run] = await tx
        .insert(schema.runs)
        .values({
          objective: input.objective,
          source: input.source,
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
    });
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
      .where(
        and(
          eq(schema.runEvents.runId, runId),
          sql`${schema.runEvents.sequence} > ${afterSequence}`,
        ),
      )
      .orderBy(bySequence);
  }

  /**
   * Appends one event. Replaying the same `event_id` with the same content
   * returns the stored event; replaying it with different content is a
   * conflict, because silently keeping either version would make the history
   * depend on delivery order.
   */
  async appendEvent(input: AppendEventInput) {
    return this.db.transaction(async (tx) => {
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
        .select({ max: sql<number | null>`max(${schema.runEvents.sequence})` })
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

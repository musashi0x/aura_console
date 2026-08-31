CREATE TABLE "run_events" (
	"event_id" uuid PRIMARY KEY NOT NULL,
	"run_id" uuid NOT NULL,
	"sequence" integer NOT NULL,
	"type" text NOT NULL,
	"event_time" timestamp with time zone NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "run_events_sequence_non_negative" CHECK ("run_events"."sequence" >= 0),
	CONSTRAINT "run_events_type_not_blank" CHECK (length(btrim("run_events"."type")) > 0)
);
--> statement-breakpoint
CREATE TABLE "runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"objective" text NOT NULL,
	"source" text NOT NULL,
	"environment" text DEFAULT 'non-mainnet' NOT NULL,
	"budget_usdc" numeric(20, 6),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "runs_objective_not_blank" CHECK (length(btrim("runs"."objective")) > 0),
	CONSTRAINT "runs_source_known" CHECK ("runs"."source" in ('CONSOLE', 'AGENT', 'FIXTURE')),
	CONSTRAINT "runs_budget_non_negative" CHECK ("runs"."budget_usdc" is null or "runs"."budget_usdc" >= 0)
);
--> statement-breakpoint
ALTER TABLE "run_events" ADD CONSTRAINT "run_events_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "run_events_run_sequence_key" ON "run_events" USING btree ("run_id","sequence");--> statement-breakpoint
CREATE INDEX "run_events_run_id_idx" ON "run_events" USING btree ("run_id");
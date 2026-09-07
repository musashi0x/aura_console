CREATE TABLE "acp_inbox" (
	"event_id" uuid PRIMARY KEY NOT NULL,
	"chain_id" bigint NOT NULL,
	"job_id" text NOT NULL,
	"entry" jsonb NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	CONSTRAINT "acp_inbox_chain_id_positive" CHECK ("acp_inbox"."chain_id" > 0),
	CONSTRAINT "acp_inbox_job_id_not_blank" CHECK (length(btrim("acp_inbox"."job_id")) > 0),
	CONSTRAINT "acp_inbox_attempts_non_negative" CHECK ("acp_inbox"."attempts" >= 0)
);
--> statement-breakpoint
CREATE TABLE "acp_jobs" (
	"chain_id" bigint NOT NULL,
	"job_id" text NOT NULL,
	"run_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "acp_jobs_chain_id_positive" CHECK ("acp_jobs"."chain_id" > 0),
	CONSTRAINT "acp_jobs_job_id_not_blank" CHECK (length(btrim("acp_jobs"."job_id")) > 0)
);
--> statement-breakpoint
CREATE TABLE "acp_spend_intents" (
	"authorization_event_id" uuid PRIMARY KEY NOT NULL,
	"run_id" uuid NOT NULL,
	"chain_id" bigint NOT NULL,
	"job_id" text NOT NULL,
	"amount_usdc" numeric(20, 6) NOT NULL,
	"authorized_at" timestamp with time zone NOT NULL,
	"claimed_at" timestamp with time zone,
	"submitted_at" timestamp with time zone,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	CONSTRAINT "acp_spend_intents_amount_positive" CHECK ("acp_spend_intents"."amount_usdc" > 0),
	CONSTRAINT "acp_spend_intents_chain_id_positive" CHECK ("acp_spend_intents"."chain_id" > 0),
	CONSTRAINT "acp_spend_intents_job_id_not_blank" CHECK (length(btrim("acp_spend_intents"."job_id")) > 0),
	CONSTRAINT "acp_spend_intents_attempts_non_negative" CHECK ("acp_spend_intents"."attempts" >= 0)
);
--> statement-breakpoint
ALTER TABLE "acp_jobs" ADD CONSTRAINT "acp_jobs_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "acp_spend_intents" ADD CONSTRAINT "acp_spend_intents_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "acp_inbox_unprocessed_idx" ON "acp_inbox" USING btree ("received_at") WHERE "acp_inbox"."processed_at" is null;--> statement-breakpoint
CREATE INDEX "acp_inbox_chain_job_idx" ON "acp_inbox" USING btree ("chain_id","job_id");--> statement-breakpoint
CREATE UNIQUE INDEX "acp_jobs_chain_job_key" ON "acp_jobs" USING btree ("chain_id","job_id");--> statement-breakpoint
CREATE INDEX "acp_jobs_run_id_idx" ON "acp_jobs" USING btree ("run_id");--> statement-breakpoint
CREATE UNIQUE INDEX "acp_spend_intents_pending_job_key" ON "acp_spend_intents" USING btree ("chain_id","job_id") WHERE "acp_spend_intents"."submitted_at" is null;--> statement-breakpoint
CREATE INDEX "acp_spend_intents_unclaimed_idx" ON "acp_spend_intents" USING btree ("authorized_at") WHERE "acp_spend_intents"."claimed_at" is null and "acp_spend_intents"."submitted_at" is null;--> statement-breakpoint
CREATE INDEX "acp_spend_intents_run_id_idx" ON "acp_spend_intents" USING btree ("run_id");
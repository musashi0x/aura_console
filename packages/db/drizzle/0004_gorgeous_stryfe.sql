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
ALTER TABLE "acp_spend_intents" ADD CONSTRAINT "acp_spend_intents_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "acp_spend_intents_pending_job_key" ON "acp_spend_intents" USING btree ("chain_id","job_id") WHERE "acp_spend_intents"."submitted_at" is null;--> statement-breakpoint
CREATE INDEX "acp_spend_intents_unclaimed_idx" ON "acp_spend_intents" USING btree ("authorized_at") WHERE "acp_spend_intents"."claimed_at" is null and "acp_spend_intents"."submitted_at" is null;--> statement-breakpoint
CREATE INDEX "acp_spend_intents_run_id_idx" ON "acp_spend_intents" USING btree ("run_id");
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
CREATE INDEX "acp_inbox_unprocessed_idx" ON "acp_inbox" USING btree ("received_at") WHERE "acp_inbox"."processed_at" is null;--> statement-breakpoint
CREATE INDEX "acp_inbox_chain_job_idx" ON "acp_inbox" USING btree ("chain_id","job_id");
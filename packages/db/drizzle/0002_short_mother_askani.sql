CREATE TABLE "acp_jobs" (
	"chain_id" bigint NOT NULL,
	"job_id" text NOT NULL,
	"run_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "acp_jobs_chain_id_positive" CHECK ("acp_jobs"."chain_id" > 0),
	CONSTRAINT "acp_jobs_job_id_not_blank" CHECK (length(btrim("acp_jobs"."job_id")) > 0)
);
--> statement-breakpoint
ALTER TABLE "acp_jobs" ADD CONSTRAINT "acp_jobs_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "acp_jobs_chain_job_key" ON "acp_jobs" USING btree ("chain_id","job_id");--> statement-breakpoint
CREATE INDEX "acp_jobs_run_id_idx" ON "acp_jobs" USING btree ("run_id");
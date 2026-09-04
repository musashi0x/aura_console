CREATE TABLE "agent_policies" (
	"agent_id" text PRIMARY KEY NOT NULL,
	"policy_version" integer DEFAULT 1 NOT NULL,
	"auto_spend_limit_usdc" numeric(20, 6),
	"absolute_spend_limit_usdc" numeric(20, 6),
	"daily_spend_limit_usdc" numeric(20, 6),
	"human_approval_above_usdc" numeric(20, 6),
	"minimum_reliability" integer,
	"preferred_provider_premium_limit" numeric(6, 4),
	"block_after_recent_failures" integer,
	"prefer_previous_success" boolean DEFAULT true NOT NULL,
	"require_verified_commitment" boolean DEFAULT false NOT NULL,
	"memory_error_override_allowed" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agent_policies_version_positive" CHECK ("agent_policies"."policy_version" > 0),
	CONSTRAINT "agent_policies_reliability_range" CHECK ("agent_policies"."minimum_reliability" is null or ("agent_policies"."minimum_reliability" between 0 and 100))
);
--> statement-breakpoint
CREATE TABLE "counterparties" (
	"counterparty_key" text PRIMARY KEY NOT NULL,
	"protocol" text NOT NULL,
	"agent_id" text NOT NULL,
	"address" text,
	"display_name" text,
	"avatar_url" text,
	"acp_lifecycle_state" text DEFAULT 'UNKNOWN' NOT NULL,
	"relationship_status" text DEFAULT 'NEW' NOT NULL,
	"latest_memory_version" integer DEFAULT 0 NOT NULL,
	"classified_aggregates" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"offerings" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"public_trust" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "counterparties_relationship_known" CHECK ("counterparties"."relationship_status" in ('NEW', 'KNOWN', 'PREFERRED', 'WATCH', 'BLOCKED', 'ARCHIVED')),
	CONSTRAINT "counterparties_memory_version_non_negative" CHECK ("counterparties"."latest_memory_version" >= 0)
);
--> statement-breakpoint
CREATE TABLE "counterparty_episodes" (
	"episode_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"counterparty_key" text NOT NULL,
	"owner_agent_id" text NOT NULL,
	"task_type" text NOT NULL,
	"outcome" text NOT NULL,
	"amount_usdc" numeric(20, 6),
	"occurred_at" timestamp with time zone NOT NULL,
	"source_run_id" uuid,
	"body" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "counterparty_episodes_outcome_known" CHECK ("counterparty_episodes"."outcome" in ('DELIVERED', 'FAILED', 'DISPUTED', 'CANCELLED'))
);
--> statement-breakpoint
CREATE TABLE "counterparty_profiles" (
	"profile_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"counterparty_key" text NOT NULL,
	"owner_agent_id" text NOT NULL,
	"memory_version" integer NOT NULL,
	"overall_reliability" integer,
	"task_fit" integer,
	"confidence" integer,
	"body" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "counterparty_profiles_version_positive" CHECK ("counterparty_profiles"."memory_version" > 0)
);
--> statement-breakpoint
CREATE TABLE "counterparty_salts" (
	"counterparty_key" text PRIMARY KEY NOT NULL,
	"salt" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memory_diffs" (
	"diff_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"counterparty_key" text NOT NULL,
	"owner_agent_id" text NOT NULL,
	"before_version" integer NOT NULL,
	"after_version" integer NOT NULL,
	"changes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"evidence_event_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"explanation" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "memory_diffs_versions_ordered" CHECK ("memory_diffs"."after_version" > "memory_diffs"."before_version")
);
--> statement-breakpoint
ALTER TABLE "counterparty_episodes" ADD CONSTRAINT "counterparty_episodes_counterparty_key_counterparties_counterparty_key_fk" FOREIGN KEY ("counterparty_key") REFERENCES "public"."counterparties"("counterparty_key") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "counterparty_profiles" ADD CONSTRAINT "counterparty_profiles_counterparty_key_counterparties_counterparty_key_fk" FOREIGN KEY ("counterparty_key") REFERENCES "public"."counterparties"("counterparty_key") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "counterparty_salts" ADD CONSTRAINT "counterparty_salts_counterparty_key_counterparties_counterparty_key_fk" FOREIGN KEY ("counterparty_key") REFERENCES "public"."counterparties"("counterparty_key") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memory_diffs" ADD CONSTRAINT "memory_diffs_counterparty_key_counterparties_counterparty_key_fk" FOREIGN KEY ("counterparty_key") REFERENCES "public"."counterparties"("counterparty_key") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "counterparties_relationship_idx" ON "counterparties" USING btree ("relationship_status");--> statement-breakpoint
CREATE INDEX "counterparty_episodes_key_idx" ON "counterparty_episodes" USING btree ("counterparty_key","occurred_at");--> statement-breakpoint
CREATE INDEX "counterparty_episodes_owner_idx" ON "counterparty_episodes" USING btree ("owner_agent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "counterparty_profiles_version_key" ON "counterparty_profiles" USING btree ("counterparty_key","owner_agent_id","memory_version");--> statement-breakpoint
CREATE INDEX "memory_diffs_key_idx" ON "memory_diffs" USING btree ("counterparty_key","after_version");
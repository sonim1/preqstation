CREATE TABLE IF NOT EXISTS "dispatch_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "owner_id" uuid NOT NULL,
  "scope" text NOT NULL,
  "objective" text NOT NULL,
  "project_key" text NOT NULL,
  "task_key" text,
  "engine" text,
  "dispatch_target" text DEFAULT 'claude-code-channel' NOT NULL,
  "branch_name" text,
  "prompt_metadata" jsonb,
  "state" text DEFAULT 'queued' NOT NULL,
  "error_message" text,
  "dispatched_at" timestamp (6) with time zone,
  "failed_at" timestamp (6) with time zone,
  "created_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp (6) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "dispatch_requests" ADD CONSTRAINT "dispatch_requests_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "dispatch_requests" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DO $$ BEGIN
 CREATE POLICY "dispatch_requests_owner_all" ON "dispatch_requests" AS PERMISSIVE FOR ALL TO public USING ("owner_id"::text = nullif(current_setting('app.user_id', true), '')) WITH CHECK ("owner_id"::text = nullif(current_setting('app.user_id', true), ''));
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dispatch_requests_owner_id_state_dispatch_target_idx" ON "dispatch_requests" USING btree ("owner_id","state","dispatch_target","created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dispatch_requests_owner_id_objective_idx" ON "dispatch_requests" USING btree ("owner_id","objective");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dispatch_requests_owner_id_project_key_idx" ON "dispatch_requests" USING btree ("owner_id","project_key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dispatch_requests_owner_id_task_key_idx" ON "dispatch_requests" USING btree ("owner_id","task_key");

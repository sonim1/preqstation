CREATE TABLE "dogfood_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"branch_name" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"engine" text,
	"target_url" text,
	"task_keys" jsonb NOT NULL,
	"summary" jsonb,
	"report_markdown" text,
	"started_at" timestamp (6) with time zone,
	"finished_at" timestamp (6) with time zone,
	"created_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (6) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "dogfood_runs" ADD CONSTRAINT "dogfood_runs_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dogfood_runs" ADD CONSTRAINT "dogfood_runs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dogfood_runs_owner_id_idx" ON "dogfood_runs" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "dogfood_runs_project_id_created_at_idx" ON "dogfood_runs" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE INDEX "dogfood_runs_owner_id_status_idx" ON "dogfood_runs" USING btree ("owner_id","status");
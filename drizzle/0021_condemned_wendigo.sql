CREATE TABLE "task_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"task_id" uuid NOT NULL,
	"parent_comment_id" uuid,
	"author_type" text DEFAULT 'user' NOT NULL,
	"author_name" text,
	"body" text NOT NULL,
	"run_state" text,
	"run_state_updated_at" timestamp (6) with time zone,
	"engine" text,
	"dispatch_target" text,
	"error_message" text,
	"metadata" jsonb,
	"created_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (6) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "task_comments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "task_comments_owner_id_idx" ON "task_comments" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "task_comments_task_id_created_at_idx" ON "task_comments" USING btree ("task_id","created_at");--> statement-breakpoint
CREATE INDEX "task_comments_owner_id_run_state_idx" ON "task_comments" USING btree ("owner_id","run_state");--> statement-breakpoint
CREATE INDEX "task_comments_parent_comment_id_idx" ON "task_comments" USING btree ("parent_comment_id");--> statement-breakpoint
CREATE POLICY "task_comments_owner_all" ON "task_comments" AS PERMISSIVE FOR ALL TO public USING ("task_comments"."owner_id"::text = nullif(current_setting('app.user_id', true), '')) WITH CHECK ("task_comments"."owner_id"::text = nullif(current_setting('app.user_id', true), ''));
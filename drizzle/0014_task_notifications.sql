CREATE TABLE "task_notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"project_id" uuid,
	"task_id" uuid NOT NULL,
	"task_key" text NOT NULL,
	"task_title" text NOT NULL,
	"status_from" text NOT NULL,
	"status_to" text NOT NULL,
	"read_at" timestamp (6) with time zone,
	"created_at" timestamp (6) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "task_notifications" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "task_notifications" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "task_notifications" ADD CONSTRAINT "task_notifications_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "task_notifications_owner_id_read_at_created_at_idx" ON "task_notifications" USING btree ("owner_id","read_at","created_at");--> statement-breakpoint
CREATE INDEX "task_notifications_owner_id_created_at_idx" ON "task_notifications" USING btree ("owner_id","created_at");--> statement-breakpoint
CREATE INDEX "task_notifications_task_id_idx" ON "task_notifications" USING btree ("task_id");--> statement-breakpoint
CREATE POLICY "task_notifications_owner_all" ON "task_notifications" AS PERMISSIVE FOR ALL TO public USING ("task_notifications"."owner_id"::text = nullif(current_setting('app.user_id', true), '')) WITH CHECK ("task_notifications"."owner_id"::text = nullif(current_setting('app.user_id', true), ''));

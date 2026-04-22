CREATE TABLE IF NOT EXISTS "task_label_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action,
	"label_id" uuid NOT NULL REFERENCES "public"."task_labels"("id") ON DELETE cascade ON UPDATE no action,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp (6) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "task_label_assignments_task_id_idx" ON "task_label_assignments" USING btree ("task_id","position");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "task_label_assignments_label_id_idx" ON "task_label_assignments" USING btree ("label_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "task_label_assignments_task_id_label_id_unique_idx" ON "task_label_assignments" USING btree ("task_id","label_id");
--> statement-breakpoint
INSERT INTO "task_label_assignments" ("task_id", "label_id", "position")
SELECT "id", "label_id", 0
FROM "tasks"
WHERE "label_id" IS NOT NULL
ON CONFLICT ("task_id", "label_id") DO NOTHING;

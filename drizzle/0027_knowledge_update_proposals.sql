CREATE TABLE IF NOT EXISTS "knowledge_update_proposals" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "owner_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE cascade,
  "task_id" uuid NOT NULL REFERENCES "tasks"("id") ON DELETE cascade,
  "source_node_id" uuid REFERENCES "task_work_nodes"("id") ON DELETE set null,
  "target" text NOT NULL,
  "body" text NOT NULL,
  "rationale" text,
  "status" text DEFAULT 'pending' NOT NULL,
  "metadata" jsonb,
  "created_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "knowledge_update_proposals_status_check" CHECK (
    "status" in ('pending', 'applied', 'rejected')
  ),
  CONSTRAINT "knowledge_update_proposals_target_length_check" CHECK (char_length("target") <= 500)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "knowledge_update_proposals_owner_id_task_id_status_idx" ON "knowledge_update_proposals" USING btree ("owner_id","task_id","status");
CREATE INDEX IF NOT EXISTS "knowledge_update_proposals_source_node_id_idx" ON "knowledge_update_proposals" USING btree ("source_node_id");
CREATE INDEX IF NOT EXISTS "knowledge_update_proposals_owner_id_status_created_at_idx" ON "knowledge_update_proposals" USING btree ("owner_id","status","created_at");
--> statement-breakpoint
ALTER TABLE "knowledge_update_proposals" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "knowledge_update_proposals" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "knowledge_update_proposals_owner_all" ON "knowledge_update_proposals";
CREATE POLICY "knowledge_update_proposals_owner_all" ON "knowledge_update_proposals"
FOR ALL
TO PUBLIC
USING ("knowledge_update_proposals"."owner_id"::text = nullif(current_setting('app.user_id', true), ''))
WITH CHECK ("knowledge_update_proposals"."owner_id"::text = nullif(current_setting('app.user_id', true), ''));

ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "workflow_memory" text;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "workflow_memory_updated_at" timestamp (6) with time zone;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "task_work_nodes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "owner_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE cascade,
  "task_id" uuid NOT NULL REFERENCES "tasks"("id") ON DELETE cascade,
  "parent_id" uuid REFERENCES "task_work_nodes"("id") ON DELETE set null,
  "type" text NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "title" text NOT NULL,
  "body" text,
  "runtime_target" text,
  "engine" text,
  "model" text,
  "actor_kind" text DEFAULT 'runtime' NOT NULL,
  "actor_label" text,
  "idempotency_key" text,
  "sort_order" varchar(64) COLLATE "C" NOT NULL DEFAULT 'a0',
  "started_at" timestamp (6) with time zone,
  "completed_at" timestamp (6) with time zone,
  "failed_at" timestamp (6) with time zone,
  "waiting_reason" text,
  "decision_prompt" text,
  "result_summary" text,
  "metadata" jsonb,
  "created_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "task_work_nodes_type_check" CHECK (
    "type" in (
      'root',
      'plan',
      'explore',
      'analyze',
      'research',
      'interview',
      'implement',
      'document',
      'review',
      'test',
      'qa',
      'deploy',
      'decision',
      'approval',
      'blocked',
      'proposal',
      'result'
    )
  ),
  CONSTRAINT "task_work_nodes_status_check" CHECK (
    "status" in (
      'pending',
      'ready',
      'running',
      'waiting_for_user',
      'blocked',
      'completed',
      'failed',
      'cancelled'
    )
  ),
  CONSTRAINT "task_work_nodes_parent_not_self_check" CHECK (
    "parent_id" IS NULL OR "id" <> "parent_id"
  )
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "task_work_node_dependencies" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "owner_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "task_id" uuid NOT NULL REFERENCES "tasks"("id") ON DELETE cascade,
  "node_id" uuid NOT NULL REFERENCES "task_work_nodes"("id") ON DELETE cascade,
  "depends_on_node_id" uuid NOT NULL REFERENCES "task_work_nodes"("id") ON DELETE cascade,
  "created_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "task_work_node_dependencies_not_self_check" CHECK ("node_id" <> "depends_on_node_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "task_work_node_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "owner_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE cascade,
  "task_id" uuid NOT NULL REFERENCES "tasks"("id") ON DELETE cascade,
  "node_id" uuid REFERENCES "task_work_nodes"("id") ON DELETE cascade,
  "event_type" text NOT NULL,
  "message" text,
  "payload" jsonb,
  "created_by" text,
  "created_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "task_work_node_events_event_type_check" CHECK (
    "event_type" in (
      'graph.initialized',
      'node.created',
      'node.started',
      'node.completed',
      'node.failed',
      'node.cancelled',
      'node.waiting_for_user',
      'node.evidence.attached',
      'workflow_memory.appended'
    )
  )
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "task_work_node_evidence" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "owner_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE cascade,
  "task_id" uuid NOT NULL REFERENCES "tasks"("id") ON DELETE cascade,
  "node_id" uuid NOT NULL REFERENCES "task_work_nodes"("id") ON DELETE cascade,
  "kind" text NOT NULL,
  "title" text NOT NULL,
  "summary" text,
  "payload" jsonb,
  "artifact_url" text,
  "created_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "task_work_node_evidence_kind_check" CHECK (
    "kind" in (
      'command',
      'test',
      'log',
      'changed_file',
      'screenshot',
      'artifact',
      'pull_request',
      'deployment',
      'summary',
      'error'
    )
  ),
  CONSTRAINT "task_work_node_evidence_title_length_check" CHECK (char_length("title") <= 160),
  CONSTRAINT "task_work_node_evidence_summary_length_check" CHECK (
    "summary" IS NULL OR char_length("summary") <= 4000
  )
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "task_work_nodes_owner_id_task_id_idx" ON "task_work_nodes" USING btree ("owner_id","task_id");
CREATE INDEX IF NOT EXISTS "task_work_nodes_task_id_parent_id_sort_order_idx" ON "task_work_nodes" USING btree ("task_id","parent_id","sort_order");
CREATE INDEX IF NOT EXISTS "task_work_nodes_owner_id_status_idx" ON "task_work_nodes" USING btree ("owner_id","status");
CREATE INDEX IF NOT EXISTS "task_work_nodes_owner_id_engine_idx" ON "task_work_nodes" USING btree ("owner_id","engine");
CREATE UNIQUE INDEX IF NOT EXISTS "task_work_nodes_owner_id_idempotency_key_unique_idx" ON "task_work_nodes" USING btree ("owner_id","idempotency_key") WHERE "idempotency_key" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "task_work_node_dependencies_node_depends_on_unique_idx" ON "task_work_node_dependencies" USING btree ("node_id","depends_on_node_id");
CREATE INDEX IF NOT EXISTS "task_work_node_dependencies_owner_id_task_id_idx" ON "task_work_node_dependencies" USING btree ("owner_id","task_id");
CREATE INDEX IF NOT EXISTS "task_work_node_events_task_id_created_at_idx" ON "task_work_node_events" USING btree ("task_id","created_at");
CREATE INDEX IF NOT EXISTS "task_work_node_events_node_id_created_at_idx" ON "task_work_node_events" USING btree ("node_id","created_at");
CREATE INDEX IF NOT EXISTS "task_work_node_events_owner_id_created_at_idx" ON "task_work_node_events" USING btree ("owner_id","created_at");
CREATE INDEX IF NOT EXISTS "task_work_node_evidence_node_id_created_at_idx" ON "task_work_node_evidence" USING btree ("node_id","created_at");
CREATE INDEX IF NOT EXISTS "task_work_node_evidence_owner_id_kind_idx" ON "task_work_node_evidence" USING btree ("owner_id","kind");
--> statement-breakpoint
ALTER TABLE "task_work_nodes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "task_work_node_dependencies" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "task_work_node_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "task_work_node_evidence" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "task_work_nodes" FORCE ROW LEVEL SECURITY;
ALTER TABLE "task_work_node_dependencies" FORCE ROW LEVEL SECURITY;
ALTER TABLE "task_work_node_events" FORCE ROW LEVEL SECURITY;
ALTER TABLE "task_work_node_evidence" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "task_work_nodes_owner_all" ON "task_work_nodes";
CREATE POLICY "task_work_nodes_owner_all" ON "task_work_nodes"
FOR ALL
TO PUBLIC
USING ("task_work_nodes"."owner_id"::text = nullif(current_setting('app.user_id', true), ''))
WITH CHECK ("task_work_nodes"."owner_id"::text = nullif(current_setting('app.user_id', true), ''));
--> statement-breakpoint
DROP POLICY IF EXISTS "task_work_node_dependencies_owner_all" ON "task_work_node_dependencies";
CREATE POLICY "task_work_node_dependencies_owner_all" ON "task_work_node_dependencies"
FOR ALL
TO PUBLIC
USING ("task_work_node_dependencies"."owner_id"::text = nullif(current_setting('app.user_id', true), ''))
WITH CHECK ("task_work_node_dependencies"."owner_id"::text = nullif(current_setting('app.user_id', true), ''));
--> statement-breakpoint
DROP POLICY IF EXISTS "task_work_node_events_owner_all" ON "task_work_node_events";
CREATE POLICY "task_work_node_events_owner_all" ON "task_work_node_events"
FOR ALL
TO PUBLIC
USING ("task_work_node_events"."owner_id"::text = nullif(current_setting('app.user_id', true), ''))
WITH CHECK ("task_work_node_events"."owner_id"::text = nullif(current_setting('app.user_id', true), ''));
--> statement-breakpoint
DROP POLICY IF EXISTS "task_work_node_evidence_owner_all" ON "task_work_node_evidence";
CREATE POLICY "task_work_node_evidence_owner_all" ON "task_work_node_evidence"
FOR ALL
TO PUBLIC
USING ("task_work_node_evidence"."owner_id"::text = nullif(current_setting('app.user_id', true), ''))
WITH CHECK ("task_work_node_evidence"."owner_id"::text = nullif(current_setting('app.user_id', true), ''));

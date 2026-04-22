ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "oauth_codes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "api_tokens" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "projects" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "task_labels" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "task_label_assignments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tasks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "work_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "project_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "qa_runs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "events_outbox" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "security_events" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "projects" FORCE ROW LEVEL SECURITY;
ALTER TABLE "task_labels" FORCE ROW LEVEL SECURITY;
ALTER TABLE "task_label_assignments" FORCE ROW LEVEL SECURITY;
ALTER TABLE "tasks" FORCE ROW LEVEL SECURITY;
ALTER TABLE "work_logs" FORCE ROW LEVEL SECURITY;
ALTER TABLE "audit_logs" FORCE ROW LEVEL SECURITY;
ALTER TABLE "user_settings" FORCE ROW LEVEL SECURITY;
ALTER TABLE "project_settings" FORCE ROW LEVEL SECURITY;
ALTER TABLE "qa_runs" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "users_select_own" ON "users";
DROP POLICY IF EXISTS "users_update_own" ON "users";
DROP POLICY IF EXISTS "users_insert_owner_only" ON "users";
DROP POLICY IF EXISTS "users_select_self" ON "users";
DROP POLICY IF EXISTS "users_update_self" ON "users";
DROP POLICY IF EXISTS "users_insert_owner_bootstrap" ON "users";
CREATE POLICY "users_select_self" ON "users"
FOR SELECT
TO PUBLIC
USING ("users"."id"::text = nullif(current_setting('app.user_id', true), ''));
CREATE POLICY "users_update_self" ON "users"
FOR UPDATE
TO PUBLIC
USING ("users"."id"::text = nullif(current_setting('app.user_id', true), ''))
WITH CHECK ("users"."id"::text = nullif(current_setting('app.user_id', true), ''));
CREATE POLICY "users_insert_owner_bootstrap" ON "users"
FOR INSERT
TO PUBLIC
WITH CHECK (
  "users"."is_owner" = true
  AND NOT EXISTS (SELECT 1 FROM "users" WHERE "users"."is_owner" = true)
);
--> statement-breakpoint
DROP POLICY IF EXISTS "oauth_codes_owner_via_user" ON "oauth_codes";
CREATE POLICY "oauth_codes_owner_via_user" ON "oauth_codes"
FOR ALL
TO PUBLIC
USING (
  EXISTS (
    SELECT 1
    FROM "users"
    WHERE "users"."id" = "oauth_codes"."user_id"
      AND "users"."id"::text = nullif(current_setting('app.user_id', true), '')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM "users"
    WHERE "users"."id" = "oauth_codes"."user_id"
      AND "users"."id"::text = nullif(current_setting('app.user_id', true), '')
  )
);
--> statement-breakpoint
DROP POLICY IF EXISTS "api_tokens_owner_policy" ON "api_tokens";
DROP POLICY IF EXISTS "api_tokens_owner_all" ON "api_tokens";
CREATE POLICY "api_tokens_owner_all" ON "api_tokens"
FOR ALL
TO PUBLIC
USING ("api_tokens"."owner_id"::text = nullif(current_setting('app.user_id', true), ''))
WITH CHECK ("api_tokens"."owner_id"::text = nullif(current_setting('app.user_id', true), ''));
--> statement-breakpoint
DROP POLICY IF EXISTS "projects_owner_policy" ON "projects";
DROP POLICY IF EXISTS "projects_owner_all" ON "projects";
CREATE POLICY "projects_owner_all" ON "projects"
FOR ALL
TO PUBLIC
USING ("projects"."owner_id"::text = nullif(current_setting('app.user_id', true), ''))
WITH CHECK ("projects"."owner_id"::text = nullif(current_setting('app.user_id', true), ''));
--> statement-breakpoint
DROP POLICY IF EXISTS "task_labels_owner_all" ON "task_labels";
CREATE POLICY "task_labels_owner_all" ON "task_labels"
FOR ALL
TO PUBLIC
USING ("task_labels"."owner_id"::text = nullif(current_setting('app.user_id', true), ''))
WITH CHECK ("task_labels"."owner_id"::text = nullif(current_setting('app.user_id', true), ''));
--> statement-breakpoint
DROP POLICY IF EXISTS "task_label_assignments_owner_via_task" ON "task_label_assignments";
CREATE POLICY "task_label_assignments_owner_via_task" ON "task_label_assignments"
FOR ALL
TO PUBLIC
USING (
  EXISTS (
    SELECT 1
    FROM "tasks"
    WHERE "tasks"."id" = "task_label_assignments"."task_id"
      AND "tasks"."owner_id"::text = nullif(current_setting('app.user_id', true), '')
  )
  AND EXISTS (
    SELECT 1
    FROM "task_labels"
    WHERE "task_labels"."id" = "task_label_assignments"."label_id"
      AND "task_labels"."owner_id"::text = nullif(current_setting('app.user_id', true), '')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM "tasks"
    WHERE "tasks"."id" = "task_label_assignments"."task_id"
      AND "tasks"."owner_id"::text = nullif(current_setting('app.user_id', true), '')
  )
  AND EXISTS (
    SELECT 1
    FROM "task_labels"
    WHERE "task_labels"."id" = "task_label_assignments"."label_id"
      AND "task_labels"."owner_id"::text = nullif(current_setting('app.user_id', true), '')
  )
);
--> statement-breakpoint
DROP POLICY IF EXISTS "tasks_owner_policy" ON "tasks";
DROP POLICY IF EXISTS "tasks_owner_all" ON "tasks";
CREATE POLICY "tasks_owner_all" ON "tasks"
FOR ALL
TO PUBLIC
USING ("tasks"."owner_id"::text = nullif(current_setting('app.user_id', true), ''))
WITH CHECK ("tasks"."owner_id"::text = nullif(current_setting('app.user_id', true), ''));
--> statement-breakpoint
DROP POLICY IF EXISTS "work_logs_owner_policy" ON "work_logs";
DROP POLICY IF EXISTS "work_logs_owner_all" ON "work_logs";
CREATE POLICY "work_logs_owner_all" ON "work_logs"
FOR ALL
TO PUBLIC
USING ("work_logs"."owner_id"::text = nullif(current_setting('app.user_id', true), ''))
WITH CHECK ("work_logs"."owner_id"::text = nullif(current_setting('app.user_id', true), ''));
--> statement-breakpoint
DROP POLICY IF EXISTS "audit_logs_owner_policy" ON "audit_logs";
DROP POLICY IF EXISTS "audit_logs_owner_all" ON "audit_logs";
CREATE POLICY "audit_logs_owner_all" ON "audit_logs"
FOR ALL
TO PUBLIC
USING ("audit_logs"."owner_id"::text = nullif(current_setting('app.user_id', true), ''))
WITH CHECK ("audit_logs"."owner_id"::text = nullif(current_setting('app.user_id', true), ''));
--> statement-breakpoint
DROP POLICY IF EXISTS "user_settings_owner_all" ON "user_settings";
CREATE POLICY "user_settings_owner_all" ON "user_settings"
FOR ALL
TO PUBLIC
USING ("user_settings"."owner_id"::text = nullif(current_setting('app.user_id', true), ''))
WITH CHECK ("user_settings"."owner_id"::text = nullif(current_setting('app.user_id', true), ''));
--> statement-breakpoint
DROP POLICY IF EXISTS "project_settings_owner_via_project" ON "project_settings";
CREATE POLICY "project_settings_owner_via_project" ON "project_settings"
FOR ALL
TO PUBLIC
USING (
  EXISTS (
    SELECT 1
    FROM "projects"
    WHERE "projects"."id" = "project_settings"."project_id"
      AND "projects"."owner_id"::text = nullif(current_setting('app.user_id', true), '')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM "projects"
    WHERE "projects"."id" = "project_settings"."project_id"
      AND "projects"."owner_id"::text = nullif(current_setting('app.user_id', true), '')
  )
);
--> statement-breakpoint
DROP POLICY IF EXISTS "qa_runs_owner_all" ON "qa_runs";
CREATE POLICY "qa_runs_owner_all" ON "qa_runs"
FOR ALL
TO PUBLIC
USING ("qa_runs"."owner_id"::text = nullif(current_setting('app.user_id', true), ''))
WITH CHECK ("qa_runs"."owner_id"::text = nullif(current_setting('app.user_id', true), ''));
--> statement-breakpoint
DROP POLICY IF EXISTS "events_outbox_owner_all" ON "events_outbox";
CREATE POLICY "events_outbox_owner_all" ON "events_outbox"
FOR ALL
TO PUBLIC
USING ("events_outbox"."owner_id"::text = nullif(current_setting('app.user_id', true), ''))
WITH CHECK ("events_outbox"."owner_id"::text = nullif(current_setting('app.user_id', true), ''));
--> statement-breakpoint
DROP POLICY IF EXISTS "security_events_owner_policy" ON "security_events";
DROP POLICY IF EXISTS "security_events_owner_select" ON "security_events";
DROP POLICY IF EXISTS "security_events_owner_insert" ON "security_events";
CREATE POLICY "security_events_owner_select" ON "security_events"
FOR SELECT
TO PUBLIC
USING (
  EXISTS (
    SELECT 1
    FROM "users"
    WHERE "users"."id"::text = nullif(current_setting('app.user_id', true), '')
      AND "users"."is_owner" = true
  )
);
CREATE POLICY "security_events_owner_insert" ON "security_events"
FOR INSERT
TO PUBLIC
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM "users"
    WHERE "users"."id"::text = nullif(current_setting('app.user_id', true), '')
      AND "users"."is_owner" = true
  )
  AND (
    "security_events"."owner_id" IS NULL
    OR "security_events"."owner_id"::text = nullif(current_setting('app.user_id', true), '')
  )
);

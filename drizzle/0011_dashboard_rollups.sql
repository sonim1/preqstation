CREATE TABLE "dashboard_work_log_daily_totals" (
	"owner_id" uuid NOT NULL,
	"bucket_date" date NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "dashboard_work_log_daily_totals_pkey" PRIMARY KEY("owner_id","bucket_date")
);
--> statement-breakpoint
ALTER TABLE "dashboard_work_log_daily_totals" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "dashboard_work_log_daily_totals" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "dashboard_project_work_log_daily" (
	"owner_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"bucket_date" date NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "dashboard_project_work_log_daily_pkey" PRIMARY KEY("owner_id","project_id","bucket_date")
);
--> statement-breakpoint
ALTER TABLE "dashboard_project_work_log_daily" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "dashboard_project_work_log_daily" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "dashboard_work_log_daily_totals" ADD CONSTRAINT "dashboard_work_log_daily_totals_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dashboard_project_work_log_daily" ADD CONSTRAINT "dashboard_project_work_log_daily_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dashboard_project_work_log_daily" ADD CONSTRAINT "dashboard_project_work_log_daily_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dashboard_work_log_daily_totals_owner_id_bucket_date_idx" ON "dashboard_work_log_daily_totals" USING btree ("owner_id","bucket_date");--> statement-breakpoint
CREATE INDEX "dashboard_project_work_log_daily_owner_id_bucket_date_idx" ON "dashboard_project_work_log_daily" USING btree ("owner_id","bucket_date");--> statement-breakpoint
CREATE INDEX "dashboard_project_work_log_daily_owner_id_project_id_bucket_date_idx" ON "dashboard_project_work_log_daily" USING btree ("owner_id","project_id","bucket_date");--> statement-breakpoint
CREATE POLICY "dashboard_work_log_daily_totals_owner_all" ON "dashboard_work_log_daily_totals" AS PERMISSIVE FOR ALL TO public USING ("dashboard_work_log_daily_totals"."owner_id"::text = nullif(current_setting('app.user_id', true), '')) WITH CHECK ("dashboard_work_log_daily_totals"."owner_id"::text = nullif(current_setting('app.user_id', true), ''));--> statement-breakpoint
CREATE POLICY "dashboard_project_work_log_daily_owner_all" ON "dashboard_project_work_log_daily" AS PERMISSIVE FOR ALL TO public USING ("dashboard_project_work_log_daily"."owner_id"::text = nullif(current_setting('app.user_id', true), '')) WITH CHECK ("dashboard_project_work_log_daily"."owner_id"::text = nullif(current_setting('app.user_id', true), ''));--> statement-breakpoint
CREATE OR REPLACE FUNCTION dashboard_owner_timezone(p_owner_id uuid)
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    NULLIF(TRIM((
      SELECT "value"
      FROM "user_settings"
      WHERE "owner_id" = p_owner_id
        AND "key" = 'timezone'
      LIMIT 1
    )), ''),
    NULLIF(current_setting('app.default_timezone', true), ''),
    'UTC'
  );
$$;--> statement-breakpoint
CREATE OR REPLACE FUNCTION dashboard_adjust_work_log_daily_total(
  p_owner_id uuid,
  p_bucket_date date,
  p_delta integer
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_delta > 0 THEN
    INSERT INTO "dashboard_work_log_daily_totals" ("owner_id", "bucket_date", "count")
    VALUES (p_owner_id, p_bucket_date, p_delta)
    ON CONFLICT ("owner_id", "bucket_date")
    DO UPDATE SET "count" = "dashboard_work_log_daily_totals"."count" + EXCLUDED."count";
  ELSE
    UPDATE "dashboard_work_log_daily_totals"
    SET "count" = "count" + p_delta
    WHERE "owner_id" = p_owner_id
      AND "bucket_date" = p_bucket_date;

    DELETE FROM "dashboard_work_log_daily_totals"
    WHERE "owner_id" = p_owner_id
      AND "bucket_date" = p_bucket_date
      AND "count" <= 0;
  END IF;
END;
$$;--> statement-breakpoint
CREATE OR REPLACE FUNCTION dashboard_adjust_project_work_log_daily(
  p_owner_id uuid,
  p_project_id uuid,
  p_bucket_date date,
  p_delta integer
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_project_id IS NULL THEN
    RETURN;
  END IF;

  IF p_delta > 0 THEN
    INSERT INTO "dashboard_project_work_log_daily" ("owner_id", "project_id", "bucket_date", "count")
    VALUES (p_owner_id, p_project_id, p_bucket_date, p_delta)
    ON CONFLICT ("owner_id", "project_id", "bucket_date")
    DO UPDATE SET "count" = "dashboard_project_work_log_daily"."count" + EXCLUDED."count";
  ELSE
    UPDATE "dashboard_project_work_log_daily"
    SET "count" = "count" + p_delta
    WHERE "owner_id" = p_owner_id
      AND "project_id" = p_project_id
      AND "bucket_date" = p_bucket_date;

    DELETE FROM "dashboard_project_work_log_daily"
    WHERE "owner_id" = p_owner_id
      AND "project_id" = p_project_id
      AND "bucket_date" = p_bucket_date
      AND "count" <= 0;
  END IF;
END;
$$;--> statement-breakpoint
CREATE OR REPLACE FUNCTION dashboard_apply_work_log_rollup_change(
  p_owner_id uuid,
  p_project_id uuid,
  p_worked_at timestamp with time zone,
  p_delta integer
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_bucket_date date;
BEGIN
  IF p_owner_id IS NULL OR p_worked_at IS NULL OR p_delta = 0 THEN
    RETURN;
  END IF;

  v_bucket_date := (p_worked_at AT TIME ZONE dashboard_owner_timezone(p_owner_id))::date;

  PERFORM dashboard_adjust_work_log_daily_total(p_owner_id, v_bucket_date, p_delta);
  PERFORM dashboard_adjust_project_work_log_daily(p_owner_id, p_project_id, v_bucket_date, p_delta);
END;
$$;--> statement-breakpoint
CREATE OR REPLACE FUNCTION dashboard_rebuild_work_log_rollups(
  p_owner_id uuid,
  p_timezone text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_timezone text;
BEGIN
  v_timezone := COALESCE(NULLIF(TRIM(p_timezone), ''), dashboard_owner_timezone(p_owner_id));

  DELETE FROM "dashboard_project_work_log_daily" WHERE "owner_id" = p_owner_id;
  DELETE FROM "dashboard_work_log_daily_totals" WHERE "owner_id" = p_owner_id;

  INSERT INTO "dashboard_work_log_daily_totals" ("owner_id", "bucket_date", "count")
  SELECT
    wl."owner_id",
    (wl."worked_at" AT TIME ZONE v_timezone)::date AS "bucket_date",
    COUNT(*)::integer AS "count"
  FROM "work_logs" wl
  WHERE wl."owner_id" = p_owner_id
  GROUP BY wl."owner_id", 2;

  INSERT INTO "dashboard_project_work_log_daily" ("owner_id", "project_id", "bucket_date", "count")
  SELECT
    wl."owner_id",
    wl."project_id",
    (wl."worked_at" AT TIME ZONE v_timezone)::date AS "bucket_date",
    COUNT(*)::integer AS "count"
  FROM "work_logs" wl
  WHERE wl."owner_id" = p_owner_id
    AND wl."project_id" IS NOT NULL
  GROUP BY wl."owner_id", wl."project_id", 3;
END;
$$;--> statement-breakpoint
CREATE OR REPLACE FUNCTION dashboard_sync_work_log_rollups()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM dashboard_apply_work_log_rollup_change(OLD."owner_id", OLD."project_id", OLD."worked_at", -1);
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    PERFORM dashboard_apply_work_log_rollup_change(OLD."owner_id", OLD."project_id", OLD."worked_at", -1);
    PERFORM dashboard_apply_work_log_rollup_change(NEW."owner_id", NEW."project_id", NEW."worked_at", 1);
    RETURN NEW;
  END IF;

  PERFORM dashboard_apply_work_log_rollup_change(NEW."owner_id", NEW."project_id", NEW."worked_at", 1);
  RETURN NEW;
END;
$$;--> statement-breakpoint
DROP TRIGGER IF EXISTS dashboard_work_log_rollups_sync ON "work_logs";--> statement-breakpoint
CREATE TRIGGER dashboard_work_log_rollups_sync
AFTER INSERT OR DELETE OR UPDATE OF "owner_id", "project_id", "worked_at" ON "work_logs"
FOR EACH ROW
EXECUTE FUNCTION dashboard_sync_work_log_rollups();--> statement-breakpoint
INSERT INTO "dashboard_work_log_daily_totals" ("owner_id", "bucket_date", "count")
SELECT
  wl."owner_id",
  (wl."worked_at" AT TIME ZONE dashboard_owner_timezone(wl."owner_id"))::date AS "bucket_date",
  COUNT(*)::integer AS "count"
FROM "work_logs" wl
GROUP BY wl."owner_id", 2
ON CONFLICT ("owner_id", "bucket_date")
DO UPDATE SET "count" = EXCLUDED."count";--> statement-breakpoint
INSERT INTO "dashboard_project_work_log_daily" ("owner_id", "project_id", "bucket_date", "count")
SELECT
  wl."owner_id",
  wl."project_id",
  (wl."worked_at" AT TIME ZONE dashboard_owner_timezone(wl."owner_id"))::date AS "bucket_date",
  COUNT(*)::integer AS "count"
FROM "work_logs" wl
WHERE wl."project_id" IS NOT NULL
GROUP BY wl."owner_id", wl."project_id", 3
ON CONFLICT ("owner_id", "project_id", "bucket_date")
DO UPDATE SET "count" = EXCLUDED."count";

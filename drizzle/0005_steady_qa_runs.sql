DO $$
BEGIN
  IF to_regclass('public.qa_runs') IS NULL THEN
    IF to_regclass('public.dogfood_runs') IS NOT NULL THEN
      EXECUTE 'ALTER TABLE "dogfood_runs" RENAME TO "qa_runs"';
    ELSE
      EXECUTE '
        CREATE TABLE "qa_runs" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
          "owner_id" uuid NOT NULL,
          "project_id" uuid NOT NULL,
          "branch_name" text NOT NULL,
          "status" text DEFAULT ''queued'' NOT NULL,
          "engine" text,
          "target_url" text,
          "task_keys" jsonb NOT NULL,
          "summary" jsonb,
          "report_markdown" text,
          "started_at" timestamp (6) with time zone,
          "finished_at" timestamp (6) with time zone,
          "created_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
          "updated_at" timestamp (6) with time zone DEFAULT now() NOT NULL
        )
      ';
      EXECUTE '
        ALTER TABLE "qa_runs"
        ADD CONSTRAINT "qa_runs_owner_id_users_id_fk"
        FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action
      ';
      EXECUTE '
        ALTER TABLE "qa_runs"
        ADD CONSTRAINT "qa_runs_project_id_projects_id_fk"
        FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action
      ';
    END IF;
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'dogfood_runs_owner_id_users_id_fk'
      AND conrelid = 'public.qa_runs'::regclass
  ) THEN
    EXECUTE '
      ALTER TABLE "qa_runs"
      RENAME CONSTRAINT "dogfood_runs_owner_id_users_id_fk" TO "qa_runs_owner_id_users_id_fk"
    ';
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'dogfood_runs_project_id_projects_id_fk'
      AND conrelid = 'public.qa_runs'::regclass
  ) THEN
    EXECUTE '
      ALTER TABLE "qa_runs"
      RENAME CONSTRAINT "dogfood_runs_project_id_projects_id_fk" TO "qa_runs_project_id_projects_id_fk"
    ';
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF to_regclass('public.dogfood_runs_owner_id_idx') IS NOT NULL
    AND to_regclass('public.qa_runs_owner_id_idx') IS NULL THEN
    EXECUTE 'ALTER INDEX "dogfood_runs_owner_id_idx" RENAME TO "qa_runs_owner_id_idx"';
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF to_regclass('public.dogfood_runs_project_id_created_at_idx') IS NOT NULL
    AND to_regclass('public.qa_runs_project_id_created_at_idx') IS NULL THEN
    EXECUTE 'ALTER INDEX "dogfood_runs_project_id_created_at_idx" RENAME TO "qa_runs_project_id_created_at_idx"';
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF to_regclass('public.dogfood_runs_owner_id_status_idx') IS NOT NULL
    AND to_regclass('public.qa_runs_owner_id_status_idx') IS NULL THEN
    EXECUTE 'ALTER INDEX "dogfood_runs_owner_id_status_idx" RENAME TO "qa_runs_owner_id_status_idx"';
  END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "qa_runs_owner_id_idx" ON "qa_runs" USING btree ("owner_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "qa_runs_project_id_created_at_idx" ON "qa_runs" USING btree ("project_id","created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "qa_runs_owner_id_status_idx" ON "qa_runs" USING btree ("owner_id","status");

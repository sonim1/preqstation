ALTER TABLE "tasks"
ADD COLUMN IF NOT EXISTS "run_state" text;
--> statement-breakpoint
ALTER TABLE "tasks"
ADD COLUMN IF NOT EXISTS "run_state_updated_at" timestamp (6) with time zone;
--> statement-breakpoint
ALTER TABLE "tasks"
DROP CONSTRAINT IF EXISTS "todos_status_check";
--> statement-breakpoint
ALTER TABLE "tasks"
ADD CONSTRAINT "todos_status_check" CHECK (
  "status" = ANY (
    ARRAY[
      'inbox'::text,
      'todo'::text,
      'in_progress'::text,
      'in_review'::text,
      'review'::text,
      'blocked'::text,
      'hold'::text,
      'ready'::text,
      'done'::text,
      'archived'::text
    ]
  )
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tasks_owner_id_run_state_idx" ON "tasks" USING btree ("owner_id","run_state");
--> statement-breakpoint

UPDATE "tasks"
SET
  "status" = 'todo',
  "run_state" = NULL,
  "run_state_updated_at" = NULL
WHERE "status" = 'in_progress';
--> statement-breakpoint

UPDATE "tasks"
SET
  "status" = 'ready',
  "run_state" = NULL,
  "run_state_updated_at" = NULL
WHERE "status" IN ('in_review', 'review');
--> statement-breakpoint

UPDATE "tasks"
SET
  "status" = 'hold',
  "run_state" = NULL,
  "run_state_updated_at" = NULL
WHERE "status" = 'blocked';
--> statement-breakpoint

UPDATE "tasks"
SET
  "status" = 'hold',
  "run_state" = NULL,
  "run_state_updated_at" = NULL
WHERE "status" NOT IN ('done', 'archived')
  AND (
    EXISTS (
      SELECT 1
      FROM "task_labels" tl
      WHERE tl."id" = "tasks"."label_id"
        AND lower(tl."name") = 'blocked'
    )
    OR EXISTS (
      SELECT 1
      FROM "task_label_assignments" tla
      INNER JOIN "task_labels" tl ON tl."id" = tla."label_id"
      WHERE tla."task_id" = "tasks"."id"
        AND lower(tl."name") = 'blocked'
    )
  );
--> statement-breakpoint

UPDATE "tasks"
SET
  "run_state" = NULL,
  "run_state_updated_at" = NULL
WHERE "run_state" IS NOT NULL
   OR "run_state_updated_at" IS NOT NULL;
--> statement-breakpoint
ALTER TABLE "tasks"
DROP CONSTRAINT IF EXISTS "todos_status_check";
--> statement-breakpoint
ALTER TABLE "tasks"
ADD CONSTRAINT "todos_status_check" CHECK (
  "status" = ANY (
    ARRAY[
      'inbox'::text,
      'todo'::text,
      'hold'::text,
      'ready'::text,
      'done'::text,
      'archived'::text
    ]
  )
);
--> statement-breakpoint

INSERT INTO "user_settings" ("owner_id", "key", "value", "created_at", "updated_at")
SELECT
  "owner_id",
  'engine_hold',
  "value",
  "created_at",
  "updated_at"
FROM "user_settings"
WHERE "key" = 'engine_in_progress'
ON CONFLICT ("owner_id", "key") DO UPDATE
SET
  "value" = EXCLUDED."value",
  "updated_at" = GREATEST("user_settings"."updated_at", EXCLUDED."updated_at");
--> statement-breakpoint

DELETE FROM "user_settings"
WHERE "key" = 'engine_in_progress';
--> statement-breakpoint

INSERT INTO "user_settings" ("owner_id", "key", "value", "created_at", "updated_at")
SELECT
  "owner_id",
  'engine_ready',
  "value",
  "created_at",
  "updated_at"
FROM "user_settings"
WHERE "key" = 'engine_in_review'
ON CONFLICT ("owner_id", "key") DO UPDATE
SET
  "value" = EXCLUDED."value",
  "updated_at" = GREATEST("user_settings"."updated_at", EXCLUDED."updated_at");
--> statement-breakpoint

DELETE FROM "user_settings"
WHERE "key" = 'engine_in_review';

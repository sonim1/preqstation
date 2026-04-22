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
SET "engine" = 'claude-code'
WHERE "engine" = 'claude';
--> statement-breakpoint
UPDATE "tasks"
SET "engine" = 'gemini-cli'
WHERE "engine" = 'gemini';
--> statement-breakpoint
UPDATE "work_logs"
SET "engine" = 'claude-code'
WHERE "engine" = 'claude';
--> statement-breakpoint
UPDATE "work_logs"
SET "engine" = 'gemini-cli'
WHERE "engine" = 'gemini';
--> statement-breakpoint
UPDATE "user_settings"
SET "value" = CASE
  WHEN "value" = 'claude' THEN 'claude-code'
  WHEN "value" = 'gemini' THEN 'gemini-cli'
  ELSE "value"
END
WHERE "key" IN (
  'engine_default',
  'engine_inbox',
  'engine_todo',
  'engine_hold',
  'engine_ready',
  'engine_done',
  'engine_in_progress',
  'engine_in_review'
);
--> statement-breakpoint
INSERT INTO "user_settings" ("owner_id", "key", "value", "created_at", "updated_at")
SELECT
  "owner_id",
  'engine_hold',
  CASE
    WHEN "value" = 'claude' THEN 'claude-code'
    WHEN "value" = 'gemini' THEN 'gemini-cli'
    ELSE "value"
  END,
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
  CASE
    WHEN "value" = 'claude' THEN 'claude-code'
    WHEN "value" = 'gemini' THEN 'gemini-cli'
    ELSE "value"
  END,
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
--> statement-breakpoint
UPDATE "work_logs"
SET "title" = replace(
  replace(
    replace(
      replace("title", 'In Progress', 'Todo'),
      'In Review',
      'Ready'
    ),
    'Review',
    'Ready'
  ),
  'Blocked',
  'Hold'
)
WHERE ("title" LIKE '%->%' OR "title" LIKE '%→%')
  AND (
    "title" LIKE '%In Progress%'
    OR "title" LIKE '%In Review%'
    OR "title" LIKE '%Review%'
    OR "title" LIKE '%Blocked%'
  );
--> statement-breakpoint
UPDATE "work_logs"
SET "detail" = replace(
  replace(
    replace(
      replace("detail", '`In Progress`', '`Todo`'),
      '`In Review`',
      '`Ready`'
    ),
    '`Review`',
    '`Ready`'
  ),
  '`Blocked`',
  '`Hold`'
)
WHERE "detail" IS NOT NULL
  AND (
    "detail" LIKE '%`In Progress`%'
    OR "detail" LIKE '%`In Review`%'
    OR "detail" LIKE '%`Review`%'
    OR "detail" LIKE '%`Blocked`%'
  );

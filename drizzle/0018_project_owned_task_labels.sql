ALTER TABLE "task_labels" ADD COLUMN "project_id" uuid REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "tasks" WHERE "project_id" IS NULL) THEN
    RAISE EXCEPTION 'project-owned labels migration requires tasks.project_id to be populated';
  END IF;
END $$;

DROP INDEX IF EXISTS "task_labels_owner_id_name_idx";
ALTER TABLE "task_labels" DROP CONSTRAINT IF EXISTS "todo_labels_owner_id_name_key";
ALTER TABLE "task_labels" DROP CONSTRAINT IF EXISTS "task_labels_owner_id_name_key";

CREATE TEMP TABLE "task_label_project_usage" ON COMMIT DROP AS
SELECT
  usage."old_label_id",
  usage."project_id",
  row_number() OVER (PARTITION BY usage."old_label_id" ORDER BY usage."project_id") AS "usage_rank"
FROM (
  SELECT DISTINCT tla."label_id" AS "old_label_id", t."project_id"
  FROM "task_label_assignments" tla
  INNER JOIN "tasks" t ON t."id" = tla."task_id"
  WHERE t."project_id" IS NOT NULL

  UNION

  SELECT DISTINCT t."label_id" AS "old_label_id", t."project_id"
  FROM "tasks" t
  WHERE t."label_id" IS NOT NULL
    AND t."project_id" IS NOT NULL
) usage;

UPDATE "task_labels" tl
SET "project_id" = usage."project_id"
FROM "task_label_project_usage" usage
WHERE tl."id" = usage."old_label_id"
  AND usage."usage_rank" = 1;

CREATE TEMP TABLE "task_label_clone_map" ON COMMIT DROP AS
SELECT
  usage."old_label_id",
  usage."project_id",
  gen_random_uuid() AS "new_label_id"
FROM "task_label_project_usage" usage
WHERE usage."usage_rank" > 1;

INSERT INTO "task_labels" (
  "id",
  "owner_id",
  "project_id",
  "name",
  "color",
  "created_at",
  "updated_at"
)
SELECT
  clone."new_label_id",
  tl."owner_id",
  clone."project_id",
  tl."name",
  tl."color",
  tl."created_at",
  tl."updated_at"
FROM "task_label_clone_map" clone
INNER JOIN "task_labels" tl ON tl."id" = clone."old_label_id";

CREATE TEMP TABLE "task_label_project_map" ON COMMIT DROP AS
SELECT
  usage."old_label_id",
  usage."project_id",
  CASE
    WHEN usage."usage_rank" = 1 THEN usage."old_label_id"
    ELSE clone."new_label_id"
  END AS "new_label_id"
FROM "task_label_project_usage" usage
LEFT JOIN "task_label_clone_map" clone
  ON clone."old_label_id" = usage."old_label_id"
 AND clone."project_id" = usage."project_id";

UPDATE "task_label_assignments" tla
SET "label_id" = map."new_label_id"
FROM "tasks" t, "task_label_project_map" map
WHERE t."id" = tla."task_id"
  AND map."old_label_id" = tla."label_id"
  AND map."project_id" = t."project_id"
  AND tla."label_id" <> map."new_label_id";

UPDATE "tasks" t
SET "label_id" = map."new_label_id"
FROM "task_label_project_map" map
WHERE t."label_id" = map."old_label_id"
  AND t."project_id" = map."project_id"
  AND t."label_id" <> map."new_label_id";

DELETE FROM "task_labels"
WHERE "project_id" IS NULL;

ALTER TABLE "tasks" DROP CONSTRAINT IF EXISTS "tasks_project_id_projects_id_fk";
ALTER TABLE "tasks"
  ADD CONSTRAINT "tasks_project_id_projects_id_fk"
  FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;

CREATE INDEX "task_labels_project_id_idx" ON "task_labels" USING btree ("project_id");
CREATE UNIQUE INDEX "task_labels_project_id_name_idx" ON "task_labels" USING btree ("project_id","name");

ALTER TABLE "task_labels" ALTER COLUMN "project_id" SET NOT NULL;
ALTER TABLE "tasks" ALTER COLUMN "project_id" SET NOT NULL;

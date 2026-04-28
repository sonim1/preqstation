WITH affected_projects AS (
  SELECT "project_id"
  FROM "project_settings"
  WHERE "key" = 'deploy_strategy' AND "value" = 'none'
)
UPDATE "project_settings"
SET "value" = 'true'
WHERE "project_id" IN (SELECT "project_id" FROM affected_projects)
  AND "key" IN ('deploy_commit_on_review', 'deploy_squash_merge');

UPDATE "project_settings"
SET "value" = 'direct_commit'
WHERE "key" = 'deploy_strategy' AND "value" = 'none';

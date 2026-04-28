UPDATE "project_settings"
SET "value" = 'direct_commit'
WHERE "key" = 'deploy_strategy' AND "value" = 'none';

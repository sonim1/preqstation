UPDATE "tasks" SET "dispatch_target" = 'telegram' WHERE "dispatch_target" = 'claude-code-channel';

DROP TABLE IF EXISTS "dispatch_requests";

ALTER TABLE "tasks" ADD COLUMN "artifacts" jsonb DEFAULT '[]'::jsonb NOT NULL;
ALTER TABLE "qa_runs" ADD COLUMN "artifacts" jsonb DEFAULT '[]'::jsonb NOT NULL;

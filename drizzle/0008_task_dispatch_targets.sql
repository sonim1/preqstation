ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "dispatch_target" text;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tasks_owner_id_dispatch_target_idx" ON "tasks" USING btree ("owner_id","dispatch_target");

CREATE INDEX IF NOT EXISTS "tasks_owner_id_engine_idx" ON "tasks" USING btree ("owner_id","engine");

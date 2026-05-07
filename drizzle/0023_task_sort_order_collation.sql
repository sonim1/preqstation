DROP INDEX IF EXISTS "tasks_owner_id_status_sort_order_idx";--> statement-breakpoint
ALTER TABLE "tasks" ALTER COLUMN "sort_order" TYPE varchar(64) COLLATE "C" USING "sort_order";--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tasks_owner_id_status_sort_order_idx" ON "tasks" USING btree ("owner_id","status","sort_order");

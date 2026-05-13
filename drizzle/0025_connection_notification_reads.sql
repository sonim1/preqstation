CREATE TABLE "connection_notification_reads" (
	"owner_id" uuid NOT NULL,
	"notification_key" text NOT NULL,
	"read_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp (6) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "connection_notification_reads" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "connection_notification_reads" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "connection_notification_reads" ADD CONSTRAINT "connection_notification_reads_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "connection_notification_reads_owner_id_notification_key_idx" ON "connection_notification_reads" USING btree ("owner_id","notification_key");--> statement-breakpoint
CREATE INDEX "connection_notification_reads_owner_id_read_at_idx" ON "connection_notification_reads" USING btree ("owner_id","read_at");--> statement-breakpoint
CREATE POLICY "connection_notification_reads_owner_all" ON "connection_notification_reads" AS PERMISSIVE FOR ALL TO public USING ("connection_notification_reads"."owner_id"::text = nullif(current_setting('app.user_id', true), '')) WITH CHECK ("connection_notification_reads"."owner_id"::text = nullif(current_setting('app.user_id', true), ''));

CREATE TABLE "browser_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"browser_name" text,
	"os_name" text,
	"last_used_at" timestamp (6) with time zone NOT NULL,
	"expires_at" timestamp (6) with time zone NOT NULL,
	"revoked_at" timestamp (6) with time zone,
	"created_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (6) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "browser_sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "browser_sessions" ADD CONSTRAINT "browser_sessions_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "browser_sessions_owner_id_revoked_at_idx" ON "browser_sessions" USING btree ("owner_id","revoked_at");--> statement-breakpoint
CREATE INDEX "browser_sessions_owner_id_last_used_at_idx" ON "browser_sessions" USING btree ("owner_id","last_used_at");--> statement-breakpoint
CREATE POLICY "browser_sessions_owner_all" ON "browser_sessions" AS PERMISSIVE FOR ALL TO public USING ("browser_sessions"."owner_id"::text = nullif(current_setting('app.user_id', true), '')) WITH CHECK ("browser_sessions"."owner_id"::text = nullif(current_setting('app.user_id', true), ''));

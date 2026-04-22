CREATE TABLE "mcp_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"client_id" text NOT NULL,
	"display_name" text NOT NULL,
	"redirect_uri" text NOT NULL,
	"engine" text,
	"last_used_at" timestamp (6) with time zone,
	"expires_at" timestamp (6) with time zone NOT NULL,
	"revoked_at" timestamp (6) with time zone,
	"created_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (6) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mcp_connections" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "oauth_clients" (
	"client_id" text PRIMARY KEY NOT NULL,
	"owner_id" uuid,
	"client_name" text,
	"redirect_uris" jsonb NOT NULL,
	"created_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (6) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "oauth_clients" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "oauth_codes" ADD COLUMN "client_id" text;--> statement-breakpoint
ALTER TABLE "mcp_connections" ADD CONSTRAINT "mcp_connections_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_connections" ADD CONSTRAINT "mcp_connections_client_id_oauth_clients_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."oauth_clients"("client_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_clients" ADD CONSTRAINT "oauth_clients_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "mcp_connections_owner_id_revoked_at_idx" ON "mcp_connections" USING btree ("owner_id","revoked_at");--> statement-breakpoint
CREATE INDEX "mcp_connections_client_id_idx" ON "mcp_connections" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "oauth_clients_owner_id_idx" ON "oauth_clients" USING btree ("owner_id");--> statement-breakpoint
ALTER TABLE "oauth_codes" ADD CONSTRAINT "oauth_codes_client_id_oauth_clients_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."oauth_clients"("client_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "oauth_codes_client_id_expires_at_idx" ON "oauth_codes" USING btree ("client_id","expires_at");--> statement-breakpoint
CREATE POLICY "mcp_connections_owner_all" ON "mcp_connections" AS PERMISSIVE FOR ALL TO public USING ("mcp_connections"."owner_id"::text = nullif(current_setting('app.user_id', true), '')) WITH CHECK ("mcp_connections"."owner_id"::text = nullif(current_setting('app.user_id', true), ''));--> statement-breakpoint
CREATE POLICY "oauth_clients_owner_all" ON "oauth_clients" AS PERMISSIVE FOR ALL TO public USING (exists (
    select 1
    from "users"
    where "users"."id" = "oauth_clients"."owner_id"
      and "users"."id"::text = nullif(current_setting('app.user_id', true), '')
  )) WITH CHECK (exists (
    select 1
    from "users"
    where "users"."id" = "oauth_clients"."owner_id"
      and "users"."id"::text = nullif(current_setting('app.user_id', true), '')
  ));
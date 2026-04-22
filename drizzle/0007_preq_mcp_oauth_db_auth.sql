ALTER TABLE "users" ADD COLUMN "password_hash" text;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "oauth_codes" (
	"code" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"code_challenge" text NOT NULL,
	"code_challenge_method" text NOT NULL,
	"redirect_uri" text NOT NULL,
	"expires_at" timestamp (6) with time zone NOT NULL,
	"created_at" timestamp (6) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "oauth_codes" ADD CONSTRAINT "oauth_codes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "oauth_codes_user_id_expires_at_idx" ON "oauth_codes" ("user_id","expires_at");

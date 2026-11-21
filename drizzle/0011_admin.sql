CREATE TABLE IF NOT EXISTS "admin_audit" (
	"id" text PRIMARY KEY NOT NULL,
	"admin_email" text NOT NULL,
	"action" text NOT NULL,
	"target_user_id" text,
	"target_email" text,
	"details" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "status_reason" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "status_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "status_changed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "last_seen_at" timestamp with time zone;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "admin_audit" ADD CONSTRAINT "admin_audit_target_user_id_user_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "admin_audit_created_idx" ON "admin_audit" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "admin_audit_target_idx" ON "admin_audit" USING btree ("target_user_id");--> statement-breakpoint
ALTER TABLE "admin_audit" ENABLE ROW LEVEL SECURITY;

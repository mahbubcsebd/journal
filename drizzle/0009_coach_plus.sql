CREATE TABLE IF NOT EXISTS "coach_memory" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"text" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "coach_report" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"kind" text NOT NULL,
	"period" text NOT NULL,
	"language" text DEFAULT 'en' NOT NULL,
	"content" text NOT NULL,
	"model" text,
	"conversation_id" text,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "coach_message" ADD COLUMN IF NOT EXISTS "feedback" integer;--> statement-breakpoint
ALTER TABLE "coach_message" ADD COLUMN IF NOT EXISTS "images" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "coach_memory" ADD CONSTRAINT "coach_memory_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "coach_report" ADD CONSTRAINT "coach_report_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
ALTER TABLE "coach_report" ADD COLUMN IF NOT EXISTS "conversation_id" text;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "coach_report" ADD CONSTRAINT "coach_report_conversation_id_coach_conversation_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."coach_conversation"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "coach_memory_user_idx" ON "coach_memory" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "coach_report_period_uq" ON "coach_report" USING btree ("user_id","kind","period");--> statement-breakpoint
ALTER TABLE "coach_memory" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "coach_report" ENABLE ROW LEVEL SECURITY;

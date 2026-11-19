CREATE TABLE IF NOT EXISTS "coach_conversation" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "coach_message" (
	"id" text PRIMARY KEY NOT NULL,
	"conversation_id" text NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"tools_used" jsonb,
	"model" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "coach_conversation" ADD CONSTRAINT "coach_conversation_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "coach_message" ADD CONSTRAINT "coach_message_conversation_id_coach_conversation_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."coach_conversation"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "coach_conversation_user_idx" ON "coach_conversation" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "coach_message_conversation_idx" ON "coach_message" USING btree ("conversation_id","created_at");--> statement-breakpoint
ALTER TABLE "coach_conversation" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "coach_message" ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS "economic_event" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"currency" text NOT NULL,
	"impact" text NOT NULL,
	"time" timestamp with time zone NOT NULL,
	"all_day" boolean DEFAULT false NOT NULL,
	"forecast" text,
	"previous" text,
	"actual" text,
	"source" text DEFAULT 'forexfactory' NOT NULL,
	"analysis" jsonb,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "economic_event_time_idx" ON "economic_event" USING btree ("time");--> statement-breakpoint
ALTER TABLE "economic_event" ENABLE ROW LEVEL SECURITY;

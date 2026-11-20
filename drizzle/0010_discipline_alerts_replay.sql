CREATE TABLE IF NOT EXISTS "pretrade_log" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"account_id" text,
	"symbol" text NOT NULL,
	"side" text NOT NULL,
	"entry" numeric(20, 8) NOT NULL,
	"sl" numeric(20, 8),
	"tp" numeric(20, 8),
	"lots" real NOT NULL,
	"verdict" text NOT NULL,
	"checks" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "push_subscription" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "trade_candles" (
	"trade_id" text PRIMARY KEY NOT NULL,
	"timeframe" integer NOT NULL,
	"candles" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "pretrade_log" ADD CONSTRAINT "pretrade_log_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "pretrade_log" ADD CONSTRAINT "pretrade_log_account_id_trading_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."trading_account"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "push_subscription" ADD CONSTRAINT "push_subscription_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "trade_candles" ADD CONSTRAINT "trade_candles_trade_id_trade_id_fk" FOREIGN KEY ("trade_id") REFERENCES "public"."trade"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pretrade_log_user_idx" ON "pretrade_log" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "push_subscription_endpoint_uq" ON "push_subscription" USING btree ("endpoint");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "push_subscription_user_idx" ON "push_subscription" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "pretrade_log" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "push_subscription" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "trade_candles" ENABLE ROW LEVEL SECURITY;

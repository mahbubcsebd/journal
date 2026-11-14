CREATE TYPE "public"."account_env" AS ENUM('REAL', 'DEMO');--> statement-breakpoint
CREATE TYPE "public"."account_status" AS ENUM('PENDING', 'CONNECTED', 'SYNCING', 'ERROR', 'DISCONNECTED');--> statement-breakpoint
CREATE TYPE "public"."market_session" AS ENUM('ASIA', 'LONDON', 'NEW_YORK', 'LONDON_NY_OVERLAP', 'OFF_HOURS');--> statement-breakpoint
CREATE TYPE "public"."platform" AS ENUM('MT5', 'MT4');--> statement-breakpoint
CREATE TYPE "public"."sync_method" AS ENUM('METAAPI', 'EA', 'IMPORT', 'MANUAL');--> statement-breakpoint
CREATE TYPE "public"."tag_kind" AS ENUM('TAG', 'MISTAKE', 'EMOTION');--> statement-breakpoint
CREATE TYPE "public"."trade_side" AS ENUM('LONG', 'SHORT');--> statement-breakpoint
CREATE TYPE "public"."trade_status" AS ENUM('OPEN', 'CLOSED');--> statement-breakpoint
CREATE TYPE "public"."transaction_type" AS ENUM('DEPOSIT', 'WITHDRAWAL', 'CREDIT', 'BONUS', 'ADJUSTMENT');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_insight" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"scope" text NOT NULL,
	"range_start" date,
	"range_end" date,
	"account_ids" jsonb,
	"content" jsonb NOT NULL,
	"model" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "challenge" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"account_id" text NOT NULL,
	"name" text NOT NULL,
	"start_balance" numeric(20, 2) NOT NULL,
	"profit_target" numeric(20, 2) NOT NULL,
	"max_drawdown" numeric(20, 2) NOT NULL,
	"max_daily_drawdown" numeric(20, 2),
	"start_date" date NOT NULL,
	"end_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_stat" (
	"account_id" text NOT NULL,
	"user_id" text NOT NULL,
	"day" date NOT NULL,
	"net_pnl" numeric(20, 2) DEFAULT 0 NOT NULL,
	"gross_profit" numeric(20, 2) DEFAULT 0 NOT NULL,
	"gross_loss" numeric(20, 2) DEFAULT 0 NOT NULL,
	"commission" numeric(20, 2) DEFAULT 0 NOT NULL,
	"swap" numeric(20, 2) DEFAULT 0 NOT NULL,
	"trades" integer DEFAULT 0 NOT NULL,
	"wins" integer DEFAULT 0 NOT NULL,
	"losses" integer DEFAULT 0 NOT NULL,
	"volume" real DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "daily_stat_account_id_day_pk" PRIMARY KEY("account_id","day")
);
--> statement-breakpoint
CREATE TABLE "deal" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"ticket" text NOT NULL,
	"order_ticket" text,
	"position_id" text,
	"symbol" text,
	"type" text NOT NULL,
	"entry" text,
	"volume" real,
	"price" numeric(20, 8),
	"sl" numeric(20, 8),
	"tp" numeric(20, 8),
	"commission" numeric(20, 2) DEFAULT 0 NOT NULL,
	"swap" numeric(20, 2) DEFAULT 0 NOT NULL,
	"fee" numeric(20, 2) DEFAULT 0 NOT NULL,
	"profit" numeric(20, 2) DEFAULT 0 NOT NULL,
	"magic" bigint,
	"comment" text,
	"time" timestamp with time zone NOT NULL,
	"source" "sync_method" NOT NULL,
	"raw" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "goal" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"account_id" text,
	"period" text NOT NULL,
	"metric" text NOT NULL,
	"target" numeric(20, 2) NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "journal_entry" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"day" date NOT NULL,
	"premarket" jsonb,
	"review" jsonb,
	"mood" integer,
	"lessons" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "note" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"folder" text DEFAULT 'General' NOT NULL,
	"title" text NOT NULL,
	"content" jsonb,
	"pinned" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "setup" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"rules" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"checklist" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"color" text DEFAULT '#6366f1' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_key" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text DEFAULT 'MT5 EA' NOT NULL,
	"prefix" text NOT NULL,
	"key_hash" text NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sync_key_key_hash_unique" UNIQUE("key_hash")
);
--> statement-breakpoint
CREATE TABLE "sync_log" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"account_id" text,
	"source" "sync_method" NOT NULL,
	"status" text NOT NULL,
	"message" text,
	"item_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tag" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"kind" "tag_kind" DEFAULT 'TAG' NOT NULL,
	"color" text DEFAULT '#64748b' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trade" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"account_id" text NOT NULL,
	"position_id" text,
	"symbol" text NOT NULL,
	"side" "trade_side" NOT NULL,
	"status" "trade_status" DEFAULT 'CLOSED' NOT NULL,
	"open_time" timestamp with time zone NOT NULL,
	"close_time" timestamp with time zone,
	"open_price" numeric(20, 8) NOT NULL,
	"close_price" numeric(20, 8),
	"volume" real NOT NULL,
	"sl" numeric(20, 8),
	"tp" numeric(20, 8),
	"commission" numeric(20, 2) DEFAULT 0 NOT NULL,
	"swap" numeric(20, 2) DEFAULT 0 NOT NULL,
	"gross_pnl" numeric(20, 2) DEFAULT 0 NOT NULL,
	"net_pnl" numeric(20, 2) DEFAULT 0 NOT NULL,
	"pips" real,
	"risk_amount" numeric(20, 2),
	"r_multiple" real,
	"mae" numeric(20, 8),
	"mfe" numeric(20, 8),
	"duration_sec" integer,
	"session" "market_session",
	"source" "sync_method" NOT NULL,
	"is_backtest" boolean DEFAULT false NOT NULL,
	"setup_id" text,
	"rating" integer,
	"notes" jsonb,
	"emotion_before" text,
	"emotion_after" text,
	"followed_plan" boolean,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trade_image" (
	"id" text PRIMARY KEY NOT NULL,
	"trade_id" text NOT NULL,
	"url" text NOT NULL,
	"caption" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trade_tag" (
	"trade_id" text NOT NULL,
	"tag_id" text NOT NULL,
	CONSTRAINT "trade_tag_trade_id_tag_id_pk" PRIMARY KEY("trade_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "trading_account" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"broker" text DEFAULT 'Exness' NOT NULL,
	"platform" "platform" DEFAULT 'MT5' NOT NULL,
	"login" text NOT NULL,
	"server" text NOT NULL,
	"nickname" text NOT NULL,
	"color" text DEFAULT '#10b981' NOT NULL,
	"account_type" text DEFAULT 'Standard' NOT NULL,
	"environment" "account_env" DEFAULT 'REAL' NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"leverage" integer,
	"sync_method" "sync_method" DEFAULT 'MANUAL' NOT NULL,
	"status" "account_status" DEFAULT 'PENDING' NOT NULL,
	"status_message" text,
	"metaapi_account_id" text,
	"encrypted_investor_password" text,
	"balance" numeric(20, 2),
	"equity" numeric(20, 2),
	"initial_balance" numeric(20, 2),
	"last_sync_at" timestamp with time zone,
	"archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transaction" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"ticket" text,
	"type" "transaction_type" NOT NULL,
	"amount" numeric(20, 2) NOT NULL,
	"comment" text,
	"time" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"timezone" text DEFAULT 'Asia/Dhaka' NOT NULL,
	"base_currency" text DEFAULT 'USD' NOT NULL,
	"onboarded" boolean DEFAULT false NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_insight" ADD CONSTRAINT "ai_insight_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenge" ADD CONSTRAINT "challenge_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenge" ADD CONSTRAINT "challenge_account_id_trading_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."trading_account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_stat" ADD CONSTRAINT "daily_stat_account_id_trading_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."trading_account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_stat" ADD CONSTRAINT "daily_stat_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal" ADD CONSTRAINT "deal_account_id_trading_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."trading_account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal" ADD CONSTRAINT "goal_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal" ADD CONSTRAINT "goal_account_id_trading_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."trading_account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entry" ADD CONSTRAINT "journal_entry_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note" ADD CONSTRAINT "note_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "setup" ADD CONSTRAINT "setup_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_key" ADD CONSTRAINT "sync_key_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_log" ADD CONSTRAINT "sync_log_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_log" ADD CONSTRAINT "sync_log_account_id_trading_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."trading_account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tag" ADD CONSTRAINT "tag_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade" ADD CONSTRAINT "trade_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade" ADD CONSTRAINT "trade_account_id_trading_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."trading_account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade" ADD CONSTRAINT "trade_setup_id_setup_id_fk" FOREIGN KEY ("setup_id") REFERENCES "public"."setup"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_image" ADD CONSTRAINT "trade_image_trade_id_trade_id_fk" FOREIGN KEY ("trade_id") REFERENCES "public"."trade"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_tag" ADD CONSTRAINT "trade_tag_trade_id_trade_id_fk" FOREIGN KEY ("trade_id") REFERENCES "public"."trade"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_tag" ADD CONSTRAINT "trade_tag_tag_id_tag_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tag"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trading_account" ADD CONSTRAINT "trading_account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction" ADD CONSTRAINT "transaction_account_id_trading_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."trading_account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "daily_stat_user_day_idx" ON "daily_stat" USING btree ("user_id","day");--> statement-breakpoint
CREATE UNIQUE INDEX "deal_ticket_uq" ON "deal" USING btree ("account_id","ticket");--> statement-breakpoint
CREATE INDEX "deal_position_idx" ON "deal" USING btree ("account_id","position_id");--> statement-breakpoint
CREATE UNIQUE INDEX "journal_day_uq" ON "journal_entry" USING btree ("user_id","day");--> statement-breakpoint
CREATE INDEX "session_user_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sync_log_user_idx" ON "sync_log" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "tag_name_uq" ON "tag" USING btree ("user_id","kind","name");--> statement-breakpoint
CREATE UNIQUE INDEX "trade_position_uq" ON "trade" USING btree ("account_id","position_id") WHERE "trade"."position_id" is not null;--> statement-breakpoint
CREATE INDEX "trade_user_close_idx" ON "trade" USING btree ("user_id","close_time");--> statement-breakpoint
CREATE INDEX "trade_account_close_idx" ON "trade" USING btree ("account_id","close_time");--> statement-breakpoint
CREATE INDEX "trade_symbol_idx" ON "trade" USING btree ("user_id","symbol");--> statement-breakpoint
CREATE UNIQUE INDEX "trading_account_login_uq" ON "trading_account" USING btree ("user_id","login","server");--> statement-breakpoint
CREATE INDEX "trading_account_user_idx" ON "trading_account" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "transaction_ticket_uq" ON "transaction" USING btree ("account_id","ticket");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");
ALTER TABLE "challenge" ADD COLUMN "min_trading_days" integer;--> statement-breakpoint
ALTER TABLE "challenge" ADD COLUMN "trailing_drawdown" boolean DEFAULT false NOT NULL;
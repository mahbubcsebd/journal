-- Supabase exposes the public schema through its Data API (PostgREST) to anyone
-- holding the project's anon key. Journal talks to Postgres directly as the table
-- owner, so enable Row Level Security with NO policies: the Data API can read or
-- write nothing, while the app (table owner, RLS not forced) works as before.
ALTER TABLE "user" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "session" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "account" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "verification" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "rate_limit" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "trading_account" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "sync_key" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "deal" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "transaction" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "trade" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "trade_image" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tag" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "trade_tag" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "setup" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "daily_stat" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "journal_entry" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "note" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "goal" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "challenge" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "sync_log" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "notification_log" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "ai_insight" ENABLE ROW LEVEL SECURITY;

# SMC Desk → Journal merge plan

Decided 2026-11-23. Live data (MT5 bridge + SMC server) stays on PC/VPS behind tunnel.
Charts / scanner / backtest / reaction UI move into Journal. Trades land in Supabase.

## Status (2026-11-23)
- Done: Phase 0 (smc-desk b8065fb), Phase 2 (proxy + WS token; smc-desk 99a5509), Phase 3 (single /desk page with the SMC tabs, not sub-routes), Phase 4 (pull-sync instead of direct writes: SMC server still runs the paper-trade lifecycle; Journal upserts them by `smc:<id>`).
- Open: Phase 1 (user actions), migration 0006 in Supabase, env vars on Vercel + smc-desk/server/.env, live smoke test. Vitest can't run on Node 25 here; use Node 22/24.

## Phase 0 — Prep
- Commit SMC WIP (chat + Reaction Zones) in the smc-desk repo. Needs `npm i` in server/ and web/ first so typecheck/tests can run.
- Keep smc-desk/ as its own repo; add `smc-desk/` to Journal .gitignore.

## Phase 1 — DB hang (blocker)
- User sends JSON from `/api/health/db`.
- SQL Editor: `ALTER ROLE postgres SET idle_in_transaction_session_timeout='30s'; ALTER ROLE postgres SET statement_timeout='30s';`
- Rotate the DB password → update Vercel DATABASE_URL (port 6543) / DIRECT_URL + .env.local → redeploy.
- Done when /dashboard loads and Add account saves.

## Phase 2 — Secure bridge to SMC server
- Journal env (server only): `SMC_API_URL`, `SMC_ACCESS_KEY`, `SMC_WS_SECRET` (add to src/lib/env.ts).
- REST: route handler `src/app/api/smc/[...path]/route.ts` checks the Better Auth session, then forwards with an `x-access-key` header. The key never reaches the browser. Streams SSE for chat.
- WS: Vercel can't proxy it. Journal issues a short-lived HMAC token (`exp`, `userId`). SMC `server/src/access.ts` accepts `/ws?token=` and verifies it with `SMC_WS_SECRET`.
- SMC `CORS_ORIGINS` += the Journal domain.

## Phase 3 — UI port
- Route `src/app/(app)/desk/`: `page.tsx` (chart + watchlist + HTF), `scanner/`, `backtest/`, `reaction/`. Add a nav-config entry.
- Copy components → `src/components/desk/`, hooks/libs → `src/lib/desk/` (tests move as Vitest).
- Add the `lightweight-charts` dependency. Client components only at the chart leaf; the page shell is a server component.
- Restyle: Jade/Coral/Gold → profit/loss/warning tokens; Journal fonts. Keep EN/BN strings via a small desk i18n map.
- Drop the SMC JournalView / JournalAnalytics / EquityChart (Journal already has these).

## Phase 4 — Trades into Supabase
- Migration: `ALTER TYPE sync_method ADD VALUE 'SMC'`.
- Each user gets one virtual trading_account "SMC Paper" (environment DEMO, sync_method SMC), created lazily.
- Desk "Save trade" → server action `src/server/actions/desk-trades.ts` (zod) → `trade` row; backtest results use `is_backtest=true`. Recompute daily_stat.
- One-time script: SMC sqlite `journal_trades` → Supabase (dedupe on position_id).

## Phase 5 — Retire + verify
- smc-desk/web is no longer deployed. smc-desk keeps only server + bridge.
- Run typecheck, lint, Vitest for the moved libs, and a smoke test on Vercel (desk loads, WS connects, a trade is saved).
- Update CLAUDE.md, docs/DESIGN.md (desk components), DEPLOY.md (tunnel + env).

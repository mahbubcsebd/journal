# Journal — Master Plan

> Exness (MT4/MT5) account er sob trade auto-sync hobe, sathe world-class analytics, calendar, journaling, psychology tracking.
> Stack: **Next.js 16 · Tailwind CSS v4 · Framer Motion · Supabase Postgres · Drizzle · Better Auth (email OTP via Nodemailer) · Gemini**

---

## 1. Sobcheye important: Exness auto-sync kivabe hobe

Exness er kono public "trade history API" nei. Exness account gulo **MetaTrader 4 / MetaTrader 5** e chole, tai sync korte hobe MetaTrader er maddhome. Amra 3 ta source support korbo, sob ekta common `SyncAdapter` interface diye:

| Option | Kivabe kaj kore | Subidha | Osubidha |
|---|---|---|---|
| **A. MetaApi Cloud** (recommended primary) | Account number + **investor (read-only) password** + server name (e.g. `Exness-MT5Real8`) dile MetaApi cloud theke 24/7 deals/positions ane, webhook/stream e | PC bondho thakleo sync hoy, real-time, open position + live equity pawa jay | Paid service (account-proti monthly fee, pricing confirm korte hobe) |
| **B. Custom MT5 Expert Advisor (EA)** | Amra ekta MQL5 EA likhbo. Terminal e chalu thakle protiti deal close/open hole `WebRequest` diye amader `/api/sync/mt5` endpoint e signed JSON pathabe | Free, instant, full control | MT5 terminal (PC ba VPS) chalu rakhte hobe — Exness free VPS deya kichu account e |
| **C. Statement import** (fallback) | MT5 "History → Report" HTML/XLSX ba CSV upload | Purono sob history ekbare import | Manual |

**Security rules:**
- Kokhono **master/trading password** nibo na — sudhu investor password (read-only, trade place korte pare na).
- Credentials AES-256-GCM e encrypt kore DB te; EA er jonno per-account API key + HMAC signature.
- Duplicate thekate `(accountId, ticket/dealId)` unique — same trade dui source theke elo-o ekta entry hobe.

**Multiple Exness sub-accounts:** Exness Personal Area er protiti MT5 login (Standard, Standard Cent, Pro, Raw Spread, Zero — real/demo) alada `trading_account` row. Topbar er account switcher diye *All accounts*, ekta account, ba jekono kichu account ek sathe select kora jay (cookie te save thake, server e validate hoy). EA mode e ekta user-level API key; EA payload e login + server thake, tai notun sub-account e EA lagale seta auto-detect hoye add hoye jabe. Cent account (USC) ar USD account mix korle USC → USD (÷100) convert kore jog hoy.

**Sync flow:** deal ashe → normalize (symbol, lot, entry/exit, SL/TP, commission, swap, net P&L, duration) → position-level "Trade" e group (partial close soho) → DB → stats recalculate → browser e real-time push (SSE) → calendar/dashboard nijei update hoye jabe.

---

## 2. Tech stack (final)

| Layer | Choice |
|---|---|
| Framework | **Next.js 16.4** (App Router, React 19.3, Cache Components + Partial Prefetching, Server Actions, Turbopack, `proxy.ts`) |
| Styling | **Tailwind CSS v4** + Radix primitives (`radix-ui`) — own component set in `src/components/ui` |
| Animation | **Motion** (Framer Motion, `motion/react`) |
| Theme | `next-themes` — Light / Dark / System |
| Auth | **Better Auth** + Email OTP plugin (passwordless, hashed OTP, rate limited) |
| Email | **Nodemailer** (any SMTP — Gmail App Password works) |
| Database | **Supabase Postgres** + **Drizzle ORM** (`postgres-js`, transaction pooler on Vercel) |
| Storage | Supabase Storage (trade screenshots) |
| Real-time | Supabase Realtime broadcast → client refresh |
| Background jobs | Vercel Cron + Inngest (periodic MetaApi sync, stats rebuild, weekly email) |
| Charts | Recharts + TradingView Lightweight Charts |
| AI insights | **Google Gemini** free API (`@google/genai`, model configurable via `GEMINI_MODEL`) |
| Testing | Vitest (stats engine) + Playwright (E2E) |
| Deploy | **Vercel** |

---

## 3. Pages / Routes

### Public
- `/` — Landing page (hero, feature showcase, animated preview)
- `/login` — Email → 6-digit OTP (same page, animated step transition, auto-submit, resend timer)
- `/onboarding` — Name, timezone, base currency, first account connect

### App (protected)
| Route | Ki thakbe |
|---|---|
| `/dashboard` | KPI cards (Net P&L, Win rate, Profit factor, Expectancy, Avg R, Max DD), equity curve, mini calendar, recent trades, open positions (live), today vs goal, streaks |
| `/calendar` | **Monthly** grid (green = profit, red = loss, intensity = size), **Weekly** view (weekly totals column), **Daily** drill-down, **Yearly** heatmap; protiti cell e P&L, trade count, win rate; click korle day details drawer |
| `/calendar/[date]` | Oi diner sob trade, intraday equity curve, daily journal, mood, mistakes |
| `/trades` | Full trade table — filters (date, symbol, side, tag, setup, result, session, account), bulk tag/delete, CSV export, saved views |
| `/trades/[id]` | Trade detail: chart with entry/exit markers (replay), stats (R-multiple, MAE/MFE, duration, pips), screenshots, notes, tags, setup, emotions, rating, mistakes checklist |
| `/trades/new` | Manual trade add (non-Exness ba backtest) |
| `/analytics` | Overview + tabs: **Performance**, **Symbols**, **Time** (hour / day-of-week / session: Asia-London-NY), **Duration**, **Long vs Short**, **Setups**, **Tags**, **Risk** (R distribution, position size), **Streaks**, **Drawdown** |
| `/reports` | Daily / Weekly / Monthly / Yearly / Custom report, compare periods, PDF export, shareable P&L card image |
| `/journal` | Daily journal list — pre-market plan, post-market review, lessons, mood; calendar-linked |
| `/journal/[date]` | Rich text editor + auto-attached day stats |
| `/notebook` | Free-form notes, folders, templates |
| `/playbook` | Strategy/setup library — rules, checklist, example trades, each setup er own stats |
| `/playbook/[id]` | Setup detail + performance |
| `/psychology` | Emotion tracking vs P&L, discipline score, tilt detection, rule-break cost |
| `/goals` | Daily/weekly/monthly profit target, max daily loss, max trades/day — progress ring + breach alert |
| `/risk` | Position size calculator, pip value, risk-reward, account risk rules |
| `/challenges` | Prop firm / personal challenge tracker (target, max DD, daily DD, days) |
| `/insights` | AI insights — "tumi Friday NY session e XAUUSD te loss koro", weekly AI review |
| `/accounts` | Multiple Exness account list, balance, sync status, last sync time |
| `/accounts/connect` | Wizard: MetaApi / EA (API key + EA download + setup guide) / Import |
| `/accounts/[id]` | Account stats, deposit/withdrawal history, sync logs |
| `/import` | Statement file upload, column mapping, preview, duplicate check |
| `/tags` | Tags, mistakes, emotions manage (color, group) |
| `/settings` | Profile, timezone, currency, theme, notifications, calendar start day, P&L display (money / R / %/ pips), data export, delete account |
| `/settings/security` | Active sessions, logout all devices |

**Global UI:** collapsible sidebar, top bar (account switcher, date range picker, theme toggle, sync indicator), `⌘K` command palette, toast notifications, keyboard shortcuts, fully responsive + PWA (mobile e install kora jabe).

---

## 4. Feature list (kono kichu bad nei)

**Auto-sync & data**
- Exness MT4/MT5 auto-sync (MetaApi / EA / import), multi-account, live open positions & equity
- Partial close / scale-in merge, commission + swap included net P&L
- Deposit / withdrawal tracking (return % sothik rakhte)
- Manual trade entry, backtest trades (alada flag)
- Duplicate detection, sync log, re-sync button

**Calendar**
- Daily / Weekly / Monthly / Yearly views, green/red with intensity
- Weekly & monthly totals, best/worst day highlight
- Day click → drawer with trades + journal

**Analytics (stats engine)**
- Net/Gross P&L, Win rate, Profit factor, Expectancy, Avg win / Avg loss, Payoff ratio
- R-multiple, Avg R, Max/avg drawdown, Recovery factor, Sharpe, Sortino, Calmar
- Max consecutive wins/losses, current streak
- MAE / MFE (MetaApi / EA price data theke)
- Breakdown: symbol, side, session, hour, weekday, month, duration bucket, lot size, setup, tag, emotion, mistake
- Equity curve, drawdown chart, P&L distribution histogram, scatter (duration vs P&L)
- Period comparison (this month vs last month)

**Journaling & psychology**
- Trade notes, screenshots (paste/drag), tags, setup, rating (1-5), emotions before/after, mistakes checklist
- Daily pre-market plan + post-market review, mood
- Rule-break tracking ("rule bhenge koto loss holo")
- Playbook with per-setup stats

**Goals & risk**
- Daily loss limit / profit target / max trades — alert (in-app + email)
- Position size calculator, prop challenge tracker

**Reports & sharing**
- PDF / CSV export, weekly email summary, share card (P&L image, amount hide option)

**AI**
- Pattern detection, weekly review, trade-specific feedback (Claude API)

**UX**
- Dark/Light/System theme, Framer Motion animations, command palette, keyboard shortcuts
- Timezone-aware (broker server time vs local time), multi-currency display
- Bangla / English (i18n ready)
- PWA, responsive, skeleton loaders, empty states

---

## 5. Database schema (main models)

```
User            id, email, name, image, timezone, baseCurrency, settings(json)
Session / Verification   (Better Auth managed — OTP store)
TradingAccount  id, userId, broker("Exness"), platform(MT4|MT5), login, server,
                syncMethod(METAAPI|EA|IMPORT), metaapiAccountId, encryptedCreds,
                eaApiKeyHash, currency, balance, equity, lastSyncAt, status
Deal            id, accountId, ticket (unique per account), positionId, type, entry(IN|OUT),
                symbol, volume, price, commission, swap, profit, time, raw(json)
Trade           id, accountId, positionId, symbol, side, openTime, closeTime, openPrice,
                closePrice, volume, sl, tp, commission, swap, grossPnl, netPnl, pips,
                rMultiple, mae, mfe, durationSec, session, status(OPEN|CLOSED),
                isManual, isBacktest, rating, setupId
TradeNote       tradeId, content(json), emotionsBefore[], emotionsAfter[]
TradeImage      tradeId, url, caption
Tag / TradeTag  (type: TAG | MISTAKE | EMOTION), color
Setup           (playbook) name, rules(json), checklist(json)
JournalEntry    userId, date, premarket(json), review(json), mood, lessons
Note / Folder   notebook
Goal            type, period, target, active
RiskRule        type (DAILY_LOSS | MAX_TRADES ...), value
Challenge       accountId, target, maxDD, dailyDD, startDate, endDate
Transaction     accountId, type(DEPOSIT|WITHDRAWAL), amount, time
DailyStat       accountId, date, netPnl, trades, wins, losses, volume  ← calendar fast load
SyncLog         accountId, source, status, message, count, createdAt
AiInsight       userId, period, content, createdAt
```
`DailyStat` table pre-aggregate kora thakbe, jate calendar & dashboard instant load hoy; notun trade ashlei oi diner row recalculate.

---

## 6. Folder structure

```
src/
  app/
    (marketing)/page.tsx
    (auth)/login, verify, onboarding
    (app)/dashboard, calendar, trades, analytics, reports, journal, notebook,
          playbook, psychology, goals, risk, challenges, insights, accounts,
          import, tags, settings
    api/
      auth/[...all]/route.ts        Better Auth
      sync/mt5/route.ts             EA webhook
      webhooks/metaapi/route.ts
      events/route.ts               SSE stream
      inngest/route.ts
  components/ ui/ (shadcn), charts/, calendar/, trades/, layout/, motion/
  lib/
    auth.ts, db.ts, crypto.ts
    sync/ adapter.ts, metaapi.ts, ea.ts, import-mt5.ts, normalize.ts
    stats/ metrics.ts, aggregations.ts   ← pure functions, fully unit tested
    validations/
  server/ actions/, queries/
  proxy.ts                          route protection (Next 16)
prisma/schema.prisma
mql5/TradeJournalSync.mq5           EA source
```

---

## 7. Design direction

- **Look:** clean, premium fintech feel — Inter/Geist font, generous spacing, soft borders, subtle glass cards in dark mode
- **Colors:** neutral zinc base, ekta accent (emerald/indigo), profit = emerald, loss = rose; colors CSS variables e, dark/light dutoi tuned
- **Motion:** page fade-slide, KPI number count-up, chart draw-in, calendar cells stagger, drawer spring, shared layout animation on tabs; `prefers-reduced-motion` respect
- **Data density:** tabular-nums font, compact & comfortable mode toggle

---

## 8. Build phases

| Phase | Kaj | Output |
|---|---|---|
| **0. Setup** | Next 16 + Tailwind v4 + shadcn + Framer Motion + Prisma + Neon, lint/format, theme system, layout shell (sidebar, topbar) | Running skeleton, dark/light toggle |
| **1. Auth** | Better Auth email OTP, Resend email template, `/login` → `/verify` → `/onboarding`, `proxy.ts` protection | Email OTP diye login |
| **2. Data core** | Prisma schema, manual trade CRUD, trades table, trade detail page, tags/setup | Manually trade add & dekha jay |
| **3. Import** | MT5 HTML/XLSX/CSV statement parser, dedupe, deal→trade grouping, DailyStat build | Exness history ekbare import |
| **4. Calendar + Dashboard** | Stats engine (tested), monthly/weekly/daily/yearly calendar red/green, dashboard KPIs & equity curve | Core value ready |
| **5. Auto-sync** | MetaApi adapter + EA (MQL5) + webhook + Inngest jobs + SSE real-time, accounts pages, sync logs | Exness e trade korle nijei journal e ashe |
| **6. Analytics & Reports** | All breakdowns, charts, period compare, PDF/CSV export, share card | Deep analysis |
| **7. Journaling** | Daily journal, notebook (Tiptap), screenshots upload, playbook, psychology, mistakes | Full journaling |
| **8. Goals & risk** | Goals, risk rules + alerts, calculators, challenge tracker | Discipline tools |
| **9. AI & extras** | AI insights, weekly email, command palette, PWA, i18n | Polish |
| **10. QA & launch** | E2E tests, performance, security review, deploy | Production |

Protiti phase shesh e working demo + commit/push.

---

## 9. Decisions (confirmed)

| Question | Decision |
|---|---|
| Platform | **MT5** |
| Sync | **Duitai** — MetaApi + MT5 EA (plus statement import) |
| Hosting | **Vercel** |
| OTP email | **Nodemailer** (SMTP) |
| AI | **Gemini free API** |
| App name | **Journal** |
| Data | **Supabase** — login korlei same user er purono sob data |
| Accounts | Multiple Exness sub-accounts, alada track + filter |

## 10. Progress

- [x] **Phase 0** — Next 16 + Tailwind v4 + Motion + Drizzle/Supabase schema + design system + app shell (sidebar, topbar, mobile drawer, dark/light)
- [x] **Phase 1** — Email OTP login (Nodemailer), onboarding, `proxy.ts` gate, settings
- [x] Multi-account foundation — accounts CRUD, global account switcher, USC/USD-safe aggregation
- [x] **Phase 2** — Trades table (filters, sort, pagination, summary, CSV export), trade detail (risk map, journal: rating, setup, emotions, plan, mistakes, tags, notes, initial SL → R), manual/backtest entry, tags & mistakes board with P&L per tag
- [x] **Phase 3** — Import: MT5 report (.html UTF-16 / .xlsx), Exness Personal Area CSV, generic CSV; account auto-detect (creates the sub-account if new), preview, idempotent re-import, deposits/withdrawals, daily stats rebuild
- [ ] Phase 4 — Calendar + full dashboard
- [ ] Phase 5 — MetaApi + EA auto-sync
- [ ] Phase 6–10 — Analytics, journaling, goals, AI, launch

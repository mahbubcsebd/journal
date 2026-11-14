# Journal

Trading journal for Exness MT5 traders — auto-synced trades, P&L calendar, deep analytics and AI insights.
See [PLAN.md](./PLAN.md) for the full feature plan and progress.

## Stack

Next.js 16 · React 19 · Tailwind CSS v4 · Motion · Supabase Postgres · Drizzle ORM · Better Auth (email OTP) · Nodemailer · Gemini

## Setup

1. **Install**
   ```bash
   npm install
   ```
2. **Environment** — copy `.env.example` to `.env.local` and fill it in:
   - `DATABASE_URL` — Supabase → Connect → ORMs → *Transaction pooler* (port 6543)
   - `DIRECT_URL` — Supabase *Session pooler* (port 5432), used for migrations
   - `BETTER_AUTH_SECRET`, `ENCRYPTION_KEY` — `openssl rand -base64 32`
   - `SMTP_*`, `EMAIL_FROM` — for Gmail: `smtp.gmail.com`, port `465`, and a Google **App Password**
   - In development without SMTP, the OTP is printed in the terminal instead of emailed.
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET` — trade screenshots.
     Create a **private** bucket (default name `trade-images`) in Supabase → Storage. Images are only
     served through `/api/trade-images/[id]` after an ownership check. Without these in development,
     files are stored in `.uploads/`.
   - `GEMINI_API_KEY` — AI insights. Create a free key at Google AI Studio (aistudio.google.com).
     `GEMINI_MODEL` defaults to `gemini-2.5-flash`; change it if Google retires that model. Without a
     key the AI pages show a setup notice and everything else works.
   - `CRON_SECRET` — protects `/api/cron/daily` (weekly summary + goal-limit emails). `vercel.json`
     schedules it once a day; Vercel sends the secret automatically when it is set in the project.
3. **Database**
   ```bash
   npm run db:migrate
   ```
4. **Run**
   ```bash
   npm run dev
   ```

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run db:generate` | Generate a migration from `src/db/schema.ts` |
| `npm run db:migrate` | Apply migrations |
| `npm run db:studio` | Open Drizzle Studio |

## Auto-sync from Exness MT5

Two ways, both feeding the same pipeline (deals are de-duplicated against imported history):

- **MT5 Expert Advisor (free).** Accounts → *Connect auto-sync* → generate a sync key and download
  `JournalSync.mq5` (source in `mql5/`, your app URL pre-filled). In MT5 add the app URL under
  Tools → Options → Expert Advisors → *Allow WebRequest*, attach the EA to one chart and paste the key.
  It sends 90 days of history, then every new deal within seconds, plus balance, equity and open
  positions every minute. New logins are added as accounts automatically. It never trades.
  Endpoint: `POST /api/sync/mt5` with `Authorization: Bearer <key>`.
- **MetaApi cloud (paid, works with the PC off).** Set `METAAPI_TOKEN`, then connect an account with its
  **investor (read-only) password** — it is passed to MetaApi once and not stored by Journal. Accounts
  refresh every 5 minutes while the app is open, from *Sync now*, and in the daily cron. Uses the official
  `metaapi.cloud-sdk`.

## Keyboard shortcuts

`⌘K` / `Ctrl K` or `/` opens the command menu (search trades, jump anywhere, run actions).
`G` then a letter jumps to a page (`G D` dashboard, `G C` calendar, `G T` trades, `G J` journal …),
`Shift N` adds a trade and `?` lists every shortcut.

## Deploying to Vercel

Add the same environment variables in Vercel → Project → Settings → Environment Variables
(`BETTER_AUTH_URL` and `NEXT_PUBLIC_APP_URL` set to your production URL), then run
`npm run db:migrate` against the Supabase database once.

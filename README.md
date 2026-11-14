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

## Deploying to Vercel

Add the same environment variables in Vercel → Project → Settings → Environment Variables
(`BETTER_AUTH_URL` and `NEXT_PUBLIC_APP_URL` set to your production URL), then run
`npm run db:migrate` against the Supabase database once.

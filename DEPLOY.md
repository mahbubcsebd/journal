# Deploy Journal (Supabase + Vercel)

Ei guide dhore 30–45 minute e app ta live kora jabe. Shob secret (password, key) shudhu
Vercel er **Environment Variables** e boshabe — kothao chat e ba code e na.

---

## 1. Supabase (database + screenshot storage)

1. <https://supabase.com> → **New project**. Region: **Southeast Asia (Singapore)** (Bangladesh er kache).
   Database password ta likhe rakho.
2. **Connection strings** — upore **Connect** button → **ORMs** → *Drizzle*:
   - **Transaction pooler** (port **6543**) → eta hobe `DATABASE_URL`
   - **Session pooler** (port **5432**) → eta hobe `DIRECT_URL` (shudhu migration er jonno)
   - `[YOUR-PASSWORD]` er jaygay step 1 er password boshao.
3. **Storage** → **New bucket** → naam `trade-images`, **Public bucket OFF** (private rakhbe).
4. **Project Settings → API Keys**:
   - Project URL → `SUPABASE_URL` (e.g. `https://abcd1234.supabase.co`)
   - `service_role` (secret) key → `SUPABASE_SERVICE_ROLE_KEY` — eta kokhono public kora jabe na.

> Supabase free plan e 1 shoptah kono activity na thakle project *pause* hoye jay. Dashboard theke
> "Restore" chaplei abar chalu hoy. Regular use korle shomossa nei.

## 2. Database migration (ekbar, nijer computer theke)

```bash
git clone https://github.com/mahbubcsebd/journal && cd journal
npm ci
cp .env.example .env.local      # DATABASE_URL ar DIRECT_URL boshao
npm run db:migrate              # shob table + Row Level Security toiri hobe
```

Migration Supabase er shob table e **Row Level Security** on kore (policy chara). Er mane Supabase
er public Data API diye keu kichu porte/likhte parbe na; app ta direct database connection diye
chole, tai app er kono shomossa hoy na.

## 3. Gmail (OTP email pathanor jonno)

1. Google Account → **Security** → **2-Step Verification** on koro.
2. **App passwords** (<https://myaccount.google.com/apppasswords>) → naam "Journal" → 16 akkhorer
   password copy koro → `SMTP_PASSWORD`.
3. `SMTP_USER` = tomar Gmail address, `EMAIL_FROM` = `Journal <tomar@gmail.com>`.

> Gmail din e ~500 email porjonto pathate dey — personal use er jonno jothesto.

## 4. Vercel

1. <https://vercel.com> → **Add New → Project** → GitHub theke `mahbubcsebd/journal` import koro.
   - Production branch hishebe je branch e code ache seta select koro (ba age `main` e merge koro).
   - Framework: Next.js (auto). Build command / output change korte hobe na.
2. **Environment Variables** (Production + Preview duitai):

| Name | Value |
|---|---|
| `DATABASE_URL` | Supabase transaction pooler URL (port 6543) |
| `DIRECT_URL` | Supabase session pooler URL (port 5432) |
| `BETTER_AUTH_SECRET` | `openssl rand -base64 32` er output |
| `BETTER_AUTH_URL` | `https://<tomar-project>.vercel.app` |
| `NEXT_PUBLIC_APP_URL` | same: `https://<tomar-project>.vercel.app` |
| `NEXT_PUBLIC_APP_NAME` | `Journal` |
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `465` |
| `SMTP_SECURE` | `true` |
| `SMTP_USER` | tomar Gmail |
| `SMTP_PASSWORD` | Gmail App Password |
| `EMAIL_FROM` | `Journal <tomar@gmail.com>` |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service_role key |
| `SUPABASE_STORAGE_BUCKET` | `trade-images` |
| `CRON_SECRET` | `openssl rand -base64 32` er output |
| `ENCRYPTION_KEY` | `openssl rand -base64 32` er output |
| `GEMINI_API_KEY` | *(optional)* <https://aistudio.google.com> → Get API key |
| `GEMINI_MODEL` | *(optional)* khali rakho: default `gemini-flash-latest` (Google er current Flash model) |
| `METAAPI_TOKEN` | *(optional, paid)* <https://app.metaapi.cloud> → API access token |

   `openssl` na thakle: <https://generate-secret.vercel.app/32> theke random value nite paro.
3. **Deploy**. Prothom deploy er por project URL ta jodi alada hoy, `BETTER_AUTH_URL` ar
   `NEXT_PUBLIC_APP_URL` update kore **Redeploy** koro.
4. **Cron**: `vercel.json` theke daily job (`/api/cron/daily`, 00:17 UTC) nijei set hoye jay. Vercel
   `CRON_SECRET` header nijei pathay. Eta weekly summary, goal alert email ar MetaApi catch-up sync kore.

Custom domain chaile: Vercel → Project → **Settings → Domains**. Domain add korar por
`BETTER_AUTH_URL` / `NEXT_PUBLIC_APP_URL` notun domain e bodle redeploy koro.

## 5. Deploy er por check list

- [ ] `https://<app>/login` → email dao → Gmail e OTP ashe → login hoy → onboarding.
- [ ] Accounts → protiti Exness MT5 account add koro (login, server, type).
- [ ] Import → MT5 history report (.html/.xlsx) upload kore purono trade ano.
- [ ] Accounts → **Connect auto-sync** → MT5 EA (puro step-by-step: [docs/MT5-SETUP-GUIDE.md](docs/MT5-SETUP-GUIDE.md), app e `/guide/mt5`):
      key generate → `JournalSync.mq5` download → MT5 te `MQL5/Experts` folder e rakho →
      MetaEditor e khule **F7** (compile) → Tools → Options → Expert Advisors →
      *Allow WebRequest for listed URL* e `https://<app>` add → EA ke chart e lagao, key paste koro.
      Chart e "Journal sync: synced …" dekhale kaj korche.
- [ ] Trade nile 5–10 second er moddhe Trades / Dashboard e ashe (open position soho).
- [ ] Settings → **Send last week's summary now** → email ashe.
- [ ] Cron test (optional):
      `curl -H "Authorization: Bearer <CRON_SECRET>" https://<app>/api/cron/daily`
- [ ] Phone e browser theke **Add to Home Screen** → app er moto khule.

## 6. Jante rakho

- **Vercel Hobby plan** e cron din e ekbar chole. EA trade gula shathe shathe pathay; MetaApi
  account gula app khola thakle protiti 5 minute e, ar din e ekbar cron e sync hoy.
- Function logs: Vercel → Project → **Logs**. Server start e missing env thakle `[journal]` diye
  shuru hoa error dekhabe.
- `npm audit` e kichu low/moderate warning thakbe: `drizzle-kit` (shudhu development tool) ar
  `metaapi.cloud-sdk` er websocket library (MetaApi server er sathe connection). High/critical gula
  `overrides` diye thik kora ache.
- Backup: Settings → **Export all data** (JSON). Supabase o daily backup rakhe (paid plan e
  point-in-time restore).

## 7. Troubleshooting

| Shomossa | Kaaron / shomadhan |
|---|---|
| OTP email ashe na | `SMTP_*` thik ache? Gmail App Password (normal password na). Spam folder dekho. |
| Login er por abar login page | `BETTER_AUTH_URL` exactly tomar https URL kina (shesh e `/` chara). |
| "Something went wrong" sob page e | `DATABASE_URL` port 6543 kina, migration chalano hoyeche kina. |
| Screenshot upload fail | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, bucket naam `trade-images` (private). |
| EA: "add … in Tools > Options" | MT5 er WebRequest list e app URL add koro (https soho). |
| EA: "server replied 401" | Key vul ba revoke kora — notun key generate koro. |
| AI page e setup notice | `GEMINI_API_KEY` boshao, redeploy koro. |

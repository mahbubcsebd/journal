# Journal
Trading journal for Exness MT5 traders — auto-synced trades, P&L calendar, analytics, AI insights.

## Stack
Next.js 16.4 (App Router), React 19.3, TypeScript, Tailwind v4, Motion, Radix/cva UI, Supabase Postgres + Drizzle ORM, Better Auth (email OTP), Nodemailer, Gemini, MetaApi, Recharts, Tiptap, zod. npm.

## Commands
- dev: `npm run dev`
- build: `npm run build`
- typecheck: `npx tsc --noEmit`
- lint: `npm run lint`
- test (one file): `npm run test -- <path>`
- db: `npm run db:generate` / `db:migrate` / `db:check`

## Structure
- src/app — routes: (app) authed pages, (auth), (marketing), api
- src/components — ui/ primitives, layout/, per-feature folders
- src/server — actions/, queries/, services/
- src/db — Drizzle schema + client
- src/lib — pure logic (analytics, dates, risk, goals) with co-located *.test.ts
- mql5 — MT5 Expert Advisor; drizzle — migrations; PLAN.md, DEPLOY.md
- SMC Desk: /desk page → components/desk + lib/desk (ported from smc-desk/web). Data via /api/desk/[...path] proxy (session + SMC_ACCESS_KEY) and /api/desk/ws signed WS token. Paper trades → "SMC Paper" account via server/actions/desk-trades.ts. smc-desk/ = separate repo (server + bridge), gitignored. Plan: docs/SMC-MERGE.md

## Conventions
- Server Components default; `proxy.ts` not middleware. Read node_modules/next/dist/docs before using unsure Next APIs.
- Server actions in src/server/actions, reads in src/server/queries; validate input with zod.
- Env vars via src/lib/env.ts; secrets never client-side.
- Tests: Vitest, next to the logic in src/lib.
- Node 25 gives EBADENGINE warn for vitest 5 — harmless; prefer Node 22/24 LTS.

@AGENTS.md
@docs/DESIGN.md

<!-- claude-kit:setup v1 -->

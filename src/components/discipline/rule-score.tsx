import { ArrowRight, CheckCircle2, ShieldAlert, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { Card } from "@/components/ui/card";
import type { User } from "@/db/schema";
import { formatDay, todayIn } from "@/lib/dates";
import { RULE_TEXT, scoreTone, type DayScore, type Rule } from "@/lib/discipline";
import { cn, formatMoney } from "@/lib/utils";
import { disciplineRange, getDiscipline, getPlanVsActual } from "@/server/queries/discipline";

const TONE = {
  profit: { text: "text-profit", bg: "bg-profit", soft: "bg-profit-soft/60 border-profit/40" },
  warning: { text: "text-warning-ink", bg: "bg-warning", soft: "bg-warning/10 border-warning/50" },
  loss: { text: "text-loss", bg: "bg-loss", soft: "bg-loss-soft/60 border-loss/40" },
  muted: { text: "text-muted-foreground", bg: "bg-muted-foreground/40", soft: "bg-card" },
} as const;

type Lang = "en" | "bn";
const L = {
  en: {
    title: "Rule score",
    sub: "Did each trade follow your rules? Profit doesn't count — discipline does.",
    today: "Last trading day",
    period: "30 days",
    none: "No trades yet",
    clean: "clean trades",
    streak: "days in a row at 80+",
    broke: "Most broken",
    allClean: "No rules broken. Keep it up!",
    details: "Details",
    recent: "Recent rule breaks",
    plan: "Plan vs actual",
    planSub: "Your pre-trade checks and what you did next",
    noPlan: "No pre-trade checks yet. Use \"Pre-trade check\" before you enter.",
    took: "Took it",
    skipped: "Not taken",
    verdict: { ok: "Go", caution: "Careful", stop: "Stop" },
  },
  bn: {
    title: "নিয়ম স্কোর",
    sub: "প্রতিটা ট্রেড কি আপনার নিয়ম মেনেছে? লাভ নয় — শৃঙ্খলাই গোনা হয়।",
    today: "শেষ ট্রেডিং দিন",
    period: "৩০ দিন",
    none: "এখনো ট্রেড নেই",
    clean: "নিয়ম মানা ট্রেড",
    streak: "দিন টানা ৮০+",
    broke: "সবচেয়ে বেশি ভাঙা",
    allClean: "কোনো নিয়ম ভাঙেনি। এভাবেই চালিয়ে যান!",
    details: "বিস্তারিত",
    recent: "সাম্প্রতিক নিয়ম ভাঙা",
    plan: "প্ল্যান বনাম আসল",
    planSub: "ট্রেডের আগের চেক আর তারপর আপনি যা করেছেন",
    noPlan: "এখনো কোনো চেক নেই। ঢোকার আগে \"ট্রেডের আগে চেক\" ব্যবহার করুন।",
    took: "নিয়েছেন",
    skipped: "নেননি",
    verdict: { ok: "ঠিক আছে", caution: "সাবধান", stop: "না" },
  },
} as const;

const langOf = (u: User): Lang => (u.settings.locale === "bn" || u.settings.coachLanguage === "bn" ? "bn" : "en");

function Bars({ days, from, to }: { days: DayScore[]; from: string; to: string }) {
  const map = new Map(days.map((d) => [d.day, d]));
  const all: string[] = [];
  for (let d = from; d <= to; d = new Date(Date.parse(`${d}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10)) all.push(d);
  return (
    <div className="flex h-14 items-end gap-[3px]" role="img" aria-label="Rule score per day">
      {all.map((day) => {
        const d = map.get(day);
        const t = TONE[scoreTone(d?.score ?? null)];
        return (
          <div
            key={day}
            title={d ? `${formatDay(day, { month: "short", day: "numeric" })}: ${d.score} (${d.trades} trades)` : formatDay(day, { month: "short", day: "numeric" })}
            className={cn("min-w-0 flex-1 rounded-sm", d ? t.bg : "bg-muted")}
            style={{ height: d ? `${Math.max(8, d.score)}%` : "6%" }}
          />
        );
      })}
    </div>
  );
}

/** Dashboard card: last trading day's rule score, the last 14 days and the most broken rule. */
export function RuleScoreCard({ user, accountIds }: { user: User; accountIds: string[] }) {
  return (
    <Suspense fallback={<div className="h-44 animate-pulse rounded-xl bg-muted/40" />}>
      <CardInner user={user} accountIds={accountIds} />
    </Suspense>
  );
}

async function CardInner({ user, accountIds }: { user: User; accountIds: string[] }) {
  const t = L[langOf(user)];
  const today = todayIn(user.timezone);
  const r = disciplineRange(today, 14);
  const d = await getDiscipline(user, accountIds, r.from, r.to).catch(() => null);
  if (!d) return null;
  const last = d.days[d.days.length - 1] ?? null;
  const tone = TONE[scoreTone(last?.score ?? null)];
  const top = d.summary.rules[0];
  const Icon = last && last.score >= 80 ? ShieldCheck : ShieldAlert;
  return (
    <Card className="grid gap-4 p-4 sm:grid-cols-[auto_1fr] sm:items-center sm:p-5">
      <div className={cn("flex items-center gap-3 rounded-xl border p-3 sm:min-w-44", tone.soft)}>
        <Icon className={cn("size-8 shrink-0", tone.text)} />
        <div>
          <p className="text-xs text-muted-foreground">{t.title} · {last ? formatDay(last.day, { month: "short", day: "numeric" }) : t.today}</p>
          <p className={cn("font-mono text-3xl font-semibold tabular", tone.text)}>
            {last ? last.score : "—"}
            <span className="text-sm text-muted-foreground">/100</span>
          </p>
        </div>
      </div>
      <div className="grid min-w-0 gap-2">
        <Bars days={d.days} from={r.from} to={r.to} />
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="text-muted-foreground">
            {d.summary.trades ? (
              top ? (
                <>
                  {t.broke}: <span className="font-medium text-foreground">{RULE_TEXT[top[0]][langOf(user)]}</span> ×{top[1]}
                </>
              ) : (
                <span className="text-profit">{t.allClean}</span>
              )
            ) : (
              t.none
            )}
          </span>
          <Link href="/psychology#rules" className="inline-flex items-center gap-1 font-medium hover:underline">
            {t.details} <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </div>
    </Card>
  );
}

/** Psychology page section: 30-day rule score, broken rules, recent breaks, plan vs actual. */
export function RuleScoreSection({ user, accountIds }: { user: User; accountIds: string[] }) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-muted/40" />}>
      <SectionInner user={user} accountIds={accountIds} />
    </Suspense>
  );
}

async function SectionInner({ user, accountIds }: { user: User; accountIds: string[] }) {
  const lang = langOf(user);
  const t = L[lang];
  const today = todayIn(user.timezone);
  const r = disciplineRange(today, 30);
  const [d, plans] = await Promise.all([getDiscipline(user, accountIds, r.from, r.to).catch(() => null), getPlanVsActual(user.id).catch(() => [])]);
  if (!d) return null;
  const s = d.summary;
  const tone = TONE[scoreTone(s.score)];
  const broken = d.verdicts.filter((v) => v.rules.length).slice(-8).reverse();
  const maxRule = Math.max(1, ...s.rules.map(([, n]) => n));
  const time = (ms: number) => new Intl.DateTimeFormat("en-GB", { timeZone: user.timezone, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(ms);
  return (
    <section id="rules" className="grid scroll-mt-24 gap-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">{t.title}</h2>
        <p className="text-sm text-muted-foreground">{t.sub}</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <Card className="grid content-start gap-4 p-5">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-xs text-muted-foreground">{t.period}</p>
              <p className={cn("font-mono text-5xl font-semibold tabular", tone.text)}>
                {s.score ?? "—"}
                <span className="text-base text-muted-foreground">/100</span>
              </p>
            </div>
            <div className="text-right text-sm">
              <p>
                <span className="font-mono font-semibold tabular">{s.clean}</span>/{s.trades} <span className="text-muted-foreground">{t.clean}</span>
              </p>
              <p>
                <span className="font-mono font-semibold tabular">{s.streak}</span> <span className="text-muted-foreground">{t.streak}</span>
              </p>
            </div>
          </div>
          <Bars days={d.days} from={r.from} to={r.to} />
          {s.rules.length ? (
            <ul className="grid gap-2">
              {s.rules.map(([rule, n]) => (
                <li key={rule} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 text-sm">
                  <span>{RULE_TEXT[rule as Rule][lang]}</span>
                  <span className="font-mono text-xs tabular">×{n}</span>
                  <span className="col-span-2 h-1.5 overflow-hidden rounded-full bg-muted">
                    <span className="block h-full rounded-full bg-loss" style={{ width: `${(n / maxRule) * 100}%` }} />
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="flex items-center gap-2 text-sm text-profit">
              <CheckCircle2 className="size-4" /> {s.trades ? t.allClean : t.none}
            </p>
          )}
        </Card>

        <div className="grid gap-4">
          <Card className="p-5">
            <p className="mb-2 font-medium">{t.recent}</p>
            {broken.length ? (
              <ul className="grid divide-y text-sm">
                {broken.map((v) => (
                  <li key={v.trade.id}>
                    <Link href={`/trades/${v.trade.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 hover:text-brand-ink">
                      <span className="w-28 font-mono text-xs text-muted-foreground tabular">{time(v.trade.openAt)}</span>
                      <span className="font-medium">
                        {v.trade.symbol} {v.trade.side === "LONG" ? "▲" : "▼"}
                      </span>
                      <span className="min-w-0 flex-1 text-xs text-loss">{v.rules.map((x) => RULE_TEXT[x][lang]).join(" · ")}</span>
                      <span className={cn("font-mono text-xs tabular", TONE[scoreTone(v.score)].text)}>{v.score}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">{s.trades ? t.allClean : t.none}</p>
            )}
          </Card>

          <Card className="p-5">
            <p className="font-medium">{t.plan}</p>
            <p className="mb-2 text-xs text-muted-foreground">{t.planSub}</p>
            {plans.length ? (
              <ul className="grid divide-y text-sm">
                {plans.map(({ log, trade }) => (
                  <li key={log.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                    <span className="w-28 font-mono text-xs text-muted-foreground tabular">{time(log.createdAt.getTime())}</span>
                    <span className="font-medium">
                      {log.symbol} {log.side === "LONG" ? "▲" : "▼"}
                    </span>
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 text-[11px] font-semibold",
                        log.verdict === "ok" ? "bg-profit-soft text-profit" : log.verdict === "caution" ? "bg-warning/15 text-warning-ink" : "bg-loss-soft text-loss",
                      )}
                    >
                      {t.verdict[log.verdict]}
                    </span>
                    <span className="ml-auto text-xs">
                      {trade ? (
                        <Link href={`/trades/${trade.id}`} className={cn("font-medium hover:underline", log.verdict === "stop" && "text-loss")}>
                          {t.took}
                          {trade.status === "CLOSED" && trade.net != null && (
                            <span className={cn("ml-1 font-mono tabular", trade.net >= 0 ? "text-profit" : "text-loss")}>{formatMoney(trade.net, d.currency, { sign: true })}</span>
                          )}
                        </Link>
                      ) : (
                        <span className={cn(log.verdict === "stop" ? "text-profit" : "text-muted-foreground")}>{t.skipped}</span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">{t.noPlan}</p>
            )}
          </Card>
        </div>
      </div>
    </section>
  );
}

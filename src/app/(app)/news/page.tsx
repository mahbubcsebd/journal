import type { Metadata } from "next";
import { ArrowRight, Settings2 } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { BigCountdown, NewsList, type ListEvent } from "@/components/news/news-list";
import { RefreshNews } from "@/components/news/refresh-news";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { addDays, startOfWeek, todayIn, type WeekStart } from "@/lib/dates";
import { CURRENCY_FLAG, IMPACT_STYLE, impactRank, isRelevant, type Impact } from "@/lib/news";
import { requireUser } from "@/lib/session";
import { cn } from "@/lib/utils";
import { getEvents, getUpcomingRelevant } from "@/server/queries/news";
import { ensureFreshCalendar } from "@/server/services/news";
import { GoldSign } from "@/components/news/gold-sign";

export const metadata: Metadata = { title: "Economic calendar" };

export default function NewsPage({ searchParams }: PageProps<"/news">) {
  return (
    <Suspense
      fallback={
        <div className="grid gap-4">
          <Skeleton className="h-14 w-80 rounded-xl" />
          <Skeleton className="h-44 rounded-2xl" />
          <Skeleton className="h-96 rounded-2xl" />
        </div>
      }
    >
      <News searchParams={searchParams} />
    </Suspense>
  );
}

const IMPACT_FILTERS = [
  { key: "high", label: "High", min: "High" },
  { key: "medium", label: "High + Medium", min: "Medium" },
  { key: "all", label: "All", min: "Low" },
] as const;

async function News({ searchParams }: { searchParams: PageProps<"/news">["searchParams"] }) {
  const [user, sp] = await Promise.all([requireUser(), searchParams]);
  await ensureFreshCalendar().catch(() => undefined);
  const tz = user.timezone;
  const week = sp.week === "next" ? "next" : "this";
  const impactKey = IMPACT_FILTERS.find((f) => f.key === sp.impact)?.key ?? "medium";
  const minImpact = IMPACT_FILTERS.find((f) => f.key === impactKey)!.min as Impact;
  const scope = sp.cur === "all" ? "all" : "mine";

  // Market weeks run Monday → Sunday.
  const start = addDays(startOfWeek(todayIn(tz), 1 as WeekStart), week === "next" ? 7 : 0);
  const end = addDays(start, 6);
  const dayOf = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  let raw: Awaited<ReturnType<typeof getEvents>>;
  let upcomingData: Awaited<ReturnType<typeof getUpcomingRelevant>>;
  try {
    [raw, upcomingData] = await Promise.all([
      getEvents(new Date(`${addDays(start, -1)}T00:00:00Z`), new Date(`${addDays(end, 1)}T23:59:59Z`)),
      getUpcomingRelevant(user, 40),
    ]);
  } catch (e) {
    console.error("[news] calendar unavailable", e);
    return <CalendarNotReady />;
  }
  const { events: upcoming, prefs } = upcomingData;
  const inWeek = raw.filter((e) => dayOf(e.time) >= start && dayOf(e.time) <= end);
  const list: ListEvent[] = inWeek
    .filter((e) => (e.impact === "Holiday" ? impactKey === "all" : impactRank(e.impact) >= impactRank(minImpact)))
    .filter((e) => scope === "all" || !prefs.currencies || prefs.currencies.has(e.currency))
    .map((e) => ({
      id: e.id,
      title: e.title,
      currency: e.currency,
      impact: e.impact,
      time: e.time.toISOString(),
      allDay: e.allDay,
      forecast: e.forecast,
      previous: e.previous,
      actual: e.actual,
      relevant: isRelevant(e, prefs.minImpact, prefs.currencies),
      hasAnalysis: Boolean(e.analysis),
    }));
  const next = upcoming.find((e) => e.impact === "High") ?? upcoming[0];
  const lastUpdate = raw.reduce((m, e) => Math.max(m, e.updatedAt.getTime()), 0);
  const q = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { week: week === "next" ? "next" : undefined, impact: impactKey === "medium" ? undefined : impactKey, cur: scope === "all" ? "all" : undefined, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `/news?${s}` : "/news";
  };
  const chip = (active: boolean) =>
    cn("h-full rounded-md px-2.5 text-[13px] leading-8 font-medium transition", active ? "bg-secondary text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground");
  const watching = prefs.currencies ? [...prefs.currencies].sort() : null;

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Economic calendar"
        description="Know every release before it hits your chart. Times are in your timezone."
        actions={
          <>
            <Button asChild variant="ghost" size="sm">
              <Link href="/settings#news">
                <Settings2 /> Alerts
              </Link>
            </Button>
            <RefreshNews />
          </>
        }
      />

      {next ? (
        <Card className="relative overflow-hidden p-5 sm:p-6">
          <div aria-hidden className="pointer-events-none absolute -top-24 -right-16 size-64 rounded-full bg-loss/10 blur-3xl" />
          <div className="relative grid gap-5 sm:grid-cols-[1fr_auto] sm:items-end">
            <div className="grid gap-2">
              <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Next news for your symbols</p>
              <h2 className="flex flex-wrap items-center gap-2 text-xl font-semibold tracking-tight sm:text-2xl">
                <span aria-hidden>{CURRENCY_FLAG[next.currency] ?? "🌐"}</span>
                {next.currency} {next.title}
                <GoldSign event={next} className="text-xs" />
              </h2>
              <p className="text-sm text-muted-foreground">
                {new Intl.DateTimeFormat("en-GB", { timeZone: tz, weekday: "long", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(next.time)}
                {" · "}
                <span className={IMPACT_STYLE[next.impact]?.text}>{next.impact} impact</span>
                {next.forecast && ` · Forecast ${next.forecast}`}
                {next.previous && ` · Previous ${next.previous}`}
              </p>
              <BigCountdown time={next.time.toISOString()} window={prefs.window} />
            </div>
            <Button asChild>
              <Link href={`/news/${next.id}`}>
                Details & AI analysis <ArrowRight />
              </Link>
            </Button>
          </div>
        </Card>
      ) : (
        <Card className="px-6 py-10 text-center text-sm text-muted-foreground">No upcoming news for your symbols in the calendar yet.</Card>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex h-9 items-center rounded-lg border bg-card p-0.5">
          <Link href={q({ week: undefined })} className={chip(week === "this")} scroll={false}>
            This week
          </Link>
          <Link href={q({ week: "next" })} className={chip(week === "next")} scroll={false}>
            Next week
          </Link>
        </div>
        <div className="inline-flex h-9 items-center rounded-lg border bg-card p-0.5">
          {IMPACT_FILTERS.map((f) => (
            <Link key={f.key} href={q({ impact: f.key === "medium" ? undefined : f.key })} className={chip(impactKey === f.key)} scroll={false}>
              {f.label}
            </Link>
          ))}
        </div>
        <div className="inline-flex h-9 items-center rounded-lg border bg-card p-0.5">
          <Link href={q({ cur: undefined })} className={chip(scope === "mine")} scroll={false}>
            My currencies
          </Link>
          <Link href={q({ cur: "all" })} className={chip(scope === "all")} scroll={false}>
            All currencies
          </Link>
        </div>
        {scope === "mine" && watching && (
          <span className="text-xs text-muted-foreground">
            Watching {watching.map((c) => `${CURRENCY_FLAG[c] ?? ""} ${c}`).join("  ")}
          </span>
        )}
      </div>

      <div className="hidden grid-cols-[60px_88px_1fr_repeat(3,72px)_110px_16px] gap-x-3 px-4 text-[11px] font-medium tracking-wide text-muted-foreground uppercase sm:grid">
        <span>Time</span>
        <span>Currency</span>
        <span>Event</span>
        <span className="text-right">Actual</span>
        <span className="text-right">Forecast</span>
        <span className="text-right">Previous</span>
        <span className="text-right">Status</span>
        <span />
      </div>
      <NewsList events={list} timezone={tz} window={prefs.window} />

      <p className="text-center text-xs text-muted-foreground">
        Calendar data: ForexFactory weekly feed{lastUpdate ? ` · updated ${new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit" }).format(lastUpdate)}` : ""}. Actual numbers may
        appear late; check your broker before trading.
      </p>
    </div>
  );
}

/** Shown when the economic_event table hasn't been created in the database yet. */
function CalendarNotReady() {
  return (
    <div className="grid gap-6">
      <PageHeader title="Economic calendar" description="Know every release before it hits your chart." />
      <Card className="grid gap-2 px-6 py-10 text-center">
        <p className="font-medium">The calendar isn&apos;t set up in the database yet</p>
        <p className="mx-auto max-w-md text-sm text-muted-foreground">
          Run the latest database migration (drizzle/0007_economic_calendar.sql — in Supabase: SQL Editor), then reload this page.
        </p>
      </Card>
    </div>
  );
}

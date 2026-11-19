import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { pnlText } from "@/components/calendar/pnl-style";
import { EventAi } from "@/components/news/event-ai";
import { BigCountdown } from "@/components/news/news-list";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { aiConfigured } from "@/lib/ai/gemini";
import type { EventAnalysis } from "@/lib/ai/schemas";
import { CURRENCY_FLAG, IMPACT_STYLE, currenciesForSymbol, goldBias } from "@/lib/news";
import { GoldSign, goldTitle } from "@/components/news/gold-sign";
import { requireUser } from "@/lib/session";
import { cn, formatMoney } from "@/lib/utils";
import { getEvent, getNewsPrefs, getPastReleases, getTradesOpenedBetween } from "@/server/queries/news";

export const metadata: Metadata = { title: "News" };

export default function EventPage({ params }: PageProps<"/news/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="h-[600px] rounded-2xl" />}>
      <EventView params={params} />
    </Suspense>
  );
}

async function EventView({ params }: { params: PageProps<"/news/[id]">["params"] }) {
  const [user, { id }] = await Promise.all([requireUser(), params]);
  const e = await getEvent(decodeURIComponent(id)).catch(() => null);
  if (!e) notFound();
  const tz = user.timezone;
  const prefs = await getNewsPrefs(user);
  const w = prefs.window;
  const [past, around] = await Promise.all([
    getPastReleases(e.title, e.currency, e.time),
    getTradesOpenedBetween(user.id, new Date(e.time.getTime() - w.before * 60_000), new Date(e.time.getTime() + w.after * 60_000)),
  ]);
  const myTrades = around.filter((t) => currenciesForSymbol(t.symbol).includes(e.currency));
  const analysis = Object.fromEntries(
    Object.entries((e.analysis ?? {}) as Record<string, { data: EventAnalysis }>).map(([k, v]) => [k, v.data]),
  ) as Partial<Record<"en" | "bn", EventAnalysis>>;
  const s = IMPACT_STYLE[e.impact] ?? IMPACT_STYLE.Low;
  const when = new Intl.DateTimeFormat("en-GB", { timeZone: tz, weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(e.time);
  const fmtDate = (d: Date) => new Intl.DateTimeFormat("en-GB", { timeZone: tz, day: "numeric", month: "short", year: "2-digit" }).format(d);

  return (
    <div className="grid max-w-5xl gap-6">
      <Link href="/news" className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Economic calendar
      </Link>

      <Card className="relative overflow-hidden p-5 sm:p-6">
        <div aria-hidden className={cn("pointer-events-none absolute -top-24 -right-16 size-64 rounded-full blur-3xl", e.impact === "High" ? "bg-loss/10" : "bg-brand/10")} />
        <div className="relative grid gap-5 md:grid-cols-[1fr_auto] md:items-end">
          <div className="grid gap-2">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-xl" aria-hidden>
                {CURRENCY_FLAG[e.currency] ?? "🌐"}
              </span>
              <span className="font-semibold">{e.currency}</span>
              <Badge variant={e.impact === "High" ? "loss" : e.impact === "Medium" ? "warning" : "default"}>
                <span className={cn("mr-1 inline-block size-1.5 rounded-full", s.dot)} />
                {e.impact} impact
              </Badge>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">{e.title}</h1>
            <p className="text-sm text-muted-foreground">{e.allDay ? "All day" : when}</p>
          </div>
          {!e.allDay && <BigCountdown time={e.time.toISOString()} window={w} />}
        </div>
        <dl className="relative mt-6 grid grid-cols-3 gap-px overflow-hidden rounded-xl border bg-border">
          {[
            ["Actual", e.actual],
            ["Forecast", e.forecast],
            ["Previous", e.previous],
          ].map(([k, v]) => (
            <div key={k} className="bg-card px-4 py-3">
              <dt className="text-xs text-muted-foreground">{k}</dt>
              <dd className="font-mono text-lg font-semibold tabular">{v ?? "—"}</dd>
            </div>
          ))}
        </dl>
        {(() => {
          const g = goldBias(e);
          if (!g) return null;
          return (
            <div className="relative mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border bg-card px-4 py-3 text-sm">
              <span className="font-medium">Gold (XAUUSD)</span>
              <GoldSign event={e} />
              <span className="min-w-0 flex-1 text-muted-foreground">{goldTitle(g)}</span>
            </div>
          );
        })()}
        {e.impact === "High" && (
          <p className="relative mt-4 text-sm text-muted-foreground">
            Your no-trade window: <b className="text-foreground">{w.before} min before</b> to <b className="text-foreground">{w.after} min after</b> the release. Spreads widen and
            price can jump through stop losses.{" "}
            <Link href="/settings#news" className="text-brand-ink hover:underline">
              Change
            </Link>
          </p>
        )}
      </Card>

      <EventAi id={e.id} initial={analysis} defaultLang={user.settings.aiLanguage ?? "en"} configured={aiConfigured()} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="grid gap-3 p-5">
          <h2 className="font-semibold tracking-tight">Your trades around this release</h2>
          {myTrades.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No {e.currency} trades opened between {w.before} min before and {w.after} min after this release.
            </p>
          ) : (
            <ul className="grid divide-y rounded-xl border">
              {myTrades.map((t) => (
                <li key={t.id}>
                  <Link href={`/trades/${t.id}`} className="flex items-center gap-3 px-3.5 py-2.5 text-sm hover:bg-accent/60">
                    <span className="font-medium">{t.symbol}</span>
                    <Badge variant={t.side === "LONG" ? "profit" : "loss"}>{t.side === "LONG" ? "Buy" : "Sell"}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {Math.round((t.openTime.getTime() - e.time.getTime()) / 60_000)} min {t.openTime < e.time ? "before" : "after"}
                    </span>
                    <span className={cn("ml-auto font-mono font-semibold tabular", pnlText(t.netPnl))}>
                      {t.status === "OPEN" ? "Open" : formatMoney(t.netPnl, t.currency, { sign: true })}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="grid content-start gap-3 p-5">
          <h2 className="font-semibold tracking-tight">Previous releases</h2>
          {past.length === 0 ? (
            <p className="text-sm text-muted-foreground">History builds up as Journal keeps the calendar each week.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr>
                  <th className="py-1.5 font-medium">Date</th>
                  <th className="py-1.5 text-right font-medium">Actual</th>
                  <th className="py-1.5 text-right font-medium">Forecast</th>
                  <th className="py-1.5 text-right font-medium">Previous</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {past.map((p) => (
                  <tr key={p.id}>
                    <td className="py-2">
                      <Link href={`/news/${p.id}`} className="hover:underline">
                        {fmtDate(p.time)}
                      </Link>
                    </td>
                    <td className="py-2 text-right font-mono font-semibold tabular">{p.actual ?? "—"}</td>
                    <td className="py-2 text-right font-mono tabular">{p.forecast ?? "—"}</td>
                    <td className="py-2 text-right font-mono text-muted-foreground tabular">{p.previous ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </div>
  );
}

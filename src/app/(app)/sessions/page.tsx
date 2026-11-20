import { ArrowRight, Lightbulb, MessagesSquare, TrendingDown, TrendingUp } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BreakdownChart } from "@/components/charts/breakdown-chart";
import { SharePie } from "@/components/charts/share-pie";
import { PageHeader } from "@/components/layout/page-header";
import { RangeTabs } from "@/components/layout/range-tabs";
import { GoldSign } from "@/components/news/gold-sign";
import { SessionLive } from "@/components/sessions/session-live";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { todayIn } from "@/lib/dates";
import { MARKETS, sessionStatus } from "@/lib/market-sessions";
import { CURRENCY_FLAG, IMPACT_STYLE } from "@/lib/news";
import { parseRange, rangeStart } from "@/lib/ranges";
import { SESSION_COLOR, SESSION_HOURS_UTC, sessionStats, type SessionRow } from "@/lib/session-stats";
import { getDataMode, getSelectedAccountIds, requireUser } from "@/lib/session";
import { formatDuration } from "@/lib/trading/metrics";
import { cn, formatMoney, formatPercent } from "@/lib/utils";
import { getAnalyticsTrades } from "@/server/queries/analytics";
import { getT } from "@/lib/locale-server";
import { getEvents, getNewsPrefs } from "@/server/queries/news";

export const metadata: Metadata = { title: "Market sessions" };

export default function SessionsPage({ searchParams }: PageProps<"/sessions">) {
  return (
    <Suspense fallback={<Skeleton className="h-[900px] rounded-2xl" />}>
      <Sessions searchParams={searchParams} />
    </Suspense>
  );
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const TIPS: { key: string; title: string; text: string }[] = [
  { key: "ASIA", title: "Asia (Sydney + Tokyo)", text: "Quieter, ranges form. Good for JPY/AUD pairs and for marking the Asian high/low that London often breaks." },
  { key: "LONDON", title: "London open", text: "The first big move of the day. Breakouts of the Asian range; EUR, GBP and gold get busy. Wait for the first 15–30 minutes to settle." },
  { key: "OVERLAP", title: "London–New York overlap", text: "Most volume and the biggest candles, plus US news at 8:30 New York time. Best for momentum — but use smaller size around releases." },
  { key: "NEW_YORK", title: "New York afternoon", text: "After London closes, moves fade and reversals are common. Late-day entries often get stuck; tighten targets." },
];

async function Sessions({ searchParams }: { searchParams: PageProps<"/sessions">["searchParams"] }) {
  const [user, sp] = await Promise.all([requireUser(), searchParams]);
  const tz = user.timezone;
  const range = parseRange(sp.range, "90d");
  const today = todayIn(tz);
  const from = rangeStart(range, today);
  const [{ ids }, mode, prefs] = await Promise.all([getSelectedAccountIds(user.id), getDataMode(), getNewsPrefs(user)]);
  const [{ currency, trades }, upcoming] = await Promise.all([getAnalyticsTrades(user.id, ids, from ?? undefined, today, tz), upcomingNews(prefs.currencies)]);
  const s = sessionStats(trades);
  const t = await getT();
  const money = (v: number, sign = true) => formatMoney(v, currency, { sign });
  const active = s.rows.filter((r) => r.trades > 0);

  const fmtTime = (d: Date) => new Intl.DateTimeFormat("en-GB", { timeZone: tz, weekday: "short", hour: "2-digit", minute: "2-digit" }).format(d);

  return (
    <div className="grid gap-8">
      <PageHeader
        title="Market sessions"
        description="Which session is open, when the next one starts, and how you trade in each."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href={`/coach?ask=${encodeURIComponent("Compare my performance across trading sessions (Asia, London, overlap, New York). Which session should I focus on, which should I avoid, and what rules should I set for each?")}`}>
              <MessagesSquare /> {t("Ask coach")}
            </Link>
          </Button>
        }
      />

      <SessionLive timezone={tz} />

      <section className="grid gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">{t("Your performance by session")}</h2>
            <p className="text-sm text-muted-foreground">
              {s.total} closed {mode === "backtest" ? "backtest " : ""}trades · grouped by the UTC hour each trade was opened
            </p>
          </div>
          <RangeTabs active={range} basePath="/sessions" />
        </div>

        {s.total === 0 ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">No closed trades in this period yet.</Card>
        ) : (
          <>
            {/* Insights first: the answer, then the evidence. */}
            <div className="grid gap-3 md:grid-cols-3">
              <Insight
                tone="profit"
                icon={TrendingUp}
                title={s.best ? `Best: ${s.best.label}` : "No clear best session yet"}
                text={
                  s.best
                    ? `${money(s.best.expectancy ?? 0)} per trade · ${formatPercent(s.best.winRate ?? 0, 0)} win rate over ${s.best.trades} trades.`
                    : "Trade at least 5 times in a session to compare."
                }
              />
              <Insight
                tone="loss"
                icon={TrendingDown}
                title={s.worst ? `Weakest: ${s.worst.label}` : "No losing session"}
                text={s.worst ? `${money(s.worst.expectancy ?? 0)} per trade over ${s.worst.trades} trades. Trade less here, or only your A+ setup.` : "Every session with 5+ trades makes money on average."}
              />
              <Insight
                tone="warning"
                icon={Lightbulb}
                title={s.lossShare ? `${Math.round(s.lossShare.share * 100)}% of your losses: ${s.lossShare.row.label}` : "Losses are spread out"}
                text={
                  s.lossShare
                    ? `${money(s.lossShare.row.grossLoss)} lost in ${s.lossShare.row.label} (${s.lossShare.row.losses} losing trades).`
                    : "No single session causes most of your losses."
                }
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
              <Card className="p-4 sm:p-5">
                <p className="mb-3 font-medium">{t("Where you trade")}</p>
                <SharePie
                  center={String(s.total)}
                  centerSub={t("trades")}
                  data={active.map((r) => ({ label: r.label, value: r.trades, color: SESSION_COLOR[r.key], sub: `${r.trades}` }))}
                />
              </Card>
              <Card className="p-4 sm:p-5">
                <p className="mb-3 font-medium">{t("Net P&L by session")}</p>
                <BreakdownChart
                  currency={currency}
                  rows={active.map((r) => ({
                    key: r.label,
                    trades: r.trades,
                    wins: r.wins,
                    losses: r.losses,
                    net: r.net,
                    grossProfit: r.grossProfit,
                    grossLoss: r.grossLoss,
                    winRate: r.winRate,
                    profitFactor: r.profitFactor,
                    expectancy: r.expectancy ?? 0,
                    avgR: null,
                  }))}
                />
              </Card>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="p-4 sm:p-5">
                <p className="mb-3 font-medium">{t("Where your losses come from")}</p>
                <SharePie
                  center={money(s.rows.reduce((a, r) => a + r.grossLoss, 0))}
                  centerSub={t("lost")}
                  data={active.filter((r) => r.grossLoss < 0).map((r) => ({ label: r.label, value: -r.grossLoss, color: SESSION_COLOR[r.key], sub: money(r.grossLoss) }))}
                />
              </Card>
              <Card className="p-4 sm:p-5">
                <p className="mb-3 font-medium">{t("Where your profits come from")}</p>
                <SharePie
                  center={money(s.rows.reduce((a, r) => a + r.grossProfit, 0))}
                  centerSub={t("won")}
                  data={active.filter((r) => r.grossProfit > 0).map((r) => ({ label: r.label, value: r.grossProfit, color: SESSION_COLOR[r.key], sub: money(r.grossProfit) }))}
                />
              </Card>
            </div>

            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                    <tr>
                      {["Session", "Hours (UTC)", "Trades", "Win rate", "Net P&L", "Per trade", "Profit factor", "Avg hold", "Best symbol", "Worst symbol"].map((h, i) => (
                        <th key={h} className={cn("px-3 py-2.5 font-medium whitespace-nowrap", i >= 2 && i <= 7 && "text-right")}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {s.rows.map((r) => (
                      <SessionTableRow key={r.key} r={r} money={money} />
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card className="p-4 sm:p-5">
              <p className="font-medium">{t("Session × weekday")}</p>
              <p className="mb-3 text-xs text-muted-foreground">Net P&amp;L. Find the exact day and session that costs you.</p>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-sm">
                  <thead>
                    <tr className="text-xs text-muted-foreground">
                      <th className="py-1.5 pr-2 text-left font-medium" />
                      {[1, 2, 3, 4, 5].map((d) => (
                        <th key={d} className="px-1 py-1.5 text-center font-medium">
                          {WEEKDAYS[d]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {active.map((r) => {
                      const max = Math.max(1, ...active.flatMap((x) => x.weekday.map(Math.abs)));
                      return (
                        <tr key={r.key}>
                          <td className="py-1 pr-2 text-xs whitespace-nowrap">
                            <span className="mr-1.5 inline-block size-2 rounded-sm" style={{ background: SESSION_COLOR[r.key] }} />
                            {r.label}
                          </td>
                          {[1, 2, 3, 4, 5].map((d) => {
                            const v = r.weekday[d];
                            const a = Math.min(1, Math.abs(v) / max);
                            return (
                              <td key={d} className="p-0.5">
                                <div
                                  className={cn(
                                    "rounded-md px-1 py-2 text-center font-mono text-xs tabular",
                                    v > 0 ? "text-profit" : v < 0 ? "text-loss" : "text-muted-foreground",
                                  )}
                                  style={{
                                    background: v === 0 ? "var(--muted)" : `color-mix(in oklch, var(${v > 0 ? "--profit" : "--loss"}) ${Math.round(8 + a * 30)}%, transparent)`,
                                  }}
                                >
                                  {v === 0 ? "—" : formatMoney(v, currency, { sign: true, compact: true })}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        )}
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <Card className="p-4 sm:p-5">
          <div className="mb-3 flex items-baseline justify-between gap-2">
            <p className="font-medium">{t("High-impact news by session")}</p>
            <Link href="/news" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
              Calendar <ArrowRight className="size-3.5" />
            </Link>
          </div>
          {upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground">No high-impact releases for your currencies in the next 36 hours.</p>
          ) : (
            <ul className="grid divide-y">
              {upcoming.map(({ e, open }) => (
                <li key={e.id}>
                  <Link href={`/news/${e.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-sm hover:text-brand-ink">
                    <span className="w-24 font-mono text-xs text-muted-foreground tabular">{fmtTime(e.time)}</span>
                    <span className={cn("size-2 rounded-full", IMPACT_STYLE[e.impact]?.dot)} aria-hidden />
                    <span className="min-w-0 flex-1 truncate">
                      {CURRENCY_FLAG[e.currency] ?? "🌐"} {e.currency} {e.title}
                    </span>
                    <GoldSign event={e} compact />
                    <span className="text-xs text-muted-foreground">{open.length ? open.map((o) => `${o.flag} ${o.name}`).join(" + ") : "Between sessions"}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-4 sm:p-5">
          <p className="mb-3 font-medium">{t("How each session trades")}</p>
          <ul className="grid gap-3">
            {TIPS.map((t) => (
              <li key={t.key} className="grid gap-0.5">
                <p className="text-sm font-medium">{t.title}</p>
                <p className="text-xs leading-relaxed text-muted-foreground">{t.text}</p>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-[11px] text-muted-foreground">
            Live clock uses each city&apos;s local hours ({MARKETS.map((m) => `${m.name} ${m.open}:00–${m.close}:00`).join(", ")}) with daylight saving. Your stats use
            fixed UTC buckets.
          </p>
        </Card>
      </section>
    </div>
  );
}

/** High-impact news in the next 36 hours, with the sessions open at release time. */
async function upcomingNews(currencies: Set<string> | null) {
  const now = Date.now();
  const events = await getEvents(new Date(now), new Date(now + 36 * 3_600_000)).catch(() => []);
  return events
    .filter((e) => !e.allDay && e.impact === "High" && (!currencies || currencies.has(e.currency)))
    .slice(0, 12)
    .map((e) => ({ e, open: sessionStatus(e.time.getTime()).filter((x) => x.isOpen) }));
}

function Insight({ tone, icon: Icon, title, text }: { tone: "profit" | "loss" | "warning"; icon: typeof TrendingUp; title: string; text: string }) {
  const s = {
    profit: "border-profit/40 bg-profit-soft/50 text-profit",
    loss: "border-loss/40 bg-loss-soft/50 text-loss",
    warning: "border-warning/50 bg-warning/10 text-warning-ink",
  }[tone];
  return (
    <div className={cn("flex gap-3 rounded-xl border p-4", s)}>
      <Icon className="mt-0.5 size-5 shrink-0" />
      <div>
        <p className="font-semibold">{title}</p>
        <p className="mt-0.5 text-sm text-muted-foreground">{text}</p>
      </div>
    </div>
  );
}

function SessionTableRow({ r, money }: { r: SessionRow; money: (v: number, sign?: boolean) => string }) {
  const tone = (v: number | null) => (v == null || v === 0 ? "" : v > 0 ? "text-profit" : "text-loss");
  return (
    <tr className={cn("border-t", r.trades === 0 && "text-muted-foreground")}>
      <td className="px-3 py-2.5 whitespace-nowrap">
        <span className="mr-2 inline-block size-2.5 rounded-sm align-middle" style={{ background: SESSION_COLOR[r.key] }} />
        <span className="font-medium">{r.label}</span>
      </td>
      <td className="px-3 py-2.5 font-mono text-xs whitespace-nowrap text-muted-foreground tabular">{SESSION_HOURS_UTC[r.key]}</td>
      <td className="px-3 py-2.5 text-right font-mono tabular">{r.trades}</td>
      <td className="px-3 py-2.5 text-right font-mono tabular">{r.winRate == null ? "—" : formatPercent(r.winRate, 0)}</td>
      <td className={cn("px-3 py-2.5 text-right font-mono font-semibold whitespace-nowrap tabular", tone(r.net))}>{r.trades ? money(r.net) : "—"}</td>
      <td className={cn("px-3 py-2.5 text-right font-mono whitespace-nowrap tabular", tone(r.expectancy))}>{r.expectancy == null ? "—" : money(r.expectancy)}</td>
      <td className="px-3 py-2.5 text-right font-mono tabular">{r.profitFactor == null ? "—" : r.profitFactor.toFixed(2)}</td>
      <td className="px-3 py-2.5 text-right font-mono whitespace-nowrap tabular">{formatDuration(r.avgHoldSec == null ? null : Math.round(r.avgHoldSec))}</td>
      <td className="px-3 py-2.5 whitespace-nowrap">
        {r.best ? (
          <>
            {r.best.symbol} <span className="font-mono text-xs text-profit tabular">{money(r.best.net)}</span>
          </>
        ) : (
          "—"
        )}
      </td>
      <td className="px-3 py-2.5 whitespace-nowrap">
        {r.worst ? (
          <>
            {r.worst.symbol} <span className="font-mono text-xs text-loss tabular">{money(r.worst.net)}</span>
          </>
        ) : (
          "—"
        )}
      </td>
    </tr>
  );
}

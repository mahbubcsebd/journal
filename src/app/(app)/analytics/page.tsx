import type { Metadata } from "next";
import { Suspense } from "react";
import { BreakdownTable } from "@/components/analytics/breakdown-table";
import { AnalyticsTabs } from "@/components/analytics/analytics-tabs";
import { ANALYTICS_TABS, type AnalyticsTab } from "@/components/analytics/tabs";
import { MonthlyGrid } from "@/components/analytics/monthly-grid";
import Link from "next/link";
import { pnlText } from "@/components/calendar/pnl-style";
import { BreakdownChart } from "@/components/charts/breakdown-chart";
import { EquityChart } from "@/components/charts/equity-chart";
import { HistogramChart } from "@/components/charts/histogram-chart";
import { DurationScatter, HourScatter } from "@/components/charts/scatter-chart";
import { PageHeader } from "@/components/layout/page-header";
import { RangeTabs } from "@/components/layout/range-tabs";
import { FadeIn } from "@/components/motion/fade-in";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DURATION_BUCKETS,
  durationBucket,
  groupBy,
  histogram,
  monthly,
  niceBin,
  performance,
  riskRatios,
  volumeBucket,
  type ATrade,
} from "@/lib/analytics";
import { formatDay, todayIn, weekdayLabels, type WeekStart } from "@/lib/dates";
import { parseRange, rangeStart } from "@/lib/ranges";
import { equityCurve, maxDrawdown } from "@/lib/stats";
import { formatDuration, SESSION_LABEL } from "@/lib/trading/metrics";
import { getSelectedAccountIds, requireUser } from "@/lib/session";
import { cn, formatMoney, formatPercent } from "@/lib/utils";
import { getAnalyticsTrades, getOpenTradeCount } from "@/server/queries/analytics";
import { getJournalDays } from "@/server/queries/journal";
import { detailedStats } from "@/lib/detailed-stats";

export const metadata: Metadata = { title: "Analytics" };

export default function AnalyticsPage({ searchParams }: PageProps<"/analytics">) {
  return (
    <Suspense
      fallback={
        <div className="grid gap-6">
          <Skeleton className="h-14 w-80 rounded-xl" />
          <Skeleton className="h-10 rounded-xl" />
          <Skeleton className="h-96 rounded-xl" />
        </div>
      }
    >
      <Analytics searchParams={searchParams} />
    </Suspense>
  );
}

function Panel({ title, description, children, className, flush }: { title: string; description?: string; children: React.ReactNode; className?: string; flush?: boolean }) {
  return (
    <Card className={className}>
      <CardHeader>
        <div>
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </div>
      </CardHeader>
      {flush ? <div className="mt-4">{children}</div> : <CardContent>{children}</CardContent>}
    </Card>
  );
}

function Stat({ label, value, tone, sub }: { label: string; value: string; tone?: number | null; sub?: string }) {
  return (
    <div className="bg-card px-4 py-3.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("mt-0.5 font-mono text-[15px] font-semibold tabular", tone != null && pnlText(tone))}>{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

async function Analytics({ searchParams }: { searchParams: PageProps<"/analytics">["searchParams"] }) {
  const [user, sp] = await Promise.all([requireUser(), searchParams]);
  const tab = (ANALYTICS_TABS.find((t) => t.key === sp.tab)?.key ?? "overview") as AnalyticsTab;
  const range = parseRange(sp.range, "90d");
  const today = todayIn(user.timezone);
  const from = rangeStart(range, today);
  const { ids } = await getSelectedAccountIds(user.id);
  const [{ currency, trades }, openTrades, journal] = await Promise.all([
    getAnalyticsTrades(user.id, ids, from, today, user.timezone),
    tab === "overview" ? getOpenTradeCount(user.id, ids) : Promise.resolve(0),
    tab === "overview" ? getJournalDays(user.id, from ?? "1970-01-01", today) : Promise.resolve(new Map()),
  ]);
  const weekStartsOn = (user.settings.weekStartsOn ?? 1) as WeekStart;

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Analytics"
        description={`${trades.length} closed trades · ${from ? `${formatDay(from, { month: "short", day: "numeric", year: "numeric" })} – today` : "all time"}`}
        actions={<RangeTabs active={range} basePath="/analytics" fallback="90d" params={tab === "overview" ? {} : tab === "time" && sp.by === "exit" ? { tab, by: "exit" } : { tab }} />}
      />
      <AnalyticsTabs active={tab} range={range} />
      {trades.length === 0 ? (
        <Card className="px-6 py-16 text-center text-sm text-muted-foreground">
          No closed trades in this period for the selected accounts. Try a longer range or import your history.
        </Card>
      ) : (
        <FadeIn key={tab} className="grid gap-6">
          {tab === "overview" && <Overview trades={trades} currency={currency} openTrades={openTrades} loggedDays={journal.size} />}
          {tab === "time" && <TimeTab trades={trades} currency={currency} weekStartsOn={weekStartsOn} by={sp.by === "exit" ? "exit" : "entry"} range={range} />}
          {tab === "instruments" && <InstrumentsTab trades={trades} currency={currency} />}
          {tab === "journal" && <JournalTab trades={trades} currency={currency} />}
          {tab === "risk" && <RiskTab trades={trades} currency={currency} />}
        </FadeIn>
      )}
    </div>
  );
}

function dailyFromTrades(trades: ATrade[]) {
  const map = new Map<string, { day: string; net: number; trades: number; wins: number; losses: number }>();
  for (const t of trades) {
    const d = map.get(t.day) ?? { day: t.day, net: 0, trades: 0, wins: 0, losses: 0 };
    d.net = Math.round((d.net + t.net) * 100) / 100;
    d.trades++;
    if (t.net > 0) d.wins++;
    if (t.net < 0) d.losses++;
    map.set(t.day, d);
  }
  return [...map.values()].sort((a, b) => a.day.localeCompare(b.day));
}

/* ─────────────────────────────── Overview ─────────────────────────────── */

function Overview({ trades, currency, openTrades, loggedDays }: { trades: ATrade[]; currency: string; openTrades: number; loggedDays: number }) {
  const p = performance(trades);
  const days = dailyFromTrades(trades);
  const curve = equityCurve(days);
  const dd = maxDrawdown(curve);
  const risk = riskRatios(days, dd);
  const m = (n: number | null, sign = false) => (n == null ? "—" : formatMoney(n, currency, { sign }));

  const stats: { label: string; value: string; tone?: number | null; sub?: string }[] = [
    { label: "Net P&L", value: m(p.net, true), tone: p.net, sub: `${p.trades} trades` },
    { label: "Gross profit", value: m(p.grossProfit), sub: `${p.wins} winners` },
    { label: "Gross loss", value: m(p.grossLoss), sub: `${p.losses} losers` },
    { label: "Profit factor", value: p.profitFactor == null ? "—" : p.profitFactor.toFixed(2) },
    { label: "Win rate", value: p.winRate == null ? "—" : formatPercent(p.winRate) },
    { label: "Expectancy", value: m(p.expectancy, true), tone: p.expectancy, sub: "Per trade" },
    { label: "Average win", value: m(p.avgWin), sub: `Held ${formatDuration(p.avgHoldWin)}` },
    { label: "Average loss", value: m(p.avgLoss), sub: `Held ${formatDuration(p.avgHoldLoss)}` },
    { label: "Payoff ratio", value: p.payoff == null ? "—" : p.payoff.toFixed(2), sub: "Avg win ÷ avg loss" },
    { label: "Average R", value: p.avgR == null ? "—" : `${p.avgR.toFixed(2)}R`, sub: "Trades with a stop loss" },
    { label: "Largest win", value: m(p.largestWin, true), tone: p.largestWin },
    { label: "Largest loss", value: m(p.largestLoss, true), tone: p.largestLoss },
    { label: "Max drawdown", value: m(dd), tone: dd || null },
    { label: "Recovery factor", value: risk.recoveryFactor == null ? "—" : risk.recoveryFactor.toFixed(2), sub: "Net ÷ max drawdown" },
    { label: "Sharpe (daily)", value: risk.sharpe == null ? "—" : risk.sharpe.toFixed(2), sub: "Annualised, money based" },
    { label: "Sortino (daily)", value: risk.sortino == null ? "—" : risk.sortino.toFixed(2), sub: "Downside only" },
    { label: "Max wins in a row", value: String(p.maxWins) },
    { label: "Max losses in a row", value: String(p.maxLosses) },
    { label: "Commission", value: m(p.commission), sub: `${p.lots.toFixed(2)} lots traded` },
    { label: "Swap", value: m(p.swap, true) },
  ];

  return (
    <>
      <Card className="grid grid-cols-2 gap-px overflow-hidden bg-border sm:grid-cols-4 xl:grid-cols-5">
        {stats.map((s) => (
          <Stat key={s.label} {...s} />
        ))}
      </Card>
      <Panel title="Equity curve" description="Cumulative net P&L and drawdown">
        <EquityChart data={curve} currency={currency} />
      </Panel>
      <Panel title="Statistics" description="Every number, trade by trade and day by day" flush>
        <StatisticsSheet trades={trades} currency={currency} openTrades={openTrades} loggedDays={loggedDays} />
      </Panel>
      <Panel title="Monthly returns" description="Net P&L per calendar month">
        <MonthlyGrid months={monthly(days)} currency={currency} />
      </Panel>
    </>
  );
}

/* ───────────────────────────────── Time ───────────────────────────────── */

function TimeTab({
  trades,
  currency,
  weekStartsOn,
  by,
  range,
}: {
  trades: ATrade[];
  currency: string;
  weekStartsOn: WeekStart;
  by: "entry" | "exit";
  range: string;
}) {
  const exit = by === "exit";
  const hourOf = (t: ATrade) => (exit ? (t.closeHour ?? t.hour) : t.hour);
  const dayOf = (t: ATrade) => (exit ? (t.closeWeekday ?? t.weekday) : t.weekday);
  const hours = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, "0"));
  const byHour = groupBy(trades, (t) => String(hourOf(t)).padStart(2, "0"), hours);
  const dayNames = weekdayLabels(weekStartsOn);
  const byWeekday = groupBy(trades, (t) => weekdayLabels(0)[dayOf(t)], dayNames);
  const scatter = trades.map((t) => ({ x: (exit ? t.closeTimeOfDay : t.openTimeOfDay) ?? hourOf(t), y: t.net, symbol: t.symbol, id: t.id }));
  const label = exit ? "Exit time" : "Entry time";
  const sessions = Object.entries(SESSION_LABEL);
  const bySession = groupBy(trades, (t) => (t.session ? SESSION_LABEL[t.session as keyof typeof SESSION_LABEL] : null), sessions.map(([, v]) => v));
  const byDuration = groupBy(trades, (t) => durationBucket(t.durationSec), DURATION_BUCKETS.map((b) => b.key));
  const months = [...new Set(trades.map((t) => t.day.slice(0, 7)))].sort();
  const byMonth = groupBy(trades, (t) => formatDay(`${t.day.slice(0, 7)}-01`, { month: "short", year: "numeric" }), months.map((m) => formatDay(`${m}-01`, { month: "short", year: "numeric" })));

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">Group by</span>
        <div className="inline-flex h-9 items-center rounded-lg border bg-card p-0.5">
          {(["entry", "exit"] as const).map((b) => (
            <Link
              key={b}
              href={`/analytics?tab=time${range !== "90d" ? `&range=${range}` : ""}${b === "exit" ? "&by=exit" : ""}`}
              scroll={false}
              className={cn(
                "h-full rounded-md px-3 text-[13px] leading-8 font-medium transition",
                by === b ? "bg-secondary text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {b === "entry" ? "Entry time" : "Exit time"}
            </Link>
          ))}
        </div>
      </div>
      <Panel title="Hour of day" description={`By the hour you ${exit ? "closed" : "opened"} the trade, in your timezone`}>
        <BreakdownChart rows={byHour} currency={currency} height={240} />
      </Panel>
      <Panel title={`Performance by ${label.toLowerCase()}`} description="Each dot is a trade: when it happened and what it made">
        <HourScatter points={scatter} currency={currency} label={label} />
        <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-chart-up" /> Win</span>
          <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-chart-down" /> Loss</span>
        </div>
      </Panel>
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Day of week" description={`By the day you ${exit ? "closed" : "opened"} the trade`}>
          <BreakdownChart rows={byWeekday} currency={currency} />
        </Panel>
        <Panel title="Session" description="Asia, London, New York and their overlap (UTC hours)">
          <BreakdownChart rows={bySession} currency={currency} />
        </Panel>
      </div>
      <Panel title="Hold time" description="How long trades stayed open" flush>
        <BreakdownTable rows={byDuration} currency={currency} label="Duration" />
      </Panel>
      <Panel title="Month" description="Net P&L per month in this range">
        <BreakdownChart rows={byMonth} currency={currency} />
      </Panel>
    </>
  );
}

/* ────────────────────────────── Instruments ────────────────────────────── */

function InstrumentsTab({ trades, currency }: { trades: ATrade[]; currency: string }) {
  const bySymbol = groupBy(trades, (t) => t.symbol);
  const sideNet = (symbol: string, side: "LONG" | "SHORT") =>
    trades.filter((t) => t.symbol === symbol && t.side === side).reduce((s, t) => s + t.net, 0);
  const bySide = groupBy(trades, (t) => (t.side === "LONG" ? "Long" : "Short"), ["Long", "Short"]);
  const byAccount = groupBy(trades, (t) => t.accountName);
  return (
    <>
      <Panel title="Symbols" description="Net P&L by instrument">
        <BreakdownChart rows={bySymbol} currency={currency} />
      </Panel>
      <Panel title="Symbol details" flush>
        <BreakdownTable
          rows={bySymbol}
          currency={currency}
          label="Symbol"
          extra={{
            header: "Long / short",
            cell: (r) => (
              <span className="font-mono text-xs">
                <span className={pnlText(sideNet(r.key, "LONG"))}>{formatMoney(sideNet(r.key, "LONG"), currency, { compact: true, sign: true })}</span>
                {" / "}
                <span className={pnlText(sideNet(r.key, "SHORT"))}>{formatMoney(sideNet(r.key, "SHORT"), currency, { compact: true, sign: true })}</span>
              </span>
            ),
          }}
        />
      </Panel>
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Direction" flush>
          <BreakdownTable rows={bySide} currency={currency} label="Side" compact />
        </Panel>
        <Panel title="Accounts" description="Compare your Exness sub-accounts" flush>
          <BreakdownTable rows={byAccount} currency={currency} label="Account" compact />
        </Panel>
      </div>
    </>
  );
}

/* ─────────────────────────── Setups, tags, psychology ─────────────────────────── */

function JournalTab({ trades, currency }: { trades: ATrade[]; currency: string }) {
  const bySetup = groupBy(trades, (t) => t.setup ?? "No setup");
  const byTag = groupBy(trades, (t) => t.tags.filter((g) => g.kind === "TAG").map((g) => g.name));
  const byMistake = groupBy(trades, (t) => t.tags.filter((g) => g.kind === "MISTAKE").map((g) => g.name));
  const byEmotion = groupBy(trades, (t) => t.emotionBefore);
  const byPlan = groupBy(trades, (t) => (t.followedPlan == null ? "Not recorded" : t.followedPlan ? "Followed plan" : "Broke plan"), ["Followed plan", "Broke plan", "Not recorded"]);
  const byRating = groupBy(trades, (t) => (t.rating ? `${"★".repeat(t.rating)}` : null), [1, 2, 3, 4, 5].map((n) => "★".repeat(n)));
  const mistakeTrades = trades.filter((t) => t.tags.some((g) => g.kind === "MISTAKE"));
  const mistakeCost = mistakeTrades.reduce((s, t) => s + t.net, 0);
  const journaled = trades.filter((t) => t.setup || t.tags.length || t.emotionBefore || t.rating || t.followedPlan != null).length;

  return (
    <>
      <Card className="grid grid-cols-2 gap-px overflow-hidden bg-border sm:grid-cols-4">
        <Stat label="Journaled trades" value={`${journaled} / ${trades.length}`} sub={formatPercent(journaled / trades.length, 0)} />
        <Stat label="Trades with mistakes" value={String(mistakeTrades.length)} />
        <Stat label="Net on mistake trades" value={formatMoney(mistakeCost, currency, { sign: true })} tone={mistakeCost} sub="What your mistakes cost (or made)" />
        <Stat
          label="Plan followed vs broken"
          value={`${byPlan[0].winRate == null ? "—" : formatPercent(byPlan[0].winRate, 0)} / ${byPlan[1].winRate == null ? "—" : formatPercent(byPlan[1].winRate, 0)}`}
          sub="Win rate"
        />
      </Card>
      <Panel title="Setups" description="Which playbook setups actually pay" flush>
        <BreakdownTable rows={bySetup} currency={currency} label="Setup" />
      </Panel>
      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Mistakes" description="Trades tagged with each mistake" flush>
          <BreakdownTable rows={byMistake} currency={currency} label="Mistake" compact />
        </Panel>
        <Panel title="Tags" flush>
          <BreakdownTable rows={byTag} currency={currency} label="Tag" compact />
        </Panel>
        <Panel title="Feeling before the trade" flush>
          <BreakdownTable rows={byEmotion} currency={currency} label="Emotion" compact />
        </Panel>
        <Panel title="Discipline" flush>
          <BreakdownTable rows={byPlan} currency={currency} label="Plan" compact />
        </Panel>
      </div>
      <Panel title="Execution rating" description="Your own 1–5 star rating per trade" flush>
        <BreakdownTable rows={byRating} currency={currency} label="Rating" />
      </Panel>
    </>
  );
}

/* ───────────────────────────────── Risk ───────────────────────────────── */

function RiskTab({ trades, currency }: { trades: ATrade[]; currency: string }) {
  const rs = trades.map((t) => t.rMultiple).filter((x): x is number => x != null);
  const rBins = histogram(rs, 0.5);
  const nets = trades.map((t) => t.net);
  const pnlBins = histogram(nets, niceBin(nets, 14));
  const byVolume = groupBy(trades, (t) => volumeBucket(t.volume), ["< 0.05", "0.05–0.09", "0.10–0.49", "0.50–0.99", "≥ 1.00"]);
  const scatter = trades.filter((t) => t.durationSec && t.durationSec > 0).map((t) => ({ x: t.durationSec!, y: t.net, symbol: t.symbol, id: t.id }));
  const above2R = rs.filter((r) => r >= 2).length;
  const belowMinus1 = rs.filter((r) => r < -1.05).length;

  return (
    <>
      <Card className="grid grid-cols-2 gap-px overflow-hidden bg-border sm:grid-cols-4">
        <Stat label="Trades with a stop loss" value={`${rs.length} / ${trades.length}`} sub={formatPercent(rs.length / trades.length, 0)} />
        <Stat label="Average R" value={rs.length ? `${(rs.reduce((s, x) => s + x, 0) / rs.length).toFixed(2)}R` : "—"} />
        <Stat label="Winners ≥ 2R" value={String(above2R)} />
        <Stat label="Losses beyond −1R" value={String(belowMinus1)} sub="Stop slipped or was moved" tone={belowMinus1 ? -1 : null} />
      </Card>
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="R-multiple distribution" description="Trades with an initial stop loss">
          {rBins.length ? <HistogramChart bins={rBins} kind="r" /> : <p className="py-10 text-center text-sm text-muted-foreground">Add stop losses to trades to see R.</p>}
        </Panel>
        <Panel title="P&L distribution" description="Net result per trade">
          <HistogramChart bins={pnlBins} kind="money" currency={currency} />
        </Panel>
      </div>
      <Panel title="Hold time vs result" description="Each dot is a trade (log time scale)">
        <DurationScatter points={scatter} currency={currency} />
        <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-chart-up" /> Win</span>
          <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-chart-down" /> Loss</span>
        </div>
      </Panel>
      <Panel title="Position size" description="Lot size buckets" flush>
        <BreakdownTable rows={byVolume} currency={currency} label="Lots" />
      </Panel>
    </>
  );
}

function StatisticsSheet({ trades, currency, openTrades, loggedDays }: { trades: ATrade[]; currency: string; openTrades: number; loggedDays: number }) {
  const { trade: t, day: d } = detailedStats(trades, { openTrades, loggedDays });
  const m = (n: number | null) => (n == null ? "—" : formatMoney(n, currency, { sign: n !== 0 }));
  const num = (n: number | null) => (n == null ? "—" : n.toLocaleString());
  const left: [string, string, number?][] = [
    ["Total P&L", m(t.totalPnl), t.totalPnl],
    ["Average daily volume", t.avgDailyVolume == null ? "—" : `${t.avgDailyVolume} lots`],
    ["Average winning trade", m(t.avgWinningTrade), t.avgWinningTrade ?? 0],
    ["Average losing trade", m(t.avgLosingTrade), t.avgLosingTrade ?? 0],
    ["Total number of trades", num(t.totalTrades)],
    ["Number of winning trades", num(t.winningTrades)],
    ["Number of losing trades", num(t.losingTrades)],
    ["Number of breakeven trades", num(t.breakevenTrades)],
    ["Max consecutive wins", num(t.maxConsecutiveWins)],
    ["Max consecutive losses", num(t.maxConsecutiveLosses)],
    ["Total commissions", m(t.totalCommission)],
    ["Total swap", m(t.totalSwap)],
    ["Largest profit", m(t.largestProfit), t.largestProfit ?? 0],
    ["Largest loss", m(t.largestLoss), t.largestLoss ?? 0],
    ["Average hold time (all trades)", formatDuration(t.avgHoldAll)],
    ["Average hold time (winning trades)", formatDuration(t.avgHoldWinning)],
    ["Average hold time (losing trades)", formatDuration(t.avgHoldLosing)],
    ["Average hold time (breakeven trades)", formatDuration(t.avgHoldBreakeven)],
    ["Average trade P&L", m(t.avgTradePnl), t.avgTradePnl ?? 0],
    ["Profit factor", t.profitFactor == null ? "—" : t.profitFactor.toFixed(2)],
  ];
  const right: [string, string, number?][] = [
    ["Open trades", num(d.openTrades)],
    ["Total trading days", num(d.tradingDays)],
    ["Winning days", num(d.winningDays)],
    ["Losing days", num(d.losingDays)],
    ["Breakeven days", num(d.breakevenDays)],
    ["Logged days (journal)", num(d.loggedDays)],
    ["Max consecutive winning days", num(d.maxConsecutiveWinningDays)],
    ["Max consecutive losing days", num(d.maxConsecutiveLosingDays)],
    ["Average daily P&L", m(d.avgDailyPnl), d.avgDailyPnl ?? 0],
    ["Average winning day P&L", m(d.avgWinningDayPnl), d.avgWinningDayPnl ?? 0],
    ["Average losing day P&L", m(d.avgLosingDayPnl), d.avgLosingDayPnl ?? 0],
    ["Largest profitable day", m(d.largestProfitableDay), d.largestProfitableDay ?? 0],
    ["Largest losing day", m(d.largestLosingDay), d.largestLosingDay ?? 0],
    ["Average realized R-multiple", d.avgRealizedR == null ? "—" : `${d.avgRealizedR.toFixed(2)}R`],
    ["Trade expectancy", m(d.expectancy), d.expectancy],
    ["Max drawdown", m(d.maxDrawdown), d.maxDrawdown],
    ["Average drawdown", m(d.avgDrawdown), d.avgDrawdown ?? 0],
  ];
  const column = (rows: typeof left) => (
    <dl className="divide-y">
      {rows.map(([k, v, tone]) => (
        <div key={k} className="flex items-baseline justify-between gap-4 px-5 py-2.5 text-sm">
          <dt className="text-muted-foreground">{k}</dt>
          <dd className={cn("text-right font-mono font-medium tabular", tone != null && tone !== 0 && pnlText(tone))}>{v}</dd>
        </div>
      ))}
    </dl>
  );
  return (
    <div className="grid border-t md:grid-cols-2 md:divide-x">
      {column(left)}
      <div className="border-t md:border-t-0">{column(right)}</div>
    </div>
  );
}

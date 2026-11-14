import type { Metadata } from "next";
import { ArrowRight, CalendarDays, FolderInput, PlugZap, Wallet } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { DailyPnlChart } from "@/components/charts/daily-pnl-chart";
import { EquityChart } from "@/components/charts/equity-chart";
import { pnlText } from "@/components/calendar/pnl-style";
import { KpiTile } from "@/components/dashboard/kpi-tile";
import { MiniMonth } from "@/components/dashboard/mini-month";
import { OpenPositions } from "@/components/dashboard/open-positions";
import { PageHeader } from "@/components/layout/page-header";
import { FadeIn, Stagger, StaggerItem } from "@/components/motion/fade-in";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { addDays, formatDay, todayIn, type WeekStart } from "@/lib/dates";
import { dayStreaks, equityCurve, maxDrawdown, summarizeDays } from "@/lib/stats";
import { parseTradeFilters } from "@/lib/trade-filters";
import { getSelectedAccountIds, getUserAccounts, requireUser } from "@/lib/session";
import { cn, formatDateTime, formatMoney, formatPercent } from "@/lib/utils";
import { getBreakdowns, getDailyPnl } from "@/server/queries/calendar";
import { listTrades } from "@/server/queries/trades";
import { RangeTabs } from "@/components/layout/range-tabs";
import { parseRange, rangeStart } from "@/lib/ranges";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <Dashboard searchParams={searchParams} />
    </Suspense>
  );
}

function DashboardSkeleton() {
  return (
    <div className="grid gap-6">
      <Skeleton className="h-14 w-72 rounded-xl" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-96 rounded-xl" />
    </div>
  );
}

async function Dashboard({ searchParams }: { searchParams: PageProps<"/dashboard">["searchParams"] }) {
  const [user, sp] = await Promise.all([requireUser(), searchParams]);
  const range = parseRange(sp.range, "30d");
  const today = todayIn(user.timezone);
  const from = rangeStart(range, today);
  const monthStart = `${today.slice(0, 7)}-01`;
  const weekStartsOn = (user.settings.weekStartsOn ?? 1) as WeekStart;

  const [accounts, { ids }] = await Promise.all([getUserAccounts(user.id), getSelectedAccountIds(user.id)]);
  const [series, month, recent, breakdowns] = await Promise.all([
    getDailyPnl(ids, from, today),
    getDailyPnl(ids, addDays(monthStart, -7), addDays(monthStart, 42)),
    listTrades(user.id, ids, parseTradeFilters({}), user.timezone, 7),
    getBreakdowns(user.id, ids, from, user.timezone),
  ]);
  const { currency, days } = series;
  const s = summarizeDays(days);
  const curve = equityCurve(days);
  const dd = maxDrawdown(curve);
  const streak = dayStreaks(days);
  const avgWin = s.wins ? s.grossProfit / s.wins : null;
  const avgLoss = s.losses ? s.grossLoss / s.losses : null;
  const first = user.name.split(" ")[0] || "trader";

  return (
    <div className="grid gap-6">
      <PageHeader
        title={`Hi, ${first}`}
        description={from ? `${formatDay(from, { month: "short", day: "numeric", year: "numeric" })} – today` : "All time"}
        actions={<RangeTabs active={range} basePath="/dashboard" />}
      />

      <Stagger className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StaggerItem>
          <KpiTile label="Net P&L" value={s.net} kind="money" currency={currency} tone="auto" sub={`${s.trades} trades · ${s.tradingDays} days`} />
        </StaggerItem>
        <StaggerItem>
          <KpiTile label="Win rate" value={s.winRate} kind="percent" sub={`${s.wins} wins · ${s.losses} losses`} />
        </StaggerItem>
        <StaggerItem>
          <KpiTile
            label="Profit factor"
            value={s.grossLoss ? s.grossProfit / Math.abs(s.grossLoss) : null}
            kind="ratio"
            sub="Gross profit ÷ gross loss"
          />
        </StaggerItem>
        <StaggerItem>
          <KpiTile
            label="Expectancy"
            value={s.trades ? s.net / s.trades : null}
            kind="money"
            currency={currency}
            tone="auto"
            sub="Average net per trade"
          />
        </StaggerItem>
        <StaggerItem>
          <KpiTile
            label="Avg win / avg loss"
            value={avgWin != null && avgLoss ? avgWin / Math.abs(avgLoss) : null}
            kind="ratio"
            sub={
              avgWin != null || avgLoss != null
                ? `${avgWin != null ? formatMoney(avgWin, currency) : "—"} / ${avgLoss != null ? formatMoney(avgLoss, currency) : "—"}`
                : "Payoff ratio"
            }
          />
        </StaggerItem>
        <StaggerItem>
          <KpiTile label="Max drawdown" value={days.length ? dd : null} kind="money" currency={currency} tone="auto" sub="Deepest fall from a peak" />
        </StaggerItem>
        <StaggerItem>
          <KpiTile
            label="Green days"
            value={s.tradingDays ? s.greenDays / s.tradingDays : null}
            kind="percent"
            sub={`${s.greenDays} green · ${s.redDays} red`}
          />
        </StaggerItem>
        <StaggerItem>
          <KpiTile
            label="Current streak"
            value={days.length ? streak.current : null}
            kind="streak"
            sub={`Best ${streak.longestGreen} green · worst ${streak.longestRed} red`}
          />
        </StaggerItem>
      </Stagger>

      <OpenPositions accounts={accounts.filter((a) => ids.includes(a.id))} timezone={user.timezone} />

      {s.trades === 0 ? (
        <GettingStarted hasAccount={accounts.length > 0} />
      ) : (
        <>
          <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
            <FadeIn delay={0.1}>
              <Card>
                <CardHeader>
                  <div>
                    <CardTitle>Equity curve</CardTitle>
                    <CardDescription>Cumulative net P&amp;L, closed trades only</CardDescription>
                  </div>
                  <p className={cn("font-mono text-lg font-semibold tabular", pnlText(s.net))}>
                    {formatMoney(s.net, currency, { sign: true })}
                  </p>
                </CardHeader>
                <CardContent>
                  <EquityChart data={curve} currency={currency} />
                </CardContent>
              </Card>
            </FadeIn>
            <FadeIn delay={0.15}>
              <Card className="h-full">
                <CardHeader>
                  <div>
                    <CardTitle>{formatDay(today, { month: "long", year: "numeric" })}</CardTitle>
                    <CardDescription>This month at a glance</CardDescription>
                  </div>
                  <Link href="/calendar" className="text-[13px] font-medium text-brand-ink hover:underline">
                    Calendar
                  </Link>
                </CardHeader>
                <CardContent>
                  <MiniMonth anchor={today} today={today} weekStartsOn={weekStartsOn} days={month.days} currency={month.currency} />
                </CardContent>
              </Card>
            </FadeIn>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
            <FadeIn delay={0.2}>
              <Card>
                <CardHeader>
                  <div>
                    <CardTitle>Daily P&amp;L</CardTitle>
                    <CardDescription>
                      Best {s.best ? formatMoney(s.best.net, currency, { sign: true }) : "—"} · worst{" "}
                      {s.worst ? formatMoney(s.worst.net, currency, { sign: true }) : "—"}
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent>
                  <DailyPnlChart data={days} currency={currency} />
                </CardContent>
              </Card>
            </FadeIn>
            <FadeIn delay={0.25}>
              <Card className="h-full">
                <CardHeader>
                  <CardTitle>Recent trades</CardTitle>
                  <Link href="/trades" className="text-[13px] font-medium text-brand-ink hover:underline">
                    All trades
                  </Link>
                </CardHeader>
                <ul className="grid gap-0.5 p-2">
                  {recent.map((t) => (
                    <li key={t.id}>
                      <Link href={`/trades/${t.id}`} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition hover:bg-accent">
                        <span className="size-2 shrink-0 rounded-full" style={{ background: t.accountColor }} />
                        <span className="font-medium">{t.symbol}</span>
                        <Badge variant={t.side === "LONG" ? "profit" : "loss"}>{t.side === "LONG" ? "L" : "S"}</Badge>
                        <span className="truncate text-xs text-muted-foreground">{formatDateTime(t.closeTime ?? t.openTime, user.timezone)}</span>
                        <span
                          className={cn(
                            "ml-auto font-mono text-[13px] font-semibold whitespace-nowrap tabular",
                            t.status === "OPEN" ? "text-muted-foreground" : pnlText(t.netPnl),
                          )}
                        >
                          {formatMoney(t.netPnl, t.currency, { sign: true, compact: Math.abs(t.netPnl) >= 10_000 })}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </Card>
            </FadeIn>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <FadeIn delay={0.3}>
              <Card>
                <CardHeader>
                  <div>
                    <CardTitle>Symbols</CardTitle>
                    <CardDescription>Net P&amp;L by instrument</CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="grid gap-3">
                  {(() => {
                    const top = breakdowns.symbols.slice(0, 6);
                    const max = Math.max(1, ...top.map((x) => Math.abs(x.net)));
                    return top.map((x) => (
                      <div key={x.key} className="grid grid-cols-[80px_1fr_96px] items-center gap-3 text-sm">
                        <span className="font-medium">{x.key}</span>
                        <div className="relative h-2 rounded-full bg-muted">
                          <div
                            className="absolute inset-y-0 left-0 rounded-full"
                            style={{
                              width: `${(Math.abs(x.net) / max) * 100}%`,
                              background: x.net >= 0 ? "var(--chart-up)" : "var(--chart-down)",
                            }}
                          />
                        </div>
                        <span className={cn("text-right font-mono text-[13px] font-semibold tabular", pnlText(x.net))}>
                          {formatMoney(x.net, currency, { sign: true })}
                        </span>
                      </div>
                    ));
                  })()}
                </CardContent>
              </Card>
            </FadeIn>
            <FadeIn delay={0.35}>
              <Card>
                <CardHeader>
                  <div>
                    <CardTitle>Long vs short</CardTitle>
                    <CardDescription>Which direction pays you</CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-3">
                  {(["LONG", "SHORT"] as const).map((side) => {
                    const x = breakdowns.sides.find((b) => b.key === side);
                    return (
                      <div key={side} className="rounded-xl border p-4">
                        <Badge variant={side === "LONG" ? "profit" : "loss"}>{side === "LONG" ? "Long" : "Short"}</Badge>
                        <p className={cn("mt-3 font-mono text-xl font-semibold tabular", pnlText(x?.net ?? 0))}>
                          {x ? formatMoney(x.net, currency, { sign: true }) : "—"}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {x ? `${x.trades} trades · ${formatPercent(x.wins / x.trades, 0)} win rate` : "No trades"}
                        </p>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </FadeIn>
          </div>
        </>
      )}
    </div>
  );
}

function GettingStarted({ hasAccount }: { hasAccount: boolean }) {
  const steps = [
    {
      icon: Wallet,
      title: "Add your Exness accounts",
      body: "Add every MT5 login — Standard, Cent, Pro, Raw, Zero. Each one is tracked and filterable separately.",
      href: "/accounts",
      cta: hasAccount ? "Manage accounts" : "Add account",
      done: hasAccount,
    },
    { icon: FolderInput, title: "Import your history", body: "Upload your MT5 history report once to bring in every past trade.", href: "/import", cta: "Import", done: false },
    { icon: PlugZap, title: "Turn on auto-sync", body: "Connect through MetaApi (works with your PC off) or our MT5 Expert Advisor.", href: "/accounts", cta: "Connect", done: false },
    { icon: CalendarDays, title: "Review on the calendar", body: "Every day turns green or red. Click any day to journal it.", href: "/calendar", cta: "Open calendar", done: false },
  ];
  return (
    <Card className="overflow-hidden">
      <div className="border-b px-5 py-4">
        <h2 className="text-sm font-semibold">Get started</h2>
        <p className="text-[13px] text-muted-foreground">No closed trades in this period yet. Four steps to a fully automatic journal.</p>
      </div>
      <Stagger className="grid divide-y sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x">
        {steps.map((step, i) => (
          <StaggerItem key={step.title} className="flex flex-col gap-3 p-5">
            <div className="flex items-center gap-2">
              <span className={cn("flex size-8 items-center justify-center rounded-lg", step.done ? "bg-profit-soft text-profit" : "bg-secondary text-muted-foreground")}>
                <step.icon className="size-4" />
              </span>
              <span className="text-xs text-muted-foreground">Step {i + 1}</span>
            </div>
            <div className="grid gap-1">
              <p className="text-sm font-medium">{step.title}</p>
              <p className="text-[13px] text-muted-foreground">{step.body}</p>
            </div>
            <Link href={step.href} className="mt-auto inline-flex items-center gap-1 text-[13px] font-medium text-brand-ink hover:underline">
              {step.cta} <ArrowRight className="size-3.5" />
            </Link>
          </StaggerItem>
        ))}
      </Stagger>
    </Card>
  );
}

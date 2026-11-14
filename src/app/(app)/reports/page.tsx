import type { Metadata } from "next";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { BreakdownTable } from "@/components/analytics/breakdown-table";
import { pnlText } from "@/components/calendar/pnl-style";
import { DailyPnlChart } from "@/components/charts/daily-pnl-chart";
import { EquityChart } from "@/components/charts/equity-chart";
import { PageHeader } from "@/components/layout/page-header";
import { FadeIn } from "@/components/motion/fade-in";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { groupBy, performance, type ATrade } from "@/lib/analytics";
import { formatDay } from "@/lib/dates";
import { equityCurve, maxDrawdown, summarizeDays } from "@/lib/stats";
import { getSelectedAccountIds, requireUser } from "@/lib/session";
import { cn, formatMoney, formatPercent } from "@/lib/utils";
import { loadReport } from "@/server/queries/reports";
import { ReportToolbar } from "./report-toolbar";

export const metadata: Metadata = { title: "Reports" };

export default function ReportsPage({ searchParams }: PageProps<"/reports">) {
  return (
    <Suspense
      fallback={
        <div className="grid gap-6">
          <Skeleton className="h-14 w-72 rounded-xl" />
          <Skeleton className="h-12 rounded-xl" />
          <Skeleton className="h-96 rounded-xl" />
        </div>
      }
    >
      <Report searchParams={searchParams} />
    </Suspense>
  );
}

function daily(trades: ATrade[]) {
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

function Delta({ cur, prev, kind, currency }: { cur: number | null; prev: number | null; kind: "money" | "pct" | "ratio" | "count"; currency: string }) {
  if (cur == null || prev == null) return <span className="text-[11px] text-muted-foreground">No previous data</span>;
  const d = cur - prev;
  if (Math.abs(d) < 1e-9) return <span className="text-[11px] text-muted-foreground">Same as previous</span>;
  const text =
    kind === "money"
      ? formatMoney(d, currency, { sign: true })
      : kind === "pct"
        ? `${d > 0 ? "+" : ""}${(d * 100).toFixed(1)} pts`
        : kind === "ratio"
          ? `${d > 0 ? "+" : ""}${d.toFixed(2)}`
          : `${d > 0 ? "+" : ""}${d}`;
  const Icon = d > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-[11px] font-medium", kind === "count" ? "text-muted-foreground" : pnlText(d))}>
      <Icon className="size-3" /> {text} vs previous
    </span>
  );
}

async function Report({ searchParams }: { searchParams: PageProps<"/reports">["searchParams"] }) {
  const [user, sp] = await Promise.all([requireUser(), searchParams]);
  const { ids } = await getSelectedAccountIds(user.id);
  const { resolved, anchor, today, currency, trades, prevTrades } = await loadReport(user, ids, sp);
  const p = performance(trades);
  const pp = performance(prevTrades);
  const days = daily(trades);
  const sd = summarizeDays(days);
  const curve = equityCurve(days);
  const sorted = [...trades].sort((a, b) => b.net - a.net);
  const best = sorted.filter((t) => t.net > 0).slice(0, 5);
  const worst = sorted.filter((t) => t.net < 0).reverse().slice(0, 5);
  const hasPrev = prevTrades.length > 0;
  const pf = (x: typeof p) => x.profitFactor;

  const kpis = [
    { label: "Net P&L", value: formatMoney(p.net, currency, { sign: true }), tone: p.net, cur: p.net, prev: hasPrev ? pp.net : null, kind: "money" as const },
    { label: "Trades", value: String(p.trades), cur: p.trades, prev: hasPrev ? pp.trades : null, kind: "count" as const },
    { label: "Win rate", value: p.winRate == null ? "—" : formatPercent(p.winRate), cur: p.winRate, prev: hasPrev ? pp.winRate : null, kind: "pct" as const },
    { label: "Profit factor", value: pf(p) == null ? "—" : pf(p)!.toFixed(2), cur: pf(p), prev: hasPrev ? pf(pp) : null, kind: "ratio" as const },
    { label: "Expectancy", value: formatMoney(p.expectancy, currency, { sign: true }), tone: p.expectancy, cur: p.expectancy, prev: hasPrev ? pp.expectancy : null, kind: "money" as const },
    { label: "Max drawdown", value: formatMoney(maxDrawdown(curve), currency), tone: maxDrawdown(curve) || null, cur: null, prev: null, kind: "money" as const },
  ];

  const qs = new URLSearchParams({ period: resolved.period, d: anchor });
  if (resolved.period === "custom") {
    qs.set("from", resolved.from);
    qs.set("to", resolved.to);
  }

  return (
    <div className="grid gap-6" id="report">
      <PageHeader title="Reports" description="A clean summary of any period — print it, export it, or share it." />
      <ReportToolbar
        period={resolved.period}
        label={resolved.label}
        prevAnchor={resolved.prevAnchor}
        nextAnchor={resolved.nextAnchor}
        today={today}
        from={resolved.from}
        to={resolved.to}
        query={qs.toString()}
      />

      <div className="hidden print:block">
        <h1 className="text-xl font-semibold">Trading report · {resolved.label}</h1>
        <p className="text-sm text-muted-foreground">{user.name} · generated {formatDay(today, { month: "long", day: "numeric", year: "numeric" })}</p>
      </div>

      {trades.length === 0 ? (
        <Card className="px-6 py-16 text-center text-sm text-muted-foreground">No closed trades in this period.</Card>
      ) : (
        <FadeIn key={qs.toString()} className="grid gap-6">
          <Card className="grid grid-cols-2 gap-px overflow-hidden bg-border sm:grid-cols-3 xl:grid-cols-6">
            {kpis.map((k) => (
              <div key={k.label} className="bg-card px-4 py-4">
                <p className="text-xs text-muted-foreground">{k.label}</p>
                <p className={cn("mt-1 font-mono text-lg font-semibold tabular", k.tone != null && pnlText(k.tone))}>{k.value}</p>
                {k.label !== "Max drawdown" ? <Delta cur={k.cur} prev={k.prev} kind={k.kind} currency={currency} /> : <span className="text-[11px] text-muted-foreground">Within this period</span>}
              </div>
            ))}
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="break-inside-avoid">
              <CardHeader>
                <div>
                  <CardTitle>Equity</CardTitle>
                  <CardDescription>{sd.tradingDays} trading days · {sd.greenDays} green · {sd.redDays} red</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <EquityChart data={curve} currency={currency} />
              </CardContent>
            </Card>
            <Card className="break-inside-avoid">
              <CardHeader>
                <div>
                  <CardTitle>Daily P&amp;L</CardTitle>
                  <CardDescription>
                    Best day {sd.best ? `${formatMoney(sd.best.net, currency, { sign: true })} (${formatDay(sd.best.day, { month: "short", day: "numeric" })})` : "—"}
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <DailyPnlChart data={days} currency={currency} />
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {[
              { title: "Best trades", list: best },
              { title: "Worst trades", list: worst },
            ].map(({ title, list }) => (
              <Card key={title} className="break-inside-avoid">
                <CardHeader>
                  <CardTitle>{title}</CardTitle>
                </CardHeader>
                <ul className="grid gap-0.5 p-2">
                  {list.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted-foreground">None</li>}
                  {list.map((t) => (
                    <li key={t.id}>
                      <Link href={`/trades/${t.id}`} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition hover:bg-accent">
                        <span className="w-16 text-xs text-muted-foreground tabular">{formatDay(t.day, { month: "short", day: "numeric" })}</span>
                        <span className="font-medium">{t.symbol}</span>
                        <Badge variant={t.side === "LONG" ? "profit" : "loss"}>{t.side === "LONG" ? "Long" : "Short"}</Badge>
                        {t.setup && <span className="truncate text-xs text-muted-foreground">{t.setup}</span>}
                        <span className={cn("ml-auto font-mono font-semibold tabular", pnlText(t.net))}>{formatMoney(t.net, currency, { sign: true })}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>

          <Card className="break-inside-avoid">
            <CardHeader>
              <CardTitle>By symbol</CardTitle>
            </CardHeader>
            <div className="mt-4">
              <BreakdownTable rows={groupBy(trades, (t) => t.symbol)} currency={currency} label="Symbol" />
            </div>
          </Card>
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="break-inside-avoid">
              <CardHeader>
                <CardTitle>By setup</CardTitle>
              </CardHeader>
              <div className="mt-4">
                <BreakdownTable rows={groupBy(trades, (t) => t.setup ?? "No setup")} currency={currency} label="Setup" compact />
              </div>
            </Card>
            <Card className="break-inside-avoid">
              <CardHeader>
                <CardTitle>By account</CardTitle>
              </CardHeader>
              <div className="mt-4">
                <BreakdownTable rows={groupBy(trades, (t) => t.accountName)} currency={currency} label="Account" compact />
              </div>
            </Card>
          </div>
        </FadeIn>
      )}
    </div>
  );
}

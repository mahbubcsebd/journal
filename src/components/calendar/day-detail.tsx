"use client";

import { motion } from "motion/react";
import { ArrowDownLeft, ArrowUpRight, CalendarX2, CircleDot } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { IntradayChart } from "@/components/charts/intraday-chart";
import { formatDay } from "@/lib/dates";
import { cn, formatDateTime, formatMoney, formatPercent, formatPrice } from "@/lib/utils";
import type { DayDetailData } from "@/server/actions/calendar";
import { pnlText } from "./pnl-style";

const time = (d: Date | string, tz: string) => formatDateTime(d, tz, { day: undefined, month: undefined });

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <section className="grid gap-2.5">
      <h3 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
        {title}
        <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-muted-foreground tabular">{count}</span>
      </h3>
      {children}
    </section>
  );
}

function Row({ href, index, children }: { href?: string; index: number; children: React.ReactNode }) {
  const cls = "flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border bg-card px-3.5 py-2.5 text-sm transition";
  return (
    <motion.li initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index, 12) * 0.03 }}>
      {href ? (
        <Link href={href} className={cn(cls, "hover:bg-accent")}>
          {children}
        </Link>
      ) : (
        <div className={cls}>{children}</div>
      )}
    </motion.li>
  );
}

const Dot = ({ color, title }: { color: string; title: string }) => (
  <span className="size-2 shrink-0 rounded-full" style={{ background: color }} title={title} />
);

const Side = ({ side }: { side: "LONG" | "SHORT" }) => (
  <Badge variant={side === "LONG" ? "profit" : "loss"}>{side === "LONG" ? "Buy" : "Sell"}</Badge>
);

export function DayDetail({ data, compact }: { data: DayDetailData; compact?: boolean }) {
  const { trades, opened, transactions, currency, timezone, day } = data;

  if (trades.length + opened.length + transactions.length === 0) {
    return (
      <div className="grid justify-items-center gap-2 py-12 text-center">
        <CalendarX2 className="size-8 text-muted-foreground/60" />
        <p className="text-sm font-medium">No orders on this day</p>
        <p className="max-w-xs text-xs text-muted-foreground">
          Nothing was opened, closed, deposited or withdrawn on {formatDay(day, { month: "long", day: "numeric" })} in the accounts you&apos;re
          viewing.
        </p>
      </div>
    );
  }

  const net = trades.reduce((s, t) => s + t.norm, 0);
  const wins = trades.filter((t) => t.netPnl > 0).length;
  const losses = trades.filter((t) => t.netPnl < 0).length;
  const best = trades.reduce((b, t) => Math.max(b, t.norm), 0);
  const worst = trades.reduce((w, t) => Math.min(w, t.norm), 0);
  const volume = trades.reduce((s, t) => s + t.volume, 0);
  const running = opened.filter((t) => t.status === "OPEN").length;

  const stats: { k: string; v: string; tone?: number; sub?: string }[] = [
    { k: "Net P&L", v: trades.length ? formatMoney(net, currency, { sign: true }) : "—", tone: net },
    { k: "Closed", v: `${trades.length}` },
    { k: "Opened", v: `${opened.length}`, sub: running ? `${running} running` : undefined },
    { k: "Win rate", v: wins + losses ? formatPercent(wins / (wins + losses), 0) : "—" },
    { k: "Best trade", v: best > 0 ? formatMoney(best, currency, { sign: true }) : "—", tone: best },
    { k: "Worst trade", v: worst < 0 ? formatMoney(worst, currency, { sign: true }) : "—", tone: worst },
  ];

  return (
    <div className="grid gap-6">
      <div className={cn("grid gap-px overflow-hidden rounded-xl border bg-border", compact ? "grid-cols-3" : "grid-cols-3 sm:grid-cols-6")}>
        {stats.map((s) => (
          <div key={s.k} className="min-w-0 bg-card px-3.5 py-3">
            <p className="text-[11px] text-muted-foreground">{s.k}</p>
            <p className={cn("mt-0.5 truncate font-mono text-sm font-semibold tabular", s.tone ? pnlText(s.tone) : "")}>{s.v}</p>
            {s.sub && <p className="truncate text-[11px] text-brand-ink">{s.sub}</p>}
          </div>
        ))}
      </div>

      {trades.length > 0 && (
        <Section title="Closed this day" count={trades.length}>
          <div className="rounded-xl border p-4">
            <p className="text-xs font-medium text-muted-foreground">Running P&amp;L through the day · {volume.toFixed(2)} lots</p>
            <IntradayChart
              currency={currency}
              timezone={timezone}
              points={trades.map((t) => ({ time: new Date(t.closeTime).getTime(), net: t.norm, symbol: t.symbol }))}
            />
          </div>
          <ul className="grid gap-1.5">
            {trades.map((t, i) => (
              <Row key={t.id} href={`/trades/${t.id}`} index={i}>
                <span className="w-12 font-mono text-xs text-muted-foreground tabular">{time(t.closeTime, timezone)}</span>
                <Dot color={t.accountColor} title={t.accountName} />
                <span className="font-medium">{t.symbol}</span>
                <Side side={t.side} />
                <span className="text-xs text-muted-foreground tabular">{t.volume.toFixed(2)} lots</span>
                <span className="hidden font-mono text-xs text-muted-foreground tabular sm:inline">
                  {formatPrice(t.openPrice)} → {formatPrice(t.closePrice)}
                </span>
                {t.rMultiple != null && <span className="text-xs text-muted-foreground tabular">{t.rMultiple.toFixed(2)}R</span>}
                <span className={cn("ml-auto font-mono font-semibold tabular", pnlText(t.netPnl))}>
                  {formatMoney(t.netPnl, t.currency, { sign: true })}
                </span>
              </Row>
            ))}
          </ul>
        </Section>
      )}

      {opened.length > 0 && (
        <Section title="Orders opened this day" count={opened.length}>
          <ul className="grid gap-1.5">
            {opened.map((t, i) => (
              <Row key={t.id} href={`/trades/${t.id}`} index={i}>
                <span className="w-12 font-mono text-xs text-muted-foreground tabular">{time(t.openTime, timezone)}</span>
                <Dot color={t.accountColor} title={t.accountName} />
                <span className="font-medium">{t.symbol}</span>
                <Side side={t.side} />
                <span className="text-xs text-muted-foreground tabular">{t.volume.toFixed(2)} lots</span>
                <span className="hidden font-mono text-xs text-muted-foreground tabular sm:inline">@ {formatPrice(t.openPrice)}</span>
                {t.status === "OPEN" ? (
                  <Badge variant="brand" className="ml-auto gap-1">
                    <CircleDot className="size-3 animate-pulse" /> Running
                  </Badge>
                ) : (
                  <>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {t.closeDay === day ? "Closed same day" : t.closeDay ? `Closed ${formatDay(t.closeDay, { month: "short", day: "numeric" })}` : "Closed"}
                    </span>
                    <span className={cn("font-mono font-semibold tabular", pnlText(t.netPnl))}>
                      {formatMoney(t.netPnl, t.currency, { sign: true })}
                    </span>
                  </>
                )}
              </Row>
            ))}
          </ul>
        </Section>
      )}

      {transactions.length > 0 && (
        <Section title="Deposits & withdrawals" count={transactions.length}>
          <ul className="grid gap-1.5">
            {transactions.map((x, i) => {
              const inflow = x.amount >= 0;
              return (
                <Row key={x.id} index={i}>
                  <span className="w-12 font-mono text-xs text-muted-foreground tabular">{time(x.time, timezone)}</span>
                  <Dot color={x.accountColor} title={x.accountName} />
                  {inflow ? <ArrowDownLeft className="size-4 text-profit" /> : <ArrowUpRight className="size-4 text-loss" />}
                  <span className="font-medium capitalize">{x.type.toLowerCase()}</span>
                  <span className="truncate text-xs text-muted-foreground">{x.accountName}</span>
                  <span className={cn("ml-auto font-mono font-semibold tabular", pnlText(x.amount))}>
                    {formatMoney(x.amount, x.currency, { sign: true })}
                  </span>
                </Row>
              );
            })}
          </ul>
        </Section>
      )}
    </div>
  );
}

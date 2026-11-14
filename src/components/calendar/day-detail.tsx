"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { IntradayChart } from "@/components/charts/intraday-chart";
import { cn, formatDateTime, formatMoney, formatPercent } from "@/lib/utils";
import type { DayDetailData } from "@/server/actions/calendar";
import { pnlText } from "./pnl-style";

export function DayDetail({ data, compact }: { data: DayDetailData; compact?: boolean }) {
  const { trades, currency, timezone } = data;
  const net = trades.reduce((s, t) => s + t.norm, 0);
  const wins = trades.filter((t) => t.netPnl > 0).length;
  const losses = trades.filter((t) => t.netPnl < 0).length;
  const best = trades.reduce((b, t) => Math.max(b, t.norm), 0);
  const worst = trades.reduce((w, t) => Math.min(w, t.norm), 0);
  const volume = trades.reduce((s, t) => s + t.volume, 0);

  if (trades.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">No closed trades on this day.</p>;
  }

  const stats = [
    ["Net P&L", formatMoney(net, currency, { sign: true }), net],
    ["Trades", `${trades.length}`, 0],
    ["Win rate", wins + losses ? formatPercent(wins / (wins + losses), 0) : "—", 0],
    ["Lots", volume.toFixed(2), 0],
    ["Best trade", best > 0 ? formatMoney(best, currency, { sign: true }) : "—", best],
    ["Worst trade", worst < 0 ? formatMoney(worst, currency, { sign: true }) : "—", worst],
  ] as const;

  return (
    <div className="grid gap-5">
      <div className={cn("grid gap-px overflow-hidden rounded-xl border bg-border", compact ? "grid-cols-3" : "grid-cols-3 sm:grid-cols-6")}>
        {stats.map(([k, v, tone]) => (
          <div key={k} className="bg-card px-3.5 py-3">
            <p className="text-[11px] text-muted-foreground">{k}</p>
            <p className={cn("mt-0.5 font-mono text-sm font-semibold tabular", tone ? pnlText(tone) : "")}>{v}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border p-4">
        <p className="text-xs font-medium text-muted-foreground">Running P&amp;L through the day</p>
        <IntradayChart
          currency={currency}
          timezone={timezone}
          points={trades.map((t) => ({ time: new Date(t.closeTime).getTime(), net: t.norm, symbol: t.symbol }))}
        />
      </div>

      <ul className="grid gap-1.5">
        {trades.map((t, i) => (
          <motion.li
            key={t.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i, 12) * 0.03 }}
          >
            <Link
              href={`/trades/${t.id}`}
              className="flex items-center gap-3 rounded-lg border bg-card px-3.5 py-2.5 text-sm transition hover:bg-accent"
            >
              <span className="w-12 font-mono text-xs text-muted-foreground tabular">
                {formatDateTime(t.closeTime, timezone, { day: undefined, month: undefined })}
              </span>
              <span className="size-2 shrink-0 rounded-full" style={{ background: t.accountColor }} title={t.accountName} />
              <span className="font-medium">{t.symbol}</span>
              <Badge variant={t.side === "LONG" ? "profit" : "loss"}>{t.side === "LONG" ? "Long" : "Short"}</Badge>
              <span className="text-xs text-muted-foreground tabular">{t.volume.toFixed(2)} lots</span>
              {t.rMultiple != null && <span className="text-xs text-muted-foreground tabular">{t.rMultiple.toFixed(2)}R</span>}
              <span className={cn("ml-auto font-mono font-semibold tabular", pnlText(t.netPnl))}>
                {formatMoney(t.netPnl, t.currency, { sign: true })}
              </span>
            </Link>
          </motion.li>
        ))}
      </ul>
    </div>
  );
}

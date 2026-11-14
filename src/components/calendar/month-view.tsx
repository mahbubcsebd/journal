"use client";

import { motion } from "motion/react";
import { Card } from "@/components/ui/card";
import { monthGrid, weekdayLabels, type WeekStart } from "@/lib/dates";
import type { DailyPoint } from "@/lib/stats";
import { cn, formatMoney, formatPercent, formatTiny } from "@/lib/utils";
import { pnlFill, pnlText } from "./pnl-style";

type Props = {
  anchor: string;
  today: string;
  weekStartsOn: WeekStart;
  byDay: Map<string, DailyPoint>;
  currency: string;
  onSelect: (day: string) => void;
};

export function MonthView({ anchor, today, weekStartsOn, byDay, currency, onSelect }: Props) {
  const weeks = monthGrid(anchor, weekStartsOn);
  const month = anchor.slice(0, 7);
  const maxAbs = Math.max(0, ...weeks.flat().map((d) => (d.startsWith(month) ? Math.abs(byDay.get(d)?.net ?? 0) : 0)));

  return (
    <Card className="overflow-hidden p-2 sm:p-3">
      <div className="grid grid-cols-7 gap-1.5 lg:grid-cols-[repeat(7,minmax(0,1fr))_minmax(0,0.9fr)] sm:gap-2">
        {weekdayLabels(weekStartsOn).map((l) => (
          <div key={l} className="px-1 pb-1 text-center text-[11px] font-medium text-muted-foreground sm:text-xs">
            {l}
          </div>
        ))}
        <div className="hidden pb-1 text-center text-xs font-medium text-muted-foreground lg:block">Week</div>

        {weeks.map((week, wi) => {
          const inMonth = week.filter((d) => d.startsWith(month));
          const wk = inMonth.map((d) => byDay.get(d)).filter(Boolean) as DailyPoint[];
          const wNet = wk.reduce((s, d) => s + d.net, 0);
          const wTrades = wk.reduce((s, d) => s + d.trades, 0);
          return [
            ...week.map((day, di) => {
              const p = byDay.get(day);
              const outside = !day.startsWith(month);
              const decided = p ? p.wins + p.losses : 0;
              return (
                <motion.button
                  key={day}
                  type="button"
                  initial={{ opacity: 0, scale: 0.94 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: (wi * 7 + di) * 0.008, duration: 0.25 }}
                  whileHover={{ y: -2 }}
                  onClick={() => onSelect(day)}
                  aria-label={`${day}${p ? `: ${formatMoney(p.net, currency, { sign: true })}, ${p.trades} trades` : ": no trades"}`}
                  className={cn(
                    "group relative flex aspect-square flex-col rounded-lg border p-1.5 text-left transition-shadow hover:shadow-pop focus-visible:z-10 sm:aspect-[1.15] sm:rounded-xl sm:p-2.5 lg:aspect-[1.3]",
                    outside && "opacity-40",
                    !p && "bg-card",
                    day === today && "ring-2 ring-brand ring-offset-2 ring-offset-card",
                  )}
                  style={p && !outside ? pnlFill(p.net, maxAbs) : p ? pnlFill(p.net, maxAbs, 0.5) : undefined}
                >
                  <span className={cn("text-[11px] font-medium tabular sm:text-xs", day === today ? "text-brand" : "text-muted-foreground")}>
                    {Number(day.slice(8))}
                  </span>
                  {p && (
                    <span className="mt-auto grid gap-0.5">
                      <span className={cn("hidden font-mono text-[13px] font-semibold tracking-tight tabular sm:block lg:text-sm", pnlText(p.net))}>
                        {formatMoney(p.net, currency, { sign: true, compact: Math.abs(p.net) >= 10_000 })}
                      </span>
                      <span className={cn("font-mono text-[10px] font-semibold tracking-tight tabular sm:hidden", pnlText(p.net))}>
                        {formatTiny(p.net)}
                      </span>
                      <span className="hidden text-[11px] text-muted-foreground sm:block">
                        {p.trades} {p.trades === 1 ? "trade" : "trades"}
                        {decided > 0 && <span className="hidden md:inline"> · {formatPercent(p.wins / decided, 0)}</span>}
                      </span>
                    </span>
                  )}
                </motion.button>
              );
            }),
            <div
              key={`w${wi}`}
              className="hidden flex-col justify-center rounded-xl border border-dashed px-3 text-right lg:flex"
            >
              <span className="text-[11px] text-muted-foreground">Week {wi + 1}</span>
              <span className={cn("font-mono text-sm font-semibold tabular", pnlText(wNet))}>
                {wTrades ? formatMoney(wNet, currency, { sign: true }) : "—"}
              </span>
              <span className="text-[11px] text-muted-foreground">
                {wk.length} {wk.length === 1 ? "day" : "days"} · {wTrades} trades
              </span>
            </div>,
          ];
        })}
      </div>
    </Card>
  );
}

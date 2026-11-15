"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { monthGrid, weekdayLabels, type WeekStart } from "@/lib/dates";
import type { DailyPoint } from "@/lib/stats";
import { cn, formatMoney } from "@/lib/utils";
import { pnlFill, pnlText } from "./pnl-style";

type Props = {
  year: string;
  today: string;
  weekStartsOn: WeekStart;
  byDay: Map<string, DailyPoint>;
  currency: string;
  opened?: Record<string, { opened: number; running: number }>;
  onSelect: (day: string) => void;
};

export function YearView({ year, today, weekStartsOn, byDay, currency, opened = {}, onSelect }: Props) {
  const maxAbs = Math.max(0, ...[...byDay.values()].map((d) => Math.abs(d.net)));
  const labels = weekdayLabels(weekStartsOn, "narrow");

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 12 }, (_, m) => {
        const anchor = `${year}-${String(m + 1).padStart(2, "0")}-01`;
        const month = anchor.slice(0, 7);
        const points = [...byDay.values()].filter((d) => d.day.startsWith(month));
        const net = points.reduce((s, d) => s + d.net, 0);
        return (
          <motion.div key={month} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: m * 0.03 }}>
            <Card className="p-4">
              <div className="mb-3 flex items-baseline justify-between">
                <Link href={`/calendar?view=month&d=${anchor}`} className="text-sm font-semibold hover:underline">
                  {new Intl.DateTimeFormat("en-US", { month: "long", timeZone: "UTC" }).format(new Date(`${anchor}T00:00:00Z`))}
                </Link>
                <span className={cn("font-mono text-xs font-semibold tabular", pnlText(net))}>
                  {points.length ? formatMoney(net, currency, { sign: true, compact: Math.abs(net) >= 10_000 }) : "—"}
                </span>
              </div>
              <div className="grid grid-cols-7 gap-1">
                {labels.map((l, i) => (
                  <span key={i} className="text-center text-[10px] text-muted-foreground">
                    {l}
                  </span>
                ))}
                {monthGrid(anchor, weekStartsOn)
                  .flat()
                  .map((day) => {
                    const p = byDay.get(day);
                    const o = opened[day];
                    const outside = !day.startsWith(month);
                    if (outside) return <span key={day} className="aspect-square" />;
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => onSelect(day)}
                        title={`${day}${p ? ` · ${formatMoney(p.net, currency, { sign: true })} · ${p.trades} closed` : ""}${o ? ` · ${o.opened} opened` : ""}`}
                        aria-label={`${day}${p ? `: ${formatMoney(p.net, currency, { sign: true })}` : ""}${o ? `, ${o.opened} opened` : ""}`}
                        className={cn(
                          "aspect-square rounded-[5px] border bg-muted/40 transition hover:scale-110 hover:shadow-soft",
                          !p && o && "border-brand/60 border-dashed",
                          day === today && "ring-2 ring-brand ring-offset-1 ring-offset-card",
                        )}
                        style={p ? pnlFill(p.net, maxAbs, 1.4) : undefined}
                      />
                    );
                  })}
              </div>
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
}

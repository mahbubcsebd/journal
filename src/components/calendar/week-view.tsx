"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { addDays, formatDay } from "@/lib/dates";
import type { DailyPoint } from "@/lib/stats";
import { cn, formatDateTime, formatMoney } from "@/lib/utils";
import type { CalendarTrade } from "@/server/queries/calendar";
import { pnlFill, pnlText } from "./pnl-style";

type Props = {
  start: string;
  today: string;
  byDay: Map<string, DailyPoint>;
  trades: CalendarTrade[];
  currency: string;
  timezone: string;
  opened?: Record<string, { opened: number; running: number }>;
  onSelect: (day: string) => void;
};

export function WeekView({ start, today, byDay, trades, currency, timezone, opened = {}, onSelect }: Props) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const maxAbs = Math.max(0, ...days.map((d) => Math.abs(byDay.get(d)?.net ?? 0)));

  return (
    <div className="grid gap-3 md:grid-cols-7">
      {days.map((day, i) => {
        const p = byDay.get(day);
        const list = trades.filter((t) => t.day === day);
        const o = opened[day];
        return (
          <motion.div
            key={day}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
          >
            <Card className={cn("flex h-full min-h-40 flex-col overflow-hidden", day === today && "ring-2 ring-brand")}>
              <button
                type="button"
                onClick={() => onSelect(day)}
                className="border-b px-3 py-2.5 text-left transition hover:brightness-95"
                style={p ? pnlFill(p.net, maxAbs) : undefined}
              >
                <p className="text-xs text-muted-foreground">{formatDay(day, { weekday: "short", month: "short", day: "numeric" })}</p>
                <p className={cn("font-mono text-sm font-semibold tabular", p ? pnlText(p.net) : "text-muted-foreground")}>
                  {p ? formatMoney(p.net, currency, { sign: true }) : o ? "Nothing closed" : "No trades"}
                </p>
                {o && (
                  <p className="text-[11px] text-muted-foreground">
                    {o.opened} opened{o.running ? ` · ${o.running} running` : ""}
                  </p>
                )}
              </button>
              <ul className="grid content-start gap-1 p-1.5">
                {list.map((t) => (
                  <li key={t.id}>
                    <Link href={`/trades/${t.id}`} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition hover:bg-accent">
                      <span className="size-1.5 shrink-0 rounded-full" style={{ background: t.accountColor }} />
                      <span className="font-medium">{t.symbol}</span>
                      <span className="text-muted-foreground tabular">
                        {formatDateTime(t.closeTime, timezone, { day: undefined, month: undefined })}
                      </span>
                      <span className={cn("ml-auto font-mono font-medium tabular", pnlText(t.netPnl))}>
                        {formatMoney(t.netPnl, t.currency, { sign: true, compact: Math.abs(t.netPnl) >= 1000 })}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
}

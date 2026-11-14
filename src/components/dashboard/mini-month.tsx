"use client";

import Link from "next/link";
import { pnlFill } from "@/components/calendar/pnl-style";
import { monthGrid, weekdayLabels, type WeekStart } from "@/lib/dates";
import type { DailyPoint } from "@/lib/stats";
import { cn, formatMoney } from "@/lib/utils";

export function MiniMonth({
  anchor,
  today,
  weekStartsOn,
  days,
  currency,
}: {
  anchor: string;
  today: string;
  weekStartsOn: WeekStart;
  days: DailyPoint[];
  currency: string;
}) {
  const byDay = new Map(days.map((d) => [d.day, d]));
  const month = anchor.slice(0, 7);
  const maxAbs = Math.max(0, ...days.filter((d) => d.day.startsWith(month)).map((d) => Math.abs(d.net)));
  return (
    <div className="grid grid-cols-7 gap-1">
      {weekdayLabels(weekStartsOn, "narrow").map((l, i) => (
        <span key={i} className="pb-1 text-center text-[10px] text-muted-foreground">
          {l}
        </span>
      ))}
      {monthGrid(anchor, weekStartsOn)
        .flat()
        .map((day) => {
          if (!day.startsWith(month)) return <span key={day} />;
          const p = byDay.get(day);
          return (
            <Link
              key={day}
              href={`/calendar/${day}`}
              title={p ? `${day}: ${formatMoney(p.net, currency, { sign: true })} · ${p.trades} trades` : day}
              className={cn(
                "flex aspect-square items-center justify-center rounded-md border text-[11px] tabular transition hover:scale-110",
                p ? "font-semibold" : "text-muted-foreground",
                day === today && "ring-2 ring-brand",
              )}
              style={p ? pnlFill(p.net, maxAbs, 1.2) : undefined}
            >
              {Number(day.slice(8))}
            </Link>
          );
        })}
    </div>
  );
}

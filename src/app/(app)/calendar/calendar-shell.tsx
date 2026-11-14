"use client";

import { AnimatePresence, motion } from "motion/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { DayDrawer } from "@/components/calendar/day-drawer";
import { MonthView } from "@/components/calendar/month-view";
import { pnlText } from "@/components/calendar/pnl-style";
import { WeekView } from "@/components/calendar/week-view";
import { YearView } from "@/components/calendar/year-view";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { addDays, addMonths, formatDay, startOfWeek, type WeekStart } from "@/lib/dates";
import { summarizeDays, type DailyPoint } from "@/lib/stats";
import { cn, formatMoney, formatPercent } from "@/lib/utils";
import type { CalendarTrade } from "@/server/queries/calendar";

export type CalendarView = "month" | "week" | "year";

type Props = {
  view: CalendarView;
  anchor: string;
  today: string;
  weekStartsOn: WeekStart;
  currency: string;
  days: DailyPoint[];
  periodFrom: string;
  periodTo: string;
  weekTrades: CalendarTrade[];
  timezone: string;
  hasAccounts: boolean;
  /** day → mood (null when the entry has no mood) for days with a journal entry. */
  journal: Record<string, number | null>;
};

const href = (view: CalendarView, d: string) => `/calendar?view=${view}&d=${d}`;

export function CalendarShell(props: Props) {
  const { view, anchor, today, weekStartsOn, currency, days, periodFrom, periodTo } = props;
  const router = useRouter();
  const [openDay, setOpenDay] = useState<string | null>(null);
  const [direction, setDirection] = useState(0);

  const step = (n: number) =>
    view === "year" ? addMonths(anchor, 12 * n) : view === "week" ? addDays(anchor, 7 * n) : addMonths(anchor, n);
  const prev = step(-1);
  const next = step(1);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (openDay || e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if (e.key === "ArrowLeft") {
        setDirection(-1);
        router.push(href(view, prev), { scroll: false });
      } else if (e.key === "ArrowRight") {
        setDirection(1);
        router.push(href(view, next), { scroll: false });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, view, prev, next, openDay]);

  const byDay = useMemo(() => new Map(days.map((d) => [d.day, d])), [days]);
  const inPeriod = days.filter((d) => d.day >= periodFrom && d.day <= periodTo);
  const s = summarizeDays(inPeriod);

  const title =
    view === "year"
      ? anchor.slice(0, 4)
      : view === "week"
        ? (() => {
            const start = startOfWeek(anchor, weekStartsOn);
            return `${formatDay(start, { month: "short", day: "numeric" })} – ${formatDay(addDays(start, 6), { month: "short", day: "numeric", year: "numeric" })}`;
          })()
        : formatDay(anchor, { month: "long", year: "numeric" });

  const stats = [
    { k: "Net P&L", v: formatMoney(s.net, currency, { sign: true }), tone: s.net },
    { k: "Trading days", v: `${s.tradingDays}` },
    { k: "Green / red", v: `${s.greenDays} / ${s.redDays}` },
    { k: "Win rate", v: s.winRate == null ? "—" : formatPercent(s.winRate) },
    { k: "Avg day", v: s.avgDay == null ? "—" : formatMoney(s.avgDay, currency, { sign: true }), tone: s.avgDay ?? 0 },
    {
      k: "Best day",
      v: s.best ? formatMoney(s.best.net, currency, { sign: true }) : "—",
      sub: s.best ? formatDay(s.best.day, { month: "short", day: "numeric" }) : undefined,
      tone: s.best?.net,
    },
    {
      k: "Worst day",
      v: s.worst ? formatMoney(s.worst.net, currency, { sign: true }) : "—",
      sub: s.worst ? formatDay(s.worst.day, { month: "short", day: "numeric" }) : undefined,
      tone: s.worst?.net,
    },
  ];

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <Button asChild variant="outline" size="icon" aria-label="Previous">
            <Link href={href(view, prev)} scroll={false} onClick={() => setDirection(-1)}>
              <ChevronLeft />
            </Link>
          </Button>
          <Button asChild variant="outline" size="icon" aria-label="Next">
            <Link href={href(view, next)} scroll={false} onClick={() => setDirection(1)}>
              <ChevronRight />
            </Link>
          </Button>
        </div>
        <h2 className="min-w-48 text-lg font-semibold tracking-tight">{title}</h2>
        <Button asChild variant="ghost" size="sm">
          <Link href={href(view, today)} scroll={false}>
            Today
          </Link>
        </Button>
        <div className="flex-1" />
        <div className="relative inline-flex h-9 items-center rounded-lg border bg-card p-0.5">
          {(["week", "month", "year"] as const).map((v) => (
            <Link
              key={v}
              href={href(v, anchor)}
              scroll={false}
              className={cn(
                "relative h-full rounded-md px-3 text-[13px] leading-8 font-medium capitalize transition-colors",
                view === v ? "text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {view === v && (
                <motion.span
                  layoutId="calendar-view"
                  className="absolute inset-0 rounded-md bg-secondary shadow-xs"
                  transition={{ type: "spring", stiffness: 500, damping: 38 }}
                />
              )}
              <span className="relative">{v}</span>
            </Link>
          ))}
        </div>
      </div>

      <Card className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 lg:divide-x">
        {stats.map((i) => (
          <div key={i.k} className="min-w-0 px-3 py-2.5 sm:px-4 sm:py-3">
            <p className="truncate text-[11px] text-muted-foreground sm:text-xs">{i.k}</p>
            <p className={cn("mt-0.5 truncate font-mono text-[13px] font-semibold tabular sm:text-[15px]", i.tone != null && pnlText(i.tone))}>{i.v}</p>
            {i.sub && <p className="text-[11px] text-muted-foreground">{i.sub}</p>}
          </div>
        ))}
      </Card>

      <AnimatePresence mode="wait" initial={false} custom={direction}>
        <motion.div
          key={`${view}-${periodFrom}`}
          custom={direction}
          initial={{ opacity: 0, x: direction * 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: direction * -24 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        >
          {view === "month" && (
            <MonthView
              anchor={anchor}
              today={today}
              weekStartsOn={weekStartsOn}
              byDay={byDay}
              currency={currency}
              journal={props.journal}
              onSelect={setOpenDay}
            />
          )}
          {view === "week" && (
            <WeekView
              start={periodFrom}
              today={today}
              byDay={byDay}
              trades={props.weekTrades}
              currency={currency}
              timezone={props.timezone}
              onSelect={setOpenDay}
            />
          )}
          {view === "year" && (
            <YearView year={anchor.slice(0, 4)} today={today} weekStartsOn={weekStartsOn} byDay={byDay} currency={currency} onSelect={setOpenDay} />
          )}
        </motion.div>
      </AnimatePresence>

      {!props.hasAccounts && (
        <p className="text-center text-sm text-muted-foreground">
          Add an account and import its history to fill the calendar.{" "}
          <Link href="/accounts" className="font-medium text-brand hover:underline">
            Accounts
          </Link>
        </p>
      )}
      <p className="hidden text-center text-xs text-muted-foreground sm:block">Tip: use ← → to move between periods.</p>

      <DayDrawer day={openDay} onClose={() => setOpenDay(null)} />
    </div>
  );
}

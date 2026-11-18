"use client";

import { AlertTriangle, CheckCircle2, ChevronRight, Clock } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { CURRENCY_FLAG, formatCountdown, IMPACT_STYLE, type NewsWindow } from "@/lib/news";
import { cn } from "@/lib/utils";

export type ListEvent = {
  id: string;
  title: string;
  currency: string;
  impact: string;
  time: string;
  allDay: boolean;
  forecast: string | null;
  previous: string | null;
  actual: string | null;
  relevant: boolean;
  hasAnalysis: boolean;
};


function useNow(ms = 1000) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

/** Week of events grouped by day in the user's timezone, with live status per row. */
export function NewsList({ events, timezone, window }: { events: ListEvent[]; timezone: string; window: NewsWindow }) {
  const now = useNow();
  const dayKey = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
  const today = dayKey(new Date().toISOString());
  const groups = new Map<string, ListEvent[]>();
  for (const e of events) groups.set(dayKey(e.time), [...(groups.get(dayKey(e.time)) ?? []), e]);
  const fmtTime = (iso: string) => new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
  const fmtDay = (key: string) =>
    new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" }).format(new Date(`${key}T12:00:00Z`));

  if (events.length === 0) {
    return <p className="rounded-2xl border border-dashed px-6 py-14 text-center text-sm text-muted-foreground">No events match these filters this week.</p>;
  }

  return (
    <div className="grid gap-6">
      {[...groups].map(([day, list]) => (
        <section key={day} className="grid gap-2" aria-label={fmtDay(day)}>
          <h2 className={cn("flex items-center gap-2 text-sm font-semibold", day === today && "text-brand-ink")}>
            {fmtDay(day)}
            {day === today && <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-medium text-brand-ink">Today</span>}
          </h2>
          <ul className="grid divide-y overflow-hidden rounded-2xl border bg-card">
            {list.map((e) => {
              const t = Date.parse(e.time);
              const inWindow = now != null && e.impact === "High" && !e.allDay && now >= t - window.before * 60_000 && now <= t + window.after * 60_000;
              const past = now != null && now > t + window.after * 60_000;
              const s = IMPACT_STYLE[e.impact] ?? IMPACT_STYLE.Low;
              return (
                <li key={e.id}>
                  <Link
                    href={`/news/${e.id}`}
                    className={cn(
                      "grid grid-cols-[52px_1fr_auto] items-center gap-x-3 gap-y-1 px-4 py-3 text-sm transition hover:bg-accent/60 sm:grid-cols-[60px_88px_1fr_repeat(3,72px)_110px_16px]",
                      past && "opacity-60",
                      inWindow && "bg-loss-soft/60",
                      !e.relevant && "text-muted-foreground",
                    )}
                  >
                    <span className="font-mono text-[13px] tabular">{e.allDay ? "All day" : fmtTime(e.time)}</span>
                    <span className="hidden items-center gap-1.5 sm:flex">
                      <span aria-hidden>{CURRENCY_FLAG[e.currency] ?? "🌐"}</span>
                      <span className="font-medium">{e.currency}</span>
                      <span className={cn("size-2 rounded-full", s.dot)} title={`${s.label} impact`} />
                    </span>
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5 sm:hidden">
                        <span aria-hidden>{CURRENCY_FLAG[e.currency] ?? "🌐"}</span>
                        <span className="text-xs font-medium">{e.currency}</span>
                        <span className={cn("text-[11px] font-medium", s.text)}>· {s.label}</span>
                      </span>
                      <span className={cn("block truncate font-medium", e.relevant && "text-foreground")}>{e.title}</span>
                      <span className="block text-[11px] text-muted-foreground sm:hidden">
                        A {e.actual ?? "—"} · F {e.forecast ?? "—"} · P {e.previous ?? "—"}
                      </span>
                    </span>
                    <span className="hidden text-right font-mono text-[13px] font-semibold tabular sm:block">{e.actual ?? "—"}</span>
                    <span className="hidden text-right font-mono text-[13px] tabular sm:block">{e.forecast ?? "—"}</span>
                    <span className="hidden text-right font-mono text-[13px] text-muted-foreground tabular sm:block">{e.previous ?? "—"}</span>
                    <span className="text-right text-xs font-medium">
                      {now == null || e.allDay ? null : inWindow ? (
                        <span className="inline-flex items-center gap-1 text-loss">
                          <AlertTriangle className="size-3.5 animate-pulse" /> {now < t ? formatCountdown(t - now) : "Live"}
                        </span>
                      ) : past ? (
                        <span className="inline-flex items-center gap-1 text-muted-foreground">
                          <CheckCircle2 className="size-3.5" /> Released
                        </span>
                      ) : (
                        <span className={cn("inline-flex items-center gap-1 font-mono tabular", t - now < 3_600_000 ? "text-warning-ink" : "text-muted-foreground")}>
                          <Clock className="size-3.5" /> {formatCountdown(t - now)}
                        </span>
                      )}
                    </span>
                    <ChevronRight className="hidden size-4 text-muted-foreground sm:block" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

/** Big countdown for the hero card. */
export function BigCountdown({ time, window }: { time: string; window: NewsWindow }) {
  const now = useNow();
  if (now == null) return <span className="font-mono text-4xl font-semibold tabular">--:--</span>;
  const t = Date.parse(time);
  const ms = t - now;
  const phase = now < t - window.before * 60_000 ? "upcoming" : now < t ? "before" : now <= t + window.after * 60_000 ? "after" : "done";
  return (
    <div className="grid gap-1">
      <span className={cn("font-mono text-4xl font-semibold tracking-tight tabular sm:text-5xl", phase === "before" || phase === "after" ? "text-loss" : "")}>
        {phase === "after" || phase === "done" ? `+${formatCountdown(ms)}` : formatCountdown(ms)}
      </span>
      <span className={cn("text-sm font-medium", phase === "before" || phase === "after" ? "text-loss" : "text-muted-foreground")}>
        {phase === "upcoming"
          ? `No-trade window opens ${window.before} min before`
          : phase === "before"
            ? "No-trade window: don't open new trades"
            : phase === "after"
              ? `Released — volatile for the next ${window.after} min`
              : "Released"}
      </span>
    </div>
  );
}

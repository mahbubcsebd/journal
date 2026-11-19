"use client";

import { Activity, Moon, Timer } from "lucide-react";
import { clockSummary, localMidnight, timeline } from "@/lib/market-sessions";
import { formatCountdown } from "@/lib/news";
import { cn } from "@/lib/utils";
import { useNow } from "./session-clock";

const ACTIVITY = { Low: "text-muted-foreground", Medium: "text-warning-ink", High: "text-profit" } as const;

/** Live clock: what's open now, what opens next, every session's countdown and a 24h timeline. */
export function SessionLive({ timezone }: { timezone: string }) {
  const now = useNow();
  if (now == null) return <div className="h-[520px] animate-pulse rounded-2xl bg-muted/40" />;
  const sum = clockSummary(now);
  const time = (ms: number, weekday = false) =>
    new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", minute: "2-digit", ...(weekday ? { weekday: "short" } : {}) }).format(ms);
  const overlap = sum.overlaps[0];
  const day = localMidnight(now, timezone);
  const rows = timeline(day);
  const nowPos = (now - day) / 86_400_000;

  return (
    <div className="grid gap-4">
      {/* Hero: now vs next */}
      <div className="grid gap-px overflow-hidden rounded-2xl border bg-border shadow-soft md:grid-cols-[1.4fr_1fr]">
        <div className="relative bg-card p-5 sm:p-6">
          <div aria-hidden className="pointer-events-none absolute -top-20 -left-10 size-56 rounded-full bg-profit/10 blur-3xl" />
          <p className="relative text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Open now</p>
          {sum.open.length ? (
            <div className="relative mt-2 grid gap-1">
              <p className="flex flex-wrap items-center gap-2 text-2xl font-semibold tracking-tight">
                <span className="relative flex size-2.5" aria-hidden>
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-profit opacity-60" />
                  <span className="relative inline-flex size-2.5 rounded-full bg-profit" />
                </span>
                {sum.open.map((s) => `${s.flag} ${s.name}`).join("  +  ")}
              </p>
              <p className="font-mono text-5xl font-semibold tracking-tight text-profit tabular sm:text-6xl">{formatCountdown(sum.open[0].msToChange)}</p>
              <p className="text-sm text-muted-foreground">
                until {sum.open[0].name} closes at {time(sum.open[0].end)}
              </p>
              {overlap && (
                <p className="mt-2 inline-flex w-fit items-center gap-1.5 rounded-lg bg-warning/15 px-2.5 py-1.5 text-sm text-warning-ink">
                  <Activity className="size-4" /> <strong>{overlap.name} overlap</strong> · {formatCountdown(overlap.end - now)} left
                </p>
              )}
            </div>
          ) : (
            <div className="relative mt-2 grid gap-1">
              <p className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
                <Moon className="size-6 text-muted-foreground" /> {sum.weekOpen ? "Between sessions" : "Market closed for the weekend"}
              </p>
              {!sum.weekOpen && (
                <>
                  <p className="font-mono text-5xl font-semibold tracking-tight tabular sm:text-6xl">{formatCountdown(sum.weekReopens - now)}</p>
                  <p className="text-sm text-muted-foreground">until the market reopens ({time(sum.weekReopens, true)})</p>
                </>
              )}
            </div>
          )}
        </div>
        <div className="bg-card p-5 sm:p-6">
          <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Next to open</p>
          {sum.nextOpen && (
            <div className="mt-2 grid gap-1">
              <p className="text-2xl font-semibold tracking-tight">
                {sum.nextOpen.flag} {sum.nextOpen.name}
              </p>
              <p className="font-mono text-4xl font-semibold tracking-tight tabular">{formatCountdown(sum.nextOpen.msToChange)}</p>
              <p className="text-sm text-muted-foreground">opens {time(sum.nextOpen.start, true)} your time</p>
            </div>
          )}
        </div>
      </div>

      {/* All four sessions */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {sum.status.map((s) => (
          <div key={s.key} className={cn("grid gap-2 rounded-xl border p-4 shadow-soft", s.isOpen ? "border-profit/40 bg-profit-soft/40" : "bg-card")}>
            <div className="flex items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 font-medium">
                <span aria-hidden>{s.flag}</span> {s.name}
              </p>
              <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase", s.isOpen ? "bg-profit text-white dark:text-background" : "bg-muted text-muted-foreground")}>
                {s.isOpen ? "Open" : "Closed"}
              </span>
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">{s.isOpen ? "Closes in" : "Opens in"}</p>
              <p className={cn("font-mono text-xl font-semibold tabular", s.isOpen && "text-profit")}>{formatCountdown(s.msToChange)}</p>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
              <div className="h-full rounded-full bg-profit transition-[width]" style={{ width: `${Math.round(s.progress * 100)}%` }} />
            </div>
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <Timer className="size-3.5" /> {time(s.isOpen ? s.start : s.start)}–{time(s.end)} your time
            </p>
            <p className="text-xs">
              <span className="text-muted-foreground">Activity </span>
              <span className={cn("font-medium", ACTIVITY[s.activity])}>{s.activity}</span>
              <span className="text-muted-foreground"> · {s.pairs.slice(0, 3).join(", ")}</span>
            </p>
          </div>
        ))}
      </div>

      {/* 24h timeline in the viewer's time zone */}
      <div className="rounded-xl border bg-card p-4 shadow-soft sm:p-5">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <p className="font-medium">Today in your time</p>
          <p className="text-xs text-muted-foreground">{timezone.replace("_", " ")} · now {time(now)}</p>
        </div>
        <div className="relative grid gap-2">
          {rows.map((r) => (
            <div key={r.key} className="grid grid-cols-[5.5rem_1fr] items-center gap-2 text-xs sm:grid-cols-[7rem_1fr]">
              <span className="truncate">
                {r.flag} {r.name}
              </span>
              <div className="relative h-6 rounded-md bg-muted/60">
                {r.bars.map((b, i) => (
                  <div
                    key={i}
                    className="absolute inset-y-0 rounded-md bg-brand/70"
                    style={{ left: `${b.from * 100}%`, width: `${(b.to - b.from) * 100}%` }}
                  />
                ))}
              </div>
            </div>
          ))}
          <div className="grid grid-cols-[5.5rem_1fr] gap-2 sm:grid-cols-[7rem_1fr]">
            <span />
            <div className="relative h-4 font-mono text-[10px] text-muted-foreground">
              {[0, 3, 6, 9, 12, 15, 18, 21].map((h) => (
                <span key={h} className="absolute -translate-x-1/2 first:translate-x-0" style={{ left: `${(h / 24) * 100}%` }}>
                  {String(h).padStart(2, "0")}
                </span>
              ))}
            </div>
          </div>
          {/* "Now" marker across all rows */}
          <div className="pointer-events-none absolute inset-y-0 right-0 left-[calc(5.5rem+0.5rem)] sm:left-[calc(7rem+0.5rem)]" aria-hidden>
            <div className="absolute inset-y-0 w-0.5 rounded-full bg-loss" style={{ left: `${nowPos * 100}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
}

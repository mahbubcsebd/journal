"use client";

import { AlertTriangle, Newspaper } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { CURRENCY_FLAG, formatCountdown, pickCountdown, type CountdownEvent, type NewsWindow } from "@/lib/news";
import { cn } from "@/lib/utils";

/**
 * Always-on countdown to the next news that matters to this trader. Turns red
 * inside the no-trade window around a high-impact release.
 */
export function NewsCountdown({ events, window }: { events: CountdownEvent[]; window: NewsWindow }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  if (now == null) return null;
  const pick = pickCountdown(events, now, window);
  if (!pick) {
    return (
      <Link
        href="/news"
        aria-label="Economic calendar"
        className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border bg-card px-2.5 text-[13px] text-muted-foreground shadow-xs transition hover:bg-accent"
      >
        <Newspaper className="size-4" />
        <span className="hidden xl:inline">No major news</span>
      </Link>
    );
  }
  const { event, phase, ms } = pick;
  const danger = phase !== "upcoming";
  const soon = phase === "upcoming" && ms < 60 * 60_000 && event.impact === "High";
  const time = phase === "after" ? `+${formatCountdown(ms)}` : formatCountdown(ms);
  const label = phase === "before" ? "No new trades" : phase === "after" ? "Just released" : event.impact === "High" ? "High impact" : `${event.impact} impact`;

  return (
    <Link
      href={`/news/${event.id}`}
      title={`${event.currency} ${event.title} — ${label}`}
      aria-label={`${event.currency} ${event.title}, ${phase === "after" ? "released" : "in"} ${time}. ${label}.`}
      className={cn(
        "inline-flex h-9 max-w-[min(46vw,320px)] shrink-0 items-center gap-2 rounded-lg border px-2.5 text-[13px] font-medium shadow-xs transition",
        danger
          ? "border-loss/50 bg-loss-soft text-loss"
          : soon
            ? "border-warning/50 bg-warning/10 text-warning-ink"
            : "bg-card hover:bg-accent",
      )}
    >
      {danger ? <AlertTriangle className="size-4 shrink-0 animate-pulse" /> : <span aria-hidden>{CURRENCY_FLAG[event.currency] ?? "🌐"}</span>}
      <span className="hidden min-w-0 truncate md:inline">
        {event.currency} {event.title}
      </span>
      <span className={cn("font-mono tabular", !danger && !soon && "text-muted-foreground")}>{time}</span>
    </Link>
  );
}

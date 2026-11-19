"use client";

import { AlertTriangle, Newspaper } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { CURRENCY_FLAG, formatCountdown, pickCountdown, type CountdownEvent, type NewsWindow } from "@/lib/news";
import { cn } from "@/lib/utils";
import { GoldSign } from "./gold-sign";

/** Pill colour by the news priority; the no-trade window is the loudest. */
const IMPACT = {
  High: { pill: "border-loss/50 bg-loss-soft text-loss", dot: "bg-loss", time: "" },
  Medium: { pill: "border-warning/60 bg-warning/15 text-warning-ink", dot: "bg-warning", time: "" },
  Low: { pill: "bg-card text-foreground hover:bg-accent", dot: "bg-muted-foreground/50", time: "text-muted-foreground" },
} as const;

/**
 * Always-on countdown to the next news that matters to this trader, coloured by
 * impact, with the usual gold reaction. Solid red inside the no-trade window.
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
  const style = IMPACT[event.impact as keyof typeof IMPACT] ?? IMPACT.Low;
  const time = phase === "after" ? `+${formatCountdown(ms)}` : formatCountdown(ms);
  const label = phase === "before" ? "No new trades" : phase === "after" ? "Just released" : `${event.impact} impact`;

  return (
    <Link
      href={`/news/${event.id}`}
      title={`${event.currency} ${event.title} — ${label}`}
      aria-label={`${event.currency} ${event.title}, ${phase === "after" ? "released" : "in"} ${time}. ${label}.`}
      className={cn(
        "inline-flex h-9 max-w-[min(52vw,380px)] min-w-0 items-center gap-1.5 rounded-lg border px-2 text-[13px] font-medium shadow-xs transition sm:gap-2 sm:px-2.5",
        danger ? "border-loss bg-loss text-white dark:text-background" : style.pill,
      )}
    >
      {danger ? (
        <AlertTriangle className="size-4 shrink-0 animate-pulse" />
      ) : (
        <span className="relative flex shrink-0 items-center">
          <span aria-hidden className="max-sm:hidden">
            {CURRENCY_FLAG[event.currency] ?? "🌐"}
          </span>
          {/* Impact dot, so priority isn't told by colour of the pill alone. */}
          <span
            className={cn("size-2 rounded-full sm:absolute sm:-right-1 sm:-bottom-0.5 sm:ring-2 sm:ring-background", style.dot)}
            aria-hidden
          />
        </span>
      )}
      <span className="hidden min-w-0 truncate lg:inline">
        {event.currency} {event.title}
      </span>
      <span className={cn("shrink-0 font-mono tabular", !danger && style.time)}>{time}</span>
      <GoldSign event={event} compact className={cn(danger && "bg-white/20 text-current")} />
    </Link>
  );
}

"use client";

import { ChevronRight, Clock } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ResponsivePopover } from "@/components/ui/responsive-popover";
import { clockSummary, type SessionStatus } from "@/lib/market-sessions";
import { formatCountdown } from "@/lib/news";
import { cn } from "@/lib/utils";

export function useNow(ms = 1000) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

/** "Opens in 2h 14m" / "closes in 45:10" — the countdown style used across the app. */
const cd = (ms: number) => formatCountdown(ms);

/** All four sessions with their countdowns (header popover and phone sheet). */
export function SessionList({ status, timezone }: { status: SessionStatus[]; timezone: string }) {
  const fmt = (ms: number) => new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", minute: "2-digit", weekday: "short" }).format(ms);
  return (
    <ul className="grid gap-1.5 p-3">
      {status.map((s) => (
        <li
          key={s.key}
          className={cn("grid grid-cols-[auto_1fr_auto] items-center gap-x-3 rounded-lg border px-3 py-2.5", s.isOpen ? "border-profit/40 bg-profit-soft/50" : "bg-card")}
        >
          <span className="text-lg" aria-hidden>
            {s.flag}
          </span>
          <span className="min-w-0">
            <span className="flex items-center gap-1.5 text-sm font-medium">
              {s.name}
              <span className={cn("rounded px-1.5 text-[10px] font-semibold uppercase", s.isOpen ? "bg-profit text-white dark:text-background" : "bg-muted text-muted-foreground")}>
                {s.isOpen ? "Open" : "Closed"}
              </span>
            </span>
            <span className="block text-xs text-muted-foreground">
              {s.isOpen ? `Closes ${fmt(s.end)}` : `Opens ${fmt(s.start)}`}
            </span>
            {s.isOpen && (
              <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-muted" aria-hidden>
                <span className="block h-full rounded-full bg-profit" style={{ width: `${Math.round(s.progress * 100)}%` }} />
              </span>
            )}
          </span>
          <span className="text-right">
            <span className="block text-[10px] text-muted-foreground uppercase">{s.isOpen ? "closes in" : "opens in"}</span>
            <span className={cn("font-mono text-sm font-semibold tabular", s.isOpen ? "text-profit" : "")}>{cd(s.msToChange)}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function Label({ now }: { now: number }) {
  const sum = clockSummary(now);
  if (!sum.weekOpen && sum.open.length === 0) {
    return (
      <>
        <span className="size-2 shrink-0 rounded-full bg-muted-foreground/50" aria-hidden />
        <span className="max-2xl:hidden">Market closed</span>
        <span className="font-mono tabular text-muted-foreground">{cd(sum.weekReopens - now)}</span>
      </>
    );
  }
  const first = sum.open[0];
  return (
    <>
      <span className="relative flex size-2 shrink-0" aria-hidden>
        {sum.open.length > 0 && <span className="absolute inline-flex size-full animate-ping rounded-full bg-profit opacity-60" />}
        <span className={cn("relative inline-flex size-2 rounded-full", sum.open.length ? "bg-profit" : "bg-muted-foreground/50")} />
      </span>
      <span className="truncate">{sum.open.length ? sum.open.map((s) => s.flag).join(" ") : "—"}</span>
      <span className="truncate max-2xl:hidden">{sum.open.map((s) => s.name).join(" + ") || "Between sessions"}</span>
      {first && <span className="font-mono tabular">{cd(first.msToChange)}</span>}
      {sum.nextOpen && (
        <span className="hidden items-center gap-1 text-muted-foreground 2xl:inline-flex">
          · {sum.nextOpen.flag} <span className="font-mono tabular">{cd(sum.nextOpen.msToChange)}</span>
        </span>
      )}
    </>
  );
}

/** Header pill (tablet and desktop): open sessions and time left; tap for all countdowns. */
export function SessionPill({ timezone }: { timezone: string }) {
  const now = useNow();
  const [open, setOpen] = useState(false);
  if (now == null) return null;
  const sum = clockSummary(now);
  return (
    <ResponsivePopover
      open={open}
      onOpenChange={setOpen}
      title="Market sessions"
      align="end"
      className="w-80 p-0"
      trigger={
        <button
          type="button"
          aria-label="Market sessions"
          className="hidden h-9 shrink-0 items-center gap-1.5 rounded-lg border bg-card px-2.5 text-[13px] font-medium shadow-xs transition hover:bg-accent lg:inline-flex"
        >
          <Label now={now} />
        </button>
      }
    >
      <SessionList status={sum.status} timezone={timezone} />
      <Overlap now={now} />
      <Link href="/sessions" onClick={() => setOpen(false)} className="flex items-center justify-between border-t px-4 py-3 text-sm font-medium hover:bg-accent">
        Sessions & your performance <ChevronRight className="size-4" />
      </Link>
    </ResponsivePopover>
  );
}

function Overlap({ now }: { now: number }) {
  const o = clockSummary(now).overlaps[0];
  if (!o) return null;
  return (
    <p className="mx-3 mb-3 rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning-ink">
      <strong>{o.name} overlap</strong> for {cd(o.end - now)} — {o.note}
    </p>
  );
}

/** Slim bar under the header on phones, where the header has no room left. */
export function SessionBar({ timezone }: { timezone: string }) {
  const now = useNow();
  const [open, setOpen] = useState(false);
  if (now == null) return <div className="h-8 lg:hidden" />;
  const sum = clockSummary(now);
  const first = sum.open[0];
  return (
    <ResponsivePopover
      open={open}
      onOpenChange={setOpen}
      title="Market sessions"
      trigger={
        <button
          type="button"
          className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-30 flex h-8 w-full items-center gap-2 border-b bg-background/85 px-4 text-xs backdrop-blur-xl lg:hidden print:hidden"
        >
          <Clock className="size-3.5 shrink-0 text-muted-foreground" />
          {first ? (
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="size-1.5 shrink-0 rounded-full bg-profit" aria-hidden />
              <span className="truncate font-medium">
                {sum.open.map((s) => `${s.flag} ${s.name}`).join(" + ")}
              </span>
              <span className="shrink-0 text-muted-foreground">closes</span>
              <span className="shrink-0 font-mono font-semibold tabular text-profit">{cd(first.msToChange)}</span>
            </span>
          ) : (
            <span className="truncate text-muted-foreground">{sum.weekOpen ? "Between sessions" : "Market closed for the weekend"}</span>
          )}
          {sum.nextOpen && (
            <span className="ml-auto flex shrink-0 items-center gap-1 text-muted-foreground">
              {sum.nextOpen.flag}
              <span className="font-mono tabular">{cd(sum.nextOpen.msToChange)}</span>
            </span>
          )}
          <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
        </button>
      }
    >
      <SessionList status={sum.status} timezone={timezone} />
      <Overlap now={now} />
      <Link href="/sessions" onClick={() => setOpen(false)} className="flex items-center justify-between border-t px-5 py-3.5 text-sm font-medium">
        Sessions & your performance <ChevronRight className="size-4" />
      </Link>
    </ResponsivePopover>
  );
}

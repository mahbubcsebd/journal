"use client";

import { useEffect, useState } from "react";
import { formatDuration } from "@/lib/mindset";
import { cn } from "@/lib/utils";

/**
 * How long a position has been open, against the trader's own averages:
 * patience while it's inside the usual winner window, a nudge once it's past it.
 */
export function HoldTimer({ openTime, avgWinSec, avgLossSec }: { openTime: string; avgWinSec: number | null; avgLossSec: number | null }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);
  if (now == null) return <span className="text-muted-foreground">—</span>;
  const held = Math.max(0, (now - new Date(openTime).getTime()) / 1000);
  const ratio = avgWinSec ? held / avgWinSec : null;
  const hint =
    ratio == null
      ? null
      : ratio < 1
        ? "inside your usual winner time"
        : ratio < 1.5
          ? "about your usual winner time"
          : avgLossSec && held > avgLossSec
            ? "longer than your average winner and loser"
            : "past your usual winner time";
  return (
    <span className="inline-grid justify-items-end gap-1" title={hint ?? undefined}>
      <span className="font-mono tabular">{formatDuration(held)}</span>
      {ratio != null && (
        <span className="h-1 w-16 overflow-hidden rounded-full bg-muted" aria-label={hint ?? undefined}>
          <span
            className={cn("block h-full rounded-full", ratio < 1 ? "bg-brand" : ratio < 1.5 ? "bg-warning" : "bg-loss")}
            style={{ width: `${Math.min(100, ratio * 100)}%` }}
          />
        </span>
      )}
    </span>
  );
}

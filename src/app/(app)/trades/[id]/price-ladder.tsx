"use client";

import { motion } from "motion/react";
import { Card } from "@/components/ui/card";
import { cn, formatPrice } from "@/lib/utils";

type Props = { side: "LONG" | "SHORT"; entry: number; exit: number | null; sl: number | null; tp: number | null };

/** Horizontal map of stop, entry, target and exit so the trade's shape is readable at a glance. */
export function PriceLadder({ side, entry, exit, sl, tp }: Props) {
  const levels = [
    sl != null && { key: "SL", price: sl, tone: "loss" },
    { key: "Entry", price: entry, tone: "neutral" },
    tp != null && { key: "TP", price: tp, tone: "profit" },
    exit != null && { key: "Exit", price: exit, tone: "exit" },
  ].filter(Boolean) as { key: string; price: number; tone: string }[];

  if (levels.length < 2) {
    return (
      <Card className="p-5 text-sm text-muted-foreground">
        Add a stop loss to see the trade&apos;s risk map and R-multiple.
      </Card>
    );
  }

  const prices = levels.map((l) => l.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const pad = (max - min) * 0.08 || 1;
  // Longs read left (low) → right (high); shorts are mirrored so profit is always to the right.
  const pos = (p: number) => {
    const x = (p - (min - pad)) / (max - min + 2 * pad);
    return (side === "LONG" ? x : 1 - x) * 100;
  };
  const won = exit != null && (side === "LONG" ? exit > entry : exit < entry);

  return (
    <Card className="p-5">
      <p className="text-sm font-semibold">Risk map</p>
      <p className="text-[13px] text-muted-foreground">Profit direction is always to the right.</p>
      <div className="relative mt-10 mb-12 h-2 rounded-full bg-muted">
        {sl != null && (
          <div
            className="absolute inset-y-0 rounded-full bg-loss/30"
            style={{ left: `${Math.min(pos(sl), pos(entry))}%`, width: `${Math.abs(pos(entry) - pos(sl))}%` }}
          />
        )}
        {tp != null && (
          <div
            className="absolute inset-y-0 rounded-full bg-profit/30"
            style={{ left: `${Math.min(pos(tp), pos(entry))}%`, width: `${Math.abs(pos(tp) - pos(entry))}%` }}
          />
        )}
        {exit != null && (
          <motion.div
            className={cn("absolute inset-y-0 rounded-full", won ? "bg-profit" : "bg-loss")}
            initial={{ width: 0 }}
            animate={{ width: `${Math.abs(pos(exit) - pos(entry))}%` }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
            style={{ left: `${Math.min(pos(exit), pos(entry))}%` }}
          />
        )}
        {levels.map((l, i) => (
          <motion.div
            key={l.key}
            className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${pos(l.price)}%` }}
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 + i * 0.08 }}
          >
            <span
              className={cn(
                "block size-3.5 rounded-full border-2 border-card",
                l.tone === "loss" && "bg-loss",
                l.tone === "profit" && "bg-profit",
                l.tone === "neutral" && "bg-foreground",
                l.tone === "exit" && (won ? "bg-profit" : "bg-loss"),
              )}
            />
            <span
              className={cn(
                "absolute left-1/2 -translate-x-1/2 text-center whitespace-nowrap",
                i % 2 === 0 ? "top-5" : "bottom-5",
              )}
            >
              <span className="block text-[11px] font-medium text-muted-foreground">{l.key}</span>
              <span className="block font-mono text-xs tabular">{formatPrice(l.price)}</span>
            </span>
          </motion.div>
        ))}
      </div>
    </Card>
  );
}

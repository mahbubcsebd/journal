"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/utils";

// Illustrative sample month for the sign-in page (not real data).
const SAMPLE = [
  null, 120, -45, 210, 80, null, null,
  -130, 95, 60, -20, 310, null, null,
  40, -75, 180, 150, -60, null, null,
  220, 35, -110, 90, 260, null, null,
  -30, 140, 70,
];

export function CalendarPreview() {
  const max = Math.max(...SAMPLE.map((v) => Math.abs(v ?? 0)));
  const total = SAMPLE.reduce<number>((s, v) => s + (v ?? 0), 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="w-full max-w-md rounded-2xl border bg-card/80 p-5 shadow-pop backdrop-blur"
    >
      <div className="mb-4 flex items-end justify-between">
        <div>
          <p className="text-xs text-muted-foreground">Sample month</p>
          <p className="text-sm font-semibold">Profit &amp; loss calendar</p>
        </div>
        <p className="font-mono text-lg font-semibold text-profit tabular">+${total.toLocaleString()}</p>
      </div>
      <div className="grid grid-cols-7 gap-1.5 text-[10px] text-muted-foreground">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <div key={i} className="pb-1 text-center">{d}</div>
        ))}
        {SAMPLE.map((v, i) => {
          const intensity = v ? 0.25 + (Math.abs(v) / max) * 0.75 : 0;
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.25 + i * 0.018, type: "spring", stiffness: 380, damping: 26 }}
              className={cn(
                "flex aspect-square flex-col justify-between rounded-lg border p-1.5",
                v == null && "border-dashed bg-transparent",
              )}
              style={
                v
                  ? {
                      background: `color-mix(in oklch, var(${v > 0 ? "--profit" : "--loss"}) ${Math.round(intensity * 32)}%, var(--card))`,
                      borderColor: `color-mix(in oklch, var(${v > 0 ? "--profit" : "--loss"}) ${Math.round(intensity * 45)}%, transparent)`,
                    }
                  : undefined
              }
            >
              <span className="tabular">{i + 1}</span>
              {v != null && (
                <span className={cn("self-end font-mono text-[9px] font-semibold tabular", v > 0 ? "text-profit" : "text-loss")}>
                  {v > 0 ? "+" : ""}
                  {v}
                </span>
              )}
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}

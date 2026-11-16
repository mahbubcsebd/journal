"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { ANALYTICS_TABS, type AnalyticsTab } from "./tabs";

/** Tabs that keep the range, filters and P&L measure when switching. */
export function AnalyticsTabs({ active }: { active: AnalyticsTab }) {
  const sp = useSearchParams();
  return (
    <nav className="-mx-1 flex gap-1 overflow-x-auto border-b px-1">
      {ANALYTICS_TABS.map((t) => {
        const q = new URLSearchParams(sp.toString());
        if (t.key === "overview") q.delete("tab");
        else q.set("tab", t.key);
        // Time-only options don't carry over.
        if (t.key !== "time") {
          q.delete("by");
          q.delete("interval");
        }
        const qs = q.toString();
        return (
          <Link
            key={t.key}
            href={qs ? `/analytics?${qs}` : "/analytics"}
            scroll={false}
            className={cn(
              "relative px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors",
              active === t.key ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
            {active === t.key && (
              <motion.span
                layoutId="analytics-tab"
                className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand"
                transition={{ type: "spring", stiffness: 500, damping: 38 }}
              />
            )}
          </Link>
        );
      })}
    </nav>
  );
}

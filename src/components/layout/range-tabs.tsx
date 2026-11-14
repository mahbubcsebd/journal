"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { RANGES, type RangeKey } from "@/lib/ranges";
import { cn } from "@/lib/utils";

/** Segmented 7D…All picker that keeps the page's other query params. */
export function RangeTabs({
  active,
  basePath,
  params = {},
  fallback = "30d",
}: {
  active: RangeKey;
  basePath: string;
  params?: Record<string, string>;
  fallback?: RangeKey;
}) {
  return (
    <div className="inline-flex h-9 items-center rounded-lg border bg-card p-0.5">
      {RANGES.map((r) => {
        const q = new URLSearchParams(params);
        if (r.key !== fallback) q.set("range", r.key);
        const qs = q.toString();
        return (
          <Link
            key={r.key}
            href={qs ? `${basePath}?${qs}` : basePath}
            scroll={false}
            className={cn(
              "relative h-full rounded-md px-2.5 text-[13px] leading-8 font-medium transition-colors",
              active === r.key ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {active === r.key && (
              <motion.span
                layoutId={`range-${basePath}`}
                className="absolute inset-0 rounded-md bg-secondary shadow-xs"
                transition={{ type: "spring", stiffness: 500, damping: 38 }}
              />
            )}
            <span className="relative">{r.label}</span>
          </Link>
        );
      })}
    </div>
  );
}

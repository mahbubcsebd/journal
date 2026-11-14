"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { RANGES, type RangeKey } from "./ranges";

export function RangeTabs({ active }: { active: RangeKey }) {
  return (
    <div className="inline-flex h-9 items-center rounded-lg border bg-card p-0.5">
      {RANGES.map((r) => (
        <Link
          key={r.key}
          href={r.key === "30d" ? "/dashboard" : `/dashboard?range=${r.key}`}
          scroll={false}
          className={cn(
            "relative h-full rounded-md px-2.5 text-[13px] leading-8 font-medium transition-colors",
            active === r.key ? "text-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {active === r.key && (
            <motion.span
              layoutId="dashboard-range"
              className="absolute inset-0 rounded-md bg-secondary shadow-xs"
              transition={{ type: "spring", stiffness: 500, damping: 38 }}
            />
          )}
          <span className="relative">{r.label}</span>
        </Link>
      ))}
    </div>
  );
}

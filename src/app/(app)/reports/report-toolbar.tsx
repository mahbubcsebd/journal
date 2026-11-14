"use client";

import { motion } from "motion/react";
import { ChevronLeft, ChevronRight, Download, Printer, Share2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PERIODS, type Period } from "@/lib/periods";
import { cn } from "@/lib/utils";
import { ShareDialog } from "./share-dialog";

type Props = {
  period: Period;
  label: string;
  prevAnchor: string;
  nextAnchor: string;
  today: string;
  from: string;
  to: string;
  query: string;
};

export function ReportToolbar({ period, label, prevAnchor, nextAnchor, today, from, to, query }: Props) {
  const router = useRouter();
  const href = (p: Period, d: string) => `/reports?period=${p}&d=${d}`;
  return (
    <div className="flex flex-wrap items-center gap-3 print:hidden">
      <div className="inline-flex h-9 items-center rounded-lg border bg-card p-0.5">
        {PERIODS.map((p) => (
          <Link
            key={p}
            href={p === "custom" ? `/reports?period=custom&from=${from}&to=${to}` : href(p, today)}
            scroll={false}
            className={cn(
              "relative h-full rounded-md px-3 text-[13px] leading-8 font-medium capitalize transition-colors",
              period === p ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {period === p && (
              <motion.span layoutId="report-period" className="absolute inset-0 rounded-md bg-secondary shadow-xs" transition={{ type: "spring", stiffness: 500, damping: 38 }} />
            )}
            <span className="relative">{p}</span>
          </Link>
        ))}
      </div>

      {period === "custom" ? (
        <div className="flex items-center gap-1.5">
          <Input
            type="date"
            aria-label="From"
            value={from}
            onChange={(e) => e.target.value && router.replace(`/reports?period=custom&from=${e.target.value}&to=${to}`, { scroll: false })}
            className="h-9 w-[150px]"
          />
          <span className="text-muted-foreground">–</span>
          <Input
            type="date"
            aria-label="To"
            value={to}
            onChange={(e) => e.target.value && router.replace(`/reports?period=custom&from=${from}&to=${e.target.value}`, { scroll: false })}
            className="h-9 w-[150px]"
          />
        </div>
      ) : (
        <div className="flex items-center gap-1">
          <Button asChild variant="outline" size="icon" aria-label="Previous period">
            <Link href={href(period, prevAnchor)} scroll={false}>
              <ChevronLeft />
            </Link>
          </Button>
          <Button asChild variant="outline" size="icon" aria-label="Next period">
            <Link href={href(period, nextAnchor)} scroll={false}>
              <ChevronRight />
            </Link>
          </Button>
          <span className="ml-2 text-sm font-semibold">{label}</span>
        </div>
      )}

      <div className="flex-1" />
      <div className="flex items-center gap-2">
        <Button asChild variant="outline" size="sm">
          <a href={`/api/trades/export?from=${from}&to=${to}`}>
            <Download /> CSV
          </a>
        </Button>
        <Button variant="outline" size="sm" onClick={() => window.print()}>
          <Printer /> PDF
        </Button>
        <ShareDialog query={query} label={label}>
          <Button size="sm">
            <Share2 /> Share card
          </Button>
        </ShareDialog>
      </div>
    </div>
  );
}
